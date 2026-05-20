import { NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE, SERVER_VERSION } from "../constants.js";

export const AGENT_CLIENTS = ["generic", "claude", "cursor", "windsurf", "hermes", "openclaw"] as const;
export type AgentClientName = typeof AGENT_CLIENTS[number];

export const HERMES_DIRECT_TOOLS = [
  "mcp_eight_sleep_eight_sleep_agent_manifest",
  "mcp_eight_sleep_eight_sleep_connection_status",
  "mcp_eight_sleep_eight_sleep_data_inventory",
  "mcp_eight_sleep_eight_sleep_get_me",
  "mcp_eight_sleep_eight_sleep_get_temperature",
  "mcp_eight_sleep_eight_sleep_get_alarms",
  "mcp_eight_sleep_eight_sleep_get_trends",
  "mcp_eight_sleep_eight_sleep_nightly_summary",
  "mcp_eight_sleep_eight_sleep_wellness_context"
];

const STANDARD_TOOLS = [
  "eight_sleep_agent_manifest",
  "eight_sleep_cache_status",
  "eight_sleep_capabilities",
  "eight_sleep_connection_status",
  "eight_sleep_data_inventory",
  "eight_sleep_get_alarms",
  "eight_sleep_get_base",
  "eight_sleep_get_current_device",
  "eight_sleep_get_me",
  "eight_sleep_get_temperature",
  "eight_sleep_get_trends",
  "eight_sleep_get_user",
  "eight_sleep_logout",
  "eight_sleep_nightly_summary",
  "eight_sleep_onboarding",
  "eight_sleep_privacy_audit",
  "eight_sleep_profile_get",
  "eight_sleep_profile_update",
  "eight_sleep_temperature_trend",
  "eight_sleep_wellness_context"
];

const MUTATION_TOOLS = [
  "eight_sleep_set_temperature",
  "eight_sleep_set_side",
  "eight_sleep_set_away_mode",
  "eight_sleep_snooze_alarm",
  "eight_sleep_dismiss_alarm"
];

export function parseAgentClientName(value: string): AgentClientName {
  return AGENT_CLIENTS.includes(value as AgentClientName) ? value as AgentClientName : "generic";
}

export function buildAgentManifest(client: AgentClientName = "generic") {
  return {
    project: "eight-sleep-mcp-unofficial",
    mcp_name: "io.github.davidmosiah/eight-sleep-mcp",
    client,
    unofficial: true,
    package: {
      name: NPM_PACKAGE_NAME,
      version: SERVER_VERSION,
      install_command: `npx -y ${NPM_PACKAGE_NAME}`,
      pinned_install_command: `npx -y ${PINNED_NPM_PACKAGE}`,
      binary: "eight-sleep-mcp-server"
    },
    auth: {
      provider: "Eight Sleep mobile-app API (auth-api.8slp.net)",
      grant_type: "password (email + password)",
      credentials: ["EIGHT_SLEEP_EMAIL", "EIGHT_SLEEP_PASSWORD"],
      token_storage: "~/.eight-sleep-mcp/tokens.json with 0600 permissions",
      secret_storage: "~/.eight-sleep-mcp/config.json or EIGHT_SLEEP_* env vars; never print secrets"
    },
    recommended_first_calls: [
      "eight_sleep_profile_get",
      "eight_sleep_connection_status",
      "eight_sleep_data_inventory",
      "eight_sleep_get_me",
      "eight_sleep_nightly_summary",
      "eight_sleep_wellness_context"
    ],
    standard_tools: STANDARD_TOOLS,
    mutation_tools: MUTATION_TOOLS,
    hermes: {
      config_path: "~/.hermes/config.yaml",
      skill_path: "~/.hermes/skills/eight-sleep-mcp/SKILL.md",
      tool_name_prefix: "mcp_eight_sleep_",
      common_tool_names: HERMES_DIRECT_TOOLS,
      recommended_config: hermesConfigSnippet(),
      doctor_command: "npx -y eight-sleep-mcp-unofficial doctor --client hermes --json"
    },
    agent_rules: [
      "Call eight_sleep_connection_status and eight_sleep_data_inventory before data tools.",
      "This server talks to Eight Sleep's mobile-app API. Endpoints are not contractually stable.",
      "Mutation tools (set_temperature, set_side, set_away_mode, snooze/dismiss alarm) are gated by EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      "Treat sleep data as sensitive. Do not expose email, device serial, or addresses.",
      "Do not provide medical diagnosis or treatment. Sleep/heart-rate/temperature numbers are wellness context, not clinical metrics.",
      "Eight Sleep does not currently expose continuous biometric streams via this API surface."
    ],
    troubleshooting: [
      { symptom: "missing EIGHT_SLEEP_EMAIL or EIGHT_SLEEP_PASSWORD", action: "Run `eight-sleep-mcp-server setup` or set the env vars." },
      { symptom: "401 invalid credentials", action: "Verify the email/password in the Eight Sleep mobile app, then re-run setup." },
      { symptom: "Mutation tools return 'mutations disabled'", action: "Re-run setup with --allow-mutations or set EIGHT_SLEEP_ALLOW_MUTATIONS=true." },
      { symptom: "Endpoint suddenly returns 4xx", action: "Eight Sleep changes mobile-app endpoints without notice. Check upstream pyEight/eightctl tracker repos." }
    ],
    links: {
      github: "https://github.com/davidmosiah/eight-sleep-mcp",
      npm: `https://www.npmjs.com/package/${NPM_PACKAGE_NAME}`,
      docs: "https://wellness.delx.ai/connectors/eight-sleep",
      upstream_python_lib: "https://github.com/lukas-clarke/eight_sleep",
      upstream_cli: "https://github.com/steipete/eightctl"
    }
  };
}

export function formatAgentManifestMarkdown(manifest: ReturnType<typeof buildAgentManifest>): string {
  return `# Eight Sleep MCP Agent Manifest

Unofficial: ${manifest.unofficial}
Package: \`${manifest.package.name}\` v${manifest.package.version}
Install: \`${manifest.package.install_command}\`
Pinned install: \`${manifest.package.pinned_install_command}\`

## Auth
Provider: ${manifest.auth.provider}
Grant type: ${manifest.auth.grant_type}
Credentials: \`${manifest.auth.credentials.join(" / ")}\`
Tokens: ${manifest.auth.token_storage}

## First Calls
${manifest.recommended_first_calls.map((tool) => `- \`${tool}\``).join("\n")}

## Hermes
Config: \`${manifest.hermes.config_path}\`
Skill: \`${manifest.hermes.skill_path}\`
Direct tools:
${manifest.hermes.common_tool_names.map((tool) => `- \`${tool}\``).join("\n")}

## Agent Rules
${manifest.agent_rules.map((rule) => `- ${rule}`).join("\n")}
`;
}

export function hermesConfigSnippet(): string {
  return `mcp_servers:\n  eight_sleep:\n    command: npx\n    args:\n      - -y\n      - ${PINNED_NPM_PACKAGE}\n    timeout: 120\n    connect_timeout: 60\n    env:\n      EIGHT_SLEEP_EMAIL: \${EIGHT_SLEEP_EMAIL}\n      EIGHT_SLEEP_PASSWORD: \${EIGHT_SLEEP_PASSWORD}\n    sampling:\n      enabled: false`;
}

export function hermesSkillMarkdown(): string {
  return `# Eight Sleep MCP Skill

Use this skill whenever a user asks Hermes to inspect Eight Sleep sleep, temperature, alarms or bed-base state through the Eight Sleep MCP.

## Rules
- Start with \`mcp_eight_sleep_eight_sleep_connection_status\`.
- Read tools (get_me, get_temperature, get_alarms, get_trends, get_base) are always safe.
- Mutation tools (set_temperature, set_side, set_away_mode, snooze/dismiss alarm) require \`EIGHT_SLEEP_ALLOW_MUTATIONS=true\` and explicit user intent.
- Treat sleep data as sensitive. Do not request raw payloads unless the user explicitly asks.
- This MCP talks to the Eight Sleep mobile-app API. Endpoints can break without notice.
- Do not diagnose or treat medical conditions.
`;
}
