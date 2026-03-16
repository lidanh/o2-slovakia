"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { UserRole, TenantInfo } from "@repo/shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  language: string;
  isSuperadmin: boolean;
  currentTenant: TenantInfo | null;
  tenants: TenantInfo[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
}

const DEFAULT_ROUTES: Record<UserRole, string> = {
  admin: "/dashboard",
  team_manager: "/dashboard",
  user: "/my-dashboard",
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
  switchTenant: async () => {},
});

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);
  const supabase = createClient();
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.current_tenant?.role ?? data.role ?? "user",
        teamId: data.current_tenant?.team_id ?? data.team_id ?? null,
        avatarUrl: data.avatar_url,
        phone: data.phone,
        language: data.language ?? "en",
        isSuperadmin: data.is_superadmin ?? false,
        currentTenant: data.current_tenant ?? null,
        tenants: data.tenants ?? [],
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });

      if (!res.ok) {
        throw new Error("Failed to switch tenant");
      }

      const data = await res.json();

      // Refresh session to get new JWT with updated app_metadata
      await supabase.auth.refreshSession();

      // Re-fetch user profile
      await fetchProfile();

      // If new role doesn't allow current page, redirect
      const newRole = data.role as UserRole;
      const defaultRoute = DEFAULT_ROUTES[newRole];
      router.refresh();

      // Check if current page is still accessible with new role
      const currentPath = window.location.pathname;
      const adminOnlyPaths = ["/settings", "/scenarios", "/backoffice"];
      const managerPaths = ["/dashboard", "/training", "/users", "/teams", "/analytics"];

      if (newRole === "user" && [...adminOnlyPaths, ...managerPaths].some((p) => currentPath.startsWith(p))) {
        router.push(defaultRoute);
      } else if (newRole === "team_manager" && adminOnlyPaths.some((p) => currentPath.startsWith(p))) {
        router.push(defaultRoute);
      }
    } catch (err) {
      console.error("Failed to switch tenant:", err);
      throw err;
    }
  }, [supabase, fetchProfile, router]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    if (!initialUser) {
      fetchProfile();
    }

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchProfile, switchTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
