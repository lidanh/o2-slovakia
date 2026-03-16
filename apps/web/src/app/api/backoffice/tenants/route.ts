import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireSuperadmin } from "@/lib/auth/authorize";
import { generateAgentApiKey } from "@/lib/agent-api-key";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export async function GET() {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    const { data: tenants, error } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get user counts per tenant
    const { data: counts } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("is_active", true);

    const countMap = new Map<string, number>();
    for (const m of counts ?? []) {
      countMap.set(m.tenant_id, (countMap.get(m.tenant_id) ?? 0) + 1);
    }

    const result = (tenants ?? []).map((t) => ({
      ...t,
      user_count: countMap.get(t.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = CreateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        settings: {},
        agent_api_key: generateAgentApiKey(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A tenant with this slug already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(tenant, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
