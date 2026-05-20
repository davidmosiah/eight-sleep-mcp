# Changelog

## 0.2.2 - 2026-05-20

### Added

- **`eight_sleep_efficiency` workflow MCP tool.** Per-night sleep efficiency from the existing `/v1/users/{id}/trends` payload — no extra API calls. For each of the last N nights (default 7, max 30) returns:
  - `time_in_bed_minutes` (from `presenceDuration`)
  - `time_asleep_minutes` (from `sleepDuration`)
  - `awakenings_count` (approximated from `tnt` when surfaced by upstream; otherwise undefined with an explanatory note)
  - `efficiency_pct = round((time_asleep / time_in_bed) * 100)`
  - `efficiency_band`: `"excellent"` (≥85%), `"good"` (75-84%), `"fair"` (65-74%), `"poor"` (<65%)
- Aggregates: `nights_analyzed`, `mean_efficiency_pct`, `median_efficiency_pct`, `min_efficiency_night`, `max_efficiency_night`, `nights_by_band` (excellent/good/fair/poor counts), `per_night` array.
- `observations[]` only when supported by the data: a mid-week drop (first-half mean - second-half mean ≥ 10), all-nights-same-band ("All N nights in 'good' band — solid baseline"), or a single-night dip ≥ 15 points below the window mean. Never invented.
- Graceful degradation: when the upstream trends payload omits `presenceDuration` / `sleepDuration` for every night, `nights_analyzed: 0` is returned with a `note` explaining the gap. When some nights are missing those fields, they appear in `per_night` (without efficiency) and are excluded from aggregates — a note explains the partial coverage.
- New `src/services/sleep-efficiency.ts` module exporting `analyzeSleepEfficiency()` (pure), `buildSleepEfficiency()` (IO + delegate), `formatSleepEfficiencyMarkdown()` (renderer), and the `bandFor()` helper.
- New `SleepEfficiencyInputSchema` in `src/schemas/common.ts` (`nights` 1-30, `timezone` IANA, `response_format`).
- New `scripts/test-sleep-efficiency.mjs` synthetic-data unit test wired into `npm test`. Covers: bandFor boundaries, empty payload, missing-fields graceful degradation, 7-night mixed window with deterministic efficiencies, all-band-same observation, single-night dip observation, partial-night mixed coverage, and tnt → awakenings_count passthrough.
- Tool count: 25 → 26. Added to STANDARD_TOOLS in agent-manifest and smoke expectedTools.

## 0.2.1 - 2026-05-19

### Added

- **`eight_sleep_temperature_trend` workflow MCP tool.** Aggregates the current smart-temperature schedule with the last N nights of trends data and returns:
  - `nights_analyzed`, `mean_bedtime`, `mean_wake`, `mean_delta` (wake - bedtime)
  - `bedtime_stats` and `wake_stats` (mean / median / min / max / most_common / count)
  - `weekend_vs_weekday` (weekend mean vs weekday mean + delta), computed by UTC day-of-week
  - `coldest_night` / `warmest_night` (by bedtime level), each `{ day, bedtime_level }`
  - `consistency_score` (0-100; 100 = identical bedtime settings every night, 0 = wildly variable)
  - `observations` — natural-language array; only populated when the data supports specific findings (e.g. "Bedtime settings 5 levels warmer on weekends than weekdays.", "Bedtime level dropped from 0 to -20 over the last 5 nights.", "Morning warm-up effectively disabled on 4 of last 5 nights."). Never invented.
  - `correlation_note` (bedtime vs sleep score, Pearson r) only when 3+ paired nights support |r| >= 0.5; otherwise omitted.
  Reuses `get_temperature` (current state) + `get_trends` (historical scores) internally — no extra API calls beyond what those tools already issue. When the trends payload does not expose per-night bedtime/wake levels (varies by firmware), aggregates degrade gracefully and `notes` explains the gap. Empty trend windows return `nights_analyzed: 0` with all aggregates undefined — no crash.
- New `src/services/temperature-trend.ts` module with three exported functions: `analyzeTemperatureTrend()` (pure, testable with synthetic data), `buildTemperatureTrend()` (does the IO + delegates), and `formatTemperatureTrendMarkdown()` (renderer). Helpers `consistencyScore()` and `isWeekendDay()` also exported.
- New `TemperatureTrendInputSchema` in `src/schemas/common.ts` (`days` 1-30, `timezone` IANA, `response_format`).
- New `scripts/test-temperature-trend.mjs` synthetic-data unit test wired into `npm test`. Covers: weekend detection, consistency scoring (identical / mild / wild), empty input (`nights_analyzed: 0`, no crash), scores-only payload (graceful degradation), full 7-night window (means / delta / coldest / warmest / weekend-vs-weekday observation), trending-colder pattern, and disabled-warmup detection.
- Tool count: 24 → 25. Added to STANDARD_TOOLS in agent-manifest and smoke expectedTools.

## 0.2.0 - 2026-05-11

### Added

- **Shared Delx Wellness profile support** — vendored canonical `profile-store.ts` (from `delx-wellness/lib/profile-store.ts` commit `197e219`) at `src/services/profile-store.ts`. Reads/writes `~/.delx-wellness/profile.json`, the same file every Delx Wellness MCP can read.
- `eight_sleep_profile_get` MCP tool — returns the shared profile, one-line summary, missing critical fields and storage path. Read-only.
- `eight_sleep_profile_update` MCP tool — persist a partial patch with `explicit_user_intent: true`. Rejects credential-shaped values (JWT, Bearer, sk_live_, sk-proj-, xoxb-, github_pat_) and secret-named keys.
- `eight_sleep_onboarding` MCP tool — returns the 11-question onboarding flow (en or pt-BR) plus current profile state and a cross-connector hint that eight-sleep reads preferences/goals to personalize bedtime plans.
- `eight-sleep-mcp-server onboarding [pt-BR]` CLI command — prints the flow JSON (and a TTY-friendly Markdown summary when stderr is a TTY).
- Tool count: 21 → 24. `recommended_first_calls` now leads with `eight_sleep_profile_get` so agents check shared profile state before any bedtime planning.

## 0.1.0

Initial public release.

- Email/password auth against `auth-api.8slp.net` (V1 password grant), with hardcoded Android-app client defaults overridable via env.
- Token storage with `chmod 600` and automatic re-login on expiry.
- Read tools: `eight_sleep_get_me`, `eight_sleep_get_user`, `eight_sleep_get_current_device`, `eight_sleep_get_temperature`, `eight_sleep_get_alarms`, `eight_sleep_get_base`, `eight_sleep_get_trends`.
- Workflow tools: `eight_sleep_nightly_summary` (best/worst night, mean, distribution) and `eight_sleep_wellness_context` (normalized `delx-wellness-context/v1` handoff so other Delx Wellness tools can read sleep context without knowing the Eight Sleep API).
- Mutation tools (gated by `EIGHT_SLEEP_ALLOW_MUTATIONS=true`): `eight_sleep_set_temperature`, `eight_sleep_set_side`, `eight_sleep_set_away_mode`, `eight_sleep_snooze_alarm`, `eight_sleep_dismiss_alarm`.
- Meta tools: `eight_sleep_data_inventory`, `eight_sleep_capabilities`, `eight_sleep_agent_manifest`, `eight_sleep_connection_status`, `eight_sleep_cache_status`, `eight_sleep_privacy_audit`, `eight_sleep_logout`.
- Privacy modes: `summary`, `structured`, `raw`.
- Optional SQLite read-through cache.
- MCP resources: `eight-sleep://inventory`, `eight-sleep://agent-manifest`, `eight-sleep://capabilities`.
- MCP prompts: `eight_sleep_nightly_review`, `eight_sleep_bedtime_temperature_plan`, `eight_sleep_morning_alarm_check`.
- CLI: `setup`, `login`, `doctor` (with `--client hermes|claude|cursor|windsurf|openclaw|generic`).
- Hermes config + skill installer.
- Friendly setup UX: interactive prompts explain the mutation gate before asking, error messages point at the exact command to fix the problem.
