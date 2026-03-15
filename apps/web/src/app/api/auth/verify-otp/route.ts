import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  // Only recovery flow is supported here now (invites use custom token system)
  if (type !== "recovery") {
    return NextResponse.json(
      { error: "Unsupported verification type" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ redirectPath: "/reset-password" });

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
    type: "recovery",
    token_hash,
  });

  if (error) {
    console.error("[api/auth/verify-otp] verifyOtp failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return response;
}
