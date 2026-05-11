# Agent Development Notes

## Scope

This repo is the unofficial Eight Sleep MCP connector. Read tools cover sleep trends, temperature program, alarms and the adjustable base. Mutation tools (temperature, side, away mode, alarm snooze/dismiss) are gated by `EIGHT_SLEEP_ALLOW_MUTATIONS=true`.

## Commands

- Install: `npm ci`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Fast smoke: `npm run smoke`
- Full gate: `npm test`

## Rules

- Never commit account credentials, access tokens, personal Eight Sleep data, or local config.
- Keep read-only behavior as the default. Mutations require an explicit user opt-in via setup or env.
- Preserve agent-ready surfaces: manifest, connection status, privacy audit, capabilities, inventory.
- Treat Eight Sleep endpoints as private and unstable. When upstream (`pyEight`, `eightctl`, `lukas-clarke/eight_sleep`) changes, follow.
- Keep sleep/temperature language clearly non-medical. No diagnosis or treatment recommendations.
- Redact email, device serial, addresses, and payment last-four by default.
