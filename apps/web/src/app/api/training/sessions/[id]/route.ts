import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCommunication } from "@/lib/wonderful";
import type { TranscriptEntry } from "@repo/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("training_sessions")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Enrich transcript with transcription_ids if missing
    const transcript = data.transcript as TranscriptEntry[] | null;
    if (
      data.communication_id &&
      transcript?.length &&
      !transcript.some((e) => e.transcription_id)
    ) {
      try {
        const { data: agentConfig } = await supabase
          .from("agent_config")
          .select("config")
          .limit(1)
          .single();
        const wonderful = agentConfig?.config?.wonderful as
          | { api_key?: string; tenant_url?: string }
          | undefined;

        if (wonderful?.api_key && wonderful?.tenant_url) {
          const commData = await getCommunication(data.communication_id, wonderful);
          const inner = (commData as { data?: Record<string, unknown> }).data ?? commData;
          const transcriptions = (
            inner as { transcriptions?: { id?: string; speaker?: string; text?: string; start_time?: number }[] }
          ).transcriptions;

          if (Array.isArray(transcriptions)) {
            const filtered = transcriptions.filter(
              (t) => t.speaker === "agent" || t.speaker === "customer"
            );
            for (let i = 0; i < transcript.length && i < filtered.length; i++) {
              transcript[i].transcription_id = filtered[i].id;
            }
            data.transcript = transcript;
          }
        }
      } catch {
        // Non-critical — buttons just won't show
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
