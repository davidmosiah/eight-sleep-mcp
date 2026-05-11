import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildAgentManifest, formatAgentManifestMarkdown } from "../services/agent-manifest.js";
import { buildCapabilities } from "../services/capabilities.js";
import { buildDataInventory } from "../services/inventory.js";

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2)
    }]
  };
}

function textResource(uri: URL, text: string) {
  return {
    contents: [{
      uri: uri.toString(),
      mimeType: "text/markdown",
      text
    }]
  };
}

export function registerEightSleepResources(server: McpServer): void {
  server.registerResource(
    "eight_sleep_data_inventory",
    "eight-sleep://inventory",
    {
      title: "Eight Sleep Data Inventory",
      description: "Static inventory of supported Eight Sleep domains, mutation tools and privacy modes.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildDataInventory())
  );

  server.registerResource(
    "eight_sleep_agent_manifest",
    "eight-sleep://agent-manifest",
    {
      title: "Eight Sleep Agent Manifest",
      description: "Machine-readable install and operating instructions for AI agents.",
      mimeType: "text/markdown"
    },
    async (uri) => textResource(uri, formatAgentManifestMarkdown(buildAgentManifest("generic")))
  );

  server.registerResource(
    "eight_sleep_capabilities_resource",
    "eight-sleep://capabilities",
    {
      title: "Eight Sleep MCP Capabilities",
      description: "Static capabilities, data boundary, privacy modes, mutation tools and recommended flow.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, buildCapabilities())
  );
}
