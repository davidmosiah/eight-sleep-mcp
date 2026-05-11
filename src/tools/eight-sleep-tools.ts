import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AgentManifestInputSchema,
  AgentManifestOutputSchema,
  AlarmActionInputSchema,
  CacheStatusOutputSchema,
  CapabilitiesOutputSchema,
  ConnectionStatusInputSchema,
  ConnectionStatusOutputSchema,
  DataInventoryOutputSchema,
  EndpointDataOutputSchema,
  LogoutOutputSchema,
  MutationOutputSchema,
  NightlySummaryInputSchema,
  NightlySummaryOutputSchema,
  PrivacyAuditOutputSchema,
  ResponseOnlyInputSchema,
  SetAwayModeInputSchema,
  SetSideInputSchema,
  SetTemperatureInputSchema,
  SimpleReadInputSchema,
  TrendsInputSchema,
  UserIdInputSchema,
  WellnessContextInputSchema,
  WellnessContextOutputSchema
} from "../schemas/common.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildPrivacyAudit } from "../services/audit.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildConnectionStatus } from "../services/connection-status.js";
import { getConfig } from "../services/config.js";
import { EightSleepClient } from "../services/eight-sleep-client.js";
import { bulletList, makeError, makeResponse } from "../services/format.js";
import { buildDataInventory, formatInventoryMarkdown } from "../services/inventory.js";
import { applyPrivacy, resolvePrivacyMode } from "../services/privacy.js";
import {
  buildNightlySummary,
  buildWellnessContext,
  formatNightlySummaryMarkdown,
  formatWellnessContextMarkdown
} from "../services/wellness-context.js";

function client(): EightSleepClient {
  return new EightSleepClient(getConfig());
}

async function resolveUserId(c: EightSleepClient, override?: string): Promise<string> {
  if (override) return override;
  const token = await c.ensureLogin();
  if (!token.user_id) {
    throw new Error("Eight Sleep token does not include a userId. Pass user_id explicitly or re-run login.");
  }
  return token.user_id;
}

function requireMutations(): void {
  if (!getConfig().allowMutations) {
    throw new Error(
      "Write tools are disabled. To enable them: re-run `eight-sleep-mcp-server setup --allow-mutations`, or set EIGHT_SLEEP_ALLOW_MUTATIONS=true in your environment. Ask the user before turning this on — it lets agents change pod temperature, side state, away mode and alarms."
    );
  }
}

export function registerEightSleepTools(server: McpServer): void {
  // ------------------------------ meta ------------------------------

  server.registerTool(
    "eight_sleep_data_inventory",
    {
      title: "Eight Sleep Data Inventory",
      description: "Inventory supported Eight Sleep domains, mutation tools, and recommended first calls. Does not call Eight Sleep APIs.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: DataInventoryOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      const inventory = buildDataInventory();
      return makeResponse(inventory, response_format, formatInventoryMarkdown(inventory));
    }
  );

  server.registerTool(
    "eight_sleep_capabilities",
    {
      title: "Eight Sleep MCP Capabilities",
      description: "Explain supported Eight Sleep data, mutation gate, privacy modes, and project links. Does not call Eight Sleep or expose secrets.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: CapabilitiesOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      const capabilities = buildCapabilities();
      return makeResponse(capabilities, response_format, bulletList("Eight Sleep MCP Capabilities", {
        project: capabilities.project,
        unofficial: capabilities.unofficial,
        api_boundary: capabilities.api_boundary.source,
        raw_definition: capabilities.api_boundary.raw_definition,
        unsupported: capabilities.api_boundary.does_not_include.join(", "),
        mutations_count: capabilities.mutations.length,
        docs: capabilities.links.docs
      }));
    }
  );

  server.registerTool(
    "eight_sleep_agent_manifest",
    {
      title: "Eight Sleep Agent Manifest",
      description: "Machine-readable install, runtime and client guidance for AI agents operating the Eight Sleep MCP.",
      inputSchema: AgentManifestInputSchema.shape,
      outputSchema: AgentManifestOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ client: targetClient, response_format }) => {
      const manifest = buildAgentManifest(targetClient);
      return makeResponse(manifest, response_format, formatAgentManifestMarkdown(manifest));
    }
  );

  server.registerTool(
    "eight_sleep_connection_status",
    {
      title: "Eight Sleep Connection Status",
      description: "Check env, local config, token file, Node version, privacy mode and mutation gate. Does not call Eight Sleep or expose secrets.",
      inputSchema: ConnectionStatusInputSchema.shape,
      outputSchema: ConnectionStatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ client: targetClient, response_format }) => {
      const status = await buildConnectionStatus({ client: targetClient });
      return makeResponse(status, response_format, bulletList("Eight Sleep Connection Status", {
        ok: status.ok,
        ready: status.ready_for_eight_sleep_api,
        client: status.client,
        missing_env: status.missing_env.join(", ") || "none",
        token_exists: status.token.exists,
        privacy_mode: status.privacy_mode,
        mutations_enabled: status.mutations_enabled,
        next_steps: status.next_steps.join(" | ")
      }));
    }
  );

  server.registerTool(
    "eight_sleep_cache_status",
    {
      title: "Eight Sleep Cache Status",
      description: "Show optional local SQLite cache status. Enable with EIGHT_SLEEP_CACHE=sqlite or EIGHT_SLEEP_CACHE=true.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: CacheStatusOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      try {
        const status = client().cacheStatus();
        return makeResponse(status, response_format, bulletList("Eight Sleep Cache Status", status));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_privacy_audit",
    {
      title: "Eight Sleep Privacy Audit",
      description: "Return local privacy, cache, token-path, env-presence, mutation gate and redaction posture without revealing secret values.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: PrivacyAuditOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ response_format }) => {
      const audit = buildPrivacyAudit();
      return makeResponse(audit, response_format, bulletList("Eight Sleep Privacy Audit", audit));
    }
  );

  server.registerTool(
    "eight_sleep_logout",
    {
      title: "Eight Sleep Logout",
      description: "Delete the local Eight Sleep token file. Use when the user explicitly wants to disconnect.",
      inputSchema: ResponseOnlyInputSchema.shape,
      outputSchema: LogoutOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
    },
    async ({ response_format }) => {
      try {
        const result = await client().logout();
        const output = {
          ...result,
          note: "Local Eight Sleep token removed. Next data tool call will re-authenticate with stored credentials."
        };
        return makeResponse(output, response_format, bulletList("Eight Sleep Logout", output));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  // ------------------------------ reads ------------------------------

  server.registerTool(
    "eight_sleep_get_me",
    {
      title: "Get Eight Sleep Profile (me)",
      description: "Return the authenticated user's Eight Sleep profile and assigned devices.",
      inputSchema: SimpleReadInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c);
        const endpoint = `/users/${userId}`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "client" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Profile", { endpoint, privacy_mode: privacyMode }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_user",
    {
      title: "Get Eight Sleep User",
      description: "Return Eight Sleep profile data for a specific user_id (defaults to authenticated user).",
      inputSchema: UserIdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/users/${userId}`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "client" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep User", { endpoint }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_current_device",
    {
      title: "Get Current Eight Sleep Device",
      description: "Return the bed side currently assigned to the user (solo/left/right).",
      inputSchema: UserIdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/users/${userId}/current-device`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "client" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Current Device", { endpoint }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_temperature",
    {
      title: "Get Eight Sleep Temperature",
      description: "Return current heating level, smart-schedule levels and side on/off state.",
      inputSchema: UserIdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/temperature`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "app" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Temperature", { endpoint }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_alarms",
    {
      title: "Get Eight Sleep Alarms",
      description: "Return the list of configured alarms and the recommended next alarm.",
      inputSchema: UserIdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v2/users/${userId}/alarms`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "app" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Alarms", { endpoint }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_base",
    {
      title: "Get Eight Sleep Adjustable Base",
      description: "Return adjustable-base state: leg angle, torso angle and preset.",
      inputSchema: UserIdInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/base`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, { base: "app" }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Base", { endpoint }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_get_trends",
    {
      title: "Get Eight Sleep Sleep Trends",
      description: "Return nightly sleep sessions and scores for a date range.",
      inputSchema: TrendsInputSchema.shape,
      outputSchema: EndpointDataOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, from_date, to_date, timezone, response_format, privacy_mode }) => {
      try {
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/users/${userId}/trends`;
        const privacyMode = resolvePrivacyMode(getConfig(), privacy_mode);
        const data = applyPrivacy(endpoint, await c.get(endpoint, {
          base: "client",
          params: {
            "tz": timezone,
            "from": from_date,
            "to": to_date,
            "include-main": true,
            "include-all-sessions": true,
            "model-version": "v2"
          }
        }), privacyMode);
        return makeResponse({ endpoint, privacy_mode: privacyMode, data }, response_format, bulletList("Eight Sleep Trends", { endpoint, from_date, to_date, timezone }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  // ------------------------------ workflows ------------------------------

  server.registerTool(
    "eight_sleep_wellness_context",
    {
      title: "Eight Sleep Wellness Context",
      description: "Build a normalized `delx-wellness-context/v1` payload from recent Eight Sleep trends so other Delx Wellness tools (nourish, exercise catalog, Telegram coaches) can read sleep context without knowing the Eight Sleep API.",
      inputSchema: WellnessContextInputSchema.shape,
      outputSchema: WellnessContextOutputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const c = client();
        const context = await buildWellnessContext(c, {
          days: params.days,
          timezone: params.timezone,
          soreness: params.soreness,
          injury_flags: params.injury_flags,
          notes: params.notes
        });
        return makeResponse(context, params.response_format, formatWellnessContextMarkdown(context));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_nightly_summary",
    {
      title: "Eight Sleep Nightly Summary",
      description: "Compute a multi-night sleep summary (best night, worst night, mean score, nights under 70 / over 85) from Eight Sleep trend data. One call replaces post-processing raw `get_trends`.",
      inputSchema: NightlySummaryInputSchema.shape,
      outputSchema: NightlySummaryOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async (params) => {
      try {
        const c = client();
        const summary = await buildNightlySummary(c, { days: params.days, timezone: params.timezone });
        return makeResponse(summary, params.response_format, formatNightlySummaryMarkdown(summary));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  // ------------------------------ mutations ------------------------------

  server.registerTool(
    "eight_sleep_set_temperature",
    {
      title: "Set Eight Sleep Temperature Level",
      description: "Set the heating level (-100 .. 100). Optionally set a duration in seconds. Requires EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      inputSchema: SetTemperatureInputSchema.shape,
      outputSchema: MutationOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, level, duration_seconds, response_format }) => {
      try {
        requireMutations();
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/temperature`;
        const body: Record<string, unknown> = { currentLevel: level };
        if (duration_seconds !== undefined) body.timeBased = { level, durationSeconds: duration_seconds };
        const data = await c.put(endpoint, body, { base: "app" });
        return makeResponse({ endpoint, method: "PUT", ok: true, data }, response_format, bulletList("Eight Sleep Temperature Set", { endpoint, level, duration_seconds: duration_seconds ?? "persistent" }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_set_side",
    {
      title: "Set Eight Sleep Side On/Off",
      description: "Turn the user's bed side on or off. Requires EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      inputSchema: SetSideInputSchema.shape,
      outputSchema: MutationOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, is_on, response_format }) => {
      try {
        requireMutations();
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/temperature`;
        const data = await c.put(endpoint, { currentState: { type: is_on ? "smart" : "off" } }, { base: "app" });
        return makeResponse({ endpoint, method: "PUT", ok: true, data }, response_format, bulletList("Eight Sleep Side Toggle", { endpoint, is_on }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_set_away_mode",
    {
      title: "Set Eight Sleep Away Mode",
      description: "Toggle away mode. Requires EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      inputSchema: SetAwayModeInputSchema.shape,
      outputSchema: MutationOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, is_away, response_format }) => {
      try {
        requireMutations();
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/away-mode`;
        const data = await c.put(endpoint, { awayPeriod: is_away ? { start: new Date().toISOString() } : null }, { base: "app" });
        return makeResponse({ endpoint, method: "PUT", ok: true, data }, response_format, bulletList("Eight Sleep Away Mode", { endpoint, is_away }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_snooze_alarm",
    {
      title: "Snooze Eight Sleep Alarm",
      description: "Snooze an actively ringing alarm. Requires EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      inputSchema: AlarmActionInputSchema.shape,
      outputSchema: MutationOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ user_id, alarm_id, response_format }) => {
      try {
        requireMutations();
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/alarms/${alarm_id}/snooze`;
        const data = await c.put(endpoint, {}, { base: "app" });
        return makeResponse({ endpoint, method: "PUT", ok: true, data }, response_format, bulletList("Eight Sleep Alarm Snoozed", { endpoint, alarm_id }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );

  server.registerTool(
    "eight_sleep_dismiss_alarm",
    {
      title: "Dismiss Eight Sleep Alarm",
      description: "Dismiss an actively ringing alarm. Requires EIGHT_SLEEP_ALLOW_MUTATIONS=true.",
      inputSchema: AlarmActionInputSchema.shape,
      outputSchema: MutationOutputSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }
    },
    async ({ user_id, alarm_id, response_format }) => {
      try {
        requireMutations();
        const c = client();
        const userId = await resolveUserId(c, user_id);
        const endpoint = `/v1/users/${userId}/alarms/${alarm_id}/dismiss`;
        const data = await c.put(endpoint, {}, { base: "app" });
        return makeResponse({ endpoint, method: "PUT", ok: true, data }, response_format, bulletList("Eight Sleep Alarm Dismissed", { endpoint, alarm_id }));
      } catch (error) {
        return makeError((error as Error).message);
      }
    }
  );
}
