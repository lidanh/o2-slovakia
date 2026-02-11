import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const scenarioId = searchParams.get("scenarioId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    let query = supabase
      .from("training_sessions")
      .select(
        "*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)",
        { count: "exact" }
      );

    if (userId) query = query.eq("user_id", userId);
    if (scenarioId) query = query.eq("scenario_id", scenarioId);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, total: count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
