import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";

const CreateTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const withStats = searchParams.get("withStats") === "true";

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!withStats) {
      const teams = data.map((t) => ({
        ...t,
        member_count: t.members?.length ?? 0,
        members: undefined,
      }));
      return NextResponse.json(teams);
    }

    // Collect all member IDs across all teams
    const allMemberIds: string[] = [];
    for (const t of data) {
      for (const m of t.members ?? []) {
        allMemberIds.push(m.id);
      }
    }

    // Batch-fetch all training sessions for all members
    let allSessions: { user_id: string; score: number | null; status: string }[] = [];
    if (allMemberIds.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("user_id, score, status")
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

    const teams = data.map((t) => {
      const members: { id: string }[] = t.members ?? [];
      const memberAverages: number[] = [];
      let totalSessions = 0;

      for (const m of members) {
        const userSessions = sessionsByUser.get(m.id) ?? [];
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
        member_count: members.length,
        members: undefined,
        avg_score: avgScore,
        total_sessions: totalSessions,
      };
    });

    return NextResponse.json(teams);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .insert(parsed.data)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
