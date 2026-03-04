import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/authorize";

const InviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "team_manager", "user"]),
  team_id: z.string().uuid().optional(),
  resend: z.boolean().optional(),
});

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

    // Resend invite for existing user
    if (resend) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id, status")
        .eq("email", email)
        .single();

      if (!existingUser || existingUser.status !== "invited") {
        return NextResponse.json({ error: "User is not in invited state" }, { status: 400 });
      }

      const { error: reinviteError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          data: { name, role },
        });

      if (reinviteError) {
        return NextResponse.json({ error: reinviteError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // Invite via Supabase Auth (sends magic link email)
    // Note: redirectTo is omitted — custom email template in supabase/templates/invite.html
    // links directly to /auth/confirm with token_hash as a query parameter
    const { data: authData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { name, role },
      });

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create auth user" }, { status: 500 });
    }

    // Insert into users table
    const effectiveTeamId = team_id ?? (auth.user.role === "team_manager" ? auth.user.teamId : null);

    const { data: user, error: insertError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        name,
        email,
        role,
        team_id: effectiveTeamId,
        invited_by: auth.user.id,
      })
      .select("*, team:teams(*)")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
