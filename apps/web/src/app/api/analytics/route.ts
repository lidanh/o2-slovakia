import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore, computeAvgScore } from "@repo/shared";
import type { AnalyticsKPIs, LeaderboardEntry } from "@repo/shared";

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Fetch all sessions
    const { data: sessions, error: sError } = await supabase
      .from("training_sessions")
      .select("id, user_id, score, call_duration, status, star_rating, created_at");

    if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });

    // KPIs
    const totalSessions = sessions?.length ?? 0;
    const completedSessions = (sessions ?? []).filter((s) => s.status === "completed");
    const avgScore = computeAvgScore(sessions ?? []) ?? 0;
    const durationSessions = completedSessions.filter((s) => s.call_duration !== null);
    const avgCallDuration =
      durationSessions.length > 0
        ? Math.round(durationSessions.reduce((a, s) => a + (s.call_duration as number), 0) / durationSessions.length)
        : 0;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions.length / totalSessions) * 100) : 0;

    // Total users and active scenarios
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: activeScenarios } = await supabase
      .from("scenarios")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const kpis: AnalyticsKPIs = {
      totalSessions,
      avgScore,
      avgCallDuration,
      completionRate,
      totalUsers: totalUsers ?? 0,
      activeScenarios: activeScenarios ?? 0,
    };

    // Score trends (last 30 days, grouped by date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCompleted = completedSessions.filter(
      (s) => isValidScore(s.score) && new Date(s.created_at) >= thirtyDaysAgo
    );
    const byDate: Record<string, number[]> = {};
    for (const s of recentCompleted) {
      const date = s.created_at.slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(s.score as number);
    }
    const scoreTrends = Object.entries(byDate)
      .map(([date, scores]) => ({
        date,
        avgScore: averageScore(scores) ?? 0,
        count: scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top performers
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
    for (const s of completedSessions) {
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
      .slice(0, 10);

    return NextResponse.json({ kpis, scoreTrends, topPerformers });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
