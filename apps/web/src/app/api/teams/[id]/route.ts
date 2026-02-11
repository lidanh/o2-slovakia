import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";

const UpdateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Compute analytics for team
    const memberIds = (data.members ?? []).map((m: { id: string }) => m.id);
    let analytics = { totalSessions: 0, avgScore: 0, completedSessions: 0 };

    if (memberIds.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("score, status")
        .in("user_id", memberIds);

      if (sessions && sessions.length > 0) {
        const completed = sessions.filter((s) => s.status === "completed");
        const scores = completed.filter((s) => isValidScore(s.score)).map((s) => s.score as number);
        analytics = {
          totalSessions: sessions.length,
          completedSessions: completed.length,
          avgScore: averageScore(scores) ?? 0,
        };
      }
    }

    return NextResponse.json({ ...data, analytics });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
