import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/authorize";
import { sendInvitationEmail } from "@/lib/email/send";

const InviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "team_manager", "user"]),
  team_id: z.string().uuid().optional(),
  resend: z.boolean().optional(),
});

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:5050";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, role, team_id, resend } = parsed.data;
    const tenantId = auth.user.tenantId;

    // Team managers can only invite 'user' role into their own team
    if (auth.user.role === "team_manager") {
      if (role !== "user") {
        return NextResponse.json(
          { error: "Team managers can only invite users" },
          { status: 403 }
        );
      }
      if (team_id && team_id !== auth.user.teamId) {
        return NextResponse.json(
          { error: "Team managers can only invite into their own team" },
          { status: 403 }
        );
      }
    }

    const supabase = createServiceClient();
    const effectiveTeamId = team_id ?? (auth.user.role === "team_manager" ? auth.user.teamId : null);

    // Validate team belongs to current tenant
    if (effectiveTeamId) {
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("id", effectiveTeamId)
        .eq("tenant_id", tenantId)
        .single();

      if (!team) {
        return NextResponse.json({ error: "Team not found in this tenant" }, { status: 400 });
      }
    }

    if (resend) {
      // Cancel existing pending invitation for this tenant
      await supabase
        .from("invitations")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("email", email)
        .eq("tenant_id", tenantId)
        .eq("status", "pending");
    } else {
      // Check no pending invitation already exists for this tenant
      const { data: existing } = await supabase
        .from("invitations")
        .select("id")
        .eq("email", email)
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .single();

      if (existing) {
        return NextResponse.json(
          { error: "A pending invitation already exists for this email in this tenant" },
          { status: 409 }
        );
      }

      // Check if user already has an active membership in this tenant
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        const { data: existingMembership } = await supabase
          .from("tenant_memberships")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .single();

        if (existingMembership) {
          return NextResponse.json(
            { error: "User already belongs to this tenant" },
            { status: 409 }
          );
        }
      }
    }

    // Get tenant name for email
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const tenantName = tenant?.name ?? "the platform";

    // Create new invitation with tenant_id
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        email,
        name,
        role,
        team_id: effectiveTeamId,
        invited_by: auth.user.id,
        tenant_id: tenantId,
      })
      .select("*, team:teams(*)")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Get inviter name for email
    const { data: inviterProfile } = await supabase
      .from("users")
      .select("name")
      .eq("id", auth.user.id)
      .single();

    const inviterName = inviterProfile?.name ?? "An administrator";
    const inviteUrl = `${getBaseUrl()}/invite/${invitation.invitation_token}`;

    await sendInvitationEmail(email, inviterName, inviteUrl, tenantName);

    return NextResponse.json(invitation, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
