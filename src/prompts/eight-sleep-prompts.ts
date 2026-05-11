import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const FromDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date YYYY-MM-DD.");
const ToDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date YYYY-MM-DD.");
const Timezone = z.string().default("UTC").describe("IANA timezone.");

function userPrompt(text: string) {
  return {
    messages: [{
      role: "user" as const,
      content: { type: "text" as const, text }
    }]
  };
}

export function registerEightSleepPrompts(server: McpServer): void {
  server.registerPrompt(
    "eight_sleep_nightly_review",
    {
      title: "Eight Sleep Nightly Review",
      description: "Use Eight Sleep trend + alarm data to produce a non-medical recap of last night's sleep.",
      argsSchema: { from_date: FromDate, to_date: ToDate, timezone: Timezone }
    },
    ({ from_date, to_date, timezone }) => userPrompt(`Call eight_sleep_get_trends with from_date=${from_date}, to_date=${to_date}, timezone=${timezone || "UTC"}, response_format=json.

Then produce a recap that:
- Leads with the most recent session score and stage breakdown.
- Notes tosses-and-turns (tnt), presence start/end, and presence duration.
- Surfaces any unusual deltas vs the prior session.
- Avoids medical diagnosis. Frame everything as wellness context.`)
  );

  server.registerPrompt(
    "eight_sleep_bedtime_temperature_plan",
    {
      title: "Eight Sleep Bedtime Temperature Plan",
      description: "Inspect the current temperature program and propose a small experiment for the next 3 nights.",
      argsSchema: {}
    },
    () => userPrompt(`Call eight_sleep_get_temperature with response_format=json. Use currentLevel, currentDeviceLevel, smartTemperatures (bedTime, initialSleep, finalSleep) and isOn.

Then:
- Summarize the current bedtime / initial / final levels.
- Propose ONE small adjustment for a 3-night experiment.
- Tell the agent which tool to call to apply the change (eight_sleep_set_temperature) and remind that EIGHT_SLEEP_ALLOW_MUTATIONS must be true.
- Make no medical claims.`)
  );

  server.registerPrompt(
    "eight_sleep_morning_alarm_check",
    {
      title: "Eight Sleep Morning Alarm Check",
      description: "Show the next configured alarm and whether thermal/vibration are enabled.",
      argsSchema: {}
    },
    () => userPrompt(`Call eight_sleep_get_alarms with response_format=json. Show the next upcoming alarm with timestamp, repeat days, thermal/vibration toggles, and whether the alarm is enabled.

If multiple alarms exist, list each briefly and highlight the next one. Do not modify alarms unless the user explicitly asks.`)
  );
}
