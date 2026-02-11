import { SignJWT, jwtVerify } from "jose";

const getSecret = () =>
  new TextEncoder().encode(process.env.BROWSER_CALL_JWT_SECRET || "dev-secret-change-me-in-production");

export interface BrowserCallTokenPayload {
  sessionId: string;
  userId: string;
  scenarioId: string;
  difficultyLevelId: string;
  otp: string;
}

export async function signBrowserCallToken(
  payload: BrowserCallTokenPayload
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyBrowserCallToken(
  token: string
): Promise<BrowserCallTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as BrowserCallTokenPayload;
}
