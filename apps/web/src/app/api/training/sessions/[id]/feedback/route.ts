import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { generateFeedback } from "@/lib/llm";
import { getCommunication } from "@/lib/wonderful";
import type { TranscriptEntry } from "@repo/shared";

const FeedbackSchema = z.object({
  transcript: z.array(
    z.object({
      role: z.enum(["agent", "customer"]),
      content: z.string(),
      timestamp: z.number().optional(),
    })
  ).optional(),
  scenarioName: z.string().min(1).optional(),
  difficultyName: z.string().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch session with scenario + difficulty info
    const { data: session, error: sessionErr } = await supabase
      .from("training_sessions")
      .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", id)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "Session not found", details: sessionErr?.message ?? null },
        { status: 404 }
      );
    }

    let transcript: TranscriptEntry[] = parsed.data.transcript ?? [];
    const scenarioName = parsed.data.scenarioName ?? session.scenario?.name ?? "Unknown";
    const difficultyName = parsed.data.difficultyName ?? session.difficulty_level?.name ?? "Default";

    // If no transcript provided, try to get it from the communication
    if (transcript.length === 0 && session.communication_id) {
      console.log("[feedback] Session has communication_id:", session.communication_id);

      const { data: agentConfig } = await supabase
        .from("agent_config")
        .select("config")
        .limit(1)
        .single();

      const wonderful = agentConfig?.config?.wonderful as
        | { api_key?: string; tenant_url?: string }
        | undefined;

      console.log("[feedback] Wonderful config present:", !!wonderful?.api_key, !!wonderful?.tenant_url);

      if (wonderful?.api_key && wonderful?.tenant_url) {
        try {
          const commData = await getCommunication(session.communication_id, wonderful);
          console.log("[feedback] Communication response keys:", Object.keys(commData));

          // Wonderful API wraps response in { data: { ... }, status: 200 }
          const inner = (commData as { data?: Record<string, unknown> }).data ?? commData;
          console.log("[feedback] Inner data keys:", Object.keys(inner));

          const transcriptions = (inner as { transcriptions?: { speaker?: string; text?: string; start_time?: number }[] }).transcriptions;
          console.log("[feedback] Transcriptions count:", transcriptions?.length ?? "undefined");

          if (Array.isArray(transcriptions)) {
            transcript = transcriptions
              .filter((t) => t.speaker === "agent" || t.speaker === "customer")
              .map((t) => ({
                role: (t.speaker === "agent" ? "agent" : "customer") as "agent" | "customer",
                content: t.text ?? "",
                timestamp: t.start_time,
              }));
            console.log("[feedback] Filtered transcript entries:", transcript.length);
          }

          // Store duration from communication (ms -> seconds)
          const durationMs = (inner as { duration?: number }).duration;
          if (typeof durationMs === "number" && !session.call_duration) {
            await supabase
              .from("training_sessions")
              .update({ call_duration: Math.round(durationMs / 1000) })
              .eq("id", id);
          }
        } catch (err) {
          console.error("[feedback] Failed to fetch communication:", err);
        }
      }
    } else {
      console.log("[feedback] Skipped communication fetch — transcript provided:", transcript.length, "communication_id:", session.communication_id);
    }

    if (transcript.length === 0) {
      console.log("[feedback] No transcript available after all attempts");
      return NextResponse.json(
        { error: "No transcript available. Provide a transcript or ensure the session has a communication_id." },
        { status: 400 }
      );
    }

    const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
    const feedback = await generateFeedback(transcript, scenarioName, difficultyName, scenarioPrompt);

    const { data, error } = await supabase
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
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update assignment status to completed if applicable
    if (data.assignment_id) {
      await supabase
        .from("assignments")
        .update({ status: "completed" })
        .eq("id", data.assignment_id);
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
