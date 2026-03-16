import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth/authorize";
import { signBrowserCallToken } from "@/lib/jwt";
import { generateUniqueOtp } from "@/lib/otp";
import { sendTrainingEmail } from "@/lib/email/send";

const SendSchema = z.object({
  assignmentId: z.string().uuid(),
});

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:5050";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;

    // Fetch assignment scoped to tenant
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select(
        "*, user:users(*), scenario:scenarios(*, difficulty_levels:difficulty_levels(*)), difficulty_level:difficulty_levels(*)"
      )
      .eq("id", parsed.data.assignmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (aErr || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (!assignment.scenario?.is_active) {
      return NextResponse.json(
        { error: "Scenario is inactive" },
        { status: 400 }
      );
    }

    const { data: sender } = await supabase
      .from("users")
      .select("name")
      .eq("id", auth.user.id)
      .single();

    const senderName = sender?.name || "O2 Trainer Admin";

    const otp = await generateUniqueOtp();
    const otpExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    // Create session with tenant_id
    const { data: session, error: sErr } = await supabase
      .from("training_sessions")
      .insert({
        user_id: assignment.user_id,
        scenario_id: assignment.scenario_id,
        difficulty_level_id: assignment.difficulty_level_id,
        assignment_id: assignment.id,
        call_type: "browser",
        status: "initiated",
        otp,
        otp_expires_at: otpExpiresAt,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (sErr || !session) {
      return NextResponse.json(
        { error: "Failed to create session", details: sErr?.message },
        { status: 500 }
      );
    }

    const token = await signBrowserCallToken({
      sessionId: session.id,
      userId: assignment.user_id,
      scenarioId: assignment.scenario_id,
      difficultyLevelId: assignment.difficulty_level_id,
      otp,
    });

    await supabase
      .from("assignments")
      .update({ status: "in_progress" })
      .eq("id", assignment.id);

    const callUrl = `/call/${token}`;
    const fullUrl = `${getBaseUrl()}${callUrl}`;

    const recipientEmail = assignment.user?.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Assignment user has no email address" },
        { status: 400 }
      );
    }

    await sendTrainingEmail(recipientEmail, {
      scenarioName: assignment.scenario?.name || "Training Scenario",
      difficultyName: assignment.difficulty_level?.name || "Standard",
      trainingUrl: fullUrl,
      senderName,
    });

    return NextResponse.json({ success: true, callUrl });
  } catch (err) {
    console.error("POST /api/training/browser-call/send error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
