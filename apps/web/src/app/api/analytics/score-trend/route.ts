import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions, error } = await supabase
      .from("training_sessions")
      .select("score, created_at")
      .eq("status", "completed")
      .not("score", "is", null)
      .gt("score", 0)
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (error) {
      throw error;
    }

    const grouped: Record<string, { total: number; count: number }> = {};
    for (const session of sessions ?? []) {
      const date = session.created_at.slice(0, 10);
      if (!grouped[date]) {
        grouped[date] = { total: 0, count: 0 };
      }
      grouped[date].total += session.score;
      grouped[date].count += 1;
    }

    const trends = Object.entries(grouped)
      .map(([date, { total, count }]) => ({
        date,
        avg_score: Math.round((total / count) * 10) / 10,
        session_count: count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(trends);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
