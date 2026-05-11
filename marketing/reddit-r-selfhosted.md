# r/selfhosted

**Title**: I wrote a local-first MCP server so my AI agent can read my Eight Sleep pod — no cloud middleman, no hosted password vault

**Body**:

```
Selfhosted folks — sharing a thing I just shipped that I think fits
this sub.

Context: I have an Eight Sleep pod. Eight Sleep doesn't publish a
public API. The mobile app talks to private endpoints at 8slp.net,
and community projects (lukas-clarke/eight_sleep for Home Assistant,
mezz64/pyEight, steipete/eightctl) have been speaking that protocol
for years.

I wanted my AI agent — I run Hermes locally with Claude Sonnet behind
it — to be able to answer "what was my best night this week and
why?" without me copy-pasting numbers from the Eight Sleep app every
morning.

So I wrote a Model Context Protocol (MCP) server that wraps the same
private endpoints, but runs entirely on my machine:

  npx -y eight-sleep-mcp-unofficial setup    # email + password, stored chmod 600
  npx -y eight-sleep-mcp-unofficial doctor   # confirms readiness

Repo: https://github.com/davidmosiah/eight-sleep-mcp

What it ships:

- 14 read tools — profile, assigned bed side, current temperature
  program (bedtime / initial sleep / final sleep levels), alarm
  list, adjustable-base state, nightly sleep trends across a date
  range.
- 5 write tools gated by EIGHT_SLEEP_ALLOW_MUTATIONS=true — set
  temperature, turn side on/off, away mode, alarm snooze + dismiss.
  Defaults are OFF so a hallucinating agent can't randomly turn your
  bed on.
- Privacy modes: summary / structured / raw. Email and device
  serial redacted by default.
- Local SQLite cache (opt-in).
- Works with Claude Desktop, Cursor, Hermes, OpenClaw, anything MCP.

Local-first design choices:

- No telemetry, no analytics, no phone-home.
- Tokens never leave the machine. ~/.eight-sleep-mcp/tokens.json
  is chmod 600.
- Password lives in ~/.eight-sleep-mcp/config.json (same perms) or
  EIGHT_SLEEP_PASSWORD env var.
- The MCP client config never holds the password — it just spawns
  the local node binary.

Honest about unofficial:

Eight Sleep can change endpoints without notice. The connector tracks
upstream community projects for breakage signals. If you want a
firmware-level deep-dive, the right project is LiamSnow/opensleep —
that goes way further than this MCP does.

Part of a wider hub at github.com/davidmosiah/delx-wellness — same
local-first treatment for WHOOP, Oura, Garmin, Strava, Fitbit, Polar,
Apple Health, Samsung Health, Withings, Google Health and a nutrition
MCP.

Issues + PRs welcome — especially endpoint regressions.
```
