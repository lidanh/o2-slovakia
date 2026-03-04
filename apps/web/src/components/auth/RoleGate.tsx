"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@repo/shared";

export function RoleGate({
  allowed,
  children,
  fallback = null,
}: {
  allowed: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();

  if (!user || !allowed.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
