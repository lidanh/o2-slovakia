import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidScore, averageScore } from "@repo/shared";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

const UpdateTeamSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const { id } = await params;
    const tenantId = auth.user.tenantId;

    const teamIds = await getAccessibleTeamIds(auth.user);
    if (teamIds && !teamIds.includes(id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Get members via tenant_memberships
    const { data: memberships } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("team_id", id)
      .eq("is_active", true);

    const memberIds = (memberships ?? []).map((m) => m.user_id);
    let members: Record<string, unknown>[] = [];
    if (memberIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("*")
        .in("id", memberIds);
      members = users ?? [];
    }

    // Compute analytics for team
    let analytics = { totalSessions: 0, avgScore: 0, completedSessions: 0 };

    if (memberIds.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("score, status")
        .eq("tenant_id", tenantId)
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

    return NextResponse.json({ ...data, members, analytics });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

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
      .eq("tenant_id", auth.user.tenantId)
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
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", id)
      .eq("tenant_id", auth.user.tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
