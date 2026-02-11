import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateGuidance } from "@/lib/llm";

const GuidanceSchema = z.object({
  communication_id: z.string().min(1),
  transcript: z.array(
    z.object({
      role: z.enum(["agent", "customer"]),
      content: z.string(),
      timestamp: z.number().optional(),
    })
  ),
});

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === process.env.AGENT_API_KEY;
}

export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = GuidanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const guidance = await generateGuidance(parsed.data.transcript);
    return NextResponse.json({ guidance });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
