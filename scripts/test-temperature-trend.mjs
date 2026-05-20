#!/usr/bin/env node
/**
 * Unit-style test for analyzeTemperatureTrend / consistencyScore / isWeekendDay.
 * Uses synthetic snapshots so it runs without network or Eight Sleep credentials.
 */
import assert from "node:assert/strict";
import {
  analyzeTemperatureTrend,
  consistencyScore,
  isWeekendDay,
} from "../dist/services/temperature-trend.js";

const WIN = { from: "2026-05-13", to: "2026-05-19", days_requested: 7, timezone: "UTC" };
const CURRENT = { bedtime_level: -10, initial_level: 0, final_level: 10, now_level: -5, is_on: true, side: "left" };

// --- isWeekendDay sanity ---
// 2026-05-16 is a Saturday, 2026-05-17 Sunday, 2026-05-18 Monday.
assert.equal(isWeekendDay("2026-05-16"), true, "Saturday should be weekend");
assert.equal(isWeekendDay("2026-05-17"), true, "Sunday should be weekend");
assert.equal(isWeekendDay("2026-05-18"), false, "Monday should not be weekend");
assert.equal(isWeekendDay("2026-05-15"), false, "Friday should not be weekend");
console.log("PASS isWeekendDay: Sat/Sun=true, Mon/Fri=false");

// --- consistencyScore: identical values = 100, large variance trends toward 0 ---
assert.equal(consistencyScore([10, 10, 10, 10]), 100, "identical → 100");
assert.equal(consistencyScore([]), 100, "empty → 100 (no variance to penalize)");
assert.equal(consistencyScore([5]), 100, "single value → 100");
const varied = consistencyScore([-30, -10, 10, 30]); // stdev ~22.4 → score 0
assert.equal(varied, 0, `wildly varied [-30,-10,10,30] → score 0 (got ${varied})`);
const mild = consistencyScore([-2, -1, 0, 1, 2]); // stdev ~1.41 → score ~86
assert.ok(mild >= 80 && mild <= 95, `mild variance score should be 80-95 (got ${mild})`);
console.log(`PASS consistencyScore: identical=100, wild=0, mild=${mild}`);

// --- analyze: empty snapshots → nights_analyzed=0, no crash ---
const empty = analyzeTemperatureTrend([], CURRENT, WIN);
assert.equal(empty.nights_analyzed, 0);
assert.equal(empty.mean_bedtime, undefined);
assert.equal(empty.mean_wake, undefined);
assert.equal(empty.mean_delta, undefined);
assert.equal(empty.weekend_vs_weekday, undefined);
assert.equal(empty.coldest_night, undefined);
assert.equal(empty.warmest_night, undefined);
assert.equal(empty.consistency_score, undefined);
assert.deepEqual(empty.observations, []);
assert.ok(empty.notes.some((n) => /no nightly records/i.test(n)));
assert.equal(empty.kind, "temperature_trend");
console.log("PASS analyze (empty): nights_analyzed=0, no crash, helpful note");

// --- analyze: snapshots WITHOUT temperature data (only score) → notes warn, no aggregates ---
const scoresOnly = analyzeTemperatureTrend(
  [
    { day: "2026-05-13", score: 85 },
    { day: "2026-05-14", score: 88 },
    { day: "2026-05-15", score: 82 },
  ],
  CURRENT,
  WIN,
);
assert.equal(scoresOnly.nights_analyzed, 3);
assert.equal(scoresOnly.mean_bedtime, undefined);
assert.ok(scoresOnly.notes.some((n) => /did not include historical bedtime/i.test(n)));
console.log("PASS analyze (scores-only): warns about missing temperature data");

// --- analyze: synthetic 7-night window with full bedtime/wake data ---
// Wed/Thu/Fri weekday bedtime ~-10, Sat/Sun weekend bedtime ~-5 (warmer),
// Mon/Tue back to -10. Wake levels +10 above bedtime (warm-up enabled).
// (2026-05-13 = Wed, 14 = Thu, 15 = Fri, 16 = Sat, 17 = Sun, 18 = Mon, 19 = Tue)
const sevenNights = [
  { day: "2026-05-13", score: 85, bedtime_level: -10, wake_level: 0 }, // Wed
  { day: "2026-05-14", score: 82, bedtime_level: -10, wake_level: 0 }, // Thu
  { day: "2026-05-15", score: 80, bedtime_level: -10, wake_level: 0 }, // Fri
  { day: "2026-05-16", score: 90, bedtime_level: -5, wake_level: 5 }, // Sat
  { day: "2026-05-17", score: 88, bedtime_level: -5, wake_level: 5 }, // Sun
  { day: "2026-05-18", score: 84, bedtime_level: -10, wake_level: 0 }, // Mon
  { day: "2026-05-19", score: 86, bedtime_level: -10, wake_level: 0 }, // Tue
];
const full = analyzeTemperatureTrend(sevenNights, CURRENT, WIN);

assert.equal(full.nights_analyzed, 7);

// Mean bedtime: (-10*5 + -5*2)/7 = -60/7 ≈ -8.6
assert.equal(full.mean_bedtime, -8.6, `mean_bedtime expected -8.6, got ${full.mean_bedtime}`);
// Mean wake: (0*5 + 5*2)/7 = 10/7 ≈ 1.4
assert.equal(full.mean_wake, 1.4, `mean_wake expected 1.4, got ${full.mean_wake}`);
// Mean delta: wake - bedtime = +10 every night → 10.0
assert.equal(full.mean_delta, 10, `mean_delta expected 10, got ${full.mean_delta}`);

// Weekend vs weekday: weekend mean = -5, weekday mean = -10, delta = +5 (weekend warmer).
assert.ok(full.weekend_vs_weekday);
assert.equal(full.weekend_vs_weekday?.weekend_mean, -5);
assert.equal(full.weekend_vs_weekday?.weekday_mean, -10);
assert.equal(full.weekend_vs_weekday?.delta, 5);
assert.equal(full.weekend_vs_weekday?.weekend_nights, 2);
assert.equal(full.weekend_vs_weekday?.weekday_nights, 5);

// Coldest / warmest by bedtime level.
assert.equal(full.coldest_night?.bedtime_level, -10);
assert.equal(full.warmest_night?.bedtime_level, -5);
// First coldest scan → 2026-05-13 (first -10 reading), first warmest → 2026-05-16 (Sat).
assert.equal(full.coldest_night?.day, "2026-05-13");
assert.equal(full.warmest_night?.day, "2026-05-16");

// Consistency: bedtimes are [-10,-10,-10,-5,-5,-10,-10] → stdev≈2.4 → score≈76.
assert.ok(
  full.consistency_score !== undefined && full.consistency_score >= 65 && full.consistency_score <= 85,
  `consistency_score should be 65-85 (got ${full.consistency_score})`,
);

// Observations should call out the 5-level weekend swing.
assert.ok(
  full.observations.some((o) => /weekend/i.test(o) && /warmer/i.test(o)),
  `observations should mention weekend warmer; got: ${JSON.stringify(full.observations)}`,
);
console.log(
  `PASS analyze (7 nights): mean_bedtime=${full.mean_bedtime}, mean_wake=${full.mean_wake}, mean_delta=${full.mean_delta}, weekend_delta=${full.weekend_vs_weekday?.delta}, consistency=${full.consistency_score}`,
);

// --- analyze: trending-colder pattern triggers a "dropped" observation ---
const trending = [
  { day: "2026-05-13", bedtime_level: 0, wake_level: 0 },
  { day: "2026-05-14", bedtime_level: -5, wake_level: -5 },
  { day: "2026-05-15", bedtime_level: -10, wake_level: -10 },
  { day: "2026-05-16", bedtime_level: -15, wake_level: -15 },
  { day: "2026-05-17", bedtime_level: -20, wake_level: -20 },
];
const trend = analyzeTemperatureTrend(trending, CURRENT, WIN);
assert.ok(
  trend.observations.some((o) => /dropped/i.test(o)),
  `trending-colder should produce a 'dropped' observation; got: ${JSON.stringify(trend.observations)}`,
);
console.log(`PASS analyze (trending): observations include 'dropped from X to Y'`);

// --- analyze: disabled-warmup pattern (wake ≈ bedtime) is surfaced ---
const noWarmup = [
  { day: "2026-05-13", bedtime_level: -10, wake_level: -10 },
  { day: "2026-05-14", bedtime_level: -10, wake_level: -9 },
  { day: "2026-05-15", bedtime_level: -10, wake_level: -10 },
  { day: "2026-05-16", bedtime_level: -10, wake_level: -8 },
  { day: "2026-05-17", bedtime_level: -10, wake_level: -10 },
];
const nw = analyzeTemperatureTrend(noWarmup, CURRENT, WIN);
assert.ok(
  nw.observations.some((o) => /warm-up/i.test(o) && /disabled/i.test(o)),
  `no-warmup pattern should produce a disabled-warmup observation; got: ${JSON.stringify(nw.observations)}`,
);
console.log("PASS analyze (no warmup): observations call out disabled morning warm-up");

console.log("\nall temperature-trend unit tests passed.");
