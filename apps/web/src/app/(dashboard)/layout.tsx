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
  const { data: profile } = await service
    .from("users")
    .select("name, role, team_id, avatar_url, phone, language")
    .eq("id", user.id)
    .single();

  if (profile) {
    initialUser = {
      id: user.id,
      email: user.email!,
      name: profile.name,
      role: profile.role as UserRole,
      teamId: profile.team_id,
      avatarUrl: profile.avatar_url,
      phone: profile.phone,
      language: profile.language ?? 'en',
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
