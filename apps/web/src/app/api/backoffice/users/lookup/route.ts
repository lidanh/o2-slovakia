import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperadmin } from "@/lib/auth/authorize";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("email", email)
      .single();

    if (data) {
      return NextResponse.json({ exists: true, user: data });
    }

    return NextResponse.json({ exists: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
