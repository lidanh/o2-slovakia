import { createServiceClient } from "@/lib/supabase/service";
import { generateFeedback, type FeedbackResult } from "@/lib/llm";
import { getCommunication } from "@/lib/wonderful";
import { translateFeedback } from "@/lib/evaluation/translate";
import { sendFeedbackEmail } from "@/lib/email/send";
import type { TranscriptEntry, FeedbackTranslations, FeedbackTranslation, FeedbackBreakdown, SessionHighlight, FeedbackDetail } from "@repo/shared";

export interface GenerateSessionFeedbackResult {
  alreadyExists?: boolean;
  success: boolean;
  feedback: FeedbackResult | null;
  session: Record<string, unknown>;
  feedback_translations?: FeedbackTranslations | null;
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

  // 3. Fetch Wonderful config from tenant settings
  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", session.tenant_id)
    .single();

  const wonderful = (tenant?.settings as Record<string, unknown>)?.wonderful as
    | { api_key?: string; tenant_url?: string }
    | undefined;

  // 4. Fetch transcript from Wonderful
  let transcript: TranscriptEntry[] = [];
  let callDuration: number | null = null;

  if (session.communication_id && wonderful?.api_key && wonderful?.tenant_url) {
    try {
      const commData = await getCommunication(session.communication_id, wonderful);
      const inner = (commData as { data?: Record<string, unknown> }).data ?? commData;
      const transcriptions = (inner as { transcriptions?: { id?: string; speaker?: string; text?: string; start_time?: number }[] }).transcriptions;

      if (Array.isArray(transcriptions)) {
        transcript = transcriptions
          .filter((t) => t.speaker === "agent" || t.speaker === "customer")
          .map((t) => ({
            role: (t.speaker === "agent" ? "agent" : "customer") as "agent" | "customer",
            content: t.text ?? "",
            timestamp: t.start_time,
            transcription_id: t.id,
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
  const scenarioType = (session.scenario?.type ?? "frontline") as "frontline" | "leadership";
  const feedback = await generateFeedback(
    transcript,
    session.scenario?.name ?? "Unknown",
    session.difficulty_level?.name ?? "Default",
    scenarioType,
    scenarioPrompt
  );

  // 7. Translate feedback to SK/HU in parallel
  const [skResult, huResult] = await Promise.allSettled([
    translateFeedback(feedback, "sk"),
    translateFeedback(feedback, "hu"),
  ]);
  const translations: FeedbackTranslations = {};
  if (skResult.status === "fulfilled") translations.sk = skResult.value;
  if (huResult.status === "fulfilled") translations.hu = huResult.value;
  const feedback_translations = Object.keys(translations).length > 0 ? translations : null;

  // 8. Update session with feedback fields + transcript, ensure status is completed
  await supabase
    .from("training_sessions")
    .update({
      status: "completed",
      completed_at: session.completed_at ?? new Date().toISOString(),
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
    .eq("id", sessionId);

  // 9. Send feedback email to trainee (async, non-blocking)
  // Pass translations explicitly since session was fetched before they were generated
  const sessionWithTranslations = { ...session, feedback_translations };
  sendFeedbackEmailForSession(supabase, sessionWithTranslations, feedback).catch((err) =>
    console.error("[feedback] Failed to send feedback email:", err)
  );

  // 11. Return result
  return { success: true, feedback, session, feedback_translations };
}

/**
 * Send feedback email to the trainee. Fetches user email and builds the email params.
 * Intended to be called with .catch() so it never blocks the response.
 */
function extractLocalizedContent(
  translations: FeedbackTranslations | null | undefined,
  language: string
) {
  const lang = language as "sk" | "hu";
  const tr: FeedbackTranslation | undefined = (lang === "sk" || lang === "hu") ? translations?.[lang] : undefined;
  if (!tr) return {};

  const localizedItemFeedback: Record<string, Record<string, string>> = {};
  const localizedItemFeedbackDetail: Record<string, Record<string, FeedbackDetail>> = {};
  let hasDetail = false;
  if (tr.feedback_breakdown_overrides) {
    for (const [catKey, overrides] of Object.entries(tr.feedback_breakdown_overrides)) {
      if (overrides?.items_feedback) {
        localizedItemFeedback[catKey] = overrides.items_feedback;
      }
      if (overrides?.items_feedback_detail) {
        localizedItemFeedbackDetail[catKey] = overrides.items_feedback_detail;
        hasDetail = true;
      }
    }
  }

  return {
    localizedSummary: tr.feedback_summary,
    localizedSuggestions: tr.suggestions,
    localizedHighlights: tr.highlights,
    localizedItemFeedback: Object.keys(localizedItemFeedback).length > 0 ? localizedItemFeedback : undefined,
    localizedItemFeedbackDetail: hasDetail ? localizedItemFeedbackDetail : undefined,
  };
}

async function sendFeedbackEmailForSession(
  supabase: ReturnType<typeof createServiceClient>,
  session: Record<string, unknown>,
  feedback: FeedbackResult
): Promise<void> {
  const { data: user } = await supabase
    .from("users")
    .select("name, email, language")
    .eq("id", session.user_id as string)
    .single();

  if (!user?.email) return;

  const language = (user.language as "en" | "sk" | "hu") || "en";
  const translations = session.feedback_translations as FeedbackTranslations | null;
  const localized = extractLocalizedContent(translations, language);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const scenario = session.scenario as { name?: string } | null;
  const difficultyLevel = session.difficulty_level as { name?: string } | null;

  await sendFeedbackEmail(user.email, {
    userName: user.name ?? "Trainee",
    scenarioName: scenario?.name ?? "Unknown",
    difficultyName: difficultyLevel?.name ?? "Default",
    completedAt: (session.completed_at as string) ?? new Date().toISOString(),
    score: feedback.score,
    starRating: feedback.star_rating,
    feedbackSummary: feedback.feedback_summary,
    feedbackBreakdown: feedback.feedback_breakdown as FeedbackBreakdown,
    suggestions: feedback.suggestions ?? [],
    highlights: (feedback.highlights ?? []) as SessionHighlight[],
    sessionUrl: `${appUrl}/training/${session.id as string}`,
    language,
    ...localized,
  });
}

/**
 * Standalone function to send feedback email after browser-call feedback generation.
 * Used by the browser-call/complete route where feedback is generated inline.
 */
export async function sendFeedbackEmailAsync(
  sessionId: string,
  feedback: FeedbackResult
): Promise<void> {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from("training_sessions")
    .select("id, user_id, tenant_id, completed_at, feedback_translations, scenario:scenarios(name), difficulty_level:difficulty_levels(name)")
    .eq("id", sessionId)
    .single();

  if (!session) return;

  const { data: user } = await supabase
    .from("users")
    .select("name, email, language")
    .eq("id", session.user_id)
    .single();

  if (!user?.email) return;

  const language = (user.language as "en" | "sk" | "hu") || "en";
  const translations = session.feedback_translations as FeedbackTranslations | null;
  const localized = extractLocalizedContent(translations, language);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const scenario = session.scenario as unknown as { name: string } | null;
  const difficultyLevel = session.difficulty_level as unknown as { name: string } | null;

  await sendFeedbackEmail(user.email, {
    userName: user.name ?? "Trainee",
    scenarioName: scenario?.name ?? "Unknown",
    difficultyName: difficultyLevel?.name ?? "Default",
    completedAt: session.completed_at ?? new Date().toISOString(),
    score: feedback.score,
    starRating: feedback.star_rating,
    feedbackSummary: feedback.feedback_summary,
    feedbackBreakdown: feedback.feedback_breakdown as FeedbackBreakdown,
    suggestions: feedback.suggestions ?? [],
    highlights: (feedback.highlights ?? []) as SessionHighlight[],
    sessionUrl: `${appUrl}/training/${sessionId}`,
    language,
    ...localized,
  });
}
