import { createServiceClient } from "@/lib/supabase/service";
import { generateFeedback, type FeedbackResult } from "@/lib/llm";
import { getCommunication } from "@/lib/wonderful";
import type { TranscriptEntry } from "@repo/shared";

export interface GenerateSessionFeedbackResult {
  alreadyExists?: boolean;
  success: boolean;
  feedback: FeedbackResult | null;
  session: Record<string, unknown>;
}

/**
 * Shared feedback generation logic: fetches transcript from Wonderful,
 * generates LLM feedback, and persists everything to the session.
 */
export async function generateSessionFeedback(
  sessionId: string
): Promise<GenerateSessionFeedbackResult> {
  const supabase = createServiceClient();

  // 1. Fetch session with scenario + difficulty info
  const { data: session, error: sessionErr } = await supabase
    .from("training_sessions")
    .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    throw new Error(`Session not found: ${sessionErr?.message ?? "no data"}`);
  }

  // 2. If feedback already exists, return early
  if (session.score != null) {
    return { alreadyExists: true, success: true, feedback: null, session };
  }

  // 3. Fetch Wonderful config from agent_config table
  const { data: agentConfig } = await supabase
    .from("agent_config")
    .select("config")
    .limit(1)
    .single();

  const wonderful = agentConfig?.config?.wonderful as
    | { api_key?: string; tenant_url?: string }
    | undefined;

  // 4. Fetch transcript from Wonderful
  let transcript: TranscriptEntry[] = [];
  let callDuration: number | null = null;

  if (session.communication_id && wonderful?.api_key && wonderful?.tenant_url) {
    try {
      const commData = await getCommunication(session.communication_id, wonderful);
      // Wonderful API wraps response in { data: { ... }, status: 200 }
      const inner = (commData as { data?: Record<string, unknown> }).data ?? commData;
      const transcriptions = (inner as { transcriptions?: { speaker?: string; text?: string; start_time?: number }[] }).transcriptions;

      if (Array.isArray(transcriptions)) {
        transcript = transcriptions
          .filter((t) => t.speaker === "agent" || t.speaker === "customer")
          .map((t) => ({
            role: (t.speaker === "agent" ? "agent" : "customer") as "agent" | "customer",
            content: t.text ?? "",
            timestamp: t.start_time,
          }));
      }

      if (typeof (inner as { duration?: number }).duration === "number") {
        callDuration = Math.round(((inner as { duration?: number }).duration!) / 1000);
      }
    } catch (err) {
      console.error("[feedback] Failed to fetch communication from Wonderful:", err);
    }
  }

  if (transcript.length === 0) {
    throw new Error("No transcript available. Ensure the session has a valid communication_id.");
  }

  // 5. Update call_duration if not already set
  if (callDuration !== null && !session.call_duration) {
    await supabase
      .from("training_sessions")
      .update({ call_duration: callDuration })
      .eq("id", sessionId);
  }

  // 6. Generate feedback via LLM
  const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
  const feedback = await generateFeedback(
    transcript,
    session.scenario?.name ?? "Unknown",
    session.difficulty_level?.name ?? "Default",
    scenarioPrompt
  );

  // 7. Update session with feedback fields + transcript
  await supabase
    .from("training_sessions")
    .update({
      score: feedback.score,
      star_rating: feedback.star_rating,
      feedback_summary: feedback.feedback_summary,
      feedback_breakdown: feedback.feedback_breakdown,
      suggestions: feedback.suggestions,
      highlights: feedback.highlights,
      transcript,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  // 8. Mark assignment as completed if applicable
  if (session.assignment_id) {
    await supabase
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", session.assignment_id);
  }

  // 9. Return result
  return { success: true, feedback, session };
}
