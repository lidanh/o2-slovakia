import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCommunication } from "@/lib/wonderful";
import { getAuthUser } from "@/lib/auth/authorize";
import type { TranscriptEntry } from "@repo/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const { id } = await params;
    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;

    const { data, error } = await supabase
      .from("training_sessions")
      .select("*, user:users(*), scenario:scenarios(*), difficulty_level:difficulty_levels(*)")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    // Regular users can only view their own sessions
    if (auth.user.role === "user" && data.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Enrich transcript with transcription_ids if missing
    const transcript = data.transcript as TranscriptEntry[] | null;
    if (
      data.communication_id &&
      transcript?.length &&
      !transcript.some((e) => e.transcription_id)
    ) {
      try {
        // Get tenant settings for Wonderful config
        const { data: tenant } = await supabase
          .from("tenants")
          .select("settings")
          .eq("id", data.tenant_id)
          .single();

        const wonderful = (tenant?.settings as Record<string, unknown>)?.wonderful as
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
