# Parallel Category-Based Evaluation System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-LLM-call feedback system with 6 parallel category evaluators matching O2 Slovakia's official evaluation checklist, each returning per-item pass/partial/fail scores, with deterministic weighted score aggregation.

**Architecture:** 6 independent GPT-4o calls (one per evaluation category) run via `Promise.all`. Each returns structured per-item scores. A deterministic scoring module computes category percentages, applies XLSX weights, derives final score + star rating. Frontline scenarios include Sales (30%), leadership scenarios redistribute that weight.

**Tech Stack:** Next.js 15, TypeScript, OpenAI GPT-4o, Supabase (JSONB), AntD 5, Recharts

---

## Task 1: Define Evaluation Types

**Files:**
- Create: `apps/web/src/lib/evaluation/types.ts`
- Modify: `packages/shared/src/types.ts:122-135`
- Modify: `packages/shared/src/constants.ts:101-107`

**Step 1: Create `apps/web/src/lib/evaluation/types.ts`**

This file defines all types used by the evaluation system internally. These are NOT shared with the frontend — only the result types in `packages/shared` are shared.

```typescript
import type { SessionHighlight } from "@repo/shared";

// Possible scores for each evaluation item
export type ItemScore = "passed" | "partially_passed" | "failed";

// Definition of a single evaluation item within a category
export interface EvaluationItemDef {
  key: string;
  label: string;
  question: string;          // The assessment question from the XLSX
  allowPartial: boolean;     // Whether "partially_passed" is valid (some items are pass/fail only)
}

// Definition of an evaluation category
export interface EvaluationCategoryDef {
  key: string;
  name: string;
  emoji: string;
  weight: number;            // 0.10, 0.15, 0.30, etc.
  description: string;
  items: EvaluationItemDef[];
}

// Result from a single category LLM evaluation
export interface CategoryEvaluationResult {
  category_key: string;
  items: {
    key: string;
    score: ItemScore;
    feedback: string;
  }[];
  highlights: SessionHighlight[];
  suggestions: string[];
}

// Context passed to each category evaluator
export interface EvaluationContext {
  scenarioName: string;
  difficultyName: string;
  scenarioPrompt?: string;
  scenarioType: "frontline" | "leadership";
  transcriptText: string;
}
```

**Step 2: Update `packages/shared/src/types.ts` — replace FeedbackBreakdown**

Replace lines 122-129 (`FeedbackBreakdown` interface) with:

```typescript
export type ItemScore = "passed" | "partially_passed" | "failed";

export interface FeedbackItemResult {
  key: string;
  label: string;
  score: ItemScore;
  max_points: number;
  earned_points: number;
  feedback: string;
}

export interface FeedbackCategoryResult {
  weight: number;
  score_percentage: number;
  items: FeedbackItemResult[];
  highlights: SessionHighlight[];
  suggestions: string[];
}

export interface FeedbackBreakdown {
  categories: Record<string, FeedbackCategoryResult>;
  wau_bonus_percentage: number;
  sales_included: boolean;
}
```

**Step 3: Update `packages/shared/src/constants.ts` — replace FEEDBACK_CATEGORIES**

Replace lines 101-107 with new evaluation category keys:

```typescript
export const EVALUATION_CATEGORIES = [
  "communication_standards",
  "active_listening",
  "solution",
  "attitude",
  "sales",
  "wau_effect",
] as const;

export type EvaluationCategoryKey = (typeof EVALUATION_CATEGORIES)[number];

// Category display names for UI
export const EVALUATION_CATEGORY_LABELS: Record<EvaluationCategoryKey, string> = {
  communication_standards: "Standards & Communication",
  active_listening: "Active Listening & Perception",
  solution: "Solution",
  attitude: "Attitude",
  sales: "Sales",
  wau_effect: "WAU Effect",
};

export const EVALUATION_CATEGORY_EMOJIS: Record<EvaluationCategoryKey, string> = {
  communication_standards: "🧭",
  active_listening: "👂",
  solution: "⚙️",
  attitude: "💬",
  sales: "💡",
  wau_effect: "🌟",
};

// Keep old constant for reference during migration, but mark deprecated
/** @deprecated Use EVALUATION_CATEGORIES instead */
export const FEEDBACK_CATEGORIES = EVALUATION_CATEGORIES;
```

**Step 4: Verify build**

Run: `cd /Users/lidan/Projects/o2-slovakia && pnpm build`

Expect: Build may fail because `SessionDetail.tsx` and other files reference old `FeedbackBreakdown` shape. That's expected and will be fixed in subsequent tasks.

**Step 5: Commit**

```bash
git add apps/web/src/lib/evaluation/types.ts packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat: define evaluation types for parallel category-based scoring system"
```

---

## Task 2: Create Category Definitions and Prompts

**Files:**
- Create: `apps/web/src/lib/evaluation/categories.ts`
- Create: `apps/web/src/lib/evaluation/prompts.ts`

**Step 1: Create `apps/web/src/lib/evaluation/categories.ts`**

This file defines all 6 categories with their items, exactly matching the XLSX checklist. Each item has its assessment question from the XLSX.

```typescript
import type { EvaluationCategoryDef } from "./types";

export const CATEGORY_DEFINITIONS: EvaluationCategoryDef[] = [
  {
    key: "communication_standards",
    name: "Standards & Communication Structure",
    emoji: "🧭",
    weight: 0.10,
    description: "The basis of every contact — shapes the first impression and overall credibility.",
    items: [
      {
        key: "introductory_standard",
        label: "Introductory standard and first impression",
        question: "Did the user introduce themselves professionally and with a positive tone?",
        allowPartial: false,
      },
      {
        key: "verification_context",
        label: "Verification with context and consent",
        question: "Did the user verify the customer identity and explain the context/reason for verification?",
        allowPartial: false,
      },
      {
        key: "interaction_structure",
        label: "Interaction structure, intelligibility and pronunciation",
        question: "Did the user follow a clear call structure, use clear and correct communication without internal slang?",
        allowPartial: true,
      },
      {
        key: "professional_ending",
        label: "Professional end of interaction",
        question: "Did the user end the call on a positive note, thank the customer for cooperation and say goodbye professionally?",
        allowPartial: false,
      },
    ],
  },
  {
    key: "active_listening",
    name: "Active Listening & Perception of the Customer",
    emoji: "👂",
    weight: 0.15,
    description: "Truly understanding the customer through active listening, paraphrasing and responding to needs.",
    items: [
      {
        key: "clarification_understanding",
        label: "Clarification of request or confirmation of understanding",
        question: "Did the user verify they understood the customer correctly — for example, by paraphrasing or confirming understanding?",
        allowPartial: true,
      },
      {
        key: "tone_tempo_adaptation",
        label: "Customize tone, tempo, and communication style",
        question: "Did the user mirror the customer's style? Did they adapt their voice, pace and form of communication to the type of customer?",
        allowPartial: true,
      },
      {
        key: "capturing_signals",
        label: "Capturing details and signals in communication",
        question: "Did the user reflect on information that the customer said, picking up on details and signals?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "solution",
    name: "Solution",
    emoji: "⚙️",
    weight: 0.30,
    description: "Taking responsibility and ensuring a specific result — affects customer trust and satisfaction.",
    items: [
      {
        key: "taking_responsibility",
        label: "Taking responsibility and reviewing the case",
        question: "Did the user express ownership of the case (e.g. 'I'll take care of it for you') and secured a solution?",
        allowPartial: true,
      },
      {
        key: "followup_questions",
        label: "Follow-up questions leading to correct solution",
        question: "Did the user obtain additional information or correctly identify the situation through follow-up questions?",
        allowPartial: true,
      },
      {
        key: "correct_procedure",
        label: "Solution in accordance with procedures and correct SLA",
        question: "Did the user provide correct information in accordance with terms and conditions, choose the correct course of action, and explain the procedure clearly with correct SLAs?",
        allowPartial: true,
      },
      {
        key: "solution_pickup_prevention",
        label: "Picking up the solution and prevention",
        question: "Did the user pick up the solution and naturally connect it with selfcare options?",
        allowPartial: true,
      },
      {
        key: "summarization",
        label: "Final or interim summarization",
        question: "Did the user make sure that the customer understands the solution — e.g. by continuous summarization or summary at the end?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "attitude",
    name: "Attitude",
    emoji: "💬",
    weight: 0.15,
    description: "Improves brand perception. Attitude and empathy create an atmosphere of trust and respect.",
    items: [
      {
        key: "positive_tone_empathy",
        label: "Positive tone, empathy and authentic expression",
        question: "Did the user show interest in the specific situation? Did they seem sincere and authentic? Did they maintain a positive tone throughout and use polite phrases ('thank you', 'please')?",
        allowPartial: true,
      },
      {
        key: "respect_calm_emotions",
        label: "Respect and calm management of emotions",
        question: "Was the user patient and respectful during the call? Did they give the customer space to finish without interruption? Did they handle an upset customer calmly?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "sales",
    name: "Sales",
    emoji: "💡",
    weight: 0.30,
    description: "Ability to turn interaction into value — recommending suitable and relevant solutions using behavioral techniques.",
    items: [
      {
        key: "needs_identification",
        label: "Identification of needs / Customer situation",
        question: "Did the user ask probing questions about the customer's needs/situation? Areas: Current provider, Family and group O2 Spolu/O2 Connect, Use of 3rd-party applications, Price, Data needs, Need for calls and SMS, HW needs, Commitment.",
        allowPartial: true,
      },
      {
        key: "offer_relevance_bridging",
        label: "Primary Offer Relevance / Bridging",
        question: "Did the user bridge from the solution to the offer, and was the offer chosen correctly in relation to the customer's needs?",
        allowPartial: true,
      },
      {
        key: "presentation_through_utility",
        label: "Presentation through utility",
        question: "Did the user use the language of added value? Did they present the product and services through benefit to the customer?",
        allowPartial: true,
      },
      {
        key: "objection_handling",
        label: "Acceptance and handling of objection",
        question: "Did the user actively pursue acceptance of objections, find out the reason for lack of interest, and argue effectively?",
        allowPartial: true,
      },
      {
        key: "closing_sale",
        label: "Closing a sale / Creating a lead",
        question: "Did the user take advantage of the momentum to complete the sale? If the deal was not closed immediately, was a lead created and follow-up contact arranged?",
        allowPartial: true,
      },
      {
        key: "additional_offer",
        label: "Additional offer",
        question: "Did the user apply relevant additional offers, e.g.: Connect, O2TV, HW, ACC, Fuse?",
        allowPartial: true,
      },
      {
        key: "behavioral_techniques",
        label: "Use of behavioral techniques in sales",
        question: "Did the user use at least 1 technique based on behavioral principles in sales (e.g. Hook, Loss Principle, anchoring, scarcity)?",
        allowPartial: true,
      },
    ],
  },
  {
    key: "wau_effect",
    name: "WAU Effect",
    emoji: "🌟",
    weight: 0.0, // Bonus — not part of base weight
    description: "Creating a moment that pleasantly surprises the customer — above-standard experience, initiative, added value.",
    items: [
      {
        key: "wau_initiative",
        label: "Initiative, proactivity, and above-standard experience",
        question: "Did the assistant do something extra that the customer did not expect? Did they offer a solution with added value? Did they end with a positive emotion that left an above-standard impression? Did they share a practical tip or advice beyond standard procedures?",
        allowPartial: true,
      },
    ],
  },
];

// Helper to get category definition by key
export function getCategoryDef(key: string): EvaluationCategoryDef | undefined {
  return CATEGORY_DEFINITIONS.find((c) => c.key === key);
}
```

**Step 2: Create `apps/web/src/lib/evaluation/prompts.ts`**

This file generates the system prompt for each category evaluator. Each prompt is focused: it only evaluates items for its category.

```typescript
import type { EvaluationCategoryDef, EvaluationContext } from "./types";

const SHARED_CONTEXT = `You are an expert training evaluator for O2 Slovakia's conversation training platform.

IMPORTANT CONTEXT:
- This is a TRAINING platform where a real user (trainee) practices customer service conversations.
- An AI agent plays a ROLE (e.g. an upset customer) as described in the scenario below.
- In the transcript, "customer" is the real USER being evaluated, and "agent" is the AI playing a role.
- Your evaluation MUST focus entirely on THE USER's (customer's) performance — NOT the AI agent.
- Be constructive, specific, and actionable. Cite specific moments from the conversation.`;

export function buildCategoryPrompt(
  category: EvaluationCategoryDef,
  context: EvaluationContext
): string {
  const scenarioSection = context.scenarioPrompt
    ? `\n\nSCENARIO CONTEXT:\n"""\n${context.scenarioPrompt}\n"""`
    : "";

  const itemsSection = category.items
    .map((item, i) => {
      const scoringOptions = item.allowPartial
        ? `"passed" (2 points), "partially_passed" (1 point), or "failed" (0 points)`
        : `"passed" (2 points) or "failed" (0 points)`;
      return `${i + 1}. **${item.label}**
   Assessment question: ${item.question}
   Scoring: ${scoringOptions}`;
    })
    .join("\n");

  const jsonItems = category.items
    .map((item) => {
      const scores = item.allowPartial
        ? `"passed" | "partially_passed" | "failed"`
        : `"passed" | "failed"`;
      return `    { "key": "${item.key}", "score": <${scores}>, "feedback": "<1-2 sentence explanation citing specific transcript moments>" }`;
    })
    .join(",\n");

  return `${SHARED_CONTEXT}

The scenario is "${context.scenarioName}" at difficulty level "${context.difficultyName}".${scenarioSection}

You are evaluating ONLY the category: **${category.emoji} ${category.name}**
${category.description}

Evaluate each of the following items:

${itemsSection}

For each item, score it based on the assessment question. Cite specific moments from the transcript in your feedback.

Also identify:
- **highlights**: Specific positive or negative moments related to this category
- **suggestions**: Actionable improvement suggestions for this category (1-3 suggestions max)

Return a JSON object with exactly this structure:
{
  "items": [
${jsonItems}
  ],
  "highlights": [
    { "type": "positive" | "negative", "text": "<specific moment from the transcript>" }
  ],
  "suggestions": ["<actionable suggestion>"]
}`;
}

export function buildWauPrompt(context: EvaluationContext): string {
  const scenarioSection = context.scenarioPrompt
    ? `\n\nSCENARIO CONTEXT:\n"""\n${context.scenarioPrompt}\n"""`
    : "";

  return `${SHARED_CONTEXT}

The scenario is "${context.scenarioName}" at difficulty level "${context.difficultyName}".${scenarioSection}

You are evaluating the **🌟 WAU Effect** — whether the user created an above-standard, memorable experience.

Consider these aspects:
- Did the user do something extra that the customer did not expect?
- Did they offer a solution that added value beyond standard procedures?
- Did they end the interaction with a positive emotion that left an above-standard impression?
- Did they share a practical tip or advice beyond what was required?
- Was there genuine initiative and proactivity?

Return a JSON object:
{
  "items": [
    { "key": "wau_initiative", "score": "passed" | "partially_passed" | "failed", "feedback": "<explanation>" }
  ],
  "wau_bonus_percentage": <number 0-20>,
  "highlights": [
    { "type": "positive", "text": "<specific above-standard moment>" }
  ],
  "suggestions": []
}

The wau_bonus_percentage should be:
- 0 if the user showed no above-standard initiative
- 5-10 if there was some proactivity or added value
- 10-15 if the user went noticeably above and beyond
- 15-20 if the interaction was truly exceptional and memorable`;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/evaluation/categories.ts apps/web/src/lib/evaluation/prompts.ts
git commit -m "feat: add evaluation category definitions and prompt templates from XLSX checklist"
```

---

## Task 3: Create Scoring Module

**Files:**
- Create: `apps/web/src/lib/evaluation/scoring.ts`

**Step 1: Create `apps/web/src/lib/evaluation/scoring.ts`**

Deterministic scoring — no LLM involved. Converts item-level scores into category percentages, applies weights, derives final score and star rating.

```typescript
import type { ItemScore, CategoryEvaluationResult } from "./types";
import type { FeedbackBreakdown, FeedbackCategoryResult, FeedbackItemResult, SessionHighlight } from "@repo/shared";
import { CATEGORY_DEFINITIONS } from "./categories";

const POINTS: Record<ItemScore, number> = {
  passed: 2,
  partially_passed: 1,
  failed: 0,
};

function scoreToStarRating(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

export interface AggregatedFeedback {
  score: number;
  star_rating: number;
  feedback_summary: string;
  feedback_breakdown: FeedbackBreakdown;
  suggestions: string[];
  highlights: SessionHighlight[];
}

export function aggregateFeedback(
  categoryResults: CategoryEvaluationResult[],
  wauBonusPercentage: number,
  salesIncluded: boolean
): AggregatedFeedback {
  // Build category results map
  const categories: Record<string, FeedbackCategoryResult> = {};

  // Determine active weights
  const activeDefs = CATEGORY_DEFINITIONS.filter((def) => {
    if (def.key === "wau_effect") return false; // WAU is bonus, not weighted
    if (def.key === "sales" && !salesIncluded) return false;
    return true;
  });

  const totalBaseWeight = activeDefs.reduce((sum, d) => sum + d.weight, 0);

  for (const catResult of categoryResults) {
    const def = CATEGORY_DEFINITIONS.find((d) => d.key === catResult.category_key);
    if (!def) continue;

    // Calculate category score from item scores
    const maxPoints = def.items.length * 2;
    let earnedPoints = 0;

    const items: FeedbackItemResult[] = catResult.items.map((item) => {
      const earned = POINTS[item.score] ?? 0;
      earnedPoints += earned;
      const itemDef = def.items.find((d) => d.key === item.key);
      return {
        key: item.key,
        label: itemDef?.label ?? item.key,
        score: item.score,
        max_points: 2,
        earned_points: earned,
        feedback: item.feedback,
      };
    });

    const scorePercentage = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;

    // Determine effective weight (normalized for active categories)
    const rawWeight = def.key === "wau_effect" ? 0 : def.weight;
    const effectiveWeight = rawWeight > 0 ? rawWeight / totalBaseWeight : 0;

    categories[catResult.category_key] = {
      weight: effectiveWeight,
      score_percentage: scorePercentage,
      items,
      highlights: catResult.highlights,
      suggestions: catResult.suggestions,
    };
  }

  // Calculate weighted final score
  let weightedScore = 0;
  for (const [key, cat] of Object.entries(categories)) {
    if (key === "wau_effect") continue;
    weightedScore += cat.score_percentage * cat.weight;
  }

  // Apply WAU bonus (capped at 100)
  const clampedBonus = Math.max(0, Math.min(20, wauBonusPercentage));
  const finalScore = Math.min(100, Math.round(weightedScore + clampedBonus));
  const starRating = scoreToStarRating(finalScore);

  // Merge all highlights and suggestions
  const allHighlights: SessionHighlight[] = [];
  const allSuggestions: string[] = [];
  for (const cat of Object.values(categories)) {
    allHighlights.push(...cat.highlights);
    allSuggestions.push(...cat.suggestions);
  }

  // Generate summary from category results
  const summary = generateSummary(categories, finalScore, salesIncluded);

  return {
    score: finalScore,
    star_rating: starRating,
    feedback_summary: summary,
    feedback_breakdown: {
      categories,
      wau_bonus_percentage: clampedBonus,
      sales_included: salesIncluded,
    },
    suggestions: allSuggestions,
    highlights: allHighlights,
  };
}

function generateSummary(
  categories: Record<string, FeedbackCategoryResult>,
  finalScore: number,
  salesIncluded: boolean
): string {
  const parts: string[] = [];

  // Overall performance
  if (finalScore >= 90) {
    parts.push("Excellent overall performance.");
  } else if (finalScore >= 75) {
    parts.push("Good performance with some areas for improvement.");
  } else if (finalScore >= 60) {
    parts.push("Adequate performance but several areas need attention.");
  } else if (finalScore >= 40) {
    parts.push("Below expectations — significant improvement needed in multiple areas.");
  } else {
    parts.push("Poor performance — fundamental skills need development.");
  }

  // Find best and worst categories
  const scored = Object.entries(categories)
    .filter(([key]) => key !== "wau_effect")
    .sort((a, b) => b[1].score_percentage - a[1].score_percentage);

  if (scored.length > 0) {
    const best = scored[0];
    const bestDef = CATEGORY_DEFINITIONS.find((d) => d.key === best[0]);
    parts.push(`Strongest area: ${bestDef?.name ?? best[0]} (${best[1].score_percentage}%).`);
  }

  if (scored.length > 1) {
    const worst = scored[scored.length - 1];
    const worstDef = CATEGORY_DEFINITIONS.find((d) => d.key === worst[0]);
    if (worst[1].score_percentage < 75) {
      parts.push(`Key area to improve: ${worstDef?.name ?? worst[0]} (${worst[1].score_percentage}%).`);
    }
  }

  return parts.join(" ");
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/evaluation/scoring.ts
git commit -m "feat: add deterministic scoring module with weighted category aggregation"
```

---

## Task 4: Create Parallel Evaluator Orchestrator

**Files:**
- Create: `apps/web/src/lib/evaluation/evaluator.ts`
- Create: `apps/web/src/lib/evaluation/index.ts`

**Step 1: Create `apps/web/src/lib/evaluation/evaluator.ts`**

This is the orchestrator that fires all category LLM calls in parallel and aggregates results.

```typescript
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
      // Skip failed category — scoring will work with available results
    }
  }

  // Extract WAU bonus from WAU result
  let wauBonus = 0;
  const wauResult = results.find(
    (r, i) => categoriesToEvaluate[i].key === "wau_effect" && r.status === "fulfilled"
  );
  if (wauResult && wauResult.status === "fulfilled") {
    // The WAU prompt returns wau_bonus_percentage in parsed JSON
    // Re-parse from the category result's raw data
    // Actually, we need to extract this from the LLM response
    // Let's handle this by modifying the evaluateCategory function
  }

  return aggregateFeedback(categoryResults, wauBonus, salesIncluded);
}
```

**Wait — WAU bonus extraction needs a small design adjustment.** The WAU evaluator returns `wau_bonus_percentage` in its JSON but `CategoryEvaluationResult` doesn't have that field. Let me fix this:

Update `evaluateCategory` to also return `wau_bonus_percentage` when it's the WAU category. The cleanest approach: add an optional `wau_bonus_percentage` field to `CategoryEvaluationResult` in `types.ts`.

Go back to `apps/web/src/lib/evaluation/types.ts` and add to `CategoryEvaluationResult`:

```typescript
export interface CategoryEvaluationResult {
  category_key: string;
  items: {
    key: string;
    score: ItemScore;
    feedback: string;
  }[];
  highlights: SessionHighlight[];
  suggestions: string[];
  wau_bonus_percentage?: number; // Only for wau_effect category
}
```

Then in `evaluator.ts`, the `evaluateCategory` function already parses the full JSON, so add:

```typescript
return {
  category_key: category.key,
  items: parsed.items ?? [],
  highlights: parsed.highlights ?? [],
  suggestions: parsed.suggestions ?? [],
  wau_bonus_percentage: parsed.wau_bonus_percentage,
};
```

And in `evaluateTranscript`, extract WAU bonus:

```typescript
const wauCategoryResult = categoryResults.find((r) => r.category_key === "wau_effect");
const wauBonus = wauCategoryResult?.wau_bonus_percentage ?? 0;
```

Here's the corrected final `evaluator.ts`:

```typescript
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
```

**Step 2: Create `apps/web/src/lib/evaluation/index.ts`**

Barrel export for clean imports:

```typescript
export { evaluateTranscript } from "./evaluator";
export { aggregateFeedback } from "./scoring";
export { CATEGORY_DEFINITIONS, getCategoryDef } from "./categories";
export type {
  ItemScore,
  EvaluationItemDef,
  EvaluationCategoryDef,
  CategoryEvaluationResult,
  EvaluationContext,
} from "./types";
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/evaluation/
git commit -m "feat: add parallel evaluator orchestrator with Promise.allSettled"
```

---

## Task 5: Refactor `llm.ts` and `feedback.ts` to Use New Evaluator

**Files:**
- Modify: `apps/web/src/lib/llm.ts` (full rewrite of `generateFeedback`)
- Modify: `apps/web/src/lib/feedback.ts:90-97` (pass scenario type)

**Step 1: Rewrite `generateFeedback` in `apps/web/src/lib/llm.ts`**

The function signature changes to accept `scenarioType` and delegates to the new evaluator. Keep `generateGuidance` unchanged.

Replace lines 1-93 with:

```typescript
import type { TranscriptEntry, FeedbackBreakdown, SessionHighlight } from "@repo/shared";
import { evaluateTranscript } from "./evaluation";

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
```

Keep the `generateGuidance` function (lines 95-121) exactly as-is, but it needs the OpenAI import since the evaluator now handles its own OpenAI instance. Update the `generateGuidance` to import OpenAI directly:

```typescript
import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function generateGuidance(
  transcript: TranscriptEntry[]
): Promise<string> {
  // ... existing code unchanged
}
```

So the full new `llm.ts`:

```typescript
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
```

**Step 2: Update `feedback.ts` to pass `scenarioType`**

In `apps/web/src/lib/feedback.ts`, the `generateFeedback` call at line 92 needs the new `scenarioType` parameter. The session query already includes `scenario:scenarios(*)` which has the `type` field.

Replace lines 90-97:

```typescript
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
```

**Step 3: Update callers that call `generateFeedback` directly**

In `apps/web/src/app/api/training/browser-call/complete/route.ts` at line 126, the `generateFeedback` call needs `scenarioType`:

Replace lines 125-131:

```typescript
        const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
        const scenarioType = (session.scenario?.type ?? "frontline") as "frontline" | "leadership";
        feedbackResult = await generateFeedback(
          transcript,
          session.scenario?.name ?? "Unknown",
          session.difficulty_level?.name ?? "Default",
          scenarioType,
          scenarioPrompt
        );
```

In `apps/web/src/app/api/training/sessions/[id]/feedback/route.ts` at line 85, similarly:

Replace lines 83-85:

```typescript
    const scenarioPrompt = session.scenario?.prompt ?? session.scenario?.description ?? undefined;
    const scenarioType = (session.scenario?.type ?? "frontline") as "frontline" | "leadership";

    const feedback = await generateFeedback(transcript, scenarioName, difficultyName, scenarioType, scenarioPrompt);
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/llm.ts apps/web/src/lib/feedback.ts apps/web/src/app/api/training/browser-call/complete/route.ts apps/web/src/app/api/training/sessions/[id]/feedback/route.ts
git commit -m "feat: wire generateFeedback to parallel category evaluator"
```

---

## Task 6: Update SessionDetail UI Component

**Files:**
- Modify: `apps/web/src/components/training/SessionDetail.tsx` (significant rewrite of feedback display sections)

**Step 1: Rewrite the feedback display sections**

The radar chart and bar chart (lines 195-240) get replaced with a collapsible accordion of categories. The suggestions and highlights sections (lines 242-325) stay mostly the same but reference the new data shape.

Key changes:
1. Import AntD `Collapse` component and new constants
2. Replace `FEEDBACK_CATEGORIES` with `EVALUATION_CATEGORIES` and `EVALUATION_CATEGORY_LABELS`
3. Replace radar chart + bar chart with `Collapse` accordion showing per-category items
4. Each item shows a color-coded `Tag` (green=passed, orange=partial, red=failed) + feedback text
5. Keep the radar chart but adapt it to the new categories

The full rewrite of `SessionDetail.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Card, Tag, Typography, List, Row, Col, Space, Button, Spin, App, Collapse, Progress,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileSearchOutlined,
  StarOutlined,
} from "@ant-design/icons";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { SessionWithDetails, FeedbackBreakdown, FeedbackCategoryResult } from "@repo/shared";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_COLORS,
  EVALUATION_CATEGORY_LABELS,
  EVALUATION_CATEGORY_EMOJIS,
} from "@repo/shared";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import StarRating from "@/components/common/StarRating";

const { Text, Paragraph } = Typography;

const SCORE_TAG_CONFIG = {
  passed: { color: "success", label: "Passed" },
  partially_passed: { color: "warning", label: "Partial" },
  failed: { color: "error", label: "Failed" },
} as const;

interface SessionDetailProps {
  session: SessionWithDetails;
  onSessionUpdate?: (session: SessionWithDetails) => void;
}

export default function SessionDetail({ session, onSessionUpdate }: SessionDetailProps) {
  const [generating, setGenerating] = useState(false);
  const { message } = App.useApp();

  const canGenerateFeedback =
    session.status === "completed" &&
    session.communication_id !== null;

  async function handleGenerateFeedback() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/training/sessions/${session.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to generate feedback");
      const updated = await res.json();
      onSessionUpdate?.(updated);
    } catch {
      message.error("Failed to generate feedback. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Parse new FeedbackBreakdown format
  const breakdown = session.feedback_breakdown as FeedbackBreakdown | null;
  const hasNewFormat = breakdown?.categories != null;

  // Build radar chart data from new format
  const radarData = hasNewFormat
    ? Object.entries(breakdown!.categories)
        .filter(([key]) => key !== "wau_effect")
        .map(([key, cat]) => ({
          category: EVALUATION_CATEGORY_LABELS[key as keyof typeof EVALUATION_CATEGORY_LABELS] ?? key,
          value: cat.score_percentage,
          fullMark: 100,
        }))
    : [];

  const duration = session.call_duration
    ? `${Math.floor(session.call_duration / 60)}:${String(session.call_duration % 60).padStart(2, "0")}`
    : "—";

  const infoItems = [
    { icon: <UserOutlined />, label: "User", value: session.user?.name ?? "—", gradient: "linear-gradient(135deg, #0112AA, #2563EB)" },
    { icon: <FileTextOutlined />, label: "Scenario", value: session.scenario?.name ?? "—", gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)" },
    { icon: <ClockCircleOutlined />, label: "Duration", value: duration, gradient: "linear-gradient(135deg, #059669, #34D399)" },
    { icon: <CalendarOutlined />, label: "Date", value: new Date(session.created_at).toLocaleString("sk-SK"), gradient: "linear-gradient(135deg, #2563EB, #60A5FA)" },
  ];

  // Build collapse items for category breakdown
  const collapseItems = hasNewFormat
    ? Object.entries(breakdown!.categories).map(([key, cat]) => {
        const emoji = EVALUATION_CATEGORY_EMOJIS[key as keyof typeof EVALUATION_CATEGORY_EMOJIS] ?? "";
        const label = EVALUATION_CATEGORY_LABELS[key as keyof typeof EVALUATION_CATEGORY_LABELS] ?? key;
        const weightLabel = key === "wau_effect"
          ? "Bonus"
          : `${Math.round(cat.weight * 100)}%`;

        return {
          key,
          label: (
            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
              <span style={{ fontSize: 18 }}>{emoji}</span>
              <Text strong style={{ flex: 1 }}>{label}</Text>
              <Tag style={{ margin: 0 }}>{weightLabel}</Tag>
              <Progress
                percent={cat.score_percentage}
                size="small"
                style={{ width: 120, margin: 0 }}
                strokeColor={cat.score_percentage >= 75 ? "#059669" : cat.score_percentage >= 50 ? "#D97706" : "#EF4444"}
              />
            </div>
          ),
          children: (
            <div>
              {cat.items.map((item) => {
                const tagConfig = SCORE_TAG_CONFIG[item.score] ?? SCORE_TAG_CONFIG.failed;
                return (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: "1px solid #F0F0F0",
                      alignItems: "flex-start",
                    }}
                  >
                    <Tag color={tagConfig.color} style={{ flexShrink: 0, marginTop: 2 }}>
                      {tagConfig.label}
                    </Tag>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13, display: "block" }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>{item.feedback}</Text>
                    </div>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>
                      {item.earned_points}/{item.max_points}
                    </Text>
                  </div>
                );
              })}
            </div>
          ),
        };
      })
    : [];

  return (
    <>
      <Row gutter={[20, 20]} className="animate-stagger">
        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: "24px" } }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <Tag color={SESSION_STATUS_COLORS[session.status]} style={{ fontSize: 12 }}>
                {SESSION_STATUS_LABELS[session.status]}
              </Tag>
              {session.difficulty_level && (
                <Tag style={{ fontSize: 12, background: "rgba(1,18,170,0.08)", color: "#0112AA", border: "none" }}>
                  {session.difficulty_level.name}
                </Tag>
              )}
            </div>
            <Row gutter={[24, 20]}>
              {infoItems.map((item) => (
                <Col xs={24} sm={12} key={item.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: item.gradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 16,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>{item.label}</Text>
                      <Text strong style={{ fontSize: 14 }}>{item.value}</Text>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            variant="borderless"
            style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "none" }}
            styles={{ body: { padding: "24px", textAlign: "center" } }}
          >
            {session.score === null ? (
              session.status === "completed" ? (
                <Space direction="vertical" size="middle" align="center" style={{ width: "100%" }}>
                  <FileSearchOutlined style={{ fontSize: 32, color: "#9CA3AF" }} />
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>Feedback not yet generated</Text>
                  <Button type="primary" loading={generating} disabled={!canGenerateFeedback} onClick={handleGenerateFeedback}>
                    {generating ? "Generating..." : "Generate Feedback"}
                  </Button>
                  <Text style={{ fontSize: 12, color: "#9CA3AF" }}>This may take a few seconds</Text>
                </Space>
              ) : (
                <Space direction="vertical" size="middle" align="center" style={{ width: "100%" }}>
                  <Spin size="small" />
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>Waiting for call to complete...</Text>
                </Space>
              )
            ) : (
              <Space direction="vertical" size="large" align="center">
                <div>
                  <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>Score</Text>
                  <div style={{ marginTop: 8 }}><ScoreDisplay score={session.score} /></div>
                </div>
                <div>
                  <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>Rating</Text>
                  <div style={{ marginTop: 8 }}><StarRating rating={session.star_rating} /></div>
                </div>
                {hasNewFormat && breakdown!.wau_bonus_percentage > 0 && (
                  <Tag icon={<StarOutlined />} color="gold" style={{ fontSize: 13, padding: "4px 12px" }}>
                    WAU Bonus: +{breakdown!.wau_bonus_percentage}%
                  </Tag>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {session.feedback_summary && (
        <Card title="Feedback Summary" variant="borderless" className="card-animated" style={{ marginTop: 20, animationDelay: "150ms" }}>
          <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", margin: 0 }}>
            {session.feedback_summary}
          </Paragraph>
        </Card>
      )}

      {hasNewFormat && collapseItems.length > 0 && (
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={14}>
            <Card title="Category Breakdown" variant="borderless">
              <Collapse
                ghost
                items={collapseItems}
                defaultActiveKey={[]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            {radarData.length > 0 && (
              <Card title="Performance Radar" variant="borderless" styles={{ body: { padding: "16px 24px 24px" } }}>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                    <Radar dataKey="value" stroke="#0112AA" fill="#0112AA" fillOpacity={0.15} strokeWidth={2} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 13 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </Col>
        </Row>
      )}

      {session.suggestions && session.suggestions.length > 0 && (
        <Card title="Suggestions" variant="borderless" style={{ marginTop: 20 }}>
          <List
            dataSource={session.suggestions}
            renderItem={(item, idx) => (
              <List.Item style={{ padding: "12px 0", borderBottom: idx < session.suggestions!.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#0112AA", flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <Text style={{ fontSize: 14, lineHeight: 1.6, color: "#374151" }}>{item}</Text>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      {session.highlights && session.highlights.length > 0 && (
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={12}>
            <Card variant="borderless" title={<Space><CheckCircleOutlined style={{ color: "#059669" }} /><span>Positive Highlights</span></Space>}>
              <List
                dataSource={session.highlights.filter((h) => h.type === "positive")}
                renderItem={(item) => (
                  <List.Item style={{ padding: "10px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", marginTop: 7, flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, color: "#374151" }}>{item.text}</Text>
                    </div>
                  </List.Item>
                )}
                locale={{ emptyText: "No positive highlights" }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card variant="borderless" title={<Space><CloseCircleOutlined style={{ color: "#EF4444" }} /><span>Areas for Improvement</span></Space>}>
              <List
                dataSource={session.highlights.filter((h) => h.type === "negative")}
                renderItem={(item) => (
                  <List.Item style={{ padding: "10px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", marginTop: 7, flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, color: "#374151" }}>{item.text}</Text>
                    </div>
                  </List.Item>
                )}
                locale={{ emptyText: "No improvement areas" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {session.transcript && session.transcript.length > 0 && (
        <Card title="Transcript" variant="borderless" style={{ marginTop: 20 }}>
          <div style={{ maxHeight: 500, overflowY: "auto", padding: "8px 0" }}>
            {session.transcript.map((entry, i) => (
              <div
                key={i}
                className="transcript-bubble"
                style={{
                  display: "flex",
                  justifyContent: entry.role === "agent" ? "flex-start" : "flex-end",
                  marginBottom: 16,
                  animationDelay: `${Math.min(i * 50, 500)}ms`,
                }}
              >
                <div
                  style={{
                    maxWidth: "70%", padding: "12px 16px",
                    borderRadius: entry.role === "agent" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                    background: entry.role === "agent" ? "#F3F4F6" : "linear-gradient(135deg, #0112AA, #2563EB)",
                    color: entry.role === "agent" ? "#374151" : "#fff",
                    boxShadow: entry.role === "agent" ? "none" : "0 2px 8px rgba(1, 18, 170, 0.2)",
                  }}
                >
                  <Text strong style={{ fontSize: 11, display: "block", marginBottom: 4, color: entry.role === "agent" ? "#9CA3AF" : "rgba(255,255,255,0.7)" }}>
                    {entry.role === "agent" ? "AI Agent" : "Customer (User)"}
                  </Text>
                  <Text style={{ color: entry.role === "agent" ? "#374151" : "#fff", fontSize: 13, lineHeight: 1.6 }}>
                    {entry.content}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/training/SessionDetail.tsx
git commit -m "feat: update SessionDetail UI with collapsible category breakdown accordion"
```

---

## Task 7: Update `useBrowserCall` Hook Types

**Files:**
- Modify: `apps/web/src/hooks/useBrowserCall.ts:27-34`

**Step 1: Update `InlineFeedback` interface**

The `feedback_breakdown` field type changed. Since it's stored as JSONB and comes from the API as a raw object, the type reference already works — `FeedbackBreakdown` is the updated type from `@repo/shared`. No code changes needed if the import is already there.

Verify the import at line 5: `import type { FeedbackBreakdown, SessionHighlight } from "@repo/shared";` — this will automatically pick up the new type.

**Step 2: Verify build**

Run: `cd /Users/lidan/Projects/o2-slovakia && pnpm build`

The build should pass now with all changes in place.

**Step 3: Commit if any changes were needed**

```bash
git add -A
git commit -m "fix: ensure all type references align with new FeedbackBreakdown shape"
```

---

## Task 8: Build Verification and End-to-End Test

**Step 1: Verify the build**

Run: `cd /Users/lidan/Projects/o2-slovakia && pnpm build`

Expected: Clean build with no TypeScript errors.

**Step 2: Manual smoke test**

If a dev server is available, test:
1. Navigate to a completed session
2. Click "Generate Feedback"
3. Verify 6 parallel API calls fire (check server logs)
4. Verify the response contains `feedback_breakdown.categories` with per-item scores
5. Verify the UI shows the collapsible accordion
6. Verify score + star rating are computed correctly

**Step 3: Final commit with all fixes**

```bash
git add -A
git commit -m "feat: complete parallel category-based evaluation system

Replaces single-LLM-call feedback with 6 parallel GPT-4o evaluators,
one per O2 Slovakia evaluation category. Each evaluator scores specific
sub-metrics as passed/partially_passed/failed. Deterministic aggregation
computes weighted final score and star rating.

Categories: Communication Standards (10%), Active Listening (15%),
Solution (30%), Attitude (15%), Sales (30%, frontline only), WAU Effect (bonus).

- New: apps/web/src/lib/evaluation/ (types, categories, prompts, evaluator, scoring)
- Updated: llm.ts, feedback.ts, SessionDetail.tsx, shared types/constants
- UI: Collapsible accordion with per-item pass/partial/fail badges"
```
