import crypto from "crypto";

export function generateAgentApiKey(): string {
  return "wai_" + crypto.randomBytes(32).toString("hex");
}
