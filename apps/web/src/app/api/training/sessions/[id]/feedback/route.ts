import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { generateFeedback } from "@/lib/llm";
import { generateSessionFeedback, sendFeedbackEmailAsync } from "@/lib/feedback";
import { translateFeedback } from "@/lib/evaluation/translate";
import { getAuthUser } from "@/lib/auth/authorize";
import type { TranscriptEntry, FeedbackTranslations } from "@repo/shared";

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
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const { id } = await params;
    const tenantId = auth.user.tenantId;
    const body = await request.json().catch(() => ({}));
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const transcript: TranscriptEntry[] = parsed.data.transcript ?? [];

    // If no transcript provided, delegate to shared feedback generation
    if (transcript.length === 0) {
      try {
        const result = await generateSessionFeedback(id);
        if (result.alreadyExists) {
          return NextResponse.json(result.session);
        }
        return NextResponse.json({
          success: true,
          score: result.feedback?.score ?? null,
          star_rating: result.feedback?.star_rating ?? null,
          feedback_summary: result.feedback?.feedback_summary ?? null,
          feedback_breakdown: result.feedback?.feedback_breakdown ?? null,
          suggestions: result.feedback?.suggestions ?? null,
          highlights: result.feedback?.highlights ?? null,
        });
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes("Session not found")) {
          return NextResponse.json({ error: message }, { status: 404 });
        }
        if (message.includes("No transcript available")) {
          return NextResponse.json(
            { error: "No transcript available. Provide a transcript or ensure the session has a communication_id." },
            { status: 400 }
          );
        }
        throw err;
      }
    }

    // Transcript was provided in the request body — use it directly
    const supabase = createServiceClient();

    const { data: session, error: sessionErr } = await supabase
      .from("training_sessions")
      .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json(
        { error: "Session not found", details: sessionErr?.message ?? null },
        { status: 404 }
      );
    }

    const scenarioName = parsed.data.scenarioName ?? session.scenario?.name ?? "Unknown";
    const difficultyName = parsed.data.difficultyName ?? session.difficulty_level?.name ?? "Default";
    const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
    const scenarioType = (session.scenario?.type ?? "frontline") as "frontline" | "leadership";

    const feedback = await generateFeedback(transcript, scenarioName, difficultyName, scenarioType, scenarioPrompt);

    // Translate feedback to SK/HU in parallel
    const [skResult, huResult] = await Promise.allSettled([
      translateFeedback(feedback, "sk"),
      translateFeedback(feedback, "hu"),
    ]);
    const translations: FeedbackTranslations = {};
    if (skResult.status === "fulfilled") translations.sk = skResult.value;
    if (huResult.status === "fulfilled") translations.hu = huResult.value;
    const feedback_translations = Object.keys(translations).length > 0 ? translations : null;

    const { data, error } = await supabase
      .from("training_sessions")
      .update({
        score: feedback.score,
        star_rating: feedback.star_rating,
        feedback_summary: feedback.feedback_summary,
        feedback_breakdown: feedback.feedback_breakdown,
        suggestions: feedback.suggestions,
        highlights: feedback.highlights,
        feedback_translations,
        transcript,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Send feedback email (async, non-blocking)
    sendFeedbackEmailAsync(id, feedback).catch((err) =>
      console.error("[feedback] Failed to send feedback email:", err)
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
