import { NPM_PACKAGE_NAME } from "../constants.js";

export function buildCapabilities() {
  return {
    project: "eight-sleep-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/eight-sleep-mcp",
    creator: {
      name: "David Mosiah",
      github: "https://github.com/davidmosiah"
    },
    unofficial: true,
    api_boundary: {
      source: "Eight Sleep mobile-app API (auth-api.8slp.net + client-api.8slp.net + app-api.8slp.net)",
      raw_definition: "Raw means the JSON response returned by the same private endpoints the Eight Sleep iOS/Android app calls. There is no official public API contract.",
      does_not_include: [
        "raw accelerometer or heart-rate device telemetry",
        "second-by-second biometric sensor streams",
        "Bluetooth Low Energy pod collection",
        "firmware-level pod control"
      ]
    },
    auth_model: {
      type: "OAuth 2.0 password grant against auth-api.8slp.net (private)",
      token_storage: "Local token file with user-only permissions (~/.eight-sleep-mcp/tokens.json, 0600)",
      credentials: ["EIGHT_SLEEP_EMAIL", "EIGHT_SLEEP_PASSWORD"],
      client_credentials_default: "Defaults to client_id/secret extracted from the public Android app, matching pyEight/eightctl. Override via EIGHT_SLEEP_CLIENT_ID / EIGHT_SLEEP_CLIENT_SECRET if you have your own."
    },
    privacy_modes: [
      { mode: "summary", use_when: "The agent only needs minimal fields (id, score, currentLevel)." },
      { mode: "structured", use_when: "Default — keeps most fields but redacts email, device serial, addresses." },
      { mode: "raw", use_when: "User explicitly needs upstream payload (debugging, deeper analysis)." }
    ],
    supported_data: [
      {
        name: "User & device",
        examples: ["userId", "first name", "device serial (redacted by default)", "assigned bed side (solo/left/right)"],
        tools: ["eight_sleep_get_me", "eight_sleep_get_user", "eight_sleep_get_current_device"]
      },
      {
        name: "Temperature",
        examples: ["currentLevel", "currentDeviceLevel", "smartTemperatures (bedTime/initial/final)", "isOn"],
        tools: ["eight_sleep_get_temperature"]
      },
      {
        name: "Alarms",
        examples: ["next alarm", "configured alarm list", "alarm thermal/vibration settings"],
        tools: ["eight_sleep_get_alarms"]
      },
      {
        name: "Sleep trends",
        examples: ["nightly sleep sessions", "score", "presence start/end", "stage breakdown", "tnt (tosses-and-turns)"],
        tools: ["eight_sleep_get_trends", "eight_sleep_nightly_summary", "eight_sleep_wellness_context"]
      },
      {
        name: "Adjustable base",
        examples: ["leg angle", "torso angle", "preset"],
        tools: ["eight_sleep_get_base"]
      }
    ],
    mutations: [
      { name: "Set temperature level", tool: "eight_sleep_set_temperature", guarded_by: "EIGHT_SLEEP_ALLOW_MUTATIONS=true" },
      { name: "Turn side on/off", tool: "eight_sleep_set_side", guarded_by: "EIGHT_SLEEP_ALLOW_MUTATIONS=true" },
      { name: "Toggle away mode", tool: "eight_sleep_set_away_mode", guarded_by: "EIGHT_SLEEP_ALLOW_MUTATIONS=true" },
      { name: "Snooze alarm", tool: "eight_sleep_snooze_alarm", guarded_by: "EIGHT_SLEEP_ALLOW_MUTATIONS=true" },
      { name: "Dismiss alarm", tool: "eight_sleep_dismiss_alarm", guarded_by: "EIGHT_SLEEP_ALLOW_MUTATIONS=true" }
    ],
    recommended_agent_flow: [
      "Call eight_sleep_agent_manifest when installing or operating inside a server agent such as Hermes.",
      "Call eight_sleep_connection_status before any data tool.",
      "If setup is incomplete, guide the user through `eight-sleep-mcp-server setup`.",
      "Prefer eight_sleep_nightly_summary or eight_sleep_wellness_context over raw eight_sleep_get_trends.",
      "Use eight_sleep_wellness_context to hand sleep context to nourish / exercise-catalog / Telegram coaches.",
      "Mutations need explicit user intent AND EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      "Use privacy_mode=raw only when the user explicitly asks for the full payload.",
      "Frame outputs as sleep/temperature context, never as medical diagnosis."
    ],
    contribution_paths: [
      "Improve setup UX (interactive prompts, validation).",
      "Add examples for more MCP clients (Claude Desktop, Cursor, Windsurf).",
      "Track upstream API changes mirrored from pyEight / eightctl.",
      "Add normalized 'sleep_context' shape for handoff to wellness aggregators."
    ],
    links: {
      github: "https://github.com/davidmosiah/eight-sleep-mcp",
      docs: "https://wellness.delx.ai/connectors/eight-sleep",
      npm: `https://www.npmjs.com/package/${NPM_PACKAGE_NAME}`,
      upstream_python_lib: "https://github.com/lukas-clarke/eight_sleep",
      upstream_cli: "https://github.com/steipete/eightctl"
    }
  };
}
