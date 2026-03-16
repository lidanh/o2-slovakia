import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Validate token format (64 hex chars)
    if (!/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: invitation, error } = await supabase
      .from("invitations")
      .select("*, team:teams(name), tenant:tenants(name)")
      .eq("invitation_token", token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // If expired, update status
    if (invitation.status === "pending" && new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from("invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      invitation.status = "expired";
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}`, status: invitation.status },
        { status: 410 }
      );
    }

    // Fetch inviter name separately
    let inviterName: string | null = null;
    if (invitation.invited_by) {
      const { data: inviter } = await supabase
        .from("users")
        .select("name")
        .eq("id", invitation.invited_by)
        .single();
      inviterName = inviter?.name ?? null;
    }

    // Check if user already exists (for existing user flow)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", invitation.email)
      .single();

    return NextResponse.json({
      email: invitation.email,
      name: invitation.name,
      role: invitation.role,
      team_name: invitation.team?.name ?? null,
      tenant_name: invitation.tenant?.name ?? null,
      inviter_name: inviterName,
      expires_at: invitation.expires_at,
      existing_user: !!existingUser,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
