import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/authorize";

const SwitchSchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = SwitchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId } = parsed.data;
    const supabase = createServiceClient();

    // Validate user has active membership in target tenant
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("role, team_id, tenant:tenants!inner(is_active)")
      .eq("user_id", auth.user.id)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!membership || !(membership.tenant as unknown as { is_active: boolean })?.is_active) {
      return NextResponse.json({ error: "No active membership in target tenant" }, { status: 403 });
    }

    // Update app_metadata with new current_tenant_id and role
    // Fetch current metadata first to avoid clobbering other fields
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(auth.user.id);
    await supabase.auth.admin.updateUserById(auth.user.id, {
      app_metadata: {
        ...authUser?.app_metadata,
        current_tenant_id: tenantId,
        role: membership.role,
      },
    });

    return NextResponse.json({
      tenant_id: tenantId,
      role: membership.role,
      team_id: membership.team_id,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
