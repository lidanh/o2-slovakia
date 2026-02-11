import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { generateSessionFeedback } from "@/lib/feedback";

const CallCompletePayload = z.object({
  communication_id: z.string(),
  assignment_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  console.log("[webhook/call-complete] Received call-complete webhook");

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

    // Try to find session by communication_id first
    let session: Record<string, unknown> | null = null;

    const { data: byCommunication } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("communication_id", body.communication_id)
      .single();

    if (byCommunication) {
      session = byCommunication;
    } else {
      // Fall back to assignment_id lookup
      const { data: byAssignment } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("assignment_id", body.assignment_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (byAssignment) {
        session = byAssignment;
      }
    }

    if (!session) {
      console.error("[webhook/call-complete] No session found for", body);
      return NextResponse.json(
        { success: false, error: "Training session not found" },
        { status: 404 }
      );
    }

    console.log("[webhook/call-complete] Found session:", session.id);

    // If session has no communication_id, update it
    if (!session.communication_id) {
      console.log("[webhook/call-complete] Updating session with communication_id and marking completed");
      await supabase
        .from("training_sessions")
        .update({
          communication_id: body.communication_id,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
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
