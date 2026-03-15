import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { createServerClient } from "@supabase/ssr";

const AcceptSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!/^[0-9a-f]{64}$/.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = AcceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Look up invitation
    const { data: invitation, error: lookupError } = await supabase
      .from("invitations")
      .select("*")
      .eq("invitation_token", token)
      .single();

    if (lookupError || !invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status}` },
        { status: 410 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from("invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: parsed.data.password,
      email_confirm: true,
      app_metadata: { role: invitation.role },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create auth user" }, { status: 500 });
    }

    // Update users row created by the DB trigger with full invitation data
    const { error: userError } = await supabase
      .from("users")
      .update({
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        team_id: invitation.team_id,
        invited_by: invitation.invited_by,
      })
      .eq("id", authData.user.id);

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    // Sign user in — set session cookies on the response
    const response = NextResponse.json({
      success: true,
      role: invitation.role,
      redirectPath:
        invitation.role === "user" ? "/my-dashboard" : "/dashboard",
    });

    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options?: Record<string, unknown>;
            }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    await sessionClient.auth.signInWithPassword({
      email: invitation.email,
      password: parsed.data.password,
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
