import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole, getAccessibleTeamIds, getAuthUser } from "@/lib/auth/authorize";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  team_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // All authenticated users can access: admin=any, team_manager=own team, user=self
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    if (auth.user.role === "user" && auth.user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (auth.user.role === "team_manager") {
      const teamIds = await getAccessibleTeamIds(auth.user);
      if (teamIds) {
        const supabase = createServiceClient();
        const { data: target } = await supabase
          .from("users")
          .select("team_id")
          .eq("id", id)
          .single();
        if (!target || !target.team_id || !teamIds.includes(target.team_id)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .select("*, team:teams(*), assignments(*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)), training_sessions(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
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

    // admin=any, team_manager=own team members only
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    if (auth.user.role === "team_manager") {
      const teamIds = await getAccessibleTeamIds(auth.user);
      if (teamIds) {
        const supabase = createServiceClient();
        const { data: target } = await supabase
          .from("users")
          .select("team_id")
          .eq("id", id)
          .single();
        if (!target || !target.team_id || !teamIds.includes(target.team_id)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, team:teams(*)")
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
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
