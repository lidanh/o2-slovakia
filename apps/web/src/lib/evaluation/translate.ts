import OpenAI from "openai";
import type { FeedbackTranslation, FeedbackDetail } from "@repo/shared";
import type { FeedbackResult } from "../llm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const LANG_NAMES: Record<string, string> = {
  sk: "Slovak",
  hu: "Hungarian",
};

interface TranslatablePayload {
  feedback_summary: string;
  suggestions: string[];
  highlights: { type: string; text: string }[];
  categories: Record<
    string,
    {
      items_feedback: Record<string, string>;
      items_feedback_detail?: Record<string, FeedbackDetail>;
      suggestions: string[];
      highlights: { type: string; text: string }[];
    }
  >;
}

function extractTranslatable(feedback: FeedbackResult): TranslatablePayload {
  const categories: TranslatablePayload["categories"] = {};

  if (feedback.feedback_breakdown?.categories) {
    for (const [key, cat] of Object.entries(feedback.feedback_breakdown.categories)) {
      const itemsFeedback: Record<string, string> = {};
      const itemsFeedbackDetail: Record<string, FeedbackDetail> = {};
      let hasDetail = false;
      for (const item of cat.items) {
        itemsFeedback[item.key] = item.feedback;
        if (item.feedback_detail) {
          itemsFeedbackDetail[item.key] = item.feedback_detail;
          hasDetail = true;
        }
      }
      categories[key] = {
        items_feedback: itemsFeedback,
        ...(hasDetail ? { items_feedback_detail: itemsFeedbackDetail } : {}),
        suggestions: cat.suggestions,
        highlights: cat.highlights.map((h) => ({ type: h.type, text: h.text })),
      };
    }
  }

  return {
    feedback_summary: feedback.feedback_summary,
    suggestions: feedback.suggestions,
    highlights: feedback.highlights.map((h) => ({ type: h.type, text: h.text })),
    categories,
  };
}

function parseTranslation(
  raw: TranslatablePayload
): FeedbackTranslation {
  return {
    feedback_summary: raw.feedback_summary,
    suggestions: raw.suggestions,
    highlights: raw.highlights.map((h) => ({
      type: h.type as "positive" | "negative",
      text: h.text,
    })),
    feedback_breakdown_overrides: Object.fromEntries(
      Object.entries(raw.categories).map(([key, cat]) => [
        key,
        {
          items_feedback: cat.items_feedback,
          ...(cat.items_feedback_detail ? { items_feedback_detail: cat.items_feedback_detail } : {}),
          suggestions: cat.suggestions,
          highlights: cat.highlights.map((h) => ({
            type: h.type as "positive" | "negative",
            text: h.text,
          })),
        },
      ])
    ),
  };
}

export async function translateFeedback(
  feedback: FeedbackResult,
  targetLang: "sk" | "hu"
): Promise<FeedbackTranslation> {
  const payload = extractTranslatable(feedback);
  const langName = LANG_NAMES[targetLang];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional translator for O2 Slovakia's customer service training platform. Translate the following feedback JSON from English to ${langName}. Maintain the same tone, specificity, and structure. Return ONLY valid JSON matching the exact input structure — same keys, same nesting. Do not translate JSON keys, only string values.`,
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No translation response for ${targetLang}`);

  const parsed = JSON.parse(content) as TranslatablePayload;
  return parseTranslation(parsed);
}
