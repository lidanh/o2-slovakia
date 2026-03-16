import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUser } from "@/lib/auth/authorize";

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  language: z.enum(["en", "sk", "hu"]).optional(),
});

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const supabase = createServiceClient();

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", auth.user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Fetch all tenants for this user
    const { data: memberships } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, team_id, tenant:tenants!inner(id, name, slug, is_active)")
      .eq("user_id", auth.user.id)
      .eq("is_active", true);

    const tenants = (memberships ?? [])
      .filter((m) => (m.tenant as unknown as { is_active: boolean })?.is_active)
      .map((m) => {
        const t = m.tenant as unknown as { id: string; name: string; slug: string };
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          role: m.role,
          team_id: m.team_id,
          is_current: t.id === auth.user.tenantId,
        };
      });

    const currentTenant = tenants.find((t) => t.id === auth.user.tenantId) ?? tenants[0] ?? null;

    // Fetch team for current tenant membership
    let team = null;
    if (currentTenant?.team_id) {
      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("id", currentTenant.team_id)
        .single();
      team = teamData;
    }

    return NextResponse.json({
      ...profile,
      // Add membership-derived fields for backward compatibility
      role: currentTenant?.role ?? "user",
      team_id: currentTenant?.team_id ?? null,
      team,
      is_superadmin: profile.is_superadmin,
      current_tenant: currentTenant,
      tenants,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Handle password update via admin API
    if (parsed.data.password) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(auth.user.id, {
        password: parsed.data.password,
      });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 500 });
      }
    }

    // Update profile fields (exclude password from DB update)
    const { password: _, ...profileFields } = parsed.data;
    const { data, error } = await supabase
      .from("users")
      .update({ ...profileFields, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
