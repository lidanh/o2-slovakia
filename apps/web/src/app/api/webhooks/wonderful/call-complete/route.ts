import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { generateSessionFeedback } from "@/lib/feedback";
import { resolveAgentAuth } from "@/lib/auth/agent-auth";

const CallCompletePayload = z.object({
  communication_id: z.string(),
  session_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  console.log("[webhook/call-complete] Received call-complete webhook");

  // Authenticate via per-tenant API key
  const agentAuth = await resolveAgentAuth(request);
  if (agentAuth.error) {
    console.error("[webhook/call-complete] Unauthorized request");
    return agentAuth.error;
  }
  const { tenantId } = agentAuth.auth;

  let body: z.infer<typeof CallCompletePayload>;
  try {
    const raw = await request.json();
    console.log("[webhook/call-complete] Payload:", JSON.stringify(raw));
    body = CallCompletePayload.parse(raw);
  } catch (err) {
    console.error("[webhook/call-complete] Invalid payload:", err);
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();

    // Look up session by session_id, scoped to tenant for defense-in-depth
    const { data: session, error: sessionError } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("id", body.session_id)
      .eq("tenant_id", tenantId)
      .single();

    if (sessionError || !session) {
      console.error("[webhook/call-complete] No session found for session_id:", body.session_id);
      return NextResponse.json(
        { success: false, error: "Training session not found" },
        { status: 404 }
      );
    }

    console.log("[webhook/call-complete] Found session:", session.id);

    // Always mark session as completed and update communication_id
    const sessionUpdate: Record<string, unknown> = {
      status: "completed",
      completed_at: session.completed_at ?? new Date().toISOString(),
    };
    if (!session.communication_id) {
      sessionUpdate.communication_id = body.communication_id;
    }
    if (session.status !== "completed") {
      console.log("[webhook/call-complete] Marking session as completed:", session.id);
      await supabase
        .from("training_sessions")
        .update(sessionUpdate)
        .eq("id", session.id);
    }

    // If feedback already exists, return early
    if (session.score != null) {
      console.log("[webhook/call-complete] Feedback already exists for session:", session.id);
      return NextResponse.json({
        success: true,
        message: "Feedback already exists",
      });
    }

    // Generate feedback
    console.log("[webhook/call-complete] Generating feedback for session:", session.id);
    const result = await generateSessionFeedback(session.id as string);

    if (result.alreadyExists) {
      return NextResponse.json({
        success: true,
        message: "Feedback already exists",
      });
    }

    console.log("[webhook/call-complete] Feedback generated successfully for session:", session.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webhook/call-complete] Error processing webhook:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
