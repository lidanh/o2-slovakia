import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";
import type { LeaderboardEntry } from "@repo/shared";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;
    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;
    const teamIds = await getAccessibleTeamIds(auth.user);

    let scopedUserIds: string[] | null = null;
    if (teamIds) {
      const { data: memberships } = await supabase
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("team_id", teamIds);
      scopedUserIds = (memberships ?? []).map((m) => m.user_id);
    }

    let sessionsQuery = supabase
      .from("training_sessions")
      .select("user_id, score, star_rating, status")
      .eq("tenant_id", tenantId)
      .eq("status", "completed");

    if (scopedUserIds) {
      sessionsQuery = sessionsQuery.in("user_id", scopedUserIds);
    }

    const { data: sessions, error: sError } = await sessionsQuery;

    if (sError) return NextResponse.json({ error: sError.message }, { status: 500 });

    // Get users and team info via memberships
    let membershipQuery = supabase
      .from("tenant_memberships")
      .select("user_id, team_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    if (scopedUserIds) {
      membershipQuery = membershipQuery.in("user_id", scopedUserIds);
    }
    const { data: memberships } = await membershipQuery;
    const memberUserIds = (memberships ?? []).map((m) => m.user_id);
    const membershipMap = new Map((memberships ?? []).map((m) => [m.user_id, m.team_id]));

    let users: Record<string, unknown>[] = [];
    if (memberUserIds.length > 0) {
      const { data: usersData } = await supabase.from("users").select("id, name").in("id", memberUserIds);
      users = usersData ?? [];
    }

    const { data: teams } = await supabase.from("teams").select("id, name").eq("tenant_id", tenantId);
    const teamNameMap = new Map((teams ?? []).map((t) => [t.id, t.name]));

    const userMap = new Map(
      users.map((u) => {
        const teamId = membershipMap.get(u.id as string);
        return [u.id as string, { name: u.name as string, team_name: teamId ? teamNameMap.get(teamId) ?? null : null }];
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
