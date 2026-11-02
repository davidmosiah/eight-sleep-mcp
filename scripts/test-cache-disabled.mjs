import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EightSleepClient } from "../dist/services/eight-sleep-client.js";
import { getConfig } from "../dist/services/config.js";
import { buildPrivacyAudit } from "../dist/services/audit.js";
import { buildConnectionStatus } from "../dist/services/connection-status.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const home = await mkdtemp(join(tmpdir(), "eight-sleep-no-cache-"));
const tokenPath = join(home, "tokens.json");
const cachePath = join(home, "legacy-cache.sqlite");
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let status = 200;
let statuses = [];
let networkFailure = false;
let pending;
let defer = false;
let called;
try {
  // A deliberately invalid DB proves neither status nor GET tries to open it.
  const legacy = "synthetic legacy private cache -- must never read or rewrite";
  await writeFile(cachePath, legacy, { mode: 0o600 });
  const config = { email: "synthetic@example.invalid", password: "synthetic", clientId: "synthetic", clientSecret: "synthetic", tokenPath, cachePath, cacheEnabled: true, privacyMode: "structured", allowMutations: false };
  process.env.HOME = home; process.env.USERPROFILE = home;
  process.env.EIGHT_SLEEP_EMAIL = "synthetic@example.invalid";
  process.env.EIGHT_SLEEP_PASSWORD = "synthetic";
  process.env.EIGHT_SLEEP_CLIENT_ID = "synthetic";
  process.env.EIGHT_SLEEP_CLIENT_SECRET = "synthetic";
  process.env.EIGHT_SLEEP_CACHE = "true";
  process.env.EIGHT_SLEEP_CACHE_PATH = cachePath;
  process.env.EIGHT_SLEEP_TOKEN_PATH = tokenPath;
  assert.equal(getConfig().cacheEnabled, false);
  assert.equal(buildPrivacyAudit().cache_enabled, false);
  assert.equal((await buildConnectionStatus({ env: { EIGHT_SLEEP_CACHE: "true", EIGHT_SLEEP_TOKEN_PATH: tokenPath, EIGHT_SLEEP_CACHE_PATH: cachePath }, homeDir: home })).cache.enabled, false);
  async function token(user) {
    await writeFile(tokenPath, JSON.stringify({ access_token: `synthetic-${user}`, user_id: user, expires_at: Math.floor(Date.now() / 1000) + 3600 }), { mode: 0o600 });
  }
  globalThis.fetch = async () => {
    called?.();
    if (networkFailure) throw new Error("synthetic-network-failure");
    if (defer) return new Promise(resolve => { pending = resolve; });
    return new Response(JSON.stringify({ synthetic: "live-provider-data" }), { status: statuses.shift() ?? status });
  };
  await token("A");
  const a = new EightSleepClient(config);
  assert.equal(a.cacheStatus().enabled, false);
  assert.equal(a.cacheStatus().entries, 0);
  assert.deepEqual(Object.keys(a.cacheStatus()).sort(), ["enabled", "entries", "path"]);
  // Verify actual MCP output-schema validation and diagnostic surfaces too.
  const mcp = new Client({ name: "cache-disabled-fixture", version: "0.0.0" });
  try {
    await mcp.connect(new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], env: {
      PATH: process.env.PATH ?? "", HOME: home, USERPROFILE: home,
      EIGHT_SLEEP_EMAIL: "synthetic@example.invalid", EIGHT_SLEEP_PASSWORD: "synthetic",
      EIGHT_SLEEP_CLIENT_ID: "synthetic", EIGHT_SLEEP_CLIENT_SECRET: "synthetic",
      EIGHT_SLEEP_TOKEN_PATH: tokenPath, EIGHT_SLEEP_CACHE_PATH: cachePath, EIGHT_SLEEP_CACHE: "true",
    } }));
    for (const [name, check] of [
      ["eight_sleep_cache_status", value => value.enabled],
      ["eight_sleep_privacy_audit", value => value.cache_enabled],
      ["eight_sleep_connection_status", value => value.cache.enabled],
    ]) {
      const result = await mcp.callTool({ name, arguments: { response_format: "json" } });
      assert.notEqual(result.isError, true);
      assert.equal(check(result.structuredContent), false);
    }
  } finally { await mcp.close(); }
  assert.deepEqual(await a.get("/users/A"), { synthetic: "live-provider-data" });
  for (const failure of [401, 403]) {
    status = failure;
    await assert.rejects(a.get("/users/A"), new RegExp(`HTTP ${failure}`));
  }
  // Network failures remain failures even after successful prior reads.
  networkFailure = true;
  await assert.rejects(a.get("/users/A"), /synthetic-network-failure/);
  networkFailure = false;
  statuses = [401, 503, 503, 503];
  await assert.rejects(a.get("/users/A"), /HTTP 503/);
  // A previous authorization denial must not be erased by a later transient result.
  status = 503;
  await assert.rejects(a.get("/users/A"), /HTTP 503/);
  await token("B");
  const b = new EightSleepClient(config);
  status = 403;
  await assert.rejects(b.get("/users/A"), /HTTP 403/);
  status = 503;
  await assert.rejects(b.get("/users/A"), /HTTP 503/);
  // Request completing after logout cannot populate a cache for a later login.
  await token("A");
  defer = true;
  const started = new Promise(resolve => { called = resolve; });
  const inFlight = a.get("/users/A");
  await started;
  await a.logout();
  pending(new Response(JSON.stringify({ synthetic: "late-A" }), { status: 200 }));
  await inFlight;
  defer = false; called = undefined;
  await token("A"); // Same bearer reused by provider: still no cached replay.
  status = 403;
  await assert.rejects(new EightSleepClient(config).get("/users/A"), /HTTP 403/);
  assert.equal(await readFile(cachePath, "utf8"), legacy);
  console.log("Real EightSleepClient fixture checks passed: cache disabled, auth/network failures, A→B, logout/in-flight/same-token.");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
  Object.assign(process.env, originalEnv);
  await rm(home, { recursive: true, force: true });
}
