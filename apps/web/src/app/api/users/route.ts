import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  team_id: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);

    // Return pending invitations instead of users
    if (searchParams.get("invitations") === "pending") {
      let query = supabase
        .from("invitations")
        .select("*, team:teams(*)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (auth.user.role === "team_manager") {
        const teamIds = await getAccessibleTeamIds(auth.user);
        if (teamIds) {
          query = query.in("team_id", teamIds);
        }
      }

      const { data, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // Default: return users
    const teamIds = await getAccessibleTeamIds(auth.user);

    let query = supabase
      .from("users")
      .select("*, team:teams(*)")
      .order("created_at", { ascending: false });

    if (teamIds) {
      query = query.in("team_id", teamIds);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("cancelInvitation");

    if (!invitationId) {
      return NextResponse.json({ error: "Missing cancelInvitation param" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("invitations")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("status", "pending");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("users")
      .insert(parsed.data)
      .select("*, team:teams(*)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
