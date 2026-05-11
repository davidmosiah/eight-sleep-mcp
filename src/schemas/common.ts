import { z } from "zod";
import { AGENT_CLIENTS } from "../services/agent-manifest.js";

export const ResponseFormatSchema = z.enum(["markdown", "json"]).default("markdown");
export const AgentClientSchema = z.enum(AGENT_CLIENTS).default("generic");
export const PrivacyModeValueSchema = z.enum(["summary", "structured", "raw"]);
export const PrivacyModeSchema = PrivacyModeValueSchema.optional()
  .describe("Optional per-call payload privacy override. Defaults to EIGHT_SLEEP_PRIVACY_MODE or structured.");

export const SimpleReadInputSchema = z.object({
  privacy_mode: PrivacyModeSchema,
  response_format: ResponseFormatSchema
}).strict();

export const ResponseOnlyInputSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

export const AgentManifestInputSchema = z.object({
  client: AgentClientSchema,
  response_format: ResponseFormatSchema
}).strict();

export const ConnectionStatusInputSchema = z.object({
  client: AgentClientSchema.optional(),
  response_format: ResponseFormatSchema
}).strict();

export const UserIdInputSchema = z.object({
  user_id: z.string().min(1).optional()
    .describe("Eight Sleep user id. Defaults to the authenticated user (from stored token)."),
  privacy_mode: PrivacyModeSchema,
  response_format: ResponseFormatSchema
}).strict();

export const TrendsInputSchema = z.object({
  user_id: z.string().min(1).optional(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD."),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date in YYYY-MM-DD."),
  timezone: z.string().min(1).max(80).default("UTC"),
  privacy_mode: PrivacyModeSchema,
  response_format: ResponseFormatSchema
}).strict();

export const SetTemperatureInputSchema = z.object({
  user_id: z.string().min(1).optional(),
  level: z.number().int().min(-100).max(100)
    .describe("Heating level. -100 = coldest, 0 = neutral, 100 = hottest. Eight Sleep clamps client-side."),
  duration_seconds: z.number().int().min(0).max(60 * 60 * 12).optional()
    .describe("Optional duration in seconds. Omit for persistent override."),
  response_format: ResponseFormatSchema
}).strict();

export const SetSideInputSchema = z.object({
  user_id: z.string().min(1).optional(),
  is_on: z.boolean().describe("Turn the side on (true) or off (false)."),
  response_format: ResponseFormatSchema
}).strict();

export const SetAwayModeInputSchema = z.object({
  user_id: z.string().min(1).optional(),
  is_away: z.boolean(),
  response_format: ResponseFormatSchema
}).strict();

export const AlarmActionInputSchema = z.object({
  user_id: z.string().min(1).optional(),
  alarm_id: z.string().min(1).describe("Eight Sleep alarm id from eight_sleep_get_alarms."),
  response_format: ResponseFormatSchema
}).strict();

// ---------------------- output schemas ----------------------

export const EndpointDataOutputSchema = z.object({
  endpoint: z.string(),
  privacy_mode: PrivacyModeValueSchema,
  data: z.unknown()
}).strict();

export const MutationOutputSchema = z.object({
  endpoint: z.string(),
  method: z.string(),
  ok: z.boolean(),
  data: z.unknown().optional(),
  note: z.string().optional()
}).strict();

export const CacheStatusOutputSchema = z.object({
  enabled: z.boolean(),
  path: z.string(),
  entries: z.number().int().nonnegative(),
  newest_cached_at: z.string().optional()
}).strict();

export const LogoutOutputSchema = z.object({
  ok: z.boolean(),
  token_path: z.string(),
  local_tokens_cleared: z.boolean(),
  note: z.string()
}).strict();

export const PrivacyAuditOutputSchema = z.object({
  project: z.string(),
  unofficial: z.boolean(),
  config_source: z.enum(["env", "local_config", "mixed", "missing"]),
  local_config_path: z.string(),
  local_config_exists: z.boolean(),
  local_config_secure_permissions: z.boolean().optional(),
  privacy_mode_default: PrivacyModeValueSchema,
  raw_payloads_opt_in: z.boolean(),
  cache_enabled: z.boolean(),
  cache_path: z.string(),
  token_path: z.string(),
  mutations_enabled: z.boolean(),
  stdout_safe: z.boolean(),
  secret_env_vars: z.array(z.string()),
  required_env_present: z.record(z.string(), z.boolean()),
  redacted_key_patterns: z.array(z.string()),
  notes: z.array(z.string())
}).strict();

export const CapabilitiesOutputSchema = z.object({
  project: z.string(),
  mcp_name: z.string(),
  creator: z.object({ name: z.string(), github: z.string() }).strict(),
  unofficial: z.boolean(),
  api_boundary: z.object({
    source: z.string(),
    raw_definition: z.string(),
    does_not_include: z.array(z.string())
  }).strict(),
  auth_model: z.object({
    type: z.string(),
    token_storage: z.string(),
    credentials: z.array(z.string()),
    client_credentials_default: z.string()
  }).strict(),
  privacy_modes: z.array(z.object({ mode: PrivacyModeValueSchema, use_when: z.string() }).strict()),
  supported_data: z.array(z.object({ name: z.string(), examples: z.array(z.string()), tools: z.array(z.string()) }).strict()),
  mutations: z.array(z.object({ name: z.string(), tool: z.string(), guarded_by: z.string() }).strict()),
  recommended_agent_flow: z.array(z.string()),
  contribution_paths: z.array(z.string()),
  links: z.record(z.string(), z.string())
}).passthrough();

export const AgentManifestOutputSchema = z.object({
  project: z.string(),
  mcp_name: z.string(),
  client: AgentClientSchema,
  unofficial: z.boolean(),
  package: z.object({
    name: z.string(),
    version: z.string(),
    install_command: z.string(),
    pinned_install_command: z.string(),
    binary: z.string()
  }).strict(),
  auth: z.object({
    provider: z.string(),
    grant_type: z.string(),
    credentials: z.array(z.string()),
    token_storage: z.string(),
    secret_storage: z.string()
  }).strict(),
  recommended_first_calls: z.array(z.string()),
  standard_tools: z.array(z.string()),
  mutation_tools: z.array(z.string()),
  hermes: z.object({
    config_path: z.string(),
    skill_path: z.string(),
    tool_name_prefix: z.string(),
    common_tool_names: z.array(z.string()),
    recommended_config: z.string(),
    doctor_command: z.string()
  }).strict(),
  agent_rules: z.array(z.string()),
  troubleshooting: z.array(z.object({ symptom: z.string(), action: z.string() }).strict()),
  links: z.record(z.string(), z.string())
}).strict();

export const ConnectionStatusOutputSchema = z.object({
  ok: z.boolean(),
  ready_for_eight_sleep_api: z.boolean(),
  client: AgentClientSchema.optional(),
  node: z.object({ version: z.string(), supported: z.boolean() }).strict(),
  privacy_mode: PrivacyModeValueSchema,
  required_env: z.record(z.string(), z.boolean()),
  missing_env: z.array(z.string()),
  mutations_enabled: z.boolean(),
  config: z.object({
    source: z.enum(["env", "local_config", "mixed", "missing"]),
    path: z.string(),
    exists: z.boolean(),
    secure_permissions: z.boolean().optional(),
    error: z.string().optional()
  }).strict(),
  token: z.object({
    path: z.string(),
    exists: z.boolean(),
    readable: z.boolean(),
    permissions: z.string().optional(),
    secure_permissions: z.boolean().optional(),
    expires_at: z.number().optional(),
    expired: z.boolean().optional(),
    error: z.string().optional()
  }).strict(),
  cache: z.object({ enabled: z.boolean(), path: z.string() }).strict(),
  next_steps: z.array(z.string())
}).strict();

export const DataInventoryOutputSchema = z.object({
  kind: z.literal("data_inventory"),
  source: z.string(),
  mcp_name: z.string(),
  generated_at: z.string(),
  unofficial: z.boolean(),
  data_access_model: z.string(),
  api_boundary: z.unknown().optional(),
  privacy_modes: z.array(z.unknown()),
  categories: z.array(z.object({
    name: z.string(),
    examples: z.array(z.string()),
    tools: z.array(z.string())
  }).strict()),
  mutations: z.array(z.unknown()),
  totals: z.object({
    categories: z.number().int().nonnegative(),
    listed_tools: z.number().int().nonnegative()
  }).strict(),
  first_tools: z.array(z.string()),
  recommended_agent_flow: z.array(z.string()),
  links: z.record(z.string(), z.string()),
  notes: z.array(z.string())
}).strict();

export type SimpleReadInput = z.infer<typeof SimpleReadInputSchema>;
export type ResponseOnlyInput = z.infer<typeof ResponseOnlyInputSchema>;
export type AgentManifestInput = z.infer<typeof AgentManifestInputSchema>;
export type UserIdInput = z.infer<typeof UserIdInputSchema>;
export type TrendsInput = z.infer<typeof TrendsInputSchema>;
export type SetTemperatureInput = z.infer<typeof SetTemperatureInputSchema>;
export type SetSideInput = z.infer<typeof SetSideInputSchema>;
export type SetAwayModeInput = z.infer<typeof SetAwayModeInputSchema>;
export type AlarmActionInput = z.infer<typeof AlarmActionInputSchema>;
