import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { generateUniqueOtp } from "@/lib/otp";
import { signBrowserCallToken } from "@/lib/jwt";
import { getAuthUser } from "@/lib/auth/authorize";

const BrowserCallSchema = z.object({
  assignmentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = BrowserCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { assignmentId } = parsed.data;
    const tenantId = auth.user.tenantId;

    // Fetch assignment scoped to tenant
    const { data: assignment, error: aError } = await supabase
      .from("assignments")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", assignmentId)
      .eq("tenant_id", tenantId)
      .single();

    if (aError || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found", details: aError?.message ?? null },
        { status: 404 }
      );
    }

    if (!assignment.scenario?.is_active) {
      return NextResponse.json(
        { error: "Scenario is currently inactive" },
        { status: 400 }
      );
    }

    let otp: string;
    try {
      otp = await generateUniqueOtp();
    } catch (otpErr) {
      return NextResponse.json(
        { error: "Failed to generate OTP", details: (otpErr as Error).message },
        { status: 500 }
      );
    }
    const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Create training session with tenant_id
    const { data: session, error: sError } = await supabase
      .from("training_sessions")
      .insert({
        user_id: assignment.user_id,
        scenario_id: assignment.scenario_id,
        difficulty_level_id: assignment.difficulty_level_id,
        assignment_id: assignmentId,
        status: "initiated",
        call_type: "browser",
        otp,
        otp_expires_at: otpExpiresAt,
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (sError || !session) {
      const msg = sError?.message ?? "Unknown insert error";
      return NextResponse.json(
        { error: "Failed to create training session", details: msg },
        { status: 500 }
      );
    }

    let token: string;
    try {
      token = await signBrowserCallToken({
        sessionId: session.id,
        userId: assignment.user_id,
        scenarioId: assignment.scenario_id,
        difficultyLevelId: assignment.difficulty_level_id,
        otp,
      });
    } catch (jwtErr) {
      return NextResponse.json(
        { error: "Failed to sign browser call token", details: (jwtErr as Error).message },
        { status: 500 }
      );
    }

    const callUrl = `/call/${token}`;

    return NextResponse.json(
      { sessionId: session.id, otp, callUrl },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/training/browser-call error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
