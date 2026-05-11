# r/QuantifiedSelf

**Title**: Open-source MCP server: ask any AI agent "what was my best night this week and why?" using your Eight Sleep data

**Body**:

```
For the QS folks who run Eight Sleep — sharing a small thing I built.

If you use Claude Desktop / Cursor / a self-hosted agent like
Hermes, you can now point it at your Eight Sleep pod and ask
natural-language questions about your sleep trend, temperature
program, or alarms. The data flows through a local MCP server, not
a cloud middleman.

  npx -y eight-sleep-mcp-unofficial setup

What's exposed:

- nightly score + stage breakdown (REM / deep / light)
- presence start/end + tnt (tosses-and-turns)
- smart-temperature program (bedtime / initial / final levels)
- alarm list with thermal + vibration toggles
- adjustable-base angle and preset

Plus optional write tools (off by default) for set_temperature,
side on/off, away mode, snooze/dismiss alarm.

Why I built it: I was tired of copy-pasting nightly numbers out of
the Eight Sleep app every morning. Now my agent does it.

Caveat: this is unofficial. Eight Sleep has no public API. The
connector talks to the same private endpoints the mobile app uses
(documented for years by lukas-clarke/eight_sleep and pyEight). If
Eight Sleep changes those, the connector breaks until upstream
follows the change.

Repo + install: https://github.com/davidmosiah/eight-sleep-mcp
Part of: https://github.com/davidmosiah/delx-wellness (15 wellness
MCP connectors — WHOOP, Oura, Garmin, etc.)
```
