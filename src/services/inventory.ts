import { buildCapabilities } from "./capabilities.js";

export function buildDataInventory() {
  const capabilities = buildCapabilities();
  const categories = capabilities.supported_data.map((category) => ({
    name: category.name,
    examples: category.examples,
    tools: category.tools
  }));
  const tools = [...new Set(categories.flatMap((category) => category.tools))].sort();

  return {
    kind: "data_inventory" as const,
    source: capabilities.project,
    mcp_name: capabilities.mcp_name,
    generated_at: new Date().toISOString(),
    unofficial: capabilities.unofficial,
    data_access_model: "unofficial_mobile_app_api",
    api_boundary: capabilities.api_boundary,
    privacy_modes: capabilities.privacy_modes,
    categories,
    mutations: capabilities.mutations,
    totals: {
      categories: categories.length,
      listed_tools: tools.length
    },
    first_tools: [
      "eight_sleep_connection_status",
      "eight_sleep_get_me",
      "eight_sleep_nightly_summary",
      "eight_sleep_wellness_context"
    ],
    recommended_agent_flow: capabilities.recommended_agent_flow,
    links: capabilities.links,
    notes: [
      "This inventory is static MCP metadata and does not call the Eight Sleep API.",
      "Always call eight_sleep_connection_status first to confirm credentials and token state.",
      "Use raw privacy mode only when the user explicitly asks for upstream payloads.",
      "Mutation tools are gated by EIGHT_SLEEP_ALLOW_MUTATIONS=true; default is read-only."
    ]
  };
}

export function formatInventoryMarkdown(inventory: ReturnType<typeof buildDataInventory>): string {
  const categoryLines = inventory.categories.map((category) => `- **${category.name}**: ${category.tools.join(", ") || "no direct tool listed"}`);
  return [
    "# Eight Sleep Data Inventory",
    "",
    `- **source**: ${inventory.source}`,
    `- **categories**: ${inventory.totals.categories}`,
    `- **listed_tools**: ${inventory.totals.listed_tools}`,
    `- **mutations**: ${inventory.mutations.length} (gated by EIGHT_SLEEP_ALLOW_MUTATIONS)`,
    "",
    "## Categories",
    ...categoryLines
  ].join("\n");
}
