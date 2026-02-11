import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const UpdateConfigSchema = z.object({
  config: z.record(z.unknown()),
});

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("agent_config")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      // If no config exists yet, return a default
      if (error.code === "PGRST116") {
        return NextResponse.json({ id: null, config: {}, created_at: null, updated_at: null });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UpdateConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check if a config row exists
    const { data: existing } = await supabase
      .from("agent_config")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      const { data, error } = await supabase
        .from("agent_config")
        .update({ config: parsed.data.config, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    } else {
      const { data, error } = await supabase
        .from("agent_config")
        .insert({ config: parsed.data.config })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
