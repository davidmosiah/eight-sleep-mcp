# Changelog

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
