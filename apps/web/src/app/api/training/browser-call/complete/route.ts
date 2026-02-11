import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyBrowserCallToken } from "@/lib/jwt";
import { generateFeedback } from "@/lib/llm";
import { getCommunication } from "@/lib/wonderful";

const CompleteSchema = z.object({
  token: z.string(),
  communicationId: z.string(),
  transcript: z.array(z.object({
    role: z.enum(["agent", "customer"]),
    content: z.string(),
    timestamp: z.number().optional(),
  })).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = CompleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { token, communicationId } = parsed.data;

    let payload;
    try {
      payload = await verifyBrowserCallToken(token);
    } catch (jwtErr) {
      return NextResponse.json(
        { error: "Invalid or expired token", details: (jwtErr as Error).message },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Fetch session with scenario + difficulty info
    const { data: session, error: sessionErr } = await supabase
      .from("training_sessions")
      .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", payload.sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "Session not found", details: sessionErr?.message ?? null },
        { status: 404 }
      );
    }

    // If client didn't send transcript, fetch from Wonderful v2 API
    let transcript = parsed.data.transcript ?? [];
    let callDuration: number | null = null;

    if (transcript.length === 0 && communicationId) {
      const { data: agentConfig } = await supabase
        .from("agent_config")
        .select("config")
        .limit(1)
        .single();

      const wonderful = agentConfig?.config?.wonderful as
        | { api_key?: string; tenant_url?: string }
        | undefined;

      if (wonderful?.api_key && wonderful?.tenant_url) {
        try {
          const commData = await getCommunication(communicationId, wonderful);
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
          console.error("Failed to fetch communication from Wonderful:", err);
        }
      }
    }

    // Update session with transcript and mark completed
    const sessionUpdate: Record<string, unknown> = {
      status: "completed",
      communication_id: communicationId,
      transcript,
      completed_at: new Date().toISOString(),
      otp_expires_at: new Date().toISOString(), // invalidate OTP
    };
    if (callDuration !== null) {
      sessionUpdate.call_duration = callDuration;
    }

    const { error: updateErr } = await supabase
      .from("training_sessions")
      .update(sessionUpdate)
      .eq("id", payload.sessionId);

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update session", details: updateErr.message },
        { status: 500 }
      );
    }

    // Generate feedback (if transcript has content)
    let feedbackResult = null;
    if (transcript.length > 0) {
      try {
        const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
        feedbackResult = await generateFeedback(
          transcript,
          session.scenario?.name ?? "Unknown",
          session.difficulty_level?.name ?? "Default",
          scenarioPrompt
        );

        await supabase
          .from("training_sessions")
          .update({
            score: feedbackResult.score,
            star_rating: feedbackResult.star_rating,
            feedback_summary: feedbackResult.feedback_summary,
            feedback_breakdown: feedbackResult.feedback_breakdown,
            suggestions: feedbackResult.suggestions,
            highlights: feedbackResult.highlights,
          })
          .eq("id", payload.sessionId);
      } catch (fbErr) {
        // Feedback generation is non-critical -- session is still marked complete
        console.error("Feedback generation failed:", (fbErr as Error).message);
      }
    }

    // Update assignment status
    if (session.assignment_id) {
      const { error: assignErr } = await supabase
        .from("assignments")
        .update({ status: "completed" })
        .eq("id", session.assignment_id);

      if (assignErr) {
        console.error("Failed to update assignment status:", assignErr.message);
        // Non-critical: session is already completed
      }
    }

    return NextResponse.json({
      success: true,
      score: feedbackResult?.score ?? null,
      star_rating: feedbackResult?.star_rating ?? null,
      feedback_summary: feedbackResult?.feedback_summary ?? null,
      feedback_breakdown: feedbackResult?.feedback_breakdown ?? null,
      suggestions: feedbackResult?.suggestions ?? null,
      highlights: feedbackResult?.highlights ?? null,
    });
  } catch (err) {
    console.error("POST /api/training/browser-call/complete error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
