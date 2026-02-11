import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const CreateAssignmentsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  scenarioId: z.string().uuid(),
  difficultyLevelId: z.string().uuid(),
});

const DeleteAssignmentsSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get("scenarioId");
    const difficultyLevelId = searchParams.get("difficultyLevelId");
    const userId = searchParams.get("userId");

    let query = supabase
      .from("assignments")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)");

    if (scenarioId) query = query.eq("scenario_id", scenarioId);
    if (difficultyLevelId) query = query.eq("difficulty_level_id", difficultyLevelId);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateAssignmentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { userIds, scenarioId, difficultyLevelId } = parsed.data;

    // Verify scenario is active before creating assignments
    const { data: scenario, error: scenarioError } = await supabase
      .from("scenarios")
      .select("id, is_active")
      .eq("id", scenarioId)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    if (!scenario.is_active) {
      return NextResponse.json({ error: "Scenario is currently inactive" }, { status: 400 });
    }

    const assignments = userIds.map((userId) => ({
      user_id: userId,
      scenario_id: scenarioId,
      difficulty_level_id: difficultyLevelId,
      status: "pending" as const,
    }));

    const { data, error } = await supabase
      .from("assignments")
      .insert(assignments)
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DeleteAssignmentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("assignments")
      .delete()
      .in("id", parsed.data.assignmentIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
