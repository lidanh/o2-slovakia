import type { UserRole } from "@repo/shared";

export const DEFAULT_ROUTE: Record<UserRole, string> = {
  admin: "/dashboard",
  team_manager: "/dashboard",
  user: "/my-dashboard",
};

interface RouteRule {
  pattern: string;
  roles: UserRole[];
}

const ROUTE_RULES: RouteRule[] = [
  { pattern: "/backoffice", roles: [] }, // handled by email domain check, not role
  { pattern: "/settings", roles: ["admin"] },
  { pattern: "/scenarios", roles: ["admin"] },
  { pattern: "/users", roles: ["admin", "team_manager"] },
  { pattern: "/teams", roles: ["admin", "team_manager"] },
  { pattern: "/analytics", roles: ["admin", "team_manager"] },
  { pattern: "/training", roles: ["admin", "team_manager"] },
  { pattern: "/dashboard", roles: ["admin", "team_manager"] },
  { pattern: "/my-dashboard", roles: ["admin", "team_manager", "user"] },
  { pattern: "/my-training", roles: ["admin", "team_manager", "user"] },
  { pattern: "/my-profile", roles: ["admin", "team_manager", "user"] },
];

/**
 * Check if a role is allowed to access a given pathname.
 * Special case: /backoffice requires @wonderful.ai email check (handled in middleware).
 * Returns true if no rule matches (permissive by default for unlisted routes).
 */
export function isRouteAllowed(pathname: string, role: UserRole, email?: string): boolean {
  const rule = ROUTE_RULES.find((r) => pathname.startsWith(r.pattern));
  if (!rule) return true;

  // /backoffice is governed by email domain, not role
  if (rule.pattern === "/backoffice") {
    return !!email && email.endsWith("@wonderful.ai");
  }

  return rule.roles.includes(role);
}
