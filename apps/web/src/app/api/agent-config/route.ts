import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/authorize";

const UpdateConfigSchema = z.object({
  config: z.record(z.unknown()),
});

export async function GET() {
  try {
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tenants")
      .select("id, settings, created_at, updated_at")
      .eq("id", auth.user.tenantId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return in backward-compatible format
    return NextResponse.json({
      id: data.id,
      config: data.settings,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireRole("admin");
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = UpdateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("tenants")
      .update({ settings: parsed.data.config, updated_at: new Date().toISOString() })
      .eq("id", auth.user.tenantId)
      .select("id, settings, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      id: data.id,
      config: data.settings,
      created_at: data.created_at,
      updated_at: data.updated_at,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
