import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EightSleepClient } from '../dist/services/eight-sleep-client.js';
import { fetchTrendDays } from '../dist/services/wellness-context.js';
import { buildTrendsQueryParams, trendsQueryHasConflictingIncludes } from '../dist/services/trends-query.js';

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
  return Response.json({ days: [{ day: '2026-07-08', score: 88, sessions: [{ id: 's1' }] }] });
};

function assertExclusiveTrendsIncludes(params, label) {
  const hasMain = Object.hasOwn(params, 'include-main');
  const hasAll = Object.hasOwn(params, 'include-all-sessions');
  assert.ok(
    !(hasMain && hasAll),
    `${label} must not send both include-main and include-all-sessions`,
  );
  assert.equal(trendsQueryHasConflictingIncludes(params), false, `${label} helper must treat params as exclusive`);
}

try {
  const trendsParams = buildTrendsQueryParams({
    timezone: 'America/Fortaleza',
    from: '2026-07-08',
    to: '2026-07-15',
  });
  assert.equal(
    trendsQueryHasConflictingIncludes({ 'include-main': true, 'include-all-sessions': true }),
    true,
    'helper must detect both include flags',
  );
  assertExclusiveTrendsIncludes(trendsParams, 'buildTrendsQueryParams');
  assert.equal(trendsParams['include-all-sessions'], true);
  assert.equal(trendsParams['include-main'], undefined);
  assert.equal(trendsParams['model-version'], 'v2');

  for (const relative of ['src/tools/eight-sleep-tools.ts', 'src/services/wellness-context.ts']) {
    const src = readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
    const hasMain = /["']include-main["']\s*:/.test(src);
    const hasAll = /["']include-all-sessions["']\s*:/.test(src);
    assert.ok(!(hasMain && hasAll), `${relative} must not hardcode both include flags`);
  }

  const payload = await client.get('/users/synthetic-user/trends', {
    base: 'client',
    params: trendsParams,
  });
  assert.equal(requests[0].origin, 'https://client-api.8slp.net');
  assert.equal(requests[0].searchParams.get('from'), '2026-07-08');
  assert.equal(requests[0].searchParams.get('to'), '2026-07-15');
  assert.equal(requests[0].searchParams.get('tz'), 'America/Fortaleza');
  assert.equal(requests[0].searchParams.has('include-main'), false, 'URL must omit include-main');
  assert.equal(requests[0].searchParams.get('include-all-sessions'), 'true');
  assert.ok(
    !(requests[0].searchParams.has('include-main') && requests[0].searchParams.has('include-all-sessions')),
    'constructed URL must not include both session flags',
  );
  assert.equal(payload.days[0].score, 88);

  const fetchCountBeforeInvalid = requests.length;
  for (const params of [
    { from: '2026-02-30', to: '2026-03-01', tz: 'UTC' },
    { from: '2026-07-15', to: '2026-07-08', tz: 'UTC' },
    { from: '2026-07-08', to: '2026-07-15', tz: 'Not/A_Timezone' },
    {
      from: '2026-07-08',
      to: '2026-07-15',
      tz: 'UTC',
      'include-main': true,
      'include-all-sessions': true,
    },
  ]) {
    await assert.rejects(
      client.get('/users/synthetic-user/trends', { base: 'client', params }),
      /Invalid Eight Sleep|Eight Sleep trends from|only one of include-main or include-all-sessions/,
    );
  }
  assert.equal(requests.length, fetchCountBeforeInvalid, 'invalid trend ranges must fail before HTTP');

  const captured = [];
  const mockClient = {
    async ensureLogin() {
      return { access_token: 'synthetic-token', user_id: 'synthetic-user' };
    },
    async get(path, options) {
      captured.push({ path, options });
      return { days: [{ day: '2026-07-08', score: 88, sessions: [{ id: 's1' }] }] };
    },
  };
  const trendDays = await fetchTrendDays(mockClient, { days: 7, timezone: 'UTC' });
  assert.equal(captured.length, 1);
  assert.match(captured[0].path, /\/users\/synthetic-user\/trends$/);
  assertExclusiveTrendsIncludes(captured[0].options.params, 'fetchTrendDays');
  assert.equal(captured[0].options.params['include-all-sessions'], true);
  assert.equal(captured[0].options.params['include-main'], undefined);
  assert.equal(trendDays.days[0].score, 88);

  console.log(JSON.stringify({ ok: true, suite: 'endpoint-contracts', requests: requests.length }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  rmSync(dir, { recursive: true, force: true });
}
