import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));
for (const rel of ["README.md", "llms.txt", "AGENTS.md", "examples/claude-desktop.json", "examples/hermes.md"]) {
  const text = readFileSync(join(root, rel), "utf8");
  assert.doesNotMatch(text, /EIGHT_SLEEP_ALLOW_MUTATIONS\s*=\s*true/);
}
console.log(JSON.stringify({ ok: true, suite: "secret-scan" }, null, 2));
