import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperadmin } from "@/lib/auth/authorize";
import { sendInvitationEmail } from "@/lib/email/send";
import crypto from "crypto";

const AddUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "team_manager", "user"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data: memberships, error } = await supabase
      .from("tenant_memberships")
      .select("*, user:users(id, name, email, avatar_url)")
      .eq("tenant_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(memberships ?? []);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id: tenantId } = await params;
    const body = await request.json();
    const parsed = AddUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { email, name, role } = parsed.data;
    const supabase = createServiceClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      // Check if already a member of this tenant
      const { data: existingMembership } = await supabase
        .from("tenant_memberships")
        .select("id, is_active")
        .eq("tenant_id", tenantId)
        .eq("user_id", existingUser.id)
        .single();

      if (existingMembership?.is_active) {
        return NextResponse.json({ error: "User already belongs to this tenant" }, { status: 409 });
      }

      if (existingMembership && !existingMembership.is_active) {
        // Reactivate existing membership
        const { error } = await supabase
          .from("tenant_memberships")
          .update({ is_active: true, role, updated_at: new Date().toISOString() })
          .eq("id", existingMembership.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else {
        // Create new membership
        const { error } = await supabase
          .from("tenant_memberships")
          .insert({
            tenant_id: tenantId,
            user_id: existingUser.id,
            role,
            invited_by: auth.user.id || null,
          });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ action: "added", email }, { status: 201 });
    }

    // User doesn't exist — create invitation
    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: "A pending invitation already exists for this email" }, { status: 409 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: inviteError } = await supabase
      .from("invitations")
      .insert({
        tenant_id: tenantId,
        email,
        name,
        role,
        invitation_token: token,
        invited_by: auth.user.id || null,
        expires_at: expiresAt.toISOString(),
      });

    if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

    // Get tenant name and inviter name for email
    const [{ data: tenant }, { data: inviterProfile }] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenantId).single(),
      supabase.from("users").select("name").eq("id", auth.user.id).single(),
    ]);

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${token}`;
    const inviterName = inviterProfile?.name || auth.user.email;

    try {
      await sendInvitationEmail(email, inviterName, inviteUrl, tenant?.name);
    } catch {
      // Email send failure is non-critical — invitation still created
    }

    return NextResponse.json({ action: "invited", email }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "team_manager", "user"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id: tenantId } = await params;
    const body = await request.json();
    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { userId, role } = parsed.data;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("tenant_memberships")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, role });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Deactivate membership
    const { error } = await supabase
      .from("tenant_memberships")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
