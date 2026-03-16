import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

const CreateTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const withStats = searchParams.get("withStats") === "true";
    const tenantId = auth.user.tenantId;

    const supabase = createServiceClient();
    const teamIds = await getAccessibleTeamIds(auth.user);

    let query = supabase
      .from("teams")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (teamIds) {
      query = query.in("id", teamIds);
    }

    const { data: teams, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get members via tenant_memberships
    const teamIdList = (teams ?? []).map((t) => t.id);
    const { data: memberships } = await supabase
      .from("tenant_memberships")
      .select("user_id, team_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("team_id", teamIdList.length > 0 ? teamIdList : ["__none__"]);

    // Group members by team
    const membersByTeam = new Map<string, string[]>();
    for (const m of memberships ?? []) {
      if (!m.team_id) continue;
      const arr = membersByTeam.get(m.team_id) ?? [];
      arr.push(m.user_id);
      membersByTeam.set(m.team_id, arr);
    }

    if (!withStats) {
      const result = (teams ?? []).map((t) => ({
        ...t,
        member_count: membersByTeam.get(t.id)?.length ?? 0,
      }));
      return NextResponse.json(result);
    }

    // Collect all member IDs across all teams
    const allMemberIds: string[] = [];
    for (const ids of membersByTeam.values()) {
      allMemberIds.push(...ids);
    }

    // Batch-fetch all training sessions for all members
    let allSessions: { user_id: string; score: number | null; status: string }[] = [];
    if (allMemberIds.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("user_id, score, status")
        .eq("tenant_id", tenantId)
        .in("user_id", allMemberIds);
      allSessions = sessions ?? [];
    }

    // Group sessions by user_id
    const sessionsByUser = new Map<string, typeof allSessions>();
    for (const s of allSessions) {
      const arr = sessionsByUser.get(s.user_id) ?? [];
      arr.push(s);
      sessionsByUser.set(s.user_id, arr);
    }

    const result = (teams ?? []).map((t) => {
      const memberIds = membersByTeam.get(t.id) ?? [];
      const memberAverages: number[] = [];
      let totalSessions = 0;

      for (const mId of memberIds) {
        const userSessions = sessionsByUser.get(mId) ?? [];
        totalSessions += userSessions.length;
        const scored = userSessions
          .filter((s) => s.status === "completed" && isValidScore(s.score))
          .map((s) => s.score as number);
        const avg = averageScore(scored);
        if (avg !== null) {
          memberAverages.push(avg);
        }
      }

      const avgScore = averageScore(memberAverages);

      return {
        ...t,
        member_count: memberIds.length,
        avg_score: avgScore,
        total_sessions: totalSessions,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = CreateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .insert({ ...parsed.data, tenant_id: auth.user.tenantId })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
