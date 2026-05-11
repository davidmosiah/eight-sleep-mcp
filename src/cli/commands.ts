import { buildConnectionStatus } from "../services/connection-status.js";
import { SERVER_VERSION } from "../constants.js";
import { parseAgentClientName } from "../services/agent-manifest.js";
import {
  getOnboardingFlow,
  getProfile,
  getProfilePath,
  missingCriticalFields,
} from "../services/profile-store.js";
import { runAuthCommand } from "./auth.js";
import { runSetupCommand } from "./setup.js";

export async function runCliCommand(args: string[]): Promise<number | undefined> {
  const [command, ...rest] = args;
  if (!command || command === "--http") return undefined;
  if (command === "setup") return runSetupCommand(rest);
  if (command === "doctor" || command === "status") return runDoctor(rest);
  if (command === "login" || command === "auth") return runAuthCommand(rest);
  if (command === "onboarding") return runOnboardingCommand(rest);
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(SERVER_VERSION);
    return 0;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (!command.startsWith("--")) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  }
  return undefined;
}

async function runDoctor(args: string[]): Promise<number> {
  const options = parseDoctorOptions(args);
  const status = await buildConnectionStatus({ client: options.client });
  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printDoctor(status);
  }
  return options.strict && !status.ok ? 1 : 0;
}

function parseDoctorOptions(args: string[]) {
  let client: ReturnType<typeof parseAgentClientName> | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--client") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --client.");
      client = parseAgentClientName(value);
      index += 1;
    }
  }
  return {
    json: args.includes("--json"),
    strict: args.includes("--strict"),
    client
  };
}

function printDoctor(status: Awaited<ReturnType<typeof buildConnectionStatus>>): void {
  const ok = "✓";
  const fail = "✗";
  const info = "·";
  const check = (passed: boolean) => (passed ? ok : fail);
  const line = (mark: string, label: string, detail?: string) => {
    const labelCol = label.padEnd(28);
    console.log(`  ${mark}  ${labelCol}${detail ? `  ${detail}` : ""}`);
  };

  console.log("Eight Sleep MCP · Doctor");
  console.log(`Status: ${status.ok ? `READY ${ok}` : `NEEDS SETUP ${fail}`}`);
  if (status.client) console.log(`Client: ${status.client}`);
  console.log("");
  console.log("Checks");
  line(check(status.node.supported), "Node.js >=20", status.node.supported ? undefined : `version ${status.node.version}`);
  line(check(status.missing_env.length === 0), "Credentials", status.missing_env.length ? `missing: ${status.missing_env.join(", ")}` : "set");
  line(check(status.config.exists), "Local config", status.config.exists ? `${status.config.source} at ${status.config.path}` : "missing");
  line(check(status.token.exists), "Token file", status.token.exists ? status.token.path : "not yet (will be created on first call)");
  if (status.token.exists) {
    line(status.token.secure_permissions === false ? fail : ok, "Token permissions", status.token.secure_permissions === false ? "insecure (chmod 600)" : undefined);
    line(check(!status.token.expired), "Token freshness", status.token.expired ? "expired (will auto-refresh)" : undefined);
  }
  line(info, "Privacy mode", status.privacy_mode);
  line(status.mutations_enabled ? ok : info, "Mutations", status.mutations_enabled ? "ENABLED (write tools available)" : "disabled (read-only)");
  line(status.cache.enabled ? ok : info, "Cache", status.cache.enabled ? `enabled at ${status.cache.path}` : "disabled");
  console.log("");
  console.log("Next steps");
  status.next_steps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
}

async function runOnboardingCommand(args: string[]): Promise<number> {
  const localeArg = args.find((arg) => !arg.startsWith("--"));
  const locale = localeArg === "pt-BR" ? "pt-BR" : "en";
  const flow = getOnboardingFlow(locale);
  const profile = await getProfile();
  const missing = missingCriticalFields(profile);
  console.log(
    JSON.stringify(
      {
        ...flow,
        current_profile: profile,
        missing_critical: missing,
      },
      null,
      2
    )
  );
  if (process.stderr.isTTY && process.env.EIGHT_SLEEP_QUIET !== "1") {
    process.stderr.write(
      `\n## Delx Wellness shared onboarding (${locale})\n` +
        `\nThe agent will ask these 11 questions next so eight-sleep-mcp (and the rest\n` +
        `of the wellness stack) can personalize bedtime plans and nightly summaries —\n` +
        `non-secret data only, stored at ${getProfilePath()}.\n\n` +
        flow.questions
          .map((q, i) => `${i + 1}. (${q.required ? "required" : "optional"}) ${q.prompt}`)
          .join("\n") +
        `\n\nPrivacy: ${flow.privacy_note}\n\n`
    );
  }
  return 0;
}

function printHelp(): void {
  console.log(`Eight Sleep MCP Server (unofficial)

Usage:
  eight-sleep-mcp-server                 Start MCP stdio server
  eight-sleep-mcp-server --http          Start local HTTP MCP server
  eight-sleep-mcp-server setup           Guided setup, local config, and MCP client config
  eight-sleep-mcp-server login           Login now and persist the token
  eight-sleep-mcp-server doctor          Check setup and next steps
  eight-sleep-mcp-server doctor --json   Print setup status as JSON
  eight-sleep-mcp-server onboarding [pt-BR]   Print shared Delx Wellness onboarding flow

Required env (or use setup):
  EIGHT_SLEEP_EMAIL
  EIGHT_SLEEP_PASSWORD

Optional env:
  EIGHT_SLEEP_ALLOW_MUTATIONS=true   Enable write tools (set_temperature, set_side, alarms, away)
  EIGHT_SLEEP_PRIVACY_MODE=structured|summary|raw
  EIGHT_SLEEP_CACHE=sqlite           Enable on-disk response cache
  EIGHT_SLEEP_CLIENT_ID / EIGHT_SLEEP_CLIENT_SECRET   Override default Android-app credentials

Unofficial: this server uses the same private endpoints the Eight Sleep mobile app talks to.
`);
}
