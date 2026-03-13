import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token_hash = body?.token_hash;
  const type = body?.type;

  if (!token_hash || !type) {
    return NextResponse.json(
      { error: "Missing verification parameters" },
      { status: 400 }
    );
  }

  const redirectPath = type === "recovery" ? "/reset-password" : "/accept-invite";

  // Build response — Supabase cookie adapter writes session cookies here
  const response = NextResponse.json({ redirectPath });

  const supabase = createServerClient(
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

  const { error } = await supabase.auth.verifyOtp({
    type: type as
      | "invite"
      | "signup"
      | "magiclink"
      | "recovery"
      | "email_change",
    token_hash,
  });

  if (error) {
    console.error("[api/auth/verify-otp] verifyOtp failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // For recovery, user already exists — skip row creation
  if (type !== "recovery") {
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
        const { count } = await service
          .from("users")
          .select("*", { count: "exact", head: true });

        await service.from("users").insert({
          id: user.id,
          name:
            user.user_metadata?.name || user.email?.split("@")[0] || "User",
          email: user.email!,
          role: count === 0 ? "admin" : "user",
          status: "invited",
        });
      }
    }
  }

  return response;
}
