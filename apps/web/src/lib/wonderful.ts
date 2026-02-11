export interface WonderfulConfig {
  tenant_url: string;
  api_key: string;
}

export function getWonderfulConfig(
  overrides?: Partial<WonderfulConfig>
): WonderfulConfig {
  return {
    tenant_url: overrides?.tenant_url || "",
    api_key: overrides?.api_key || "",
  };
}

async function wonderfulFetch(
  path: string,
  config: WonderfulConfig,
  options: RequestInit = {}
) {
  const baseUrl = new URL(config.tenant_url).origin;
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.api_key,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wonderful API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createWonderfulCall(
  params: {
    phoneNumber: string;
    prompt: string;
    scenarioName: string;
    difficultyName: string;
    resistanceLevel: number;
    emotionalIntensity: number;
    cooperation: number;
    callbackUrl: string;
  },
  wonderfulConfig?: Partial<WonderfulConfig>
): Promise<{ communication_id: string; call_url: string }> {
  const config = getWonderfulConfig(wonderfulConfig);
  return wonderfulFetch("/v1/communications", config, {
    method: "POST",
    body: JSON.stringify({
      phone_number: params.phoneNumber,
      prompt: params.prompt,
      scenario_name: params.scenarioName,
      difficulty_name: params.difficultyName,
      resistance_level: params.resistanceLevel,
      emotional_intensity: params.emotionalIntensity,
      cooperation: params.cooperation,
      callback_url: params.callbackUrl,
    }),
  });
}

export async function getWonderfulTranscript(
  communicationId: string,
  wonderfulConfig?: Partial<WonderfulConfig>
): Promise<{ role: string; content: string; timestamp?: number }[]> {
  const config = getWonderfulConfig(wonderfulConfig);
  return wonderfulFetch(
    `/v1/communications/${communicationId}/transcript`,
    config
  );
}

export async function getCommunication(
  communicationId: string,
  wonderfulConfig?: Partial<WonderfulConfig>
): Promise<Record<string, unknown>> {
  const config = getWonderfulConfig(wonderfulConfig);
  return wonderfulFetch(`/api/v2/communications/${communicationId}`, config);
}

export async function makeOutboundCall(
  params: { callPurpose: string; from: string; to: string },
  wonderfulConfig?: Partial<WonderfulConfig>
): Promise<Record<string, unknown>> {
  const config = getWonderfulConfig(wonderfulConfig);
  return wonderfulFetch("/api/v1/agents/outbound", config, {
    method: "POST",
    body: JSON.stringify({
      call_purpose: params.callPurpose,
      from: params.from,
      to: params.to,
    }),
  });
}

/**
 * Fetch the first active phone number for a Wonderful agent.
 * Returns the number string (e.g. "+97223763520") or null if none found.
 */
export async function getAgentPhoneNumber(
  agentId: string,
  wonderfulConfig?: Partial<WonderfulConfig>
): Promise<string | null> {
  const config = getWonderfulConfig(wonderfulConfig);
  const result = await wonderfulFetch(`/api/v1/agents/${agentId}`, config);
  const phoneNumbers = result?.data?.phone_numbers;
  if (!Array.isArray(phoneNumbers)) return null;
  const active = phoneNumbers.find(
    (p: { details?: { active?: boolean; number?: string } }) =>
      p.details?.active === true && p.details?.number
  );
  return active?.details?.number ?? null;
}
