# Twitter launch thread — Eight Sleep MCP (v0.1.0)

Attach a terminal screenshot of `npx -y eight-sleep-mcp-unofficial setup`
to tweet 1. Attach an MCP-client screenshot showing `eight_sleep_get_trends`
output to tweet 6.

---

## 1/ Hook

> Your Eight Sleep pod has 6 months of nightly scores, presence intervals
> and a smart-temperature schedule locked behind the mobile app.
>
> Now your AI agent can read it.
>
> npx -y eight-sleep-mcp-unofficial setup
>
> Local-first MCP — credentials never leave your machine. 🧵

## 2/ Why

> Eight Sleep doesn't ship a public API. Every "smart bed dashboard"
> project I found either ran in the cloud or wanted to install my
> account credentials into someone else's database.
>
> Wrong default for sleep data. So I went the other way.

## 3/ How

> The Eight Sleep mobile app talks to private endpoints at 8slp.net.
> Community projects (lukas-clarke/eight_sleep, mezz64/pyEight,
> steipete/eightctl) have been documenting them for years.
>
> This MCP server speaks the same protocol — in TypeScript, stateless,
> tokens chmod 600.

## 4/ What you get

> 14 read tools out of the box:
>
> · profile + assigned bed side
> · current temperature program (bedtime / initial / final levels)
> · nightly sleep trends with score + stage breakdown
> · alarm list with thermal/vibration toggles
> · adjustable-base angle + preset
>
> All read-only by default.

## 5/ Write tools (gated)

> 5 mutation tools (set_temperature, set_side, set_away_mode,
> snooze_alarm, dismiss_alarm) are OFF by default.
>
> Flip them on with one flag (`EIGHT_SLEEP_ALLOW_MUTATIONS=true`) and
> your agent can warm the bed before bedtime or dismiss the alarm when
> you said the magic word.

## 6/ Live

[attach: screenshot of an MCP client returning eight_sleep_get_trends output]

> "What was my best night this week?"
>
> The agent calls eight_sleep_get_trends, sees a 92 on Wednesday with
> 1h12m of REM, explains why, and asks if you want it to tune the
> bedtime temperature for Sunday.

## 7/ Honest about unofficial

> Eight Sleep can change endpoints without notice. This connector
> tracks the upstream Python/CLI community projects so when something
> breaks I follow their fix. The README says this in plain English.

## 8/ Part of Delx Wellness

> 15 wellness MCP connectors. Same install pattern, same privacy model,
> same agent-manifest surface.
>
> One profile pack for Hermes: npx -y delx-wellness-hermes setup
>
> github.com/davidmosiah/delx-wellness

## 9/ Install

> ```
> npx -y eight-sleep-mcp-unofficial setup
> npx -y eight-sleep-mcp-unofficial doctor
> ```
>
> github.com/davidmosiah/eight-sleep-mcp
>
> Issues + PRs welcome. ⭐ helps other agent builders find it.
