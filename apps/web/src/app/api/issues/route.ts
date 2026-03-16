import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { createIssue } from "@/lib/wonderful";

const createIssueSchema = z.object({
  communicationId: z.string().uuid(),
  transcriptionId: z.string().uuid(),
  description: z.string().min(1),
  category: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  scenarioName: z.string().optional(),
  difficultyName: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await getAuthUser();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = createIssueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tenantId = auth.user.tenantId;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();

  const wonderful = (tenant?.settings as Record<string, unknown>)?.wonderful as
    | { api_key?: string; tenant_url?: string }
    | undefined;

  if (!wonderful?.api_key || !wonderful?.tenant_url) {
    return NextResponse.json({ error: "Wonderful not configured" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", auth.user.id)
    .single();

  const userName = profile?.name ?? auth.user.email;
  const parts = [
    `[${userName}] ${parsed.data.description}`,
  ];
  const { sessionId, scenarioName, difficultyName } = parsed.data;
  if (scenarioName || difficultyName || sessionId) {
    const meta = [
      scenarioName && `Scenario: ${scenarioName}`,
      difficultyName && `Difficulty: ${difficultyName}`,
      sessionId && `Session: ${sessionId}`,
    ].filter(Boolean).join(" | ");
    parts.push(meta);
  }
  const description = parts.join("\n\n");

  const result = await createIssue({ ...parsed.data, description }, wonderful);
  return NextResponse.json(result);
}
