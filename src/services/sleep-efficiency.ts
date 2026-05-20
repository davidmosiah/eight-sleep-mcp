/**
 * Eight Sleep sleep-efficiency analyzer (v0.2.2).
 *
 * Computes per-night sleep efficiency = (time_asleep / time_in_bed) * 100 from
 * the existing /v1/users/{id}/trends payload (the same data the
 * eight_sleep_nightly_summary and eight_sleep_temperature_trend tools already
 * consume). No extra HTTP calls.
 *
 * Eight Sleep's trends payload returns:
 *   - presenceDuration (seconds) — time on the pod (≈ time in bed)
 *   - sleepDuration (seconds)    — time actually asleep per the bed's scoring
 *
 * Efficiency bands (industry standard):
 *   excellent ≥ 85%
 *   good      75-84%
 *   fair      65-74%
 *   poor      < 65%
 *
 * When the upstream payload does not include presenceDuration or sleepDuration
 * for any night in the window, `nights_analyzed` is 0 and a `note` explains it.
 */
import type { EightSleepClient } from "./eight-sleep-client.js";
import { fetchTrendDays } from "./wellness-context.js";

export type EfficiencyBand = "excellent" | "good" | "fair" | "poor";

export interface NightEfficiency {
  /** ISO YYYY-MM-DD. */
  day: string;
  /** Total minutes on the pod (≈ time in bed). undefined when upstream omits presenceDuration. */
  time_in_bed_minutes?: number;
  /** Total minutes asleep per the pod's scoring. undefined when upstream omits sleepDuration. */
  time_asleep_minutes?: number;
  /** Total awakenings if surfaced by upstream; undefined when not exposed. */
  awakenings_count?: number;
  /** Rounded efficiency percentage. undefined when either of the source fields is missing. */
  efficiency_pct?: number;
  /** Band label corresponding to efficiency_pct. undefined when efficiency_pct undefined. */
  efficiency_band?: EfficiencyBand;
  /** Eight Sleep's 0-100 nightly sleep score (passed through for reference). */
  score?: number;
}

export interface EfficiencyOptions {
  nights: number;
  timezone: string;
}

export interface EfficiencyResult extends Record<string, unknown> {
  kind: "sleep_efficiency";
  generated_at: string;
  window: { from: string; to: string; days_requested: number; days_returned: number; timezone: string };
  nights_analyzed: number;
  mean_efficiency_pct?: number;
  median_efficiency_pct?: number;
  min_efficiency_night?: NightEfficiency;
  max_efficiency_night?: NightEfficiency;
  nights_by_band: { excellent: number; good: number; fair: number; poor: number };
  per_night: NightEfficiency[];
  observations: string[];
  notes: string[];
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round0(n: number): number {
  return Math.round(n);
}

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid];
}

export function bandFor(pct: number): EfficiencyBand {
  if (pct >= 85) return "excellent";
  if (pct >= 75) return "good";
  if (pct >= 65) return "fair";
  return "poor";
}

/**
 * Pure analyzer. Takes an already-fetched day array and returns the efficiency
 * summary. No IO. Used by both buildSleepEfficiency() and the unit tests.
 *
 * Each input day record may carry presenceDuration / sleepDuration (seconds)
 * and optionally tnt (tosses & turns — surfaced as awakenings_count when
 * present; the Eight Sleep API does not expose a strict awakenings field).
 */
export function analyzeSleepEfficiency(
  days: Array<Record<string, unknown>>,
  window: { from: string; to: string; days_requested: number; timezone: string },
): EfficiencyResult {
  const sorted = [...days].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const perNight: NightEfficiency[] = sorted.map((d) => {
    const presenceSec = num(d.presenceDuration);
    const sleepSec = num(d.sleepDuration);
    const score = num(d.score);
    const awakeningsRaw = num(d.tnt); // approximate — Eight Sleep does not surface a true awakenings field
    const tib = presenceSec !== undefined ? round0(presenceSec / 60) : undefined;
    const asleep = sleepSec !== undefined ? round0(sleepSec / 60) : undefined;
    const eff =
      tib !== undefined && asleep !== undefined && tib > 0
        ? Math.round((asleep / tib) * 100)
        : undefined;
    return {
      day: String(d.day),
      time_in_bed_minutes: tib,
      time_asleep_minutes: asleep,
      awakenings_count: awakeningsRaw,
      efficiency_pct: eff,
      efficiency_band: eff !== undefined ? bandFor(eff) : undefined,
      score,
    };
  });

  const efficiencies = perNight
    .map((n) => n.efficiency_pct)
    .filter((v): v is number => v !== undefined);

  const nightsBy = { excellent: 0, good: 0, fair: 0, poor: 0 } as Record<EfficiencyBand, number>;
  for (const n of perNight) {
    if (n.efficiency_band) nightsBy[n.efficiency_band]++;
  }

  let minNight: NightEfficiency | undefined;
  let maxNight: NightEfficiency | undefined;
  for (const n of perNight) {
    if (n.efficiency_pct === undefined) continue;
    if (minNight === undefined || n.efficiency_pct < (minNight.efficiency_pct ?? Infinity)) minNight = n;
    if (maxNight === undefined || n.efficiency_pct > (maxNight.efficiency_pct ?? -Infinity)) maxNight = n;
  }

  // Observations — only when the data supports them.
  const observations: string[] = [];
  if (efficiencies.length >= 4) {
    // Mid-week drop: compare first half to second half
    const split = Math.floor(efficiencies.length / 2);
    const firstHalf = efficiencies.slice(0, split);
    const secondHalf = efficiencies.slice(split);
    const firstMean = mean(firstHalf)!;
    const secondMean = mean(secondHalf)!;
    if (firstMean - secondMean >= 10) {
      observations.push(
        `Efficiency dropped from ${round0(firstMean)}% to ${round0(secondMean)}% mid-week — investigate.`,
      );
    } else if (secondMean - firstMean >= 10) {
      observations.push(
        `Efficiency rose from ${round0(firstMean)}% to ${round0(secondMean)}% later in the window — momentum building.`,
      );
    }
  }
  // All-band observation when every night sits in the same tier
  if (efficiencies.length >= 5 && nightsBy.excellent + nightsBy.good + nightsBy.fair + nightsBy.poor === efficiencies.length) {
    const allBand = (Object.entries(nightsBy) as [EfficiencyBand, number][]).find(
      ([, count]) => count === efficiencies.length,
    );
    if (allBand) {
      observations.push(`All ${efficiencies.length} nights in '${allBand[0]}' band — solid baseline.`);
    }
  }
  // Big single-night dip: any night > 15 points below the mean
  if (efficiencies.length >= 3) {
    const m = mean(efficiencies)!;
    const dip = perNight.find((n) => n.efficiency_pct !== undefined && m - n.efficiency_pct >= 15);
    if (dip) {
      observations.push(
        `${dip.day} was ${round0(m - (dip.efficiency_pct ?? 0))} points below the window mean (${dip.efficiency_pct}% vs ${round0(m)}%).`,
      );
    }
  }

  const notes: string[] = [];
  if (sorted.length === 0) {
    notes.push("Eight Sleep returned no nightly records for this window.");
  } else if (efficiencies.length === 0) {
    notes.push(
      "Eight Sleep trends payload did not expose presenceDuration / sleepDuration for any night in this window. Efficiency cannot be computed — try a different window or check pod connectivity.",
    );
  } else if (efficiencies.length < sorted.length) {
    notes.push(
      `${sorted.length - efficiencies.length} of ${sorted.length} nights had no presenceDuration or sleepDuration — those nights are listed but excluded from aggregates.`,
    );
  }
  if (perNight.every((n) => n.awakenings_count === undefined) && sorted.length > 0) {
    notes.push(
      "awakenings_count was not exposed by the Eight Sleep trends payload — when present, it is approximated from `tnt` (tosses-and-turns) and is NOT a strict awakenings count.",
    );
  }

  return {
    kind: "sleep_efficiency",
    generated_at: new Date().toISOString(),
    window: {
      from: window.from,
      to: window.to,
      days_requested: window.days_requested,
      days_returned: sorted.length,
      timezone: window.timezone,
    },
    nights_analyzed: efficiencies.length,
    mean_efficiency_pct: efficiencies.length ? round0(mean(efficiencies)!) : undefined,
    median_efficiency_pct: efficiencies.length ? round0(median(efficiencies)!) : undefined,
    min_efficiency_night: minNight,
    max_efficiency_night: maxNight,
    nights_by_band: nightsBy,
    per_night: perNight,
    observations,
    notes,
  };
}

export async function buildSleepEfficiency(
  client: EightSleepClient,
  options: EfficiencyOptions,
): Promise<EfficiencyResult> {
  const { days, from, to } = await fetchTrendDays(client, {
    days: options.nights,
    timezone: options.timezone,
  });
  return analyzeSleepEfficiency(days as unknown as Array<Record<string, unknown>>, {
    from,
    to,
    days_requested: options.nights,
    timezone: options.timezone,
  });
}

export function formatSleepEfficiencyMarkdown(payload: EfficiencyResult): string {
  const lines = ["# Eight Sleep · Sleep Efficiency", ""];
  lines.push(
    `- **window**: ${payload.window.from} → ${payload.window.to} (${payload.window.days_returned}/${payload.window.days_requested} days)`,
  );
  lines.push(`- **nights_analyzed**: ${payload.nights_analyzed}`);
  if (payload.mean_efficiency_pct !== undefined) lines.push(`- **mean_efficiency_pct**: ${payload.mean_efficiency_pct}`);
  if (payload.median_efficiency_pct !== undefined) lines.push(`- **median_efficiency_pct**: ${payload.median_efficiency_pct}`);
  if (payload.min_efficiency_night) {
    lines.push(
      `- **min**: ${payload.min_efficiency_night.day} @ ${payload.min_efficiency_night.efficiency_pct}% (${payload.min_efficiency_night.efficiency_band})`,
    );
  }
  if (payload.max_efficiency_night) {
    lines.push(
      `- **max**: ${payload.max_efficiency_night.day} @ ${payload.max_efficiency_night.efficiency_pct}% (${payload.max_efficiency_night.efficiency_band})`,
    );
  }
  lines.push(
    "",
    "## Bands",
    `- excellent (≥85%): ${payload.nights_by_band.excellent}`,
    `- good (75-84%): ${payload.nights_by_band.good}`,
    `- fair (65-74%): ${payload.nights_by_band.fair}`,
    `- poor (<65%): ${payload.nights_by_band.poor}`,
  );
  if (payload.observations.length > 0) {
    lines.push("", "## Observations");
    for (const o of payload.observations) lines.push(`- ${o}`);
  }
  if (payload.notes.length > 0) {
    lines.push("", "## Notes");
    for (const n of payload.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}
