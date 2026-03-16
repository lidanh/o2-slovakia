import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole, getAccessibleTeamIds, getAuthUser } from "@/lib/auth/authorize";
import type { UserRole } from "@repo/shared";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  role: z.enum(["admin", "team_manager", "user"]).optional(),
  team_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    if (auth.user.role === "user" && auth.user.id !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;

    // Check user belongs to this tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("role, team_id")
      .eq("user_id", id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!membership && auth.user.id !== id) {
      return NextResponse.json({ error: "User not found in this tenant" }, { status: 404 });
    }

    if (auth.user.role === "team_manager" && membership) {
      const teamIds = await getAccessibleTeamIds(auth.user);
      if (teamIds && (!membership.team_id || !teamIds.includes(membership.team_id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch user with their tenant-scoped data
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Fetch assignments and sessions scoped to tenant
    const { data: assignments } = await supabase
      .from("assignments")
      .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("user_id", id)
      .eq("tenant_id", tenantId);

    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("user_id", id)
      .eq("tenant_id", tenantId);

    // Get team data
    let team = null;
    if (membership?.team_id) {
      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("id", membership.team_id)
        .single();
      team = teamData;
    }

    return NextResponse.json({
      ...user,
      role: membership?.role ?? "user",
      team_id: membership?.team_id ?? null,
      team,
      assignments: assignments ?? [],
      training_sessions: sessions ?? [],
    });
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
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;

    // Check user belongs to this tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("id, role, team_id")
      .eq("user_id", id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "User not found in this tenant" }, { status: 404 });
    }

    if (auth.user.role === "team_manager") {
      const teamIds = await getAccessibleTeamIds(auth.user);
      if (teamIds && (!membership.team_id || !teamIds.includes(membership.team_id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Split: profile fields go to users table, role/team go to membership
    const { role, team_id, ...profileFields } = parsed.data;

    if (Object.keys(profileFields).length > 0) {
      const { error } = await supabase
        .from("users")
        .update({ ...profileFields, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update membership fields
    const membershipUpdate: Record<string, unknown> = {};
    if (role !== undefined) membershipUpdate.role = role;
    if (team_id !== undefined) membershipUpdate.team_id = team_id;

    if (Object.keys(membershipUpdate).length > 0) {
      const { error } = await supabase
        .from("tenant_memberships")
        .update(membershipUpdate)
        .eq("id", membership.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Sync role to auth metadata if this is the user's current tenant
      if (role) {
        const { data: authUser } = await supabase.auth.admin.getUserById(id);
        if (authUser?.user?.app_metadata?.current_tenant_id === tenantId) {
          await supabase.auth.admin.updateUserById(id, {
            app_metadata: { ...authUser.user.app_metadata, role },
          });
        }
      }
    }

    // Return updated user with membership data
    const { data: updatedUser } = await supabase.from("users").select("*").eq("id", id).single();
    const { data: updatedMembership } = await supabase
      .from("tenant_memberships")
      .select("role, team_id")
      .eq("id", membership.id)
      .single();

    let team = null;
    if (updatedMembership?.team_id) {
      const { data: teamData } = await supabase.from("teams").select("*").eq("id", updatedMembership.team_id).single();
      team = teamData;
    }

    return NextResponse.json({
      ...updatedUser,
      role: (updatedMembership?.role ?? membership.role) as UserRole,
      team_id: updatedMembership?.team_id ?? null,
      team,
    });
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

    // Deactivate membership in this tenant (don't delete the user globally)
    const { error } = await supabase
      .from("tenant_memberships")
      .update({ is_active: false })
      .eq("user_id", id)
      .eq("tenant_id", auth.user.tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
