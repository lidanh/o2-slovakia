import { randomInt } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export function generateOtpCode(): string {
  return randomInt(0, 999999).toString().padStart(6, "0");
}

export async function generateUniqueOtp(maxRetries = 10): Promise<string> {
  const supabase = createServiceClient();

  for (let i = 0; i < maxRetries; i++) {
    const otp = generateOtpCode();
    const { data, error } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("otp", otp)
      .gt("otp_expires_at", new Date().toISOString())
      .limit(1);

    if (error) {
      // If the otp or otp_expires_at columns don't exist, the migration
      // 00002_browser_call.sql hasn't been applied yet.
      if (error.message.includes("otp") || error.code === "42703") {
        throw new Error(
          "Database column 'otp' or 'otp_expires_at' not found on training_sessions. " +
          "Please run migration 00002_browser_call.sql first. " +
          `Supabase error: ${error.message}`
        );
      }
      throw new Error(`OTP uniqueness check failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return otp;
    }
  }

  throw new Error("Failed to generate unique OTP after max retries");
}
