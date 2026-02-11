import OpenAI from "openai";
import type { TranscriptEntry, FeedbackBreakdown, SessionHighlight } from "@repo/shared";

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
  scenarioPrompt?: string
): Promise<FeedbackResult> {
  const transcriptText = transcript
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  const scenarioContext = scenarioPrompt
    ? `\n\nSCENARIO CONTEXT (the system prompt that describes the situation the user is handling):\n"""\n${scenarioPrompt}\n"""`
    : "";

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert training evaluator for O2 Slovakia's conversation training platform.

IMPORTANT CONTEXT:
- This is a TRAINING platform where a real user (trainee/manager) practices difficult workplace conversations.
- An AI agent plays a ROLE (e.g. an upset customer, a difficult team member, etc.) as described in the scenario below.
- In the transcript, "customer" is the real USER being evaluated, and "agent" is the AI playing a role.
- Your evaluation MUST focus entirely on THE USER's (customer's) performance — NOT the AI agent.

The scenario is "${scenarioName}" at difficulty level "${difficultyName}".${scenarioContext}

Evaluate how well the user handled this scenario across these 5 dimensions:

1. **Communication** — Clarity, coherence, appropriate language, and effective message delivery
2. **Active Listening** — Picking up on cues, asking follow-up questions, and responding to what was actually said (not just scripted responses)
3. **Empathy** — Emotional intelligence, understanding the other person's feelings, validating their perspective, and building rapport
4. **Problem Solving** — Identifying the root issue, proposing practical solutions, and handling objections or resistance constructively
5. **Confidence** — Composure under pressure, assertiveness, professional tone, and ability to steer the conversation toward resolution

Provide constructive, specific, and actionable feedback. Be honest but encouraging. Highlight specific moments from the conversation.

Return a JSON object with exactly these fields:
{
  "score": <number 0-100>,
  "star_rating": <number 1-5>,
  "feedback_summary": "<3-4 sentence summary evaluating the USER's overall performance, strengths, and key area to improve>",
  "feedback_breakdown": {
    "communication": <number 0-100>,
    "active_listening": <number 0-100>,
    "empathy": <number 0-100>,
    "problem_solving": <number 0-100>,
    "confidence": <number 0-100>
  },
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>", ...],
  "highlights": [
    {"type": "positive", "text": "<specific quote or moment from the USER that was effective>"},
    {"type": "negative", "text": "<specific moment where the USER could improve, with explanation>"},
    ...
  ]
}`,
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No feedback response from LLM");
  return JSON.parse(content) as FeedbackResult;
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
