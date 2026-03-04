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

  // Allow unauthenticated access to accept-invite, reset-password, forgot-password
  if (
    pathname.startsWith("/accept-invite") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/forgot-password")
  ) {
    return supabaseResponse;
  }

  // Helper: redirect while preserving Supabase cookie changes
  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const response = NextResponse.redirect(url);
    // Forward any cookies the Supabase client set (e.g. cleared/refreshed tokens)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  }

  // If no user and not on login page, redirect to login
  if (!user && !pathname.startsWith("/login")) {
    return redirectTo("/login");
  }

  // If user exists, apply role-based routing
  if (user) {
    // Check if user still needs to complete invite setup
    const service = createServiceClient();
    const { data: profile } = await service
      .from("users")
      .select("status, role")
      .eq("id", user.id)
      .single();

    if (profile?.status === "invited" && !pathname.startsWith("/accept-invite")) {
      return redirectTo("/accept-invite");
    }

    // Use role from DB (authoritative) with fallback to JWT metadata
    const role = (profile?.role as UserRole) ?? (user.app_metadata?.role as UserRole) ?? "user";
    const defaultRoute = DEFAULT_ROUTE[role];

    // If user is on login page, redirect to their default home
    if (pathname.startsWith("/login")) {
      return redirectTo(defaultRoute);
    }

    // If user is on root, redirect to their default home
    if (pathname === "/") {
      return redirectTo(defaultRoute);
    }

    // Check if user's role is allowed to access this route
    if (!isRouteAllowed(pathname, role)) {
      return redirectTo(defaultRoute);
    }
  }

  return supabaseResponse;
}
