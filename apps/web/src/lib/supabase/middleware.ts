import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_ROUTE, isRouteAllowed } from "@/lib/auth/route-config";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@repo/shared";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Let API routes through without page-level redirects
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Allow unauthenticated access to invite, reset-password, forgot-password, no-access
  if (
    pathname.startsWith("/invite") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/no-access")
  ) {
    return supabaseResponse;
  }

  // Helper: redirect while preserving Supabase cookie changes
  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  }

  // If no user and not on login page, redirect to login (preserving intended destination)
  if (!user && !pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  }

  // If user exists, apply role-based routing
  if (user) {
    const service = createServiceClient();

    // Read current_tenant_id from app_metadata
    let currentTenantId = user.app_metadata?.current_tenant_id as string | undefined;
    let role: UserRole = "user";

    if (currentTenantId) {
      // Fetch membership for current tenant
      const { data: membership } = await service
        .from("tenant_memberships")
        .select("role, tenant:tenants!inner(is_active)")
        .eq("user_id", user.id)
        .eq("tenant_id", currentTenantId)
        .eq("is_active", true)
        .single();

      if (membership && (membership.tenant as unknown as { is_active: boolean })?.is_active) {
        role = membership.role as UserRole;
      } else {
        // Current tenant invalid — find another
        currentTenantId = undefined;
      }
    }

    if (!currentTenantId) {
      // Find first active membership
      const { data: firstMembership } = await service
        .from("tenant_memberships")
        .select("tenant_id, role, tenant:tenants!inner(is_active)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (firstMembership && (firstMembership.tenant as unknown as { is_active: boolean })?.is_active) {
        currentTenantId = firstMembership.tenant_id;
        role = firstMembership.role as UserRole;

        // Set current_tenant_id in app_metadata
        await service.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            current_tenant_id: currentTenantId,
            role,
          },
        });
      } else {
        // No active tenant membership — redirect to no-access
        if (!pathname.startsWith("/no-access")) {
          return redirectTo("/no-access");
        }
        return supabaseResponse;
      }
    }

    const defaultRoute = DEFAULT_ROUTE[role];

    // If user is on login page, redirect to intended destination or default home
    if (pathname.startsWith("/login")) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      if (redirectParam && redirectParam.startsWith("/")) {
        return redirectTo(redirectParam);
      }
      return redirectTo(defaultRoute);
    }

    // If user is on root, redirect to their default home
    if (pathname === "/") {
      return redirectTo(defaultRoute);
    }

    // Check if user's role/email is allowed to access this route
    if (!isRouteAllowed(pathname, role, user.email)) {
      return redirectTo(defaultRoute);
    }
  }

  return supabaseResponse;
}
