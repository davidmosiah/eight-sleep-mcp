<!-- delx-wellness header v2 -->
<h1 align="center">Eight Sleep MCP</h1>

<h3 align="center">
  Give your AI agent your Eight Sleep sleep trends, temperature program and alarms &mdash; and optionally let it tune the pod overnight.<br>
  Local-first MCP server &mdash; <strong>credentials never leave your machine</strong>.
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/eight-sleep-mcp-unofficial"><img src="https://img.shields.io/npm/v/eight-sleep-mcp-unofficial?style=for-the-badge&labelColor=0F172A&color=10B981&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/eight-sleep-mcp-unofficial"><img src="https://img.shields.io/npm/dm/eight-sleep-mcp-unofficial?style=for-the-badge&labelColor=0F172A&color=0EA5A3&logo=npm&logoColor=white" alt="npm downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-22C55E?style=for-the-badge&labelColor=0F172A" alt="License MIT" /></a>
  <a href="https://wellness.delx.ai/connectors/eight-sleep"><img src="https://img.shields.io/badge/SITE-wellness.delx.ai-0EA5A3?style=for-the-badge&labelColor=0F172A" alt="Site" /></a>
</p>

<p align="center">
  <a href="https://github.com/davidmosiah/eight-sleep-mcp/stargazers"><img src="https://img.shields.io/github/stars/davidmosiah/eight-sleep-mcp?style=for-the-badge&labelColor=0F172A&color=FBBF24&logo=github" alt="GitHub stars" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/BUILT_FOR-MCP-7C3AED?style=for-the-badge&labelColor=0F172A" alt="Built for MCP" /></a>
  <a href="https://github.com/davidmosiah/delx-wellness-hermes"><img src="https://img.shields.io/badge/HERMES-one--command_setup-10B981?style=for-the-badge&labelColor=0F172A" alt="Hermes one-command setup" /></a>
  <a href="https://www.eightsleep.com/"><img src="https://img.shields.io/badge/EIGHT_SLEEP-1B1B1B?style=for-the-badge&labelColor=0F172A&logoColor=white" alt="Eight Sleep" /></a>
</p>

> ⚡ **One-command install** with [Delx Wellness for Hermes](https://github.com/davidmosiah/delx-wellness-hermes):
> `npx -y delx-wellness-hermes setup` &mdash; preconfigures this connector alongside the rest of the wellness catalog.
>
> Or wire it standalone into Claude Desktop / Cursor / OpenClaw / any MCP client &mdash; see the install section below.

---

<!-- /delx-wellness header v2 -->

**Local-first MCP server that connects AI agents to your Eight Sleep pod &mdash; sleep sessions, temperature program, alarms, adjustable base &mdash; with an explicit mutation gate for write actions.**

> **Unofficial project.** Not affiliated with, endorsed by, or supported by Eight Sleep, Inc. Eight Sleep is a trademark of its respective owner. Use this only with your own Eight Sleep account.

Eight Sleep does not publish a stable public API. This package talks to the same private endpoints (`auth-api.8slp.net`, `client-api.8slp.net`, `app-api.8slp.net`) the mobile app uses, following the path well documented by upstream community projects ([`lukas-clarke/eight_sleep`](https://github.com/lukas-clarke/eight_sleep), [`mezz64/pyEight`](https://github.com/mezz64/pyEight), [`steipete/eightctl`](https://github.com/steipete/eightctl)).

Part of [Delx Wellness](https://github.com/davidmosiah/delx-wellness) &mdash; a registry of local-first wellness MCP connectors.

> If this connector helps your agent workflow, please star the repo. Stars make the project easier for other AI builders to discover and help Delx keep shipping local-first wellness infrastructure.

## Why this exists

Eight Sleep ships great sleep telemetry &mdash; nightly score, presence intervals, tnt, smart-temperature schedule &mdash; but it lives inside a closed iOS/Android app with no public API. Bringing it into your agent today means reverse-engineering OAuth, juggling token refresh, normalizing endpoint shapes, and handling timezone quirks.

This package does all of that locally, exposes Eight Sleep through the Model Context Protocol, and lets any MCP-compatible agent read your sleep context (and write pod commands, if you opt in) with one config snippet. Credentials and tokens stay on your machine.

## Setup in 60 seconds

```bash
npx -y eight-sleep-mcp-unofficial setup   # interactive: email + password
npx -y eight-sleep-mcp-unofficial login   # persists the auth token
npx -y eight-sleep-mcp-unofficial doctor  # verifies you're ready
```

Then add this to your MCP client config:

```json
{
  "mcpServers": {
    "eight_sleep": {
      "command": "npx",
      "args": ["-y", "eight-sleep-mcp-unofficial"]
    }
  }
}
```

For Claude Desktop, run `setup --client claude` and the snippet is written for you.

## Try it with your agent

Three things to ask first:

```text
Use eight_sleep_connection_status to check setup, then run eight_sleep_get_me.
Tell me what device you find.
```

```text
Call eight_sleep_get_trends for the last 7 days, response_format=json.
What's my best night and worst night, and why?
```

```text
Call eight_sleep_get_temperature. Summarize the current smart schedule
(bedtime, initial sleep, final sleep) and tell me if I should tune it.
```

## Data availability

This package talks to the Eight Sleep mobile-app API. It does **not** access continuous biometric sensor streams or BLE.

| Data | Tool | Source |
|------|------|--------|
| User & device | `eight_sleep_get_me`, `eight_sleep_get_user`, `eight_sleep_get_current_device` | `client-api.8slp.net /users/...` |
| Temperature program | `eight_sleep_get_temperature` | `app-api.8slp.net /v1/users/{id}/temperature` |
| Sleep trends | `eight_sleep_get_trends` | `client-api.8slp.net /users/{id}/trends` |
| Alarms | `eight_sleep_get_alarms` | `app-api.8slp.net /v2/users/{id}/alarms` |
| Adjustable base | `eight_sleep_get_base` | `app-api.8slp.net /v1/users/{id}/base` |

## Mutation tools (write gate)

Off by default. To enable, re-run setup with `--allow-mutations` or set `EIGHT_SLEEP_ALLOW_MUTATIONS=true`.

| Action | Tool |
|------|------|
| Set heating level | `eight_sleep_set_temperature` |
| Turn side on/off | `eight_sleep_set_side` |
| Toggle away mode | `eight_sleep_set_away_mode` |
| Snooze alarm | `eight_sleep_snooze_alarm` |
| Dismiss alarm | `eight_sleep_dismiss_alarm` |

When the gate is off, mutation tools return an explicit `mutations disabled` error so agents can detect it and ask the user to opt in.

## Privacy

- Credentials stored in `~/.eight-sleep-mcp/config.json` with `chmod 600`.
- Auth tokens stored in `~/.eight-sleep-mcp/tokens.json` with `chmod 600`.
- Sensitive fields (email, device serial, shipping address, payment last-four) are redacted from tool responses by default.
- `EIGHT_SLEEP_PRIVACY_MODE`:
  - `summary` — minimal fields only.
  - `structured` (default) — keeps useful fields but redacts identifiers.
  - `raw` — full upstream payload (debugging only).

Call `eight_sleep_privacy_audit` at any time to inspect the current posture without exposing secrets.

## Environment variables

| Var | Purpose |
|-----|---------|
| `EIGHT_SLEEP_EMAIL` | Account email. |
| `EIGHT_SLEEP_PASSWORD` | Account password. |
| `EIGHT_SLEEP_ALLOW_MUTATIONS` | `true` to enable write tools. |
| `EIGHT_SLEEP_PRIVACY_MODE` | `summary` / `structured` / `raw`. |
| `EIGHT_SLEEP_CACHE` | `sqlite` to enable on-disk response cache. |
| `EIGHT_SLEEP_TOKEN_PATH` | Override token storage path. |
| `EIGHT_SLEEP_CLIENT_ID` / `EIGHT_SLEEP_CLIENT_SECRET` | Override Android-app credential defaults (advanced). |

## Stability

Eight Sleep changes mobile-app endpoints without notice. This connector tracks upstream community projects (`lukas-clarke/eight_sleep`, `steipete/eightctl`, `mezz64/pyEight`) for breakage signals. If a tool starts returning 4xx unexpectedly, check those repos and the project [issues](https://github.com/davidmosiah/eight-sleep-mcp/issues) for the latest known-good shape.

## Credits

- [`lukas-clarke/eight_sleep`](https://github.com/lukas-clarke/eight_sleep) — Home Assistant integration, most current reference for V2 endpoints.
- [`mezz64/pyEight`](https://github.com/mezz64/pyEight) — original Python library; auth + endpoint discovery.
- [`steipete/eightctl`](https://github.com/steipete/eightctl) — CLI variant with extracted client credentials.
- [`LiamSnow/opensleep`](https://github.com/LiamSnow/opensleep) — full open-source firmware (deeper than this MCP goes).

## License

MIT &mdash; see [LICENSE](LICENSE).
