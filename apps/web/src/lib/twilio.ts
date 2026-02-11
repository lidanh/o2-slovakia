import twilio from "twilio";
import type { Twilio } from "twilio";

export interface TwilioConfig {
  account_sid: string;
  auth_token: string;
}

let _client: Twilio | null = null;
let _lastSid: string | null = null;

function getTwilioClient(overrides?: Partial<TwilioConfig>): Twilio {
  const accountSid =
    overrides?.account_sid || process.env.TWILIO_ACCOUNT_SID;
  const authToken =
    overrides?.auth_token || process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }

  // Re-create client when credentials change
  if (!_client || _lastSid !== accountSid) {
    _client = twilio(accountSid, authToken);
    _lastSid = accountSid;
  }
  return _client;
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("421")) return `+${digits}`;
  if (digits.startsWith("0")) return `+421${digits.slice(1)}`;
  return `+${digits}`;
}

export async function makeCall(
  toNumber: string,
  statusCallbackUrl: string,
  wonderfulUrl: string,
  twilioConfig?: Partial<TwilioConfig>,
  fromNumberOverride?: string
): Promise<string> {
  const client = getTwilioClient(twilioConfig);
  const fromNumber = fromNumberOverride || process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber) {
    throw new Error("No from number available (agent has no active number and TWILIO_FROM_NUMBER is not set)");
  }

  const call = await client.calls.create({
    to: formatPhoneNumber(toNumber),
    from: fromNumber,
    url: wonderfulUrl,
    statusCallback: statusCallbackUrl,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    statusCallbackMethod: "POST",
    method: "POST",
  });
  return call.sid;
}
