import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SessionStatus } from "@repo/shared";

const TWILIO_STATUS_MAP: Record<string, SessionStatus> = {
  initiated: "initiated",
  ringing: "ringing",
  "in-progress": "in_progress",
  completed: "completed",
  failed: "failed",
  "no-answer": "no_answer",
  busy: "busy",
  canceled: "canceled",
};

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const formData = await request.formData();
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string | null;
    const callSid = formData.get("CallSid") as string | null;

    const status = TWILIO_STATUS_MAP[callStatus];
    if (!status) {
      return NextResponse.json({ error: `Unknown status: ${callStatus}` }, { status: 400 });
    }

    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (callSid) updateData.call_sid = callSid;
    if (callDuration) updateData.call_duration = parseInt(callDuration, 10);

    if (status === "in_progress") {
      updateData.answered_at = new Date().toISOString();
    }
    if (status === "completed" || status === "failed" || status === "no_answer" || status === "busy" || status === "canceled") {
      updateData.completed_at = new Date().toISOString();
    }

    // Store raw Twilio metadata
    const metadata: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      metadata[key] = value;
    });
    updateData.twilio_metadata = metadata;

    const { error } = await supabase
      .from("training_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Return TwiML-compatible empty response
    return new NextResponse("<Response/>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
