#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const envFilePath = path.join(__dirname, "..", ".env.local");

/**
 * Run command and return output, or null if it fails.
 */
function tryExec(command, options = {}) {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe", ...options });
  } catch {
    return null;
  }
}

/**
 * Parse KEY=VALUE (optionally quoted) lines from a string, skipping comments
 * and blank lines.
 */
function parseEnv(content) {
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+?)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      // Strip surrounding quotes if present
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      vars[key] = value;
    }
  }
  return vars;
}

/**
 * Fetch Supabase credentials from the local CLI.
 * Starts Supabase if it is not already running.
 */
function getSupabaseCredentials() {
  console.log("  Checking local Supabase status...");

  let envOutput = tryExec("supabase status --output env", { cwd: repoRoot });

  if (!envOutput) {
    console.log("  Supabase is not running — starting it now...");
    console.log("  (this may take a minute on first run)\n");

    try {
      execSync("supabase start", { cwd: repoRoot, stdio: "inherit" });
      console.log("");
    } catch (err) {
      console.error("  Failed to start Supabase:", err.message);
      process.exit(1);
    }

    envOutput = tryExec("supabase status --output env", { cwd: repoRoot });
    if (!envOutput) {
      console.error("  Failed to read Supabase status after starting.");
      process.exit(1);
    }
  }

  const parsed = parseEnv(envOutput);

  const url = parsed.API_URL;
  const anonKey = parsed.ANON_KEY;
  const serviceRoleKey = parsed.SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    console.error("  Could not parse required keys from `supabase status`.");
    console.error("  Got:", JSON.stringify(parsed, null, 2));
    process.exit(1);
  }

  return { url, anonKey, serviceRoleKey };
}

/**
 * Merge Supabase credentials into .env.local, preserving all other variables.
 */
function updateEnvFile(credentials) {
  let existing = {};

  if (fs.existsSync(envFilePath)) {
    existing = parseEnv(fs.readFileSync(envFilePath, "utf-8"));
  }

  // Merge — Supabase keys always come from the CLI; everything else is kept
  const merged = {
    ...existing,
    NEXT_PUBLIC_SUPABASE_URL: credentials.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: credentials.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: credentials.serviceRoleKey,
  };

  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envFilePath, lines.join("\n") + "\n");
}

/**
 * Main
 */
function main() {
  console.log("\n  setup-env: Syncing Supabase credentials\n");

  const credentials = getSupabaseCredentials();
  updateEnvFile(credentials);

  console.log("  .env.local updated:");
  console.log(`    NEXT_PUBLIC_SUPABASE_URL = ${credentials.url}`);
  console.log(
    `    NEXT_PUBLIC_SUPABASE_ANON_KEY = ${credentials.anonKey.substring(0, 20)}...`
  );
  console.log(
    `    SUPABASE_SERVICE_ROLE_KEY     = ${credentials.serviceRoleKey.substring(0, 20)}...`
  );
  console.log("");
}

main();
