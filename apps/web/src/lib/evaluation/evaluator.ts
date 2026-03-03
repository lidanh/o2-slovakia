import OpenAI from "openai";
import type { TranscriptEntry } from "@repo/shared";
import type { CategoryEvaluationResult, EvaluationContext } from "./types";
import { CATEGORY_DEFINITIONS } from "./categories";
import { buildCategoryPrompt, buildWauPrompt } from "./prompts";
import { aggregateFeedback, type AggregatedFeedback } from "./scoring";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

async function evaluateCategory(
  category: typeof CATEGORY_DEFINITIONS[number],
  context: EvaluationContext
): Promise<CategoryEvaluationResult> {
  const isWau = category.key === "wau_effect";
  const systemPrompt = isWau
    ? buildWauPrompt(context)
    : buildCategoryPrompt(category, context);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: context.transcriptText },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response from LLM for category: ${category.key}`);

  const parsed = JSON.parse(content);

  return {
    category_key: category.key,
    items: parsed.items ?? [],
    highlights: parsed.highlights ?? [],
    suggestions: parsed.suggestions ?? [],
    wau_bonus_percentage: parsed.wau_bonus_percentage,
  };
}

export async function evaluateTranscript(
  transcript: TranscriptEntry[],
  scenarioName: string,
  difficultyName: string,
  scenarioType: "frontline" | "leadership",
  scenarioPrompt?: string
): Promise<AggregatedFeedback> {
  const transcriptText = transcript
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  const context: EvaluationContext = {
    scenarioName,
    difficultyName,
    scenarioPrompt,
    scenarioType,
    transcriptText,
  };

  const salesIncluded = scenarioType === "frontline";

  // Select which categories to evaluate
  const categoriesToEvaluate = CATEGORY_DEFINITIONS.filter((def) => {
    if (def.key === "sales" && !salesIncluded) return false;
    return true;
  });

  // Fire all category evaluations in parallel
  const results = await Promise.allSettled(
    categoriesToEvaluate.map((cat) => evaluateCategory(cat, context))
  );

  // Collect successful results, log failures
  const categoryResults: CategoryEvaluationResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      categoryResults.push(result.value);
    } else {
      console.error(
        `[evaluator] Category "${categoriesToEvaluate[i].key}" failed:`,
        result.reason
      );
    }
  }

  // Extract WAU bonus
  const wauResult = categoryResults.find((r) => r.category_key === "wau_effect");
  const wauBonus = wauResult?.wau_bonus_percentage ?? 0;

  return aggregateFeedback(categoryResults, wauBonus, salesIncluded);
}
