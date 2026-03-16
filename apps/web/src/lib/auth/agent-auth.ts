import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface AgentAuthResult {
  tenantId: string;
}

/**
 * Resolve a tenant from the X-API-Key header.
 * Used by all Wonderful AI agent-facing routes.
 */
export async function resolveAgentAuth(
  request: NextRequest
): Promise<
  { auth: AgentAuthResult; error?: never } | { auth?: never; error: NextResponse }
> {
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabase = createServiceClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("agent_api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (error || !tenant) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { auth: { tenantId: tenant.id } };
}
