import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/authorize";
import type { WonderfulAgent } from "@repo/shared";

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    const { data: tenant, error: cfgError } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", auth.user.tenantId)
      .single();

    if (cfgError || !tenant) {
      return NextResponse.json(
        { error: "Tenant settings not found", details: cfgError?.message ?? null },
        { status: 500 }
      );
    }

    const wonderful = (tenant.settings as Record<string, unknown>).wonderful as {
      tenant_url: string;
      api_key: string;
    } | undefined;

    if (!wonderful?.tenant_url || !wonderful?.api_key) {
      return NextResponse.json(
        { error: "not_configured", details: "Wonderful tenant_url or api_key not configured" },
        { status: 422 }
      );
    }

    let baseUrl: string;
    try {
      baseUrl = new URL(wonderful.tenant_url).origin;
    } catch {
      return NextResponse.json(
        { error: "not_configured", details: "Invalid tenant URL" },
        { status: 422 }
      );
    }

    const response = await fetch(`${baseUrl}/api/v1/agents`, {
      headers: { "x-api-key": wonderful.api_key },
    });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json(
        { error: `Wonderful API error: ${response.status}`, details: body },
        { status: response.status }
      );
    }

    const data = await response.json();
    const agentsList = Array.isArray(data) ? data : data.data ?? [];

    const agents: WonderfulAgent[] = agentsList.map(
      (a: Record<string, unknown>) => ({
        id: a.id,
        name: a.name,
        display_name: a.display_name,
        description: a.description,
        mode: a.mode,
      })
    );

    return NextResponse.json(agents);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
