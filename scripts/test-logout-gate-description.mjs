import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/tools/eight-sleep-tools.ts', import.meta.url), 'utf8');
// Extract logout tool registration block
const idx = src.indexOf('"eight_sleep_logout"');
assert.ok(idx > 0, 'logout tool must exist');
const slice = src.slice(idx, idx + 800);
assert.match(slice, /explicit_user_intent|explicit user intent/i, 'description must document explicit intent gate');
assert.match(slice, /Gated by|Requires explicit/i, 'description must use scorecard gate hints');
console.log(JSON.stringify({ ok: true, suite: 'logout-gate-description' }, null, 2));
