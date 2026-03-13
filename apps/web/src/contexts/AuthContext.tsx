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
import type { UserRole } from "@repo/shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  language: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => {},
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
        role: data.role,
        teamId: data.team_id,
        avatarUrl: data.avatar_url,
        phone: data.phone,
        language: data.language ?? 'en',
      });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

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

    // If server-side render didn't provide user data, fetch client-side
    if (!initialUser) {
      fetchProfile();
    }

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
