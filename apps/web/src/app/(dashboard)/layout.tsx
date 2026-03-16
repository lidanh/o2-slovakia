import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AuthProvider, type AuthUser } from "@/contexts/AuthContext";
import DashboardShell from "@/components/layout/DashboardShell";
import type { UserRole } from "@repo/shared";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let initialUser: AuthUser | null = null;

  const service = createServiceClient();

  // Fetch user profile
  const { data: profile } = await service
    .from("users")
    .select("name, avatar_url, phone, language, is_superadmin")
    .eq("id", user.id)
    .single();

  // Get current tenant from app_metadata
  const currentTenantId = user.app_metadata?.current_tenant_id as string | undefined;

  // Fetch all memberships
  const { data: memberships } = await service
    .from("tenant_memberships")
    .select("tenant_id, role, team_id, tenant:tenants!inner(id, name, slug, is_active)")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const tenants = (memberships ?? [])
    .filter((m) => (m.tenant as unknown as { is_active: boolean })?.is_active)
    .map((m) => {
      const t = m.tenant as unknown as { id: string; name: string; slug: string };
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: m.role as UserRole,
        team_id: m.team_id,
        is_current: t.id === currentTenantId,
      };
    });

  const currentTenant = tenants.find((t) => t.is_current) ?? tenants[0] ?? null;

  if (profile) {
    initialUser = {
      id: user.id,
      email: user.email!,
      name: profile.name,
      role: currentTenant?.role ?? "user",
      teamId: currentTenant?.team_id ?? null,
      avatarUrl: profile.avatar_url,
      phone: profile.phone,
      language: profile.language ?? 'en',
      isSuperadmin: profile.is_superadmin ?? false,
      currentTenant,
      tenants,
    };
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AuthProvider initialUser={initialUser}>
        <DashboardShell>{children}</DashboardShell>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
