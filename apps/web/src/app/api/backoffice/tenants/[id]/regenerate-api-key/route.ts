import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperadmin } from "@/lib/auth/authorize";
import { generateAgentApiKey } from "@/lib/agent-api-key";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const newKey = generateAgentApiKey();
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("tenants")
      .update({ agent_api_key: newKey, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agent_api_key: newKey });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
