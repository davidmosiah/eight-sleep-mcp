import { homedir } from "node:os";
import { join } from "node:path";
import { SERVER_NAME } from "../constants.js";
import type { PrivacyMode } from "../types.js";
import { loadConfigSources } from "./local-config.js";
import { REDACTED_KEY_PATTERNS } from "./redaction.js";

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined): boolean {
  return Boolean(value && ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase()));
}

export function buildPrivacyAudit(): Record<string, unknown> {
  const requiredEnv = ["EIGHT_SLEEP_EMAIL", "EIGHT_SLEEP_PASSWORD"];
  const sources = loadConfigSources();
  const value = (name: keyof typeof sources.values) => sources.values[name];
  return {
    project: SERVER_NAME,
    unofficial: true,
    config_source: sources.source,
    local_config_path: sources.local.path,
    local_config_exists: sources.local.exists,
    local_config_secure_permissions: sources.local.secure_permissions,
    privacy_mode_default: parsePrivacyMode(value("EIGHT_SLEEP_PRIVACY_MODE")),
    raw_payloads_opt_in: true,
    cache_enabled: parseBool(value("EIGHT_SLEEP_CACHE")),
    cache_path: value("EIGHT_SLEEP_CACHE_PATH") ?? join(homedir(), ".eight-sleep-mcp", "cache.sqlite"),
    token_path: value("EIGHT_SLEEP_TOKEN_PATH") ?? join(homedir(), ".eight-sleep-mcp", "tokens.json"),
    mutations_enabled: parseBool(value("EIGHT_SLEEP_ALLOW_MUTATIONS")),
    stdout_safe: true,
    secret_env_vars: ["EIGHT_SLEEP_PASSWORD", "EIGHT_SLEEP_CLIENT_SECRET"],
    required_env_present: Object.fromEntries(requiredEnv.map((name) => [name, Boolean(value(name as keyof typeof sources.values))])),
    redacted_key_patterns: REDACTED_KEY_PATTERNS,
    notes: [
      "This is an unofficial Eight Sleep integration. It calls the same private endpoints the mobile app uses.",
      "Email/password auth: credentials are sent to auth-api.8slp.net and the resulting access token is stored locally.",
      "Tokens are stored in ~/.eight-sleep-mcp/tokens.json with 0600 permissions and are never returned by tools.",
      "Raw upstream payloads require EIGHT_SLEEP_PRIVACY_MODE=raw or privacy_mode=raw on the call.",
      "Mutations (set_temperature, set_side, set_away_mode, snooze/dismiss alarm) require EIGHT_SLEEP_ALLOW_MUTATIONS=true and are read-only by default.",
      "Errors are redacted before being returned to MCP clients.",
      "stdio transport logs to stderr to avoid corrupting JSON-RPC."
    ]
  };
}
