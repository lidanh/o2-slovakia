import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const UpdateScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1).optional(),
  type: z.enum(["frontline", "leadership"]).optional(),
  is_active: z.boolean().optional(),
  agent_id: z.string().nullable().optional(),
  difficulty_levels: z
    .array(
      z.object({
        name: z.string().min(1),
        prompt: z.string().min(1),
        resistance_level: z.number().min(0).max(100),
        emotional_intensity: z.number().min(0).max(100),
        cooperation: z.number().min(0).max(100),
        sort_order: z.number().int(),
      })
    )
    .optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("scenarios")
      .select("*, difficulty_levels(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { difficulty_levels, ...scenarioData } = parsed.data;

    const { error } = await supabase
      .from("scenarios")
      .update({ ...scenarioData, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (difficulty_levels) {
      // Fetch existing levels to update in place (preserves IDs for FK references)
      const { data: existing } = await supabase
        .from("difficulty_levels")
        .select("id")
        .eq("scenario_id", id)
        .order("sort_order", { ascending: true });

      const existingIds = existing ?? [];

      // Update existing levels in place, insert new ones
      for (let i = 0; i < difficulty_levels.length; i++) {
        const dl = difficulty_levels[i];
        if (i < existingIds.length) {
          const { error: upErr } = await supabase
            .from("difficulty_levels")
            .update(dl)
            .eq("id", existingIds[i].id);
          if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
        } else {
          const { error: insErr } = await supabase
            .from("difficulty_levels")
            .insert({ ...dl, scenario_id: id });
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
        }
      }

      // Remove surplus levels (only those not referenced by training sessions)
      for (let i = difficulty_levels.length; i < existingIds.length; i++) {
        await supabase
          .from("difficulty_levels")
          .delete()
          .eq("id", existingIds[i].id);
        // Silently ignore FK errors — level is still in use
      }
    }

    const { data: full } = await supabase
      .from("scenarios")
      .select("*, difficulty_levels(*)")
      .eq("id", id)
      .single();

    return NextResponse.json(full);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export { PUT as PATCH };

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { error } = await supabase.from("scenarios").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
