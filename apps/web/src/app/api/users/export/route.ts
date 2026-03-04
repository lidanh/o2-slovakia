import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateXlsx } from "@/lib/export";
import { requireRole, getAccessibleTeamIds } from "@/lib/auth/authorize";

export async function GET() {
  try {
    const auth = await requireRole("admin", "team_manager");
    if (auth.error) return auth.error;

    const supabase = createServiceClient();
    const teamIds = await getAccessibleTeamIds(auth.user);

    let query = supabase
      .from("users")
      .select("*, team:teams(name)")
      .order("name");

    if (teamIds) {
      query = query.in("team_id", teamIds);
    }

    const { data: users, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (users ?? []).map((u) => ({
      Name: u.name,
      Email: u.email,
      Phone: u.phone,
      Team: u.team?.name ?? "",
      "Created At": u.created_at,
    }));

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
