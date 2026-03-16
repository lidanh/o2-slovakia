import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateXlsx } from "@/lib/export";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

export async function GET() {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const tenantId = auth.user.tenantId;
    const teamIds = await getAccessibleTeamIds(auth.user);

    // Get user IDs in this tenant via memberships
    let membershipQuery = supabase
      .from("tenant_memberships")
      .select("user_id, team_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (teamIds) {
      membershipQuery = membershipQuery.in("team_id", teamIds);
    }

    const { data: memberships } = await membershipQuery;
    const userIds = (memberships ?? []).map((m) => m.user_id);

    if (userIds.length === 0) {
      const buffer = generateXlsx([], "Users");
      const uint8 = new Uint8Array(buffer);
      return new NextResponse(uint8, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get team names
    const { data: teams } = await supabase.from("teams").select("id, name").eq("tenant_id", tenantId);
    const teamNameMap = new Map((teams ?? []).map((t) => [t.id, t.name]));
    const membershipMap = new Map((memberships ?? []).map((m) => [m.user_id, m.team_id]));

    const rows = (users ?? []).map((u) => {
      const teamId = membershipMap.get(u.id);
      return {
        Name: u.name,
        Email: u.email,
        Phone: u.phone,
        Team: teamId ? teamNameMap.get(teamId) ?? "" : "",
        "Created At": u.created_at,
      };
    });

    const buffer = generateXlsx(rows, "Users");
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
