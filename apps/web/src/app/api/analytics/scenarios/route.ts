import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
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

    let sessionsQuery = supabase
      .from("training_sessions")
      .select("scenario_id, scenario:scenarios(name), user_id");

    if (scopedUserIds) {
      sessionsQuery = sessionsQuery.in("user_id", scopedUserIds);
    }

    const { data: sessions, error } = await sessionsQuery;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const counts: Record<string, { scenario_name: string; session_count: number }> = {};

    for (const s of sessions ?? []) {
      const id = s.scenario_id as string;
      if (!counts[id]) {
        const scenario = s.scenario as { name: string } | { name: string }[] | null;
        const name = Array.isArray(scenario) ? scenario[0]?.name ?? "Unknown" : scenario?.name ?? "Unknown";
        counts[id] = { scenario_name: name, session_count: 0 };
      }
      counts[id].session_count++;
    }

    const stats = Object.values(counts).sort((a, b) => b.session_count - a.session_count);

    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
