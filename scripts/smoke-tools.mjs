import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const expectedTools = [
  'eight_sleep_agent_manifest',
  'eight_sleep_cache_status',
  'eight_sleep_capabilities',
  'eight_sleep_connection_status',
  'eight_sleep_data_inventory',
  'eight_sleep_dismiss_alarm',
  'eight_sleep_efficiency',
  'eight_sleep_get_alarms',
  'eight_sleep_get_base',
  'eight_sleep_get_current_device',
  'eight_sleep_get_me',
  'eight_sleep_get_temperature',
  'eight_sleep_get_trends',
  'eight_sleep_get_user',
  'eight_sleep_logout',
  'eight_sleep_nightly_summary',
  'eight_sleep_onboarding',
  'eight_sleep_privacy_audit',
  'eight_sleep_profile_get',
  'eight_sleep_profile_update',
  'eight_sleep_set_away_mode',
  'eight_sleep_set_side',
  'eight_sleep_set_temperature',
  'eight_sleep_snooze_alarm',
  'eight_sleep_temperature_trend',
  'eight_sleep_wellness_context'
];

const expectedResources = [
  'eight-sleep://agent-manifest',
  'eight-sleep://capabilities',
  'eight-sleep://inventory'
];

const expectedPrompts = [
  'eight_sleep_bedtime_temperature_plan',
  'eight_sleep_morning_alarm_check',
  'eight_sleep_nightly_review'
];

const client = new Client({ name: 'eight-sleep-mcp-smoke-test', version: '0.0.0' });
const homeDir = mkdtempSync(join(tmpdir(), 'eight-sleep-mcp-smoke-'));
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/index.js'],
  env: {
    ...process.env,
    HOME: homeDir,
    EIGHT_SLEEP_EMAIL: '',
    EIGHT_SLEEP_PASSWORD: '',
    EIGHT_SLEEP_TOKEN_PATH: join(homeDir, '.eight-sleep-mcp', 'tokens.json'),
    EIGHT_SLEEP_CACHE_PATH: join(homeDir, '.eight-sleep-mcp', 'cache.sqlite')
  }
});
await client.connect(transport);
try {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, expectedTools.sort());

  const resources = await client.listResources();
  const resourceUris = resources.resources.map((resource) => resource.uri).sort();
  assert.deepEqual(resourceUris, expectedResources.sort());

  const prompts = await client.listPrompts();
  const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();
  assert.deepEqual(promptNames, expectedPrompts.sort());

  const auditResult = await client.callTool({
    name: 'eight_sleep_privacy_audit',
    arguments: { response_format: 'json' }
  });
  assert.equal(auditResult.structuredContent?.unofficial, true);
  assert.ok(['env', 'local_config', 'mixed', 'missing'].includes(auditResult.structuredContent?.config_source));
  assert.ok(auditResult.structuredContent?.secret_env_vars?.includes('EIGHT_SLEEP_PASSWORD'));

  const capabilitiesResult = await client.callTool({
    name: 'eight_sleep_capabilities',
    arguments: { response_format: 'json' }
  });
  assert.equal(capabilitiesResult.structuredContent?.unofficial, true);
  assert.ok(capabilitiesResult.structuredContent?.mutations?.length >= 4);
  assert.ok(capabilitiesResult.structuredContent?.recommended_agent_flow?.some((step) => step.includes('eight_sleep_connection_status')));

  const inventoryResult = await client.callTool({ name: 'eight_sleep_data_inventory', arguments: { response_format: 'json' } });
  assert.equal(inventoryResult.structuredContent?.kind, 'data_inventory');
  assert.equal(typeof inventoryResult.structuredContent?.source, 'string');

  const manifestResult = await client.callTool({
    name: 'eight_sleep_agent_manifest',
    arguments: { client: 'hermes', response_format: 'json' }
  });
  assert.equal(manifestResult.structuredContent?.client, 'hermes');
  assert.ok(manifestResult.structuredContent?.hermes?.common_tool_names?.some((name) => name.includes('eight_sleep')));

  const statusResult = await client.callTool({
    name: 'eight_sleep_connection_status',
    arguments: { client: 'hermes', response_format: 'json' }
  });
  assert.equal(statusResult.structuredContent?.ok, false);
  assert.ok(statusResult.structuredContent?.missing_env?.includes('EIGHT_SLEEP_EMAIL'));
  assert.equal(statusResult.structuredContent?.mutations_enabled, false);

  console.log(JSON.stringify({
    ok: true,
    tools: toolNames.length,
    resources: resourceUris.length,
    prompts: promptNames.length
  }, null, 2));
} finally {
  await client.close();
}
