---
name: eight-sleep
description: >
  Unofficial Eight Sleep pod data for AI agents. Writes stay fail-closed. Prefer MCP tools if connected; otherwise the package CLI.
  Use when the user wants Eight Sleep data or actions through an agent.
---

# Eight Sleep — skill or MCP

Same binary either way. Do not duplicate the API client.

## Choose a surface

**MCP** — tools appear natively after stdio/HTTP config:

```json
{ "mcpServers": { "eight-sleep": { "command": "npx", "args": ["-y", "eight-sleep-mcp-unofficial"] } } }
```

Do not put mutation flags in that snippet.

**Skill / CLI** — no MCP client required. Same tools:

```bash
npx -y eight-sleep-mcp-unofficial call eight_sleep_connection_status --json '{}'
```

If MCP tools named `eight_*` are already available, use them. Do not also shell out.

## Loop

1. Call `eight_sleep_connection_status` (or `doctor --json` when that exists).
2. Use read tools as asked.
3. Stop on `USER_ACTION_REQUIRED`. Do not invent env flags. Do not enable mutations from this skill.

## Never

- Paste tokens into git, chat logs, or the prompt
- Copy a mutations-enabled assignment into config
