import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (email) {
      const supabase = createServiceClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5050";

      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
      });
    }
  } catch {
    // Intentionally swallow errors to not reveal if email exists
  }

  // Always return 200
  return NextResponse.json({ ok: true });
}
