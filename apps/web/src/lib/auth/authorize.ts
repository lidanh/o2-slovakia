import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@repo/shared";

export type { UserRole };

export interface AuthorizedUser {
  id: string;
  email: string;
  tenantId: string;
  role: UserRole;
  teamId: string | null;
  isSuperadmin: boolean;
}

/**
 * Get the currently authenticated user with tenant context.
 * Resolves tenant from JWT app_metadata, falls back to first active membership.
 */
export async function getAuthUser(): Promise<
  { user: AuthorizedUser; error?: never } | { user?: never; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const service = createServiceClient();

  // Get user profile for is_superadmin
  const { data: profile } = await service
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  const isSuperadmin = profile?.is_superadmin ?? false;

  // Read current tenant from JWT metadata
  let currentTenantId = user.app_metadata?.current_tenant_id as string | undefined;

  if (currentTenantId) {
    // Validate the membership still exists and is active
    const { data: membership } = await service
      .from("tenant_memberships")
      .select("role, team_id, is_active, tenant:tenants!inner(is_active)")
      .eq("user_id", user.id)
      .eq("tenant_id", currentTenantId)
      .single();

    if (membership?.is_active && (membership.tenant as unknown as { is_active: boolean })?.is_active) {
      return {
        user: {
          id: user.id,
          email: user.email!,
          tenantId: currentTenantId,
          role: membership.role as UserRole,
          teamId: membership.team_id ?? null,
          isSuperadmin,
        },
      };
    }

    // Current tenant is invalid — fall through to find a valid one
    currentTenantId = undefined;
  }

  // No valid current tenant — find first active membership
  const { data: firstMembership } = await service
    .from("tenant_memberships")
    .select("tenant_id, role, team_id, tenant:tenants!inner(is_active)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!firstMembership || !(firstMembership.tenant as unknown as { is_active: boolean })?.is_active) {
    // User has no active tenant memberships — allow superadmins through with no tenant context
    if (isSuperadmin) {
      return {
        user: {
          id: user.id,
          email: user.email!,
          tenantId: "",
          role: "admin" as UserRole,
          teamId: null,
          isSuperadmin: true,
        },
      };
    }
    return { error: NextResponse.json({ error: "No active tenant membership" }, { status: 403 }) };
  }

  // Set this tenant as current via admin API
  await service.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      current_tenant_id: firstMembership.tenant_id,
      role: firstMembership.role,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email!,
      tenantId: firstMembership.tenant_id,
      role: firstMembership.role as UserRole,
      teamId: firstMembership.team_id ?? null,
      isSuperadmin,
    },
  };
}

/**
 * Require the authenticated user to have one of the given roles in their current tenant.
 */
export async function requireRole(
  ...roles: UserRole[]
): Promise<
  { user: AuthorizedUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await getAuthUser();
  if (result.error) return result;

  if (!roles.includes(result.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}

/**
 * Get all team IDs accessible to a user within their current tenant.
 * Admin gets null (meaning "all teams in tenant").
 */
export async function getAccessibleTeamIds(
  user: AuthorizedUser
): Promise<string[] | null> {
  if (user.role === "admin") return null;
  if (!user.teamId) return [];

  const service = createServiceClient();
  const { data } = await service.rpc("get_descendant_team_ids", {
    root_id: user.teamId,
  });

  return (data as string[]) ?? [user.teamId];
}

/**
 * Require the user to have a @wonderful.ai email (for backoffice routes).
 */
export async function requireSuperadmin(): Promise<
  { user: AuthorizedUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await getAuthUser();
  if (result.error) return result;

  if (!result.user.isSuperadmin && !result.user.email.endsWith("@wonderful.ai")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return result;
}
