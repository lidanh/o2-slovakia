import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUser, getAccessibleTeamIds } from "@/lib/auth/authorize";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const scenarioId = searchParams.get("scenarioId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const tenantId = auth.user.tenantId;

    let query = supabase
      .from("training_sessions")
      .select(
        "*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)",
        { count: "exact" }
      )
      .eq("tenant_id", tenantId);

    if (userId) query = query.eq("user_id", userId);
    if (scenarioId) query = query.eq("scenario_id", scenarioId);
    if (status) query = query.eq("status", status);

    // Role-based scoping
    if (auth.user.role === "user") {
      query = query.eq("user_id", auth.user.id);
    } else if (auth.user.role === "team_manager") {
      const teamIds = await getAccessibleTeamIds(auth.user);
      if (teamIds) {
        const { data: teamMemberships } = await supabase
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .in("team_id", teamIds);
        const userIds = (teamMemberships ?? []).map((m) => m.user_id);
        query = query.in("user_id", userIds.length > 0 ? userIds : ["__none__"]);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, total: count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
