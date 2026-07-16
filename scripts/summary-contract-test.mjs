import assert from 'node:assert/strict';
import { buildWellnessContext } from '../dist/services/wellness-context.js';

const failingClient = {
  async ensureLogin() {
    return { access_token: 'synthetic-token', user_id: 'synthetic-user' };
  },
  async get() {
    throw new Error('synthetic Eight Sleep trends failure');
  },
};

await assert.rejects(
  buildWellnessContext(failingClient, { days: 7, timezone: 'UTC' }),
  /synthetic Eight Sleep trends failure/,
);

console.log(JSON.stringify({ ok: true, suite: 'summary-contracts', failures_propagate: true }, null, 2));
