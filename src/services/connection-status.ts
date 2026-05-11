import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { EightSleepTokenSet, PrivacyMode } from "../types.js";
import { type AgentClientName } from "./agent-manifest.js";
import { loadConfigSources } from "./local-config.js";

type Env = Record<string, string | undefined>;

export interface ConnectionStatusOptions {
  env?: Env;
  homeDir?: string;
  nowMs?: number;
  client?: AgentClientName;
}

export interface ConnectionStatus extends Record<string, unknown> {
  ok: boolean;
  ready_for_eight_sleep_api: boolean;
  client?: AgentClientName;
  node: { version: string; supported: boolean };
  privacy_mode: PrivacyMode;
  required_env: Record<string, boolean>;
  missing_env: string[];
  mutations_enabled: boolean;
  config: {
    source: "env" | "local_config" | "mixed" | "missing";
    path: string;
    exists: boolean;
    secure_permissions?: boolean;
    error?: string;
  };
  token: {
    path: string;
    exists: boolean;
    readable: boolean;
    permissions?: string;
    secure_permissions?: boolean;
    expires_at?: number;
    expired?: boolean;
    error?: string;
  };
  cache: { enabled: boolean; path: string };
  next_steps: string[];
}

const REQUIRED_ENV = ["EIGHT_SLEEP_EMAIL", "EIGHT_SLEEP_PASSWORD"];

export async function buildConnectionStatus(options: ConnectionStatusOptions = {}): Promise<ConnectionStatus> {
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? homedir();
  const sources = loadConfigSources(env, homeDir);
  const value = (name: keyof typeof sources.values) => sources.values[name];
  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const tokenPath = value("EIGHT_SLEEP_TOKEN_PATH") ?? join(homeDir, ".eight-sleep-mcp", "tokens.json");
  const cachePath = value("EIGHT_SLEEP_CACHE_PATH") ?? join(homeDir, ".eight-sleep-mcp", "cache.sqlite");
  const requiredEnv = Object.fromEntries(REQUIRED_ENV.map((name) => [name, Boolean(value(name as keyof typeof sources.values))]));
  const missingEnv = REQUIRED_ENV.filter((name) => !requiredEnv[name]);
  const token = await inspectToken(tokenPath, nowSeconds);
  const nodeSupported = Number(process.versions.node.split(".")[0] ?? 0) >= 20;
  const tokenUsable = !token.exists || (token.readable && token.secure_permissions !== false);
  const ready = missingEnv.length === 0 && tokenUsable;
  const ok = ready && nodeSupported;

  return {
    ok,
    ready_for_eight_sleep_api: ready,
    client: options.client,
    node: { version: process.versions.node, supported: nodeSupported },
    privacy_mode: parsePrivacyMode(value("EIGHT_SLEEP_PRIVACY_MODE")),
    required_env: requiredEnv,
    missing_env: missingEnv,
    mutations_enabled: parseBool(value("EIGHT_SLEEP_ALLOW_MUTATIONS")),
    config: {
      source: sources.source,
      path: sources.local.path,
      exists: sources.local.exists,
      secure_permissions: sources.local.secure_permissions,
      error: sources.local.error
    },
    token,
    cache: { enabled: parseBool(value("EIGHT_SLEEP_CACHE")), path: cachePath },
    next_steps: buildNextSteps({ missingEnv, token, nodeSupported })
  };
}

function parsePrivacyMode(value: string | undefined): PrivacyMode {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  return "structured";
}

function parseBool(value: string | undefined): boolean {
  return Boolean(value && ["1", "true", "yes", "on", "sqlite"].includes(value.toLowerCase()));
}

async function inspectToken(path: string, nowSeconds: number): Promise<ConnectionStatus["token"]> {
  try {
    const [stat, text] = await Promise.all([fs.stat(path), fs.readFile(path, "utf8")]);
    const permissions = (stat.mode & 0o777).toString(8).padStart(3, "0");
    const securePermissions = process.platform === "win32" ? true : (stat.mode & 0o077) === 0;
    const token = JSON.parse(text) as Partial<EightSleepTokenSet>;
    const expiresAt = typeof token.expires_at === "number" ? token.expires_at : undefined;
    return {
      path,
      exists: true,
      readable: true,
      permissions,
      secure_permissions: securePermissions,
      expires_at: expiresAt,
      expired: expiresAt ? expiresAt <= nowSeconds : undefined
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { path, exists: false, readable: false };
    return { path, exists: true, readable: false, error: (error as Error).message };
  }
}

function buildNextSteps(input: {
  missingEnv: string[];
  token: ConnectionStatus["token"];
  nodeSupported: boolean;
}): string[] {
  const steps: string[] = [];
  if (!input.nodeSupported) steps.push("Install Node.js 20 or newer.");
  for (const name of input.missingEnv) {
    steps.push(`Set ${name}. Use your Eight Sleep app email/password.`);
  }
  if (!input.token.exists && input.missingEnv.length === 0) {
    steps.push("Run `eight-sleep-mcp-server login` (or just call any data tool; login happens on first call).");
  } else if (input.token.exists && !input.token.readable) {
    steps.push(`Fix token file readability at ${input.token.path}.`);
  } else if (input.token.secure_permissions === false) {
    steps.push(`Restrict token file permissions: chmod 600 ${input.token.path}`);
  } else if (input.token.expired) {
    steps.push("Token expired. Next request will auto-refresh by re-logging in with stored credentials.");
  }
  if (steps.length === 0) {
    steps.push("Ready. Start with eight_sleep_get_me, then eight_sleep_get_temperature.");
  }
  return steps;
}
