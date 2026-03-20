import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const STALE_THRESHOLD_HOURS = 1;

/**
 * Marks training sessions stuck in "initiated" or "in_progress" for over 1 hour
 * as "completed" (abandoned). Assignment status is derived from sessions at read
 * time, so no assignment updates are needed.
 *
 * Can be called via cron or manually. Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(
    Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000
  ).toISOString();

  // Find stale sessions
  const { data: staleSessions, error: fetchErr } = await supabase
    .from("training_sessions")
    .select("id, assignment_id, status")
    .in("status", ["initiated", "in_progress"])
    .lt("created_at", cutoff);

  if (fetchErr) {
    console.error("[cleanup] Failed to fetch stale sessions:", fetchErr);
    return NextResponse.json(
      { error: "Failed to fetch stale sessions" },
      { status: 500 }
    );
  }

  if (!staleSessions || staleSessions.length === 0) {
    return NextResponse.json({ cleaned: 0 });
  }

  const sessionIds = staleSessions.map((s) => s.id);

  // Mark sessions as completed (abandoned)
  const { error: updateErr } = await supabase
    .from("training_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .in("id", sessionIds);

  if (updateErr) {
    console.error("[cleanup] Failed to update stale sessions:", updateErr);
    return NextResponse.json(
      { error: "Failed to update stale sessions" },
      { status: 500 }
    );
  }

  console.log(`[cleanup] Cleaned ${sessionIds.length} stale sessions`);
  return NextResponse.json({ cleaned: sessionIds.length });
}
