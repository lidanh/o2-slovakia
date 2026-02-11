import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeAvgScore } from "@repo/shared";
import type { AnalyticsKPIs } from "@repo/shared";

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

    return NextResponse.json(kpis);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
