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
    verdict?: string;
    evidence?: string;
    improvements?: string[];
    example?: string;
  }[];
  highlights: SessionHighlight[];
  suggestions: string[];
  wau_bonus_percentage?: number; // Only for wau_effect category
}

// Context passed to each category evaluator
export interface EvaluationContext {
  scenarioName: string;
  difficultyName: string;
  scenarioPrompt?: string;
  scenarioType: "frontline" | "leadership";
  transcriptText: string;
}
