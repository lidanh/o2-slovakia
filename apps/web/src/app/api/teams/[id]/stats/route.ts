import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";

interface Member {
  id: string;
  name: string;
}

interface Session {
  user_id: string;
  score: number | null;
  status: string;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: team, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const members: Member[] = team.members ?? [];
    const memberIds = members.map((m) => m.id);

    if (memberIds.length === 0) {
      return NextResponse.json({
        avgScore: null,
        totalSessions: 0,
        completedSessions: 0,
        members: [],
      });
    }

    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("user_id, score, status, created_at")
      .in("user_id", memberIds);

    const allSessions: Session[] = sessions ?? [];

    // Group sessions by user_id
    const sessionsByUser = new Map<string, Session[]>();
    for (const s of allSessions) {
      const arr = sessionsByUser.get(s.user_id) ?? [];
      arr.push(s);
      sessionsByUser.set(s.user_id, arr);
    }

    let totalSessions = 0;
    let completedSessions = 0;
    const memberAverages: number[] = [];

    const memberStats = members.map((m) => {
      const userSessions = sessionsByUser.get(m.id) ?? [];
      const completed = userSessions.filter((s) => s.status === "completed");
      const scored = completed.filter((s) => isValidScore(s.score));

      totalSessions += userSessions.length;
      completedSessions += completed.length;

      const scores = scored.map((s) => s.score as number);
      const avgScore = averageScore(scores);
      if (avgScore !== null) {
        memberAverages.push(avgScore);
      }

      const lastSession =
        userSessions.length > 0
          ? userSessions.reduce((latest, s) =>
              s.created_at > latest.created_at ? s : latest
            ).created_at
          : null;

      return {
        userId: m.id,
        userName: m.name,
        avgScore,
        totalSessions: userSessions.length,
        lastSessionDate: lastSession,
      };
    });

    // Sort by avgScore descending, nulls last
    memberStats.sort((a, b) => {
      if (a.avgScore === null && b.avgScore === null) return 0;
      if (a.avgScore === null) return 1;
      if (b.avgScore === null) return -1;
      return b.avgScore - a.avgScore;
    });

    const teamAvgScore = averageScore(memberAverages);

    return NextResponse.json({
      avgScore: teamAvgScore,
      totalSessions,
      completedSessions,
      members: memberStats,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
