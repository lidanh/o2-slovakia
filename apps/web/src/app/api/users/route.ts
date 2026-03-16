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
    const tenantId = auth.user.tenantId;

    // Return pending invitations instead of users
    if (searchParams.get("invitations") === "pending") {
      let query = supabase
        .from("invitations")
        .select("*, team:teams(*)")
        .eq("tenant_id", tenantId)
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

    // Default: return users in this tenant via memberships
    const teamIds = await getAccessibleTeamIds(auth.user);

    // Get user IDs that belong to this tenant
    let membershipQuery = supabase
      .from("tenant_memberships")
      .select("user_id, role, team_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (teamIds) {
      membershipQuery = membershipQuery.in("team_id", teamIds);
    }

    const { data: memberships } = await membershipQuery;
    const userIds = (memberships ?? []).map((m) => m.user_id);

    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Merge membership data into user objects for backward compatibility
    const membershipMap = new Map((memberships ?? []).map((m) => [m.user_id, m]));

    // Fetch teams for this tenant
    const { data: teams } = await supabase
      .from("teams")
      .select("*")
      .eq("tenant_id", tenantId);
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

    const enriched = (users ?? []).map((u) => {
      const m = membershipMap.get(u.id);
      return {
        ...u,
        role: m?.role ?? "user",
        team_id: m?.team_id ?? null,
        team: m?.team_id ? teamMap.get(m.team_id) ?? null : null,
      };
    });

    return NextResponse.json(enriched);
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
      .eq("tenant_id", auth.user.tenantId)
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
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
