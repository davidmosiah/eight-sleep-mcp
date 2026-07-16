import assert from 'node:assert/strict';
import { applyPrivacy } from '../dist/services/privacy.js';

const upstream = {
  days: [{
    day: '2026-07-08',
    score: 88,
    stages: { deep: 5400, rem: 6300 },
    futureMetrics: { sleepRegularity: 91 },
    podSerial: 'sensitive-serial',
  }],
  futureEnvelope: { modelVersion: 'v3' },
};

const structured = applyPrivacy('/users/synthetic-user/trends', upstream, 'structured');
assert.deepEqual(structured.days[0].stages, upstream.days[0].stages);
assert.deepEqual(structured.days[0].futureMetrics, { sleepRegularity: 91 });
assert.deepEqual(structured.futureEnvelope, { modelVersion: 'v3' });
assert.equal(structured.days[0].podSerial, '[REDACTED]');

console.log(JSON.stringify({ ok: true, suite: 'privacy-contracts' }, null, 2));
