#!/usr/bin/env node
/**
 * Unit tests for analyzeSleepEfficiency / bandFor.
 * Synthetic-data only — no network or Eight Sleep credentials required.
 */
import assert from "node:assert/strict";
import { analyzeSleepEfficiency, bandFor } from "../dist/services/sleep-efficiency.js";

const WIN = { from: "2026-05-13", to: "2026-05-19", days_requested: 7, timezone: "UTC" };

// ---- bandFor boundary tests
assert.equal(bandFor(95), "excellent");
assert.equal(bandFor(85), "excellent", "85% is exactly excellent");
assert.equal(bandFor(84), "good", "84% drops to good");
assert.equal(bandFor(80), "good");
assert.equal(bandFor(75), "good", "75% is exactly good");
assert.equal(bandFor(74), "fair", "74% drops to fair");
assert.equal(bandFor(65), "fair", "65% is exactly fair");
assert.equal(bandFor(64), "poor", "64% drops to poor");
assert.equal(bandFor(10), "poor");
console.log("PASS bandFor boundaries (excellent ≥85, good 75-84, fair 65-74, poor <65)");

// ---- empty payload → no crash
const empty = analyzeSleepEfficiency([], WIN);
assert.equal(empty.kind, "sleep_efficiency");
assert.equal(empty.nights_analyzed, 0);
assert.equal(empty.mean_efficiency_pct, undefined);
assert.equal(empty.median_efficiency_pct, undefined);
assert.equal(empty.min_efficiency_night, undefined);
assert.equal(empty.max_efficiency_night, undefined);
assert.deepEqual(empty.per_night, []);
assert.deepEqual(empty.observations, []);
assert.ok(empty.notes.some((n) => /no nightly records/i.test(n)), "empty should warn about no records");
console.log("PASS analyze (empty): nights_analyzed=0 + helpful note, no crash");

// ---- presence/sleep missing → graceful degradation
const missing = analyzeSleepEfficiency(
  [
    { day: "2026-05-13", score: 80 },
    { day: "2026-05-14", score: 78 },
    { day: "2026-05-15", score: 82 },
  ],
  WIN,
);
assert.equal(missing.nights_analyzed, 0, "no efficiency when fields missing");
assert.equal(missing.per_night.length, 3, "but per-night still surfaces the nights");
assert.equal(missing.per_night[0].efficiency_pct, undefined);
assert.equal(missing.per_night[0].efficiency_band, undefined);
assert.ok(
  missing.notes.some((n) => /did not expose presenceDuration/i.test(n)),
  "should warn about missing presence/sleep duration",
);
console.log("PASS analyze (missing fields): graceful degradation + explanatory note");

// ---- happy path: 7 nights with deterministic efficiencies
// presenceDuration is in seconds; design each night so efficiency is exactly the target %.
function night(day, score, target_eff_pct, in_bed_minutes = 480, tnt = undefined) {
  const inBedSec = in_bed_minutes * 60;
  const asleepSec = Math.round(inBedSec * target_eff_pct / 100);
  return { day, score, presenceDuration: inBedSec, sleepDuration: asleepSec, ...(tnt !== undefined ? { tnt } : {}) };
}

const nights = [
  night("2026-05-13", 90, 92), // excellent
  night("2026-05-14", 88, 88), // excellent
  night("2026-05-15", 85, 86), // excellent
  night("2026-05-16", 75, 78), // good
  night("2026-05-17", 70, 72), // fair
  night("2026-05-18", 65, 68), // fair
  night("2026-05-19", 55, 60), // poor
];
const result = analyzeSleepEfficiency(nights, WIN);

assert.equal(result.nights_analyzed, 7);
// Mean = (92+88+86+78+72+68+60)/7 = 544/7 = 77.71 → rounds to 78
assert.equal(result.mean_efficiency_pct, 78, `expected mean=78 got ${result.mean_efficiency_pct}`);
// Median of [60, 68, 72, 78, 86, 88, 92] = 78
assert.equal(result.median_efficiency_pct, 78);
assert.equal(result.min_efficiency_night?.day, "2026-05-19");
assert.equal(result.min_efficiency_night?.efficiency_pct, 60);
assert.equal(result.min_efficiency_night?.efficiency_band, "poor");
assert.equal(result.max_efficiency_night?.day, "2026-05-13");
assert.equal(result.max_efficiency_night?.efficiency_pct, 92);
assert.equal(result.max_efficiency_night?.efficiency_band, "excellent");
assert.equal(result.nights_by_band.excellent, 3);
assert.equal(result.nights_by_band.good, 1);
assert.equal(result.nights_by_band.fair, 2);
assert.equal(result.nights_by_band.poor, 1);
// First-half mean (92,88,86)=88.67; second-half (78,72,68,60)=69.5; gap=19.17 → "dropped" observation
assert.ok(
  result.observations.some((o) => /dropped from 89% to 70% mid-week/.test(o) || /dropped/i.test(o)),
  `expected a mid-week drop observation; got: ${JSON.stringify(result.observations)}`,
);
console.log(`PASS analyze (7 nights mixed): mean=${result.mean_efficiency_pct}%, median=${result.median_efficiency_pct}%, mid-week drop observed`);

// ---- all-nights-same-band observation
const allGood = analyzeSleepEfficiency(
  [
    night("2026-05-13", 80, 80),
    night("2026-05-14", 80, 78),
    night("2026-05-15", 80, 82),
    night("2026-05-16", 80, 79),
    night("2026-05-17", 80, 80),
  ],
  WIN,
);
assert.equal(allGood.nights_analyzed, 5);
assert.equal(allGood.nights_by_band.good, 5);
assert.equal(allGood.nights_by_band.excellent, 0);
assert.equal(allGood.nights_by_band.fair, 0);
assert.equal(allGood.nights_by_band.poor, 0);
assert.ok(
  allGood.observations.some((o) => /All 5 nights in 'good' band/i.test(o)),
  `expected all-band observation; got: ${JSON.stringify(allGood.observations)}`,
);
console.log("PASS analyze (5 good nights): 'All 5 nights in good band' observation fires");

// ---- single-night dip observation
const dippy = analyzeSleepEfficiency(
  [
    night("2026-05-13", 90, 92),
    night("2026-05-14", 88, 90),
    night("2026-05-15", 85, 88),
    night("2026-05-16", 70, 65), // dip
    night("2026-05-17", 88, 90),
  ],
  WIN,
);
// Mean = (92+90+88+65+90)/5 = 425/5 = 85; dip night = 65; gap = 20 ≥ 15 → observation
assert.ok(
  dippy.observations.some((o) => /2026-05-16/.test(o) && /below the window mean/i.test(o)),
  `expected single-night dip observation; got: ${JSON.stringify(dippy.observations)}`,
);
console.log("PASS analyze (dip night): single-night dip observation fires");

// ---- partial nights mix (some missing fields)
const mixed = analyzeSleepEfficiency(
  [
    night("2026-05-13", 80, 80),
    { day: "2026-05-14", score: 75 }, // no presence/sleep — excluded
    night("2026-05-15", 85, 86),
  ],
  WIN,
);
assert.equal(mixed.nights_analyzed, 2, "only 2 nights computable");
assert.equal(mixed.per_night.length, 3, "all 3 still listed");
assert.ok(
  mixed.notes.some((n) => /1 of 3 nights had no presenceDuration/i.test(n)),
  `expected note about 1 partial night; got: ${JSON.stringify(mixed.notes)}`,
);
console.log("PASS analyze (partial): 2/3 nights computable + clarifying note");

// ---- tnt → awakenings_count passthrough (and note when absent)
const withTnt = analyzeSleepEfficiency(
  [
    night("2026-05-13", 80, 80, 480, 12), // tnt=12
    night("2026-05-14", 78, 78, 480, 9),
  ],
  WIN,
);
assert.equal(withTnt.per_night[0].awakenings_count, 12);
assert.equal(withTnt.per_night[1].awakenings_count, 9);
// When tnt present we should NOT include the "no awakenings_count" note
assert.ok(
  !withTnt.notes.some((n) => /awakenings_count was not exposed/i.test(n)),
  "awakenings note should NOT appear when tnt present",
);
console.log("PASS analyze: tnt → awakenings_count passthrough");

const withoutTnt = analyzeSleepEfficiency(
  [
    night("2026-05-13", 80, 80),
    night("2026-05-14", 78, 78),
  ],
  WIN,
);
assert.equal(withoutTnt.per_night[0].awakenings_count, undefined);
assert.ok(
  withoutTnt.notes.some((n) => /awakenings_count was not exposed/i.test(n)),
  "should note awakenings_count absence",
);
console.log("PASS analyze: awakenings_count absence noted");

console.log("\nall sleep-efficiency unit tests passed.");
