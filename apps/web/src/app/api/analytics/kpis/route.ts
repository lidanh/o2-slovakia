import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeAvgScore } from "@repo/shared";
import type { AnalyticsKPIs } from "@repo/shared";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

export async function GET() {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const teamIds = await getAccessibleTeamIds(auth.user);

    // If team_manager, get user IDs in accessible teams
    let scopedUserIds: string[] | null = null;
    if (teamIds) {
      const { data: teamUsers } = await supabase
        .from("users")
        .select("id")
        .in("team_id", teamIds);
      scopedUserIds = (teamUsers ?? []).map((u) => u.id);
    }

    // Fetch sessions (scoped if needed)
    let sessionsQuery = supabase
      .from("training_sessions")
      .select("id, user_id, score, call_duration, status, star_rating, created_at");

    if (scopedUserIds) {
      sessionsQuery = sessionsQuery.in("user_id", scopedUserIds);
    }

    const { data: sessions, error: sError } = await sessionsQuery;

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

    // Total users and active scenarios (scoped for team_manager)
    let usersQuery = supabase.from("users").select("*", { count: "exact", head: true });
    if (scopedUserIds) {
      usersQuery = usersQuery.in("id", scopedUserIds);
    }
    const { count: totalUsers } = await usersQuery;

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

    return NextResponse.json(kpis);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
