import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPhoneNumber } from "@/lib/twilio";
import { getAgentPhoneNumber, makeOutboundCall } from "@/lib/wonderful";
import { MAX_BULK_CALL_SIZE } from "@repo/shared";
import { getAuthUser } from "@/lib/auth/authorize";

const BulkCallSchema = z.object({
  scenarioId: z.string().uuid(),
  difficultyLevelId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = BulkCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { scenarioId, difficultyLevelId } = parsed.data;
    const tenantId = auth.user.tenantId;

    // Fetch all assignments for this scenario/difficulty, then filter out completed ones
    const { data: allAssignments, error: aError } = await supabase
      .from("assignments")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("tenant_id", tenantId)
      .eq("scenario_id", scenarioId)
      .eq("difficulty_level_id", difficultyLevelId);

    if (aError) return NextResponse.json({ error: aError.message }, { status: 500 });
    if (!allAssignments || allAssignments.length === 0) {
      return NextResponse.json({ error: "No pending assignments found" }, { status: 404 });
    }

    // Find assignments whose latest session is completed — exclude them
    const assignmentIds = allAssignments.map((a) => a.id);
    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("assignment_id, status")
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false });

    const completedAssignmentIds = new Set<string>();
    const seen = new Set<string>();
    for (const s of sessions ?? []) {
      if (s.assignment_id && !seen.has(s.assignment_id)) {
        seen.add(s.assignment_id);
        if (s.status === "completed") {
          completedAssignmentIds.add(s.assignment_id);
        }
      }
    }

    const assignments = allAssignments
      .filter((a) => !completedAssignmentIds.has(a.id))
      .slice(0, MAX_BULK_CALL_SIZE);

    if (assignments.length === 0) {
      return NextResponse.json({ error: "No pending assignments found" }, { status: 404 });
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

    const firstAssignment = assignments[0];
    const effectiveAgentId = firstAssignment?.scenario?.agent_id ?? wonderful.agent_id;
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

    const callPurpose = `${firstAssignment.scenario.name} - ${firstAssignment.difficulty_level.name}`;

    const results: { assignmentId: string; sessionId: string; callId: string | null }[] = [];
    const errors: { assignmentId: string; error: string }[] = [];

    for (const assignment of assignments) {
      try {
        const { data: session, error: sError } = await supabase
          .from("training_sessions")
          .insert({
            user_id: assignment.user_id,
            scenario_id: assignment.scenario_id,
            difficulty_level_id: assignment.difficulty_level_id,
            assignment_id: assignment.id,
            status: "initiated",
            tenant_id: tenantId,
          })
          .select()
          .single();

        if (sError || !session) {
          errors.push({ assignmentId: assignment.id, error: sError?.message ?? "Failed to create session" });
          continue;
        }

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

        results.push({ assignmentId: assignment.id, sessionId: session.id, callId });
      } catch (err) {
        errors.push({ assignmentId: assignment.id, error: (err as Error).message });
      }
    }

    return NextResponse.json({ results, errors }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
