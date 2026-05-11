import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET } from "../constants.js";
import type { EightSleepConfig, PrivacyMode } from "../types.js";
import { loadConfigSources } from "./local-config.js";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function getConfig(): EightSleepConfig {
  const sources = loadConfigSources(process.env, homedir());
  const value = (name: keyof typeof sources.values) => env(name) ?? sources.values[name];

  const email = value("EIGHT_SLEEP_EMAIL");
  const password = value("EIGHT_SLEEP_PASSWORD");
  const clientId = value("EIGHT_SLEEP_CLIENT_ID") ?? DEFAULT_CLIENT_ID;
  const clientSecret = value("EIGHT_SLEEP_CLIENT_SECRET") ?? DEFAULT_CLIENT_SECRET;
  const tokenPath = value("EIGHT_SLEEP_TOKEN_PATH") ?? join(homedir(), ".eight-sleep-mcp", "tokens.json");
  const cachePath = value("EIGHT_SLEEP_CACHE_PATH") ?? join(homedir(), ".eight-sleep-mcp", "cache.sqlite");
  const privacyMode = parsePrivacyMode(value("EIGHT_SLEEP_PRIVACY_MODE"));
  const cacheEnabled = parseBool(value("EIGHT_SLEEP_CACHE"), false);
  const allowMutations = parseBool(value("EIGHT_SLEEP_ALLOW_MUTATIONS"), false);

  const missing = [
    ["EIGHT_SLEEP_EMAIL", email],
    ["EIGHT_SLEEP_PASSWORD", password]
  ].filter(([, v]) => !v).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing Eight Sleep credentials: ${missing.join(", ")}. ` +
      "Run `eight-sleep-mcp-server setup` or set EIGHT_SLEEP_EMAIL and EIGHT_SLEEP_PASSWORD."
    );
  }

  return {
    email: email!,
    password: password!,
    clientId,
    clientSecret,
    tokenPath,
    privacyMode,
    cacheEnabled,
    cachePath,
    allowMutations
  };
}

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase());
}
