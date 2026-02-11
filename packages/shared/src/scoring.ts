export function isValidScore(score: number | null | undefined): score is number {
  return score != null && score > 0;
}

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

export function computeAvgScore<T extends { score: number | null; status: string }>(
  sessions: T[]
): number | null {
  const valid = sessions
    .filter((s) => s.status === "completed" && isValidScore(s.score))
    .map((s) => s.score as number);
  return averageScore(valid);
}
