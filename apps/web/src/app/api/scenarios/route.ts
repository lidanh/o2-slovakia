import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const CreateScenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  prompt: z.string().min(1),
  type: z.enum(["frontline", "leadership"]),
  is_active: z.boolean().optional().default(true),
  agent_id: z.string().optional(),
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

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("scenarios")
      .select("*, difficulty_levels(*)")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { difficulty_levels, ...scenarioData } = parsed.data;

    const { data: scenario, error } = await supabase
      .from("scenarios")
      .insert(scenarioData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (difficulty_levels && difficulty_levels.length > 0) {
      const levels = difficulty_levels.map((dl) => ({
        ...dl,
        scenario_id: scenario.id,
      }));
      const { error: dlError } = await supabase
        .from("difficulty_levels")
        .insert(levels);
      if (dlError) return NextResponse.json({ error: dlError.message }, { status: 500 });
    }

    const { data: full } = await supabase
      .from("scenarios")
      .select("*, difficulty_levels(*)")
      .eq("id", scenario.id)
      .single();

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
