import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface as createCallbackInterface } from "node:readline";
import { createInterface as createPromptInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { NPM_PACKAGE_NAME, PINNED_NPM_PACKAGE } from "../constants.js";
import { hermesConfigSnippet, hermesSkillMarkdown, parseAgentClientName, type AgentClientName } from "../services/agent-manifest.js";
import { writeLocalConfig, type LocalEightSleepConfig } from "../services/local-config.js";
import { runAuthCommand } from "./auth.js";

interface SetupOptions {
  client: AgentClientName;
  email: string;
  password: string;
  privacyMode: "summary" | "structured" | "raw";
  allowMutations: boolean;
  cache?: string;
  noAuth: boolean;
  json: boolean;
  homeDir: string;
}

export async function runSetupCommand(args: string[]): Promise<number> {
  const options = await parseSetupOptions(args);
  const config: LocalEightSleepConfig = {
    EIGHT_SLEEP_EMAIL: options.email,
    EIGHT_SLEEP_PASSWORD: options.password,
    EIGHT_SLEEP_PRIVACY_MODE: options.privacyMode,
    EIGHT_SLEEP_ALLOW_MUTATIONS: options.allowMutations ? "true" : "false"
  };
  if (options.cache) config.EIGHT_SLEEP_CACHE = options.cache;

  const configPath = writeLocalConfig(config, options.homeDir);
  const clientConfig = writeClientConfig(options.client, options.homeDir);
  const setupOutput = {
    ok: true,
    config_path: configPath,
    client: options.client,
    client_config_path: clientConfig.path,
    hermes_skill_path: clientConfig.hermes_skill_path,
    hermes_config_backup_path: clientConfig.hermes_config_backup_path,
    warnings: clientConfig.warnings,
    mutations_enabled: options.allowMutations,
    login_started: !options.noAuth,
    next_step: setupNextStep(options.client, options.noAuth)
  };

  if (options.json) console.log(JSON.stringify(setupOutput, null, 2));
  else {
    console.log("Eight Sleep MCP · Setup");
    console.log("");
    console.log(`  ✓  Local config       ${configPath}`);
    console.log(`  ✓  MCP client config  ${clientConfig.path}`);
    if (clientConfig.hermes_skill_path) console.log(`  ✓  Hermes skill       ${clientConfig.hermes_skill_path}`);
    console.log("");
    console.log("Secrets were saved only in the local config file (chmod 600).");
    if (options.allowMutations) {
      console.log("⚠  Mutations ENABLED — agents can change temperature, alarms, away mode.");
    } else {
      console.log("·  Mutations disabled. Re-run with --allow-mutations to enable write tools.");
    }
    console.log("");
    console.log(`→ Next: ${setupOutput.next_step}`);
  }

  if (!options.noAuth) {
    return runAuthCommand(options.json ? ["--json"] : []);
  }
  return 0;
}

async function parseSetupOptions(args: string[]): Promise<SetupOptions> {
  const flags = parseFlags(args);
  const json = flags.has("json");
  const homeDir = flags.get("home-dir") ?? homedir();
  const interactive = !json && !flags.has("non-interactive") && process.stdin.isTTY;

  const answers = interactive ? await promptForMissing(flags) : flags;
  const client = parseAgentClientName(answers.get("client") ?? "generic");
  const email = required(answers, "email", "Eight Sleep email");
  const password = required(answers, "password", "Eight Sleep password");
  const privacyMode = parsePrivacyMode(answers.get("privacy-mode") ?? "structured");
  const allowMutations = parseBool(answers.get("allow-mutations") ?? "false");
  const cache = answers.get("cache");

  return {
    client,
    email,
    password,
    privacyMode,
    allowMutations,
    cache,
    noAuth: flags.has("no-auth"),
    json,
    homeDir
  };
}

function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(name, "true");
    } else {
      flags.set(name, next);
      index += 1;
    }
  }
  return flags;
}

async function promptForMissing(flags: Map<string, string>): Promise<Map<string, string>> {
  const merged = new Map(flags);
  const firstPrompt = createPromptInterface({ input, output });
  try {
    if (!merged.has("client")) merged.set("client", (await firstPrompt.question("MCP client (generic/claude/cursor/windsurf/hermes/openclaw) [generic]: ")).trim() || "generic");
    if (!merged.has("email")) merged.set("email", (await firstPrompt.question("Eight Sleep email: ")).trim());
  } finally {
    firstPrompt.close();
  }
  if (!merged.has("password")) merged.set("password", await promptHidden("Eight Sleep password: "));

  const secondPrompt = createPromptInterface({ input, output });
  try {
    if (!merged.has("privacy-mode")) merged.set("privacy-mode", (await secondPrompt.question("Privacy mode (summary/structured/raw) [structured]: ")).trim() || "structured");
    if (!merged.has("allow-mutations")) {
      output.write("\nWrite tools let agents change your bed — temperature, side on/off, away mode, and snooze/dismiss alarms.\n");
      output.write("They are OFF by default. You can enable them now or later with `setup --allow-mutations`.\n");
      merged.set("allow-mutations", (await secondPrompt.question("Enable write tools now? [y/N]: ")).trim().toLowerCase().startsWith("y") ? "true" : "false");
    }
  } finally {
    secondPrompt.close();
  }
  return merged;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createCallbackInterface({ input, output, terminal: true }) as ReturnType<typeof createCallbackInterface> & {
      stdoutMuted?: boolean;
      _writeToOutput?: (text: string) => void;
    };
    const originalWrite = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (text: string) => {
      if (rl.stdoutMuted && text !== "\n" && text !== "\r\n") output.write("*");
      else if (originalWrite) originalWrite(text);
      else output.write(text);
    };
    rl.stdoutMuted = true;
    rl.question(question, (answer) => {
      rl.stdoutMuted = false;
      rl.close();
      output.write("\n");
      resolve(answer.trim());
    });
  });
}

function required(flags: Map<string, string>, key: string, label: string): string {
  const value = flags.get(key);
  if (!value || value === "true") throw new Error(`${label} is required. Pass --${key} or run setup interactively.`);
  return value;
}

function parsePrivacyMode(value: string): "summary" | "structured" | "raw" {
  if (value === "summary" || value === "structured" || value === "raw") return value;
  throw new Error("Privacy mode must be summary, structured or raw.");
}

function parseBool(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

interface ClientConfigResult {
  path: string;
  hermes_skill_path?: string;
  hermes_config_backup_path?: string;
  warnings?: string[];
}

function writeClientConfig(client: AgentClientName, homeDir: string): ClientConfigResult {
  if (client === "claude") return { path: mergeClaudeConfig(homeDir) };
  if (client === "hermes") return writeHermesClientConfig(homeDir);
  const path = join(homeDir, ".eight-sleep-mcp", "mcp-configs", `${client}.json`);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(mcpConfigSnippet(), null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return { path };
}

function mergeClaudeConfig(homeDir: string): string {
  const path = process.platform === "darwin"
    ? join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    : join(homeDir, ".eight-sleep-mcp", "mcp-configs", "claude-desktop.json");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  const mcpServers = typeof existing.mcpServers === "object" && existing.mcpServers ? existing.mcpServers as Record<string, unknown> : {};
  const next = {
    ...existing,
    mcpServers: {
      ...mcpServers,
      eight_sleep: mcpConfigSnippet().mcpServers.eight_sleep
    }
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

function mcpConfigSnippet() {
  return {
    mcpServers: {
      eight_sleep: {
        command: "npx",
        args: ["-y", PINNED_NPM_PACKAGE]
      }
    }
  };
}

function writeHermesClientConfig(homeDir: string): ClientConfigResult {
  const configPath = join(homeDir, ".hermes", "config.yaml");
  const skillPath = join(homeDir, ".hermes", "skills", "eight-sleep-mcp", "SKILL.md");
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(skillPath), { recursive: true, mode: 0o700 });

  const backupPath = mergeHermesConfig(configPath);
  writeFileSync(skillPath, `${hermesSkillMarkdown()}\n`, { mode: 0o600 });
  chmodSync(skillPath, 0o600);

  return {
    path: configPath,
    hermes_skill_path: skillPath,
    hermes_config_backup_path: backupPath,
    warnings: [
      "After editing Hermes MCP config, use `/reload-mcp` or `hermes mcp test eight_sleep`; do not restart the gateway for normal data access.",
      `Hermes config pins ${PINNED_NPM_PACKAGE} to avoid stale npx cache behavior.`
    ]
  };
}

function mergeHermesConfig(configPath: string): string | undefined {
  const snippet = hermesConfigSnippet();
  if (!existsSync(configPath)) {
    writeFileSync(configPath, `${snippet}\n`, { mode: 0o600 });
    chmodSync(configPath, 0o600);
    return undefined;
  }

  const existing = readFileSync(configPath, "utf8");
  if (/eight-sleep-mcp-unofficial|eight-sleep-mcp-server/.test(existing) && /^\s*eight_sleep\s*:/m.test(existing)) {
    if (existing.includes(PINNED_NPM_PACKAGE)) return undefined;
    const backupPath = backupConfig(configPath);
    const updated = existing.replace(/eight-sleep-mcp-unofficial(?:@\d+\.\d+\.\d+)?/g, PINNED_NPM_PACKAGE);
    writeFileSync(configPath, updated, { mode: 0o600 });
    chmodSync(configPath, 0o600);
    return backupPath;
  }

  const backupPath = backupConfig(configPath);
  const next = existing.trimEnd().length ? addHermesEightSleepBlock(existing) : snippet;
  writeFileSync(configPath, next, { mode: 0o600 });
  chmodSync(configPath, 0o600);
  return backupPath;
}

function addHermesEightSleepBlock(existing: string): string {
  const serverBlock = [
    "  eight_sleep:",
    "    command: npx",
    "    args:",
    "      - -y",
    `      - ${PINNED_NPM_PACKAGE}`,
    "    env:",
    "      EIGHT_SLEEP_EMAIL: ${EIGHT_SLEEP_EMAIL}",
    "      EIGHT_SLEEP_PASSWORD: ${EIGHT_SLEEP_PASSWORD}"
  ].join("\n");
  const trimmed = existing.trimEnd();
  if (/^mcp_servers:\s*$/m.test(trimmed)) {
    return `${trimmed.replace(/^mcp_servers:\s*$/m, `mcp_servers:\n${serverBlock}`)}\n`;
  }
  return `${trimmed}\n\n# Added by ${NPM_PACKAGE_NAME} setup.\nmcp_servers:\n${serverBlock}\n`;
}

function backupConfig(path: string): string {
  const backupPath = `${path}.bak-eight-sleep-mcp-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z")}`;
  renameSync(path, backupPath);
  chmodSync(backupPath, 0o600);
  writeFileSync(path, readFileSync(backupPath, "utf8"), { mode: 0o600 });
  chmodSync(path, 0o600);
  return backupPath;
}

function setupNextStep(client: AgentClientName, noAuth: boolean): string {
  const login = noAuth ? "Run `eight-sleep-mcp-server login`, then " : "";
  if (client === "hermes") {
    return `${login}run \`eight-sleep-mcp-server doctor --client hermes\`, then \`/reload-mcp\` or \`hermes mcp test eight_sleep\`.`;
  }
  return `${login}run \`eight-sleep-mcp-server doctor\`.`;
}
