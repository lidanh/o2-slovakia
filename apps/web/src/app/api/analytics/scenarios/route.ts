import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: sessions, error } = await supabase
      .from("training_sessions")
      .select("scenario_id, scenario:scenarios(name)");

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
