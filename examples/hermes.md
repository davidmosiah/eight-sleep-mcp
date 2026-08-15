# Hermes / local agent setup

This server runs over MCP stdio. Add it to your agent's MCP configuration using a local Node command.

```yaml
mcp_servers:
  eight_sleep:
    command: npx
    args:
      - -y
      - "eight-sleep-mcp-unofficial"
```

Recommended first run:

1. Run `eight-sleep-mcp-server setup --client hermes`.
2. Run `eight-sleep-mcp-server login`.
3. Ask Hermes to call `eight_sleep_connection_status`.
4. Call `eight_sleep_nightly_summary` or `eight_sleep_get_trends`.

Keep `EIGHT_SLEEP_CLIENT_SECRET`, `EIGHT_SLEEP_PASSWORD`, and `EIGHT_SLEEP_TOKEN_PATH` out of prompts, logs and public repos. `setup` stores secrets in the local Eight Sleep MCP config instead of this agent config.
