import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyBrowserCallToken } from "@/lib/jwt";

export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    let payload;
    try {
      payload = await verifyBrowserCallToken(token);
    } catch (jwtErr) {
      return NextResponse.json(
        { error: "Invalid or expired token", details: (jwtErr as Error).message },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Fetch session and verify it's still active
    const { data: session, error } = await supabase
      .from("training_sessions")
      .select("*, scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", payload.sessionId)
      .in("status", ["initiated", "in_progress"])
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: "Session not found or expired", details: error?.message ?? null },
        { status: 404 }
      );
    }

    // Check OTP expiry
    if (session.otp_expires_at && new Date(session.otp_expires_at) < new Date()) {
      return NextResponse.json({ error: "Session OTP has expired" }, { status: 410 });
    }

    // Fetch agent config
    const { data: agentConfig, error: cfgError } = await supabase
      .from("agent_config")
      .select("config")
      .limit(1)
      .single();

    if (cfgError || !agentConfig) {
      return NextResponse.json(
        { error: "Agent config not found", details: cfgError?.message ?? null },
        { status: 500 }
      );
    }

    const wonderful = agentConfig.config.wonderful as {
      agent_id: string;
      api_key: string;
      tenant_url: string;
    } | undefined;

    if (!wonderful?.api_key || !wonderful?.tenant_url) {
      return NextResponse.json(
        { error: "Wonderful config incomplete — api_key and tenant_url are required" },
        { status: 500 }
      );
    }

    let wonderfulHost: string;
    try {
      wonderfulHost = new URL(wonderful.tenant_url).origin;
    } catch {
      return NextResponse.json(
        { error: "Invalid Wonderful tenant URL" },
        { status: 500 }
      );
    }

    const effectiveAgentId = session.scenario?.agent_id ?? wonderful.agent_id;
    if (!effectiveAgentId) {
      return NextResponse.json(
        { error: "No agent_id configured for scenario or global config" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      otp: session.otp,
      agentId: effectiveAgentId,
      apiKey: wonderful.api_key,
      wonderfulHost,
      scenarioName: session.scenario?.name ?? "Unknown",
      difficultyName: session.difficulty_level?.name ?? "Default",
    });
  } catch (err) {
    console.error("GET /api/training/browser-call/validate error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
