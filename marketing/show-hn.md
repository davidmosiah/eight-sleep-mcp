# Show HN

**Title**: Show HN: Eight Sleep MCP — local-first AI agent access to your smart mattress

**Body**:

```
Hi HN — I built a Model Context Protocol (MCP) server that lets AI
agents (Claude Desktop, Cursor, Hermes, OpenClaw, anything that speaks
MCP) read my Eight Sleep pod's nightly score, temperature program, and
alarms — and optionally tune the bed.

Repo: https://github.com/davidmosiah/eight-sleep-mcp
npm: npx -y eight-sleep-mcp-unofficial setup

Why it exists

Eight Sleep doesn't publish a public API. The mobile app talks to
private endpoints at auth-api.8slp.net / client-api.8slp.net /
app-api.8slp.net. Community projects like lukas-clarke/eight_sleep
(Home Assistant) and mezz64/pyEight have been documenting that surface
for years.

Every Eight-Sleep-aware dashboard I found either ran in the cloud (and
wanted my account password installed into their hosted database) or
required a manual JSON paste. Neither felt right for sleep data, so I
wrote a thin MCP wrapper that runs locally and never phones home.

What's in v0.1.0

- 14 read tools: profile, current device, temperature program (incl.
  bedtime / initial sleep / final sleep levels), alarm list,
  adjustable-base state, nightly sleep trends across a date range.
- 5 write tools gated by an explicit env flag
  (EIGHT_SLEEP_ALLOW_MUTATIONS=true): set temperature, turn side
  on/off, toggle away mode, snooze + dismiss alarms.
- Privacy modes (summary / structured / raw), redaction of email and
  device serial by default, on-disk SQLite cache (opt-in).
- MCP resources for inventory / capabilities / agent-manifest, plus
  three MCP prompts (nightly review, bedtime experiment, alarm check).
- CLI: setup (interactive, password is hidden), login (persists
  token), doctor (sanity check).
- Optional Hermes / Claude Desktop / Cursor / Windsurf / OpenClaw
  config writers.

Auth model

Password grant against auth-api.8slp.net using the same Android-app
client_id/secret the upstream Python + Go libs use (overridable).
Token stored in ~/.eight-sleep-mcp/tokens.json with chmod 600.
Automatic re-login on expiry. No third party in the path.

Honest about unofficial

Eight Sleep can change endpoints without notice. The connector tracks
lukas-clarke/eight_sleep and pyEight for breakage signals. README
spells this out — I don't want anyone to think there's an SLA here.

Part of a wider thing

This is connector #15 in https://github.com/davidmosiah/delx-wellness
— 15 wellness MCP servers (WHOOP, Oura, Garmin, Strava, Fitbit,
Polar, Apple Health, Samsung Health, Withings, Google Health, Eight
Sleep, Nourish, plus a few experimental ones) that share an install
pattern and privacy model. There's a Hermes profile pack for the
whole stack.

Feedback welcome — especially from anyone who has hit the same
endpoint-drift problem with Eight Sleep before.
```
