// Real logout gate: schema + MCP handler (not description-string grep only).
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LogoutInputSchema } from "../dist/schemas/common.js";

// --- Schema contract (shipped LogoutInputSchema) ---
const withIntent = LogoutInputSchema.safeParse({
  explicit_user_intent: true,
  response_format: "json",
});
assert.equal(withIntent.success, true, "schema accepts explicit_user_intent: true");
assert.equal(withIntent.data.explicit_user_intent, true);

const omitted = LogoutInputSchema.safeParse({ response_format: "json" });
assert.equal(omitted.success, true, "schema allows omit (defaults false)");
assert.equal(omitted.data.explicit_user_intent, false);

// Description still documents the gate (scorecard + humans)
const src = readFileSync(new URL("../src/tools/eight-sleep-tools.ts", import.meta.url), "utf8");
const idx = src.indexOf('"eight_sleep_logout"');
assert.ok(idx > 0, "logout tool must exist");
const slice = src.slice(idx, idx + 900);
assert.match(slice, /explicit_user_intent|explicit user intent/i);
assert.match(slice, /Gated by|Requires explicit/i);

// --- Handler via real MCP tool path ---
const homeDir = mkdtempSync(join(tmpdir(), "eight-sleep-logout-"));
const tokenPath = join(homeDir, ".eight-sleep-mcp", "tokens.json");
mkdirSync(join(homeDir, ".eight-sleep-mcp"), { recursive: true, mode: 0o700 });
writeFileSync(
  tokenPath,
  JSON.stringify({ access_token: "test-token-not-real", user_id: "user-test", expires_at: Date.now() + 3600_000 }, null, 2),
  { mode: 0o600 },
);
assert.equal(existsSync(tokenPath), true, "fixture token file exists before logout");

const client = new Client({ name: "eight-sleep-logout-gate-test", version: "0.0.0" });
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: {
    ...process.env,
    HOME: homeDir,
    EIGHT_SLEEP_EMAIL: "logout-gate-test@example.com",
    EIGHT_SLEEP_PASSWORD: "not-a-real-password",
    EIGHT_SLEEP_TOKEN_PATH: tokenPath,
    EIGHT_SLEEP_CACHE_PATH: join(homeDir, ".eight-sleep-mcp", "cache.sqlite"),
  },
});
await client.connect(transport);

function textPayload(result) {
  const block = result.content?.find((c) => c.type === "text");
  if (!block?.text) return null;
  try {
    return JSON.parse(block.text);
  } catch {
    return { raw: block.text };
  }
}

try {
  // omit intent → USER_ACTION_REQUIRED (handler gate)
  const omittedCall = await client.callTool({
    name: "eight_sleep_logout",
    arguments: { response_format: "json" },
  });
  const omittedBody = omittedCall.structuredContent ?? textPayload(omittedCall) ?? {};
  const omittedText = JSON.stringify(omittedBody) + (omittedCall.content?.map((c) => c.text || "").join("") || "");
  assert.match(
    omittedText,
    /USER_ACTION_REQUIRED|explicit_user_intent/i,
    `omit intent must gate: ${omittedText.slice(0, 400)}`,
  );
  assert.equal(existsSync(tokenPath), true, "token must remain when gate rejects");

  // false intent → still gated
  const falseCall = await client.callTool({
    name: "eight_sleep_logout",
    arguments: { explicit_user_intent: false, response_format: "json" },
  });
  const falseText =
    JSON.stringify(falseCall.structuredContent ?? textPayload(falseCall) ?? {}) +
    (falseCall.content?.map((c) => c.text || "").join("") || "");
  assert.match(falseText, /USER_ACTION_REQUIRED|explicit_user_intent/i);
  assert.equal(existsSync(tokenPath), true, "token must remain when intent false");

  // true intent → clears local tokens
  const okCall = await client.callTool({
    name: "eight_sleep_logout",
    arguments: { explicit_user_intent: true, response_format: "json" },
  });
  const okBody = okCall.structuredContent ?? textPayload(okCall);
  assert.ok(okBody, "logout success should return body");
  assert.equal(okBody.ok ?? okBody.local_tokens_cleared, true, JSON.stringify(okBody));
  assert.equal(okBody.local_tokens_cleared, true, JSON.stringify(okBody));
  assert.equal(existsSync(tokenPath), false, "token file cleared after explicit logout");
} finally {
  await client.close();
}

console.log(JSON.stringify({ ok: true, suite: "logout-gate-handler" }, null, 2));
