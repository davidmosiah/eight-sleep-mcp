import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EightSleepClient } from '../dist/services/eight-sleep-client.js';

const dir = mkdtempSync(join(tmpdir(), 'eight-sleep-mcp-endpoint-contract-'));
const tokenPath = join(dir, 'tokens.json');
writeFileSync(tokenPath, JSON.stringify({
  access_token: 'synthetic-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user_id: 'synthetic-user',
}), { mode: 0o600 });

const client = new EightSleepClient({
  email: '',
  password: '',
  clientId: 'synthetic-client',
  clientSecret: 'synthetic-secret',
  tokenPath,
  privacyMode: 'structured',
  cacheEnabled: false,
  cachePath: join(dir, 'cache.sqlite'),
  allowMutations: false,
});

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  requests.push(url);
  return Response.json({ days: [{ day: '2026-07-08', score: 88 }] });
};

try {
  const payload = await client.get('/users/synthetic-user/trends', {
    base: 'client',
    params: {
      tz: 'America/Fortaleza',
      from: '2026-07-08',
      to: '2026-07-15',
      'include-main': true,
      'include-all-sessions': true,
      'model-version': 'v2',
    },
  });
  assert.equal(requests[0].origin, 'https://client-api.8slp.net');
  assert.equal(requests[0].searchParams.get('from'), '2026-07-08');
  assert.equal(requests[0].searchParams.get('to'), '2026-07-15');
  assert.equal(requests[0].searchParams.get('tz'), 'America/Fortaleza');
  assert.equal(payload.days[0].score, 88);

  const fetchCountBeforeInvalid = requests.length;
  for (const params of [
    { from: '2026-02-30', to: '2026-03-01', tz: 'UTC' },
    { from: '2026-07-15', to: '2026-07-08', tz: 'UTC' },
    { from: '2026-07-08', to: '2026-07-15', tz: 'Not/A_Timezone' },
  ]) {
    await assert.rejects(
      client.get('/users/synthetic-user/trends', { base: 'client', params }),
      /Invalid Eight Sleep|Eight Sleep trends from/,
    );
  }
  assert.equal(requests.length, fetchCountBeforeInvalid, 'invalid trend ranges must fail before HTTP');

  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requests.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  rmSync(dir, { recursive: true, force: true });
}
