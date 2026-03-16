import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { createServerClient } from "@supabase/ssr";

const AcceptSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
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

    // Check if user already exists (existing user joining new tenant)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", invitation.email)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // Existing user — just create membership, no password needed
      userId = existingUser.id;

      // Update user name if needed
      await supabase
        .from("users")
        .update({ name: invitation.name })
        .eq("id", userId);
    } else {
      // New user — require password
      if (!parsed.data.password) {
        return NextResponse.json({ error: "Password is required for new accounts" }, { status: 400 });
      }

      isNewUser = true;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: invitation.email,
        password: parsed.data.password,
        email_confirm: true,
        app_metadata: {
          role: invitation.role,
          current_tenant_id: invitation.tenant_id,
        },
      });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      if (!authData.user) {
        return NextResponse.json({ error: "Failed to create auth user" }, { status: 500 });
      }

      userId = authData.user.id;

      // Update users row created by the DB trigger with full invitation data
      const { error: userError } = await supabase
        .from("users")
        .update({
          name: invitation.name,
          email: invitation.email,
        })
        .eq("id", userId);

      if (userError) {
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }
    }

    // Create tenant membership
    const { error: membershipError } = await supabase
      .from("tenant_memberships")
      .insert({
        tenant_id: invitation.tenant_id,
        user_id: userId,
        role: invitation.role,
        team_id: invitation.team_id,
        invited_by: invitation.invited_by,
      });

    if (membershipError) {
      // If user was just created, clean up
      if (isNewUser) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    // Set current_tenant_id in app_metadata (spread existing to avoid clobbering)
    const { data: { user: existingAuthUser } } = await supabase.auth.admin.getUserById(userId);
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existingAuthUser?.app_metadata,
        current_tenant_id: invitation.tenant_id,
        role: invitation.role,
      },
    });

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
      isNewUser,
      redirectPath:
        invitation.role === "user" ? "/my-dashboard" : "/dashboard",
    });

    // Only sign in if we have a password (new user or existing user provided one)
    if (parsed.data.password) {
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
    }

    return response;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
