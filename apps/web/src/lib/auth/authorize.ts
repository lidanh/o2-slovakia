import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@repo/shared";

export type { UserRole };

export interface AuthorizedUser {
  id: string;
  email: string;
  role: UserRole;
  teamId: string | null;
}

/**
 * Get the currently authenticated user with role from JWT metadata.
 * Returns { user } on success, { error: NextResponse } on failure.
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

  const role = (user.app_metadata?.role as UserRole) ?? "user";

  // Fetch team_id from users table
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("team_id")
    .eq("id", user.id)
    .single();

  return {
    user: {
      id: user.id,
      email: user.email!,
      role,
      teamId: profile?.team_id ?? null,
    },
  };
}

/**
 * Require the authenticated user to have one of the given roles.
 * Returns 401 if not authenticated, 403 if role not allowed.
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
 * Get all team IDs accessible to a user (their team + all descendant teams).
 * Admin gets null (meaning "all teams").
 * Users/managers get an array of team IDs.
 */
export async function getAccessibleTeamIds(
  user: AuthorizedUser
): Promise<string[] | null> {
  if (user.role === "admin") return null; // admin sees everything
  if (!user.teamId) return []; // no team assigned

  const service = createServiceClient();
  const { data } = await service.rpc("get_descendant_team_ids", {
    root_id: user.teamId,
  });

  return (data as string[]) ?? [user.teamId];
}
