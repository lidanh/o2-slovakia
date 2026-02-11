import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === process.env.AGENT_API_KEY;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const phone = body.phone as string | undefined;
    const otp = body.otp as string | undefined;

    if (!phone && !otp) {
      return NextResponse.json({ error: "Missing phone or otp parameter" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let session;

    if (otp) {
      // OTP-based lookup (browser calls)
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          scenario:scenarios(*),
          difficulty_level:difficulty_levels(*)
        `)
        .eq("otp", otp)
        .gt("otp_expires_at", new Date().toISOString())
        .in("status", ["initiated", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No active session found for this OTP" }, { status: 404 });
      }
      session = data;
    } else {
      // Phone-based lookup (Twilio calls)
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          user:users!inner(phone),
          scenario:scenarios(*),
          difficulty_level:difficulty_levels(*)
        `)
        .eq("user.phone", phone!)
        .in("status", ["initiated", "ringing", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No active session found for this phone number" }, { status: 404 });
      }
      session = data;
    }

    const scenario = session.scenario;
    const difficultyLevel = session.difficulty_level;

    const response = {
      session_id: session.id,
      user_id: session.user_id,
      scenario_id: session.scenario_id,
      prompt: difficultyLevel
        ? `${scenario.prompt}\n\n${difficultyLevel.prompt}`
        : scenario.prompt,
      resistance_level: difficultyLevel?.resistance_level ?? 50,
      emotional_intensity: difficultyLevel?.emotional_intensity ?? 50,
      cooperation: difficultyLevel?.cooperation ?? 50,
      scenario_name: scenario.name,
      difficulty_name: difficultyLevel?.name ?? "Default",
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
