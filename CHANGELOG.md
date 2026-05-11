# Changelog

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
