import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperadmin } from "@/lib/auth/authorize";

const UpdateSettingsSchema = z.object({
  settings: z.record(z.unknown()),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ settings: data.settings ?? {} });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("tenants")
      .update({ settings: parsed.data.settings, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("settings")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ settings: data.settings ?? {} });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
