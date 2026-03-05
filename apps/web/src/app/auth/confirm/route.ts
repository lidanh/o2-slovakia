import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/service";

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5050";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!token_hash || !type) {
    return redirectToLogin("Missing verification parameters");
  }

  // Prepare redirect (will set cookies on this response)
  const redirectPath = type === "recovery" ? "/reset-password" : "/accept-invite";
  const response = NextResponse.redirect(new URL(redirectPath, getSiteUrl()));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Verify the OTP token — this creates a session server-side
  const { error } = await supabase.auth.verifyOtp({
    type: type as "invite" | "signup" | "magiclink" | "recovery" | "email_change",
    token_hash,
  });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed:", error.message);
    return redirectToLogin(error.message);
  }

  // For recovery, user already exists — skip row creation
  if (type !== "recovery") {
    // Ensure user has a record in public.users
    // (handles Dashboard invites where our API didn't create the row)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const service = createServiceClient();
      const { data: existingUser } = await service
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // Dashboard invite — create users row
        const { count } = await service
          .from("users")
          .select("*", { count: "exact", head: true });

        await service.from("users").insert({
          id: user.id,
          name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
          email: user.email!,
          role: count === 0 ? "admin" : "user",
          status: "invited",
        });
      }
    }
  }

  return response;
}

function redirectToLogin(error: string) {
  const url = new URL("/login", getSiteUrl());
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
