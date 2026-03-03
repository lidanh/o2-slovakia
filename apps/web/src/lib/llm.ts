import OpenAI from "openai";
import type { TranscriptEntry, FeedbackBreakdown, SessionHighlight } from "@repo/shared";
import { evaluateTranscript } from "./evaluation";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface FeedbackResult {
  score: number;
  star_rating: number;
  feedback_summary: string;
  feedback_breakdown: FeedbackBreakdown;
  suggestions: string[];
  highlights: SessionHighlight[];
}

export async function generateFeedback(
  transcript: TranscriptEntry[],
  scenarioName: string,
  difficultyName: string,
  scenarioType: "frontline" | "leadership",
  scenarioPrompt?: string
): Promise<FeedbackResult> {
  return evaluateTranscript(
    transcript,
    scenarioName,
    difficultyName,
    scenarioType,
    scenarioPrompt
  );
}

export async function generateGuidance(
  transcript: TranscriptEntry[]
): Promise<string> {
  const transcriptText = transcript
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a real-time call coaching assistant for O2 Slovakia customer service training. Based on the conversation so far, provide brief, actionable guidance for the agent. Keep it under 2 sentences. Focus on what to say or do next.`,
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],
    temperature: 0.5,
    max_tokens: 150,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No guidance response from LLM");
  return content;
}
