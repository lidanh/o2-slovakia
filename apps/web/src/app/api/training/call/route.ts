import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPhoneNumber } from "@/lib/twilio";
import { getAgentPhoneNumber, makeOutboundCall } from "@/lib/wonderful";
import { getAuthUser } from "@/lib/auth/authorize";

const TriggerCallSchema = z.object({
  assignmentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = TriggerCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { assignmentId } = parsed.data;
    const tenantId = auth.user.tenantId;

    // Fetch assignment with user, scenario, and difficulty_level
    const { data: assignment, error: aError } = await supabase
      .from("assignments")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", assignmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (aError || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (!assignment.scenario?.is_active) {
      return NextResponse.json({ error: "Scenario is currently inactive" }, { status: 400 });
    }

    // Read tenant settings for Wonderful config
    const { data: tenant, error: cfgError } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    if (cfgError || !tenant) {
      return NextResponse.json({ error: "Tenant settings not found" }, { status: 500 });
    }

    const wonderful = (tenant.settings as Record<string, unknown>).wonderful as { agent_id: string; tenant_url: string; api_key?: string } | undefined;
    if (!wonderful?.tenant_url) {
      return NextResponse.json({ error: "Wonderful tenant_url not configured" }, { status: 500 });
    }

    const effectiveAgentId = assignment.scenario?.agent_id ?? wonderful.agent_id;
    if (!effectiveAgentId) {
      return NextResponse.json({ error: "No agent_id configured for scenario or global config" }, { status: 500 });
    }

    if (!wonderful.api_key) {
      return NextResponse.json({ error: "Wonderful api_key not configured" }, { status: 500 });
    }

    const agentFromNumber = await getAgentPhoneNumber(effectiveAgentId, {
      tenant_url: wonderful.tenant_url,
      api_key: wonderful.api_key,
    });

    if (!agentFromNumber) {
      return NextResponse.json({ error: "No active phone number found for agent" }, { status: 500 });
    }

    const callPurpose = `${assignment.scenario.name} - ${assignment.difficulty_level.name}`;

    // Create training session with tenant_id
    const { data: session, error: sError } = await supabase
      .from("training_sessions")
      .insert({
        user_id: assignment.user_id,
        scenario_id: assignment.scenario_id,
        difficulty_level_id: assignment.difficulty_level_id,
        assignment_id: assignmentId,
        status: "initiated",
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });

    const callResponse = await makeOutboundCall(
      {
        callPurpose,
        from: agentFromNumber,
        to: formatPhoneNumber(assignment.user.phone),
      },
      { tenant_url: wonderful.tenant_url, api_key: wonderful.api_key }
    );

    const callId = (callResponse.communication_id ?? callResponse.id ?? null) as string | null;

    if (callId) {
      await supabase
        .from("training_sessions")
        .update({ call_sid: callId })
        .eq("id", session.id);
    }

    return NextResponse.json({ sessionId: session.id, callId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
