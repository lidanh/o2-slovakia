import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { formatPhoneNumber } from "@/lib/twilio";
import { getAgentPhoneNumber, makeOutboundCall } from "@/lib/wonderful";
import { MAX_BULK_CALL_SIZE } from "@repo/shared";

const BulkCallSchema = z.object({
  scenarioId: z.string().uuid(),
  difficultyLevelId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BulkCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { scenarioId, difficultyLevelId } = parsed.data;

    // Fetch pending assignments for this scenario + difficulty (include scenario and difficulty_level)
    const { data: assignments, error: aError } = await supabase
      .from("assignments")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("scenario_id", scenarioId)
      .eq("difficulty_level_id", difficultyLevelId)
      .eq("status", "pending")
      .limit(MAX_BULK_CALL_SIZE);

    if (aError) return NextResponse.json({ error: aError.message }, { status: 500 });
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ error: "No pending assignments found" }, { status: 404 });
    }

    // Read agent config from DB to get wonderful tenant_url
    const { data: agentConfig, error: cfgError } = await supabase
      .from("agent_config")
      .select("config")
      .limit(1)
      .single();

    if (cfgError || !agentConfig) {
      return NextResponse.json({ error: "Agent config not found" }, { status: 500 });
    }

    const wonderful = agentConfig.config.wonderful as { agent_id: string; tenant_url: string; api_key?: string } | undefined;
    if (!wonderful?.tenant_url) {
      return NextResponse.json({ error: "Wonderful tenant_url not configured" }, { status: 500 });
    }

    // Use scenario-level agent_id if available, otherwise fall back to global config
    const firstAssignment = assignments[0];
    const effectiveAgentId = firstAssignment?.scenario?.agent_id ?? wonderful.agent_id;
    if (!effectiveAgentId) {
      return NextResponse.json({ error: "No agent_id configured for scenario or global config" }, { status: 500 });
    }

    // Fetch the agent's active phone number from Wonderful API (required)
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

    // Build call purpose from first assignment's scenario and difficulty level
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

        await supabase
          .from("assignments")
          .update({ status: "in_progress" })
          .eq("id", assignment.id);

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
