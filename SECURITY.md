# Security Policy

## Supported versions

This project is early-stage. Security fixes target the latest `main` branch until tagged releases stabilize.

## Reporting a vulnerability

Please report vulnerabilities privately by opening a GitHub security advisory or contacting the maintainer directly. Do not post account credentials, access tokens, token files, or personal health data in public issues.

## Sensitive data handled by this project

- Eight Sleep account email/password from `EIGHT_SLEEP_EMAIL` / `EIGHT_SLEEP_PASSWORD`.
- Optional override client credentials in `EIGHT_SLEEP_CLIENT_SECRET`.
- Local setup config at `~/.eight-sleep-mcp/config.json`.
- Access tokens at `~/.eight-sleep-mcp/tokens.json` (path overridable via `EIGHT_SLEEP_TOKEN_PATH`).
- Personal sleep, temperature program, alarms, and device data returned by the Eight Sleep mobile-app API.

## Local hardening expectations

- Store tokens on a trusted machine only.
- Prefer `eight-sleep-mcp-server setup` over putting `EIGHT_SLEEP_PASSWORD` directly in MCP client configs.
- The setup config is written with `0600` permissions and should stay outside synced/shared folders.
- Keep the token path outside synced/shared folders when possible.
- Restrict token file permissions to the local user. The server writes token files with `0600` permissions.
- Avoid passing `--password` on shared shells because it may appear in shell history or process listings; use interactive setup.
- Do not paste raw API responses into public issues if they include personal sleep/health data.
- Keep `EIGHT_SLEEP_ALLOW_MUTATIONS` off unless you intentionally want agents to change pod state.
- Prefer `response_format=markdown` for agent-facing summaries and `response_format=json` only when you need structured processing.

## Non-goals

This MCP server is not a medical device, clinical tool, or emergency monitoring system. It also does not provide BLE-level or firmware access.

## Upstream tracking

Because Eight Sleep does not publish a public API contract, endpoint and auth shape can change without notice. The project tracks upstream community implementations (`lukas-clarke/eight_sleep`, `mezz64/pyEight`, `steipete/eightctl`) for breakage signals. Treat any 4xx/5xx anomaly as a potential upstream change first, not necessarily a vulnerability.
