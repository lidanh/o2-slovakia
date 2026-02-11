import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";
import type { LeaderboardEntry } from "@repo/shared";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;
    const supabase = createServiceClient();

    const { data: sessions, error: sError } = await supabase
      .from("training_sessions")
      .select("user_id, score, star_rating, status")
      .eq("status", "completed");

    if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });

    const { data: users } = await supabase
      .from("users")
      .select("id, name, team:teams(name)");

    const userMap = new Map(
      (users ?? []).map((u: Record<string, unknown>) => {
        const team = u.team as { name: string } | { name: string }[] | null;
        const teamName = Array.isArray(team) ? team[0]?.name ?? null : team?.name ?? null;
        return [u.id as string, { name: u.name as string, team_name: teamName }];
      })
    );

    const userSessions: Record<string, { scores: number[]; stars: number[]; count: number }> = {};
    for (const s of sessions ?? []) {
      if (!userSessions[s.user_id]) userSessions[s.user_id] = { scores: [], stars: [], count: 0 };
      userSessions[s.user_id].count++;
      if (isValidScore(s.score)) userSessions[s.user_id].scores.push(s.score);
      if (s.star_rating !== null) userSessions[s.user_id].stars.push(s.star_rating as number);
    }

    const topPerformers: LeaderboardEntry[] = Object.entries(userSessions)
      .filter(([, data]) => data.scores.length > 0)
      .map(([userId, data]) => ({
        user_id: userId,
        user_name: userMap.get(userId)?.name ?? "Unknown",
        team_name: userMap.get(userId)?.team_name ?? null,
        avg_score: averageScore(data.scores) ?? 0,
        total_sessions: data.count,
        avg_star_rating:
          data.stars.length > 0
            ? Math.round((data.stars.reduce((a, b) => a + b, 0) / data.stars.length) * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, limit);

    return NextResponse.json(topPerformers);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
