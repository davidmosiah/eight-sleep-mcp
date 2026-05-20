/**
 * Eight Sleep temperature-trend workflow.
 *
 * Aggregates the current smart-temperature schedule (bedTime / initial / final
 * levels) with the last N nights of trends data, then surfaces:
 *   - the current settings (so the user can see what the bed is doing now)
 *   - per-night snapshots (score + any bedtime / wake levels found)
 *   - aggregate stats: mean_bedtime, mean_wake, mean_delta, min/max, mode
 *   - weekend_vs_weekday breakdown (Sat-Sun vs Mon-Fri)
 *   - coldest_night / warmest_night (by bedtime level when available)
 *   - consistency_score (0-100; 100 = exact same settings every night,
 *     0 = maximum variance across observed nights)
 *   - natural-language observations (English) — only when the data supports
 *     them, never invented
 *   - a correlation note (only when 3+ paired nights support |r| >= 0.5)
 *
 * The trends endpoint does NOT reliably expose per-night bedtime/wake levels
 * across all firmware versions; aggregate fields cover only the nights that
 * DID return temperature data, and `notes` explains when the upstream payload
 * is incomplete. Aggregates are honest, not invented.
 *
 * v0.2.1: New tool that calls /v1/users/{userId}/temperature for current
 * settings AND reuses fetchTrendDays() to pull the trends payload, so we don't
 * issue a third HTTP request.
 */
import type { EightSleepClient } from "./eight-sleep-client.js";
import { fetchTrendDays } from "./wellness-context.js";

export interface TemperatureTrendOptions {
  days: number;
  timezone: string;
}

interface SmartTemperatureSchedule {
  bedTime?: number;
  initial?: number;
  final?: number;
}

interface CurrentTemperaturePayload {
  currentLevel?: number;
  currentDeviceLevel?: number;
  smartTemperatures?: SmartTemperatureSchedule;
  isOn?: boolean;
  side?: string;
}

export interface NightlySnapshot {
  /** ISO YYYY-MM-DD. */
  day: string;
  score?: number;
  /** When the trends payload exposes a recorded bedTime level, it's surfaced here. */
  bedtime_level?: number;
  /** When trends exposes an end-of-night final level, it's surfaced here. */
  wake_level?: number;
}

export interface CurrentTemperatureSummary {
  bedtime_level?: number;
  initial_level?: number;
  final_level?: number;
  now_level?: number;
  is_on?: boolean;
  side?: string;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid];
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function mostCommon(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: { value: number; count: number } | undefined;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best?.value;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Pearson correlation coefficient between two equally-sized numeric arrays.
 * Returns undefined when arrays are <3 long or stdev=0.
 */
function pearson(xs: number[], ys: number[]): number | undefined {
  if (xs.length < 3 || xs.length !== ys.length) return undefined;
  const xMean = mean(xs)!;
  const yMean = mean(ys)!;
  let num = 0;
  let xDen = 0;
  let yDen = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - xMean;
    const dy = ys[i]! - yMean;
    num += dx * dy;
    xDen += dx * dx;
    yDen += dy * dy;
  }
  const denom = Math.sqrt(xDen * yDen);
  return denom === 0 ? undefined : num / denom;
}

/**
 * Returns true if a YYYY-MM-DD ISO day-string falls on Saturday or Sunday (UTC).
 * Exported for tests.
 */
export function isWeekendDay(isoDay: string): boolean {
  const dow = new Date(`${isoDay}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Consistency score in [0, 100] for a list of numeric settings.
 * 100 = identical every night (variance 0); decreases with population stdev.
 * Uses a linear scale where stdev=10 (a 10-level swing per night) → score=0.
 * Returns 100 for arrays of length < 2.
 */
export function consistencyScore(values: number[]): number {
  if (values.length < 2) return 100;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  // Eight Sleep "levels" run -100..+100; 10 units = 10% of a full swing.
  // Anything beyond stdev=10 we treat as fully inconsistent.
  const score = Math.max(0, Math.min(100, Math.round((1 - std / 10) * 100)));
  return score;
}

/**
 * Pure analyzer: takes an already-fetched `snapshots` array (sorted by day)
 * and an optional `current` schedule, and returns the temperature-trend
 * payload. No IO. Used both by `buildTemperatureTrend()` and tests with
 * synthetic data.
 *
 * Empty snapshots → `nights_analyzed: 0`, all aggregates undefined,
 * `observations` empty, `notes` explains why — no crash.
 */
export function analyzeTemperatureTrend(
  snapshots: NightlySnapshot[],
  current: CurrentTemperatureSummary | undefined,
  window: { from: string; to: string; days_requested: number; timezone: string },
) {
  const sorted = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));

  const bedtimeLevels = sorted.map((s) => s.bedtime_level).filter((v): v is number => v !== undefined);
  const wakeLevels = sorted.map((s) => s.wake_level).filter((v): v is number => v !== undefined);
  const deltas = sorted
    .map((s) => (s.bedtime_level !== undefined && s.wake_level !== undefined ? s.wake_level - s.bedtime_level : undefined))
    .filter((v): v is number => v !== undefined);

  const bedtimeStats = bedtimeLevels.length
    ? {
        mean: round1(mean(bedtimeLevels)!),
        median: round1(median(bedtimeLevels)!),
        min: Math.min(...bedtimeLevels),
        max: Math.max(...bedtimeLevels),
        most_common: mostCommon(bedtimeLevels),
        count: bedtimeLevels.length,
      }
    : undefined;

  const wakeStats = wakeLevels.length
    ? {
        mean: round1(mean(wakeLevels)!),
        median: round1(median(wakeLevels)!),
        min: Math.min(...wakeLevels),
        max: Math.max(...wakeLevels),
        most_common: mostCommon(wakeLevels),
        count: wakeLevels.length,
      }
    : undefined;

  // Weekend (Sat-Sun) vs weekday (Mon-Fri) bedtime levels.
  const weekendBedtimes: number[] = [];
  const weekdayBedtimes: number[] = [];
  for (const s of sorted) {
    if (s.bedtime_level === undefined) continue;
    (isWeekendDay(s.day) ? weekendBedtimes : weekdayBedtimes).push(s.bedtime_level);
  }
  const weekend_vs_weekday =
    weekendBedtimes.length > 0 && weekdayBedtimes.length > 0
      ? {
          weekend_mean: round1(mean(weekendBedtimes)!),
          weekday_mean: round1(mean(weekdayBedtimes)!),
          delta: round1(mean(weekendBedtimes)! - mean(weekdayBedtimes)!),
          weekend_nights: weekendBedtimes.length,
          weekday_nights: weekdayBedtimes.length,
        }
      : undefined;

  // Coldest / warmest night by bedtime level.
  let coldest_night: { day: string; bedtime_level: number } | undefined;
  let warmest_night: { day: string; bedtime_level: number } | undefined;
  for (const s of sorted) {
    if (s.bedtime_level === undefined) continue;
    if (coldest_night === undefined || s.bedtime_level < coldest_night.bedtime_level) {
      coldest_night = { day: s.day, bedtime_level: s.bedtime_level };
    }
    if (warmest_night === undefined || s.bedtime_level > warmest_night.bedtime_level) {
      warmest_night = { day: s.day, bedtime_level: s.bedtime_level };
    }
  }

  // Consistency score over bedtime levels (the most actionable setting).
  const consistency_score = bedtimeLevels.length >= 2 ? consistencyScore(bedtimeLevels) : undefined;

  // Correlation between bedtime level and sleep score (3+ paired nights, |r|>=0.5).
  const paired = sorted.filter(
    (s): s is NightlySnapshot & { bedtime_level: number; score: number } =>
      s.bedtime_level !== undefined && s.score !== undefined,
  );
  let correlation_note: string | undefined;
  if (paired.length >= 3) {
    const r = pearson(paired.map((s) => s.bedtime_level), paired.map((s) => s.score));
    if (r !== undefined && Math.abs(r) >= 0.5) {
      const direction = r > 0 ? "warmer bedtime → higher sleep score" : "colder bedtime → higher sleep score";
      correlation_note = `Bedtime level vs sleep score: r=${round1(r)} across ${paired.length} nights (${direction}). Indicative only; ${paired.length} nights is a small sample.`;
    } else if (r !== undefined) {
      correlation_note = `Bedtime level vs sleep score: weak correlation (r=${round1(r)}, ${paired.length} nights). No reliable signal.`;
    }
  }

  // Natural-language observations — only those supported by data.
  const observations: string[] = [];
  if (weekend_vs_weekday && Math.abs(weekend_vs_weekday.delta) >= 5) {
    const direction = weekend_vs_weekday.delta > 0 ? "warmer" : "colder";
    observations.push(
      `Bedtime settings ${Math.abs(weekend_vs_weekday.delta)} levels ${direction} on weekends (${weekend_vs_weekday.weekend_nights} nights) than weekdays (${weekend_vs_weekday.weekday_nights} nights).`,
    );
  }
  if (bedtimeLevels.length >= 4) {
    const recent = bedtimeLevels.slice(-4);
    const head = recent[0]!;
    const tail = recent[recent.length - 1]!;
    if (Math.abs(tail - head) >= 10) {
      const direction = tail < head ? "dropped" : "rose";
      observations.push(`Bedtime level ${direction} from ${head} to ${tail} over the last ${recent.length} nights.`);
    }
  }
  if (consistency_score !== undefined && consistency_score <= 30) {
    observations.push(`Bedtime settings have been highly variable (consistency_score=${consistency_score}/100).`);
  }
  if (consistency_score !== undefined && consistency_score >= 90) {
    observations.push(`Bedtime settings have been remarkably consistent (consistency_score=${consistency_score}/100).`);
  }
  // Disabled-warmup observation: count nights where wake_level was off (0) or very close to bedtime.
  const disabledWarmups = sorted.filter(
    (s) =>
      s.bedtime_level !== undefined &&
      s.wake_level !== undefined &&
      Math.abs(s.wake_level - s.bedtime_level) <= 2,
  );
  if (disabledWarmups.length >= 3 && sorted.length >= 5) {
    observations.push(
      `Morning warm-up effectively disabled on ${disabledWarmups.length} of last ${sorted.length} nights (wake level within ±2 of bedtime level).`,
    );
  }

  const notes: string[] = [];
  if (sorted.length === 0) notes.push("Eight Sleep returned no nightly records for this window.");
  if (bedtimeStats === undefined && sorted.length > 0) {
    notes.push(
      "Eight Sleep trends payload did not include historical bedtime temperature levels. Aggregate fields reflect only the current smart-temperature schedule.",
    );
  }

  return {
    kind: "temperature_trend" as const,
    generated_at: new Date().toISOString(),
    window: { ...window, days_returned: sorted.length },
    current: current ?? {},
    nights_analyzed: sorted.length,
    nightly: sorted,
    mean_bedtime: bedtimeLevels.length ? round1(mean(bedtimeLevels)!) : undefined,
    mean_wake: wakeLevels.length ? round1(mean(wakeLevels)!) : undefined,
    mean_delta: deltas.length ? round1(mean(deltas)!) : undefined,
    bedtime_stats: bedtimeStats,
    wake_stats: wakeStats,
    weekend_vs_weekday,
    coldest_night,
    warmest_night,
    consistency_score,
    observations,
    correlation_note,
    notes,
  };
}

export async function buildTemperatureTrend(client: EightSleepClient, options: TemperatureTrendOptions) {
  const token = await client.ensureLogin();
  if (!token.user_id) {
    throw new Error("Eight Sleep token is missing userId. Run `eight-sleep-mcp-server login` and retry.");
  }
  const userId = token.user_id;

  // 1. Current smart-temperature schedule (the same endpoint eight_sleep_get_temperature uses).
  const currentTemp = (await client.get(`/v1/users/${userId}/temperature`, { base: "app" })) as CurrentTemperaturePayload;

  // 2. Last N nights of trends (reuses fetchTrendDays — no third HTTP call beyond what get_trends already does).
  const trend = await fetchTrendDays(client, { days: options.days, timezone: options.timezone });
  const sortedDays = [...trend.days].sort((a, b) => a.day.localeCompare(b.day));

  // The Eight Sleep trends payload is loosely-typed; per-night temperature fields may
  // appear under different keys depending on the model version. We probe a couple of
  // common keys and surface whatever we find.
  const snapshots: NightlySnapshot[] = sortedDays.map((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const bedtimeLevel =
      num(raw["temperatureBedTimeLevel"]) ??
      num((raw["smartTemperatures"] as SmartTemperatureSchedule | undefined)?.bedTime);
    const wakeLevel =
      num(raw["temperatureFinalLevel"]) ??
      num((raw["smartTemperatures"] as SmartTemperatureSchedule | undefined)?.final);
    return {
      day: d.day,
      score: num(d.score),
      bedtime_level: bedtimeLevel,
      wake_level: wakeLevel,
    };
  });

  const current: CurrentTemperatureSummary = {
    bedtime_level: num(currentTemp.smartTemperatures?.bedTime),
    initial_level: num(currentTemp.smartTemperatures?.initial),
    final_level: num(currentTemp.smartTemperatures?.final),
    now_level: num(currentTemp.currentLevel),
    is_on: typeof currentTemp.isOn === "boolean" ? currentTemp.isOn : undefined,
    side: typeof currentTemp.side === "string" ? currentTemp.side : undefined,
  };

  return analyzeTemperatureTrend(snapshots, current, {
    from: trend.from,
    to: trend.to,
    days_requested: options.days,
    timezone: options.timezone,
  });
}

export function formatTemperatureTrendMarkdown(payload: ReturnType<typeof analyzeTemperatureTrend>): string {
  const lines = ["# Eight Sleep Temperature Trend", ""];
  lines.push(`- **window**: ${payload.window.from} → ${payload.window.to} (${payload.window.days_returned}/${payload.window.days_requested} days)`);
  lines.push(`- **nights_analyzed**: ${payload.nights_analyzed}`);
  if (payload.current.bedtime_level !== undefined) lines.push(`- **current bedtime level**: ${payload.current.bedtime_level}`);
  if (payload.current.final_level !== undefined) lines.push(`- **current wake level**: ${payload.current.final_level}`);
  if (payload.mean_bedtime !== undefined) lines.push(`- **mean_bedtime**: ${payload.mean_bedtime}`);
  if (payload.mean_wake !== undefined) lines.push(`- **mean_wake**: ${payload.mean_wake}`);
  if (payload.mean_delta !== undefined) lines.push(`- **mean_delta (wake - bedtime)**: ${payload.mean_delta}`);
  if (payload.consistency_score !== undefined) lines.push(`- **consistency_score**: ${payload.consistency_score}/100`);
  if (payload.coldest_night) lines.push(`- **coldest_night**: ${payload.coldest_night.day} @ ${payload.coldest_night.bedtime_level}`);
  if (payload.warmest_night) lines.push(`- **warmest_night**: ${payload.warmest_night.day} @ ${payload.warmest_night.bedtime_level}`);
  if (payload.weekend_vs_weekday) {
    lines.push(
      "",
      "## Weekend vs weekday",
      `- weekend mean: ${payload.weekend_vs_weekday.weekend_mean} (${payload.weekend_vs_weekday.weekend_nights} nights)`,
      `- weekday mean: ${payload.weekend_vs_weekday.weekday_mean} (${payload.weekend_vs_weekday.weekday_nights} nights)`,
      `- delta: ${payload.weekend_vs_weekday.delta}`,
    );
  }
  if (payload.bedtime_stats) {
    lines.push("", "## Bedtime levels (last N nights)");
    for (const [k, v] of Object.entries(payload.bedtime_stats)) lines.push(`- **${k}**: ${v}`);
  }
  if (payload.wake_stats) {
    lines.push("", "## Wake levels (last N nights)");
    for (const [k, v] of Object.entries(payload.wake_stats)) lines.push(`- **${k}**: ${v}`);
  }
  if (payload.observations.length > 0) {
    lines.push("", "## Observations");
    for (const obs of payload.observations) lines.push(`- ${obs}`);
  }
  if (payload.correlation_note) lines.push("", payload.correlation_note);
  if (payload.notes.length > 0) {
    lines.push("", "## Notes");
    for (const note of payload.notes) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}
