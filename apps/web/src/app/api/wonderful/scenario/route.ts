import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAgentAuth } from "@/lib/auth/agent-auth";

interface DifficultyParams {
  resistance_level: number;
  emotional_intensity: number;
  cooperation: number;
}

/**
 * Translate numeric difficulty parameters (1-10 scale) into explicit
 * behavioral instructions for the AI persona so it respects the
 * intended difficulty of the training session.
 */
function buildBehaviorDirectives(params: DifficultyParams): string {
  const { resistance_level, emotional_intensity, cooperation } = params;
  const lines: string[] = [];

  lines.push("--- BEHAVIORAL DIRECTIVES (based on difficulty settings) ---");

  // Resistance: how hard the persona pushes back / refuses to be persuaded
  if (resistance_level >= 8) {
    lines.push(
      "RESISTANCE (very high): You are extremely difficult to persuade. Reject initial offers firmly. " +
      "Do NOT suggest solutions or hint at what would satisfy you — make the trainee work hard to uncover your needs. " +
      "Only concede after the trainee has demonstrated genuine empathy and offered a concrete, compelling resolution."
    );
  } else if (resistance_level >= 5) {
    lines.push(
      "RESISTANCE (moderate): You are skeptical but open to good arguments. " +
      "Push back on weak offers but respond positively when the trainee addresses your core concern. " +
      "Do not volunteer solutions, but acknowledge good suggestions when offered."
    );
  } else {
    lines.push(
      "RESISTANCE (low): You are relatively open and willing to cooperate. " +
      "Voice your concern but accept reasonable solutions without much pushback."
    );
  }

  // Emotional intensity: how emotionally charged the persona is
  if (emotional_intensity >= 8) {
    lines.push(
      "EMOTION (very high): You are visibly upset, frustrated, or angry. Express strong emotions. " +
      "Do not calm down easily — the trainee must actively de-escalate before you engage constructively."
    );
  } else if (emotional_intensity >= 5) {
    lines.push(
      "EMOTION (moderate): You are noticeably dissatisfied but not hostile. " +
      "Show frustration when your concerns are dismissed, but respond to empathy."
    );
  } else {
    lines.push(
      "EMOTION (low): You are calm and matter-of-fact. " +
      "State your issue clearly without strong emotional language."
    );
  }

  // Cooperation: how much the persona helps steer the conversation
  if (cooperation <= 3) {
    lines.push(
      "COOPERATION (very low): Do NOT help the trainee. Give short, vague answers. " +
      "Do NOT proactively offer information about what you want. Do NOT hint at solutions. " +
      "Do NOT signal interest in competing offers or mention switching providers. " +
      "The trainee must ask the right questions to extract your needs."
    );
  } else if (cooperation <= 6) {
    lines.push(
      "COOPERATION (moderate): Answer direct questions honestly but do not volunteer extra information. " +
      "Do not proactively guide the conversation toward any outcome. " +
      "Let the trainee lead the discovery process."
    );
  } else {
    lines.push(
      "COOPERATION (high): Be forthcoming with information. " +
      "Clearly explain your situation, what bothers you, and what kind of solution you are looking for. " +
      "Help the trainee understand your needs."
    );
  }

  lines.push("--- END BEHAVIORAL DIRECTIVES ---");
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const agentAuth = await resolveAgentAuth(request);
    if (agentAuth.error) return agentAuth.error;
    const { tenantId } = agentAuth.auth;

    const body = await request.json();
    const phone = body.phone as string | undefined;
    const otp = body.otp as string | undefined;
    const sessionId = body.session_id as string | undefined;

    if (!phone && !otp && !sessionId) {
      return NextResponse.json({ error: "Missing phone, otp, or session_id parameter" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let session;

    if (sessionId) {
      // Direct session ID lookup
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          scenario:scenarios(*),
          difficulty_level:difficulty_levels(*)
        `)
        .eq("id", sessionId)
        .eq("tenant_id", tenantId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No session found for this session_id" }, { status: 404 });
      }
      session = data;
    } else if (otp) {
      // OTP-based lookup (browser calls)
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          scenario:scenarios(*),
          difficulty_level:difficulty_levels(*)
        `)
        .eq("otp", otp)
        .eq("tenant_id", tenantId)
        .gt("otp_expires_at", new Date().toISOString())
        .in("status", ["initiated", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No active session found for this OTP" }, { status: 404 });
      }
      session = data;
    } else {
      // Phone-based lookup (Twilio calls) — scoped to tenant
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          user:users!inner(phone),
          scenario:scenarios(*),
          difficulty_level:difficulty_levels(*)
        `)
        .eq("user.phone", phone!)
        .eq("tenant_id", tenantId)
        .in("status", ["initiated", "ringing", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "No active session found for this phone number" }, { status: 404 });
      }
      session = data;
    }

    console.log("[wonderful/scenario] session_id:", session.id);

    const scenario = session.scenario;
    const difficultyLevel = session.difficulty_level;

    const basePrompt = difficultyLevel
      ? `${scenario.prompt}\n\n${difficultyLevel.prompt}`
      : scenario.prompt;

    const behaviorDirectives = difficultyLevel
      ? buildBehaviorDirectives(difficultyLevel)
      : "";

    const response = {
      session_id: session.id,
      user_id: session.user_id,
      scenario_id: session.scenario_id,
      prompt: behaviorDirectives
        ? `${basePrompt}\n\n${behaviorDirectives}`
        : basePrompt,
      resistance_level: difficultyLevel?.resistance_level ?? 50,
      emotional_intensity: difficultyLevel?.emotional_intensity ?? 50,
      cooperation: difficultyLevel?.cooperation ?? 50,
      scenario_name: scenario.name,
      difficulty_name: difficultyLevel?.name ?? "Default",
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
