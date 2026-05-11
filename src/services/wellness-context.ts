import type { EightSleepClient } from "./eight-sleep-client.js";

export interface WellnessContextOptions {
  days: number;
  timezone: string;
  soreness: string[];
  injury_flags: string[];
  notes?: string | undefined;
}

interface DayRecord {
  day: string;
  score?: number;
  sleepDuration?: number;
  presenceDuration?: number;
  presenceStart?: string;
  presenceEnd?: string;
  tnt?: number;
  lightDuration?: number;
  deepDuration?: number;
  remDuration?: number;
  sleepFitnessScore?: { total?: number };
  sleepQualityScore?: { total?: number };
  sleepRoutineScore?: { total?: number };
}

interface TrendsPayload {
  days?: DayRecord[];
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isoDateNDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface FetchTrendOptions {
  days: number;
  timezone: string;
}

export async function fetchTrendDays(client: EightSleepClient, options: FetchTrendOptions): Promise<{ days: DayRecord[]; from: string; to: string }> {
  const token = await client.ensureLogin();
  if (!token.user_id) {
    throw new Error("Eight Sleep token is missing userId. Run `eight-sleep-mcp-server login` and retry.");
  }
  const to = todayIsoDate();
  const from = isoDateNDaysAgo(options.days);
  const payload = (await client.get(`/users/${token.user_id}/trends`, {
    base: "client",
    params: {
      "tz": options.timezone,
      "from": from,
      "to": to,
      "include-main": true,
      "include-all-sessions": true,
      "model-version": "v2"
    }
  })) as TrendsPayload;
  return { days: payload.days ?? [], from, to };
}

export async function buildWellnessContext(client: EightSleepClient, options: WellnessContextOptions) {
  const { days, from, to } = await fetchTrendDays(client, options);
  const sortedDays = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sortedDays[sortedDays.length - 1];

  const sleepScore = num(latest?.score);
  const fitnessScore = num(latest?.sleepFitnessScore?.total);
  // Eight Sleep's nightly score is 0-100; surface it as both sleep_score and recovery_score
  // since the connector does not measure HRV directly.
  const recoveryScore = fitnessScore ?? sleepScore;

  const tnts = sortedDays.map((d) => num(d.tnt)).filter((n): n is number => n !== undefined);
  const avgTnt = average(tnts);

  const notes: string[] = [];
  if (latest?.presenceStart && latest?.presenceEnd) {
    notes.push(`Last presence interval: ${latest.presenceStart} → ${latest.presenceEnd}.`);
  }
  if (avgTnt !== undefined) {
    notes.push(`Average tosses-and-turns over ${sortedDays.length} nights: ${avgTnt.toFixed(1)}.`);
  }
  if (options.notes) notes.push(options.notes);

  const dataQuality = {
    days_returned: sortedDays.length,
    days_requested: options.days,
    confidence: sortedDays.length === 0 ? "none" : sortedDays.length < Math.min(3, options.days) ? "low" : "structured",
    has_latest_session: Boolean(latest)
  };

  return {
    source: "eight-sleep" as const,
    context_contract_version: "delx-wellness-context/v1" as const,
    context_type: "wellness_context" as const,
    generated_at: new Date().toISOString(),
    window: { from, to, days_returned: sortedDays.length, days_requested: options.days, timezone: options.timezone },
    recovery_score: recoveryScore !== undefined ? clamp(recoveryScore, 0, 100) : undefined,
    sleep_score: sleepScore !== undefined ? clamp(sleepScore, 0, 100) : undefined,
    strain_score: undefined,
    recent_training_load: "unknown" as const,
    soreness: options.soreness,
    injury_flags: options.injury_flags,
    notes,
    data_quality: dataQuality,
    recommended_handoff: {
      tool: "nourish_daily_coach",
      reason: "Use the sleep score to inform daily intake recommendations; Eight Sleep does not provide training load on its own."
    },
    telegram_summary: [
      "Eight Sleep wellness context",
      sleepScore !== undefined ? `Sleep: ${sleepScore}` : undefined,
      avgTnt !== undefined ? `Avg tnt: ${avgTnt.toFixed(1)}` : undefined
    ].filter(Boolean).join(" | ")
  };
}

export function formatWellnessContextMarkdown(context: ReturnType<typeof buildWellnessContext> extends Promise<infer T> ? T : never): string {
  const lines = ["# Eight Sleep Wellness Context", ""];
  for (const key of ["context_contract_version", "context_type", "sleep_score", "recovery_score", "recent_training_load"] as const) {
    if (context[key] !== undefined) lines.push(`- **${key}**: ${String(context[key])}`);
  }
  if (context.window) {
    lines.push(`- **window**: ${context.window.from} → ${context.window.to} (${context.window.days_returned}/${context.window.days_requested} days)`);
  }
  if (context.recommended_handoff) {
    lines.push("", "## Recommended Handoff");
    lines.push(`- **tool**: ${context.recommended_handoff.tool}`);
    lines.push(`- **reason**: ${context.recommended_handoff.reason}`);
  }
  if (context.notes.length) {
    lines.push("", "## Notes");
    for (const note of context.notes) lines.push(`- ${note}`);
  }
  return lines.join("\n");
}

export interface NightlySummaryOptions {
  days: number;
  timezone: string;
}

export async function buildNightlySummary(client: EightSleepClient, options: NightlySummaryOptions) {
  const { days, from, to } = await fetchTrendDays(client, options);
  const sortedDays = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const scoredDays = sortedDays.filter((d) => num(d.score) !== undefined);
  const scores = scoredDays.map((d) => d.score!).filter((s): s is number => Number.isFinite(s));

  const latest = sortedDays[sortedDays.length - 1];
  const best = scoredDays.length ? scoredDays.reduce((acc, d) => ((d.score ?? -Infinity) > (acc.score ?? -Infinity) ? d : acc), scoredDays[0]) : undefined;
  const worst = scoredDays.length ? scoredDays.reduce((acc, d) => ((d.score ?? Infinity) < (acc.score ?? Infinity) ? d : acc), scoredDays[0]) : undefined;
  const meanScore = average(scores);

  return {
    kind: "nightly_summary" as const,
    generated_at: new Date().toISOString(),
    window: { from, to, days_returned: sortedDays.length, days_requested: options.days, timezone: options.timezone },
    latest: latest ? summarizeDay(latest) : undefined,
    best: best ? summarizeDay(best) : undefined,
    worst: worst ? summarizeDay(worst) : undefined,
    mean_score: meanScore !== undefined ? Math.round(meanScore * 10) / 10 : undefined,
    nights_under_70: scoredDays.filter((d) => (d.score ?? 0) < 70).length,
    nights_over_85: scoredDays.filter((d) => (d.score ?? 0) > 85).length,
    notes: [
      "Scores are Eight Sleep's nightly composite (0-100). They are not clinical metrics.",
      "Stage durations are in seconds when present; tnt is tosses-and-turns count.",
      "When days are missing it is usually because Eight Sleep is still processing a recent night or the pod was off."
    ]
  };
}

function summarizeDay(d: DayRecord): Record<string, unknown> {
  return {
    day: d.day,
    score: num(d.score),
    sleep_duration_s: num(d.sleepDuration),
    presence_duration_s: num(d.presenceDuration),
    presence_start: d.presenceStart,
    presence_end: d.presenceEnd,
    tnt: num(d.tnt),
    light_s: num(d.lightDuration),
    deep_s: num(d.deepDuration),
    rem_s: num(d.remDuration),
    fitness_score: num(d.sleepFitnessScore?.total),
    quality_score: num(d.sleepQualityScore?.total),
    routine_score: num(d.sleepRoutineScore?.total)
  };
}

export function formatNightlySummaryMarkdown(summary: ReturnType<typeof buildNightlySummary> extends Promise<infer T> ? T : never): string {
  const lines = ["# Eight Sleep Nightly Summary", ""];
  lines.push(`- **window**: ${summary.window.from} → ${summary.window.to} (${summary.window.days_returned}/${summary.window.days_requested} days)`);
  if (summary.mean_score !== undefined) lines.push(`- **mean_score**: ${summary.mean_score}`);
  lines.push(`- **nights_under_70**: ${summary.nights_under_70}`);
  lines.push(`- **nights_over_85**: ${summary.nights_over_85}`);
  if (summary.latest) {
    lines.push("", "## Latest");
    for (const [k, v] of Object.entries(summary.latest)) {
      if (v !== undefined && v !== null) lines.push(`- **${k}**: ${String(v)}`);
    }
  }
  if (summary.best && summary.best.day !== summary.worst?.day) {
    lines.push("", "## Best");
    for (const [k, v] of Object.entries(summary.best)) {
      if (v !== undefined && v !== null) lines.push(`- **${k}**: ${String(v)}`);
    }
    lines.push("", "## Worst");
    for (const [k, v] of Object.entries(summary.worst ?? {})) {
      if (v !== undefined && v !== null) lines.push(`- **${k}**: ${String(v)}`);
    }
  }
  return lines.join("\n");
}
