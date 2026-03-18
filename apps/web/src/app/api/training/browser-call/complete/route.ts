import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyBrowserCallToken } from "@/lib/jwt";
import { generateFeedback } from "@/lib/llm";
import { getCommunication } from "@/lib/wonderful";
import { translateFeedback } from "@/lib/evaluation/translate";
import { sendFeedbackEmailAsync } from "@/lib/feedback";
import type { FeedbackTranslations } from "@repo/shared";

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
      // Get tenant settings for Wonderful config
      const { data: tenant } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", session.tenant_id)
        .single();

      const wonderful = (tenant?.settings as Record<string, unknown>)?.wonderful as
        | { api_key?: string; tenant_url?: string }
        | undefined;

      if (wonderful?.api_key && wonderful?.tenant_url) {
        try {
          const commData = await getCommunication(communicationId, wonderful);
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
      otp_expires_at: new Date().toISOString(),
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

    // Generate feedback
    let feedbackResult = null;
    let feedbackTranslations: FeedbackTranslations | null = null;
    if (transcript.length > 0) {
      try {
        const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
        const scenarioType = (session.scenario?.type ?? "frontline") as "frontline" | "leadership";
        feedbackResult = await generateFeedback(
          transcript,
          session.scenario?.name ?? "Unknown",
          session.difficulty_level?.name ?? "Default",
          scenarioType,
          scenarioPrompt
        );

        const [skResult, huResult] = await Promise.allSettled([
          translateFeedback(feedbackResult, "sk"),
          translateFeedback(feedbackResult, "hu"),
        ]);
        const translations: FeedbackTranslations = {};
        if (skResult.status === "fulfilled") translations.sk = skResult.value;
        if (huResult.status === "fulfilled") translations.hu = huResult.value;
        feedbackTranslations = Object.keys(translations).length > 0 ? translations : null;

        await supabase
          .from("training_sessions")
          .update({
            score: feedbackResult.score,
            star_rating: feedbackResult.star_rating,
            feedback_summary: feedbackResult.feedback_summary,
            feedback_breakdown: feedbackResult.feedback_breakdown,
            suggestions: feedbackResult.suggestions,
            highlights: feedbackResult.highlights,
            feedback_translations: feedbackTranslations,
          })
          .eq("id", payload.sessionId);
        // Send feedback email (async, non-blocking)
        sendFeedbackEmailAsync(payload.sessionId, feedbackResult).catch((err) =>
          console.error("[feedback] Failed to send feedback email:", err)
        );
      } catch (fbErr) {
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
      feedback_translations: feedbackTranslations,
    });
  } catch (err) {
    console.error("POST /api/training/browser-call/complete error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
