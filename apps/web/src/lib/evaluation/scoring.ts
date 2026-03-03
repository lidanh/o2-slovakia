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
  _salesIncluded: boolean
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
