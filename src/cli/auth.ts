import { getConfig } from "../services/config.js";
import { EightSleepClient } from "../services/eight-sleep-client.js";

export async function runAuthCommand(args: string[]): Promise<number> {
  const json = args.includes("--json");
  try {
    const config = getConfig();
    const client = new EightSleepClient(config);
    const token = await client.ensureLogin();
    const output = {
      ok: true,
      token_path: config.tokenPath,
      expires_at: token.expires_at,
      user_id: token.user_id,
      next_step: "Run `eight-sleep-mcp-server doctor` or add this MCP to your agent and call eight_sleep_get_me."
    };
    if (json) console.log(JSON.stringify(output, null, 2));
    else {
      console.log("Eight Sleep MCP · Login");
      console.log("");
      console.log("✓ Logged in");
      console.log("");
      console.log(`  Token file:  ${output.token_path}`);
      if (output.expires_at) console.log(`  Expires at:  ${new Date(output.expires_at * 1000).toISOString()}`);
      if (output.user_id) console.log(`  User id:     ${output.user_id}`);
      console.log("");
      console.log(`→ Next: ${output.next_step}`);
    }
    return 0;
  } catch (error) {
    if (json) console.log(JSON.stringify({ ok: false, error: (error as Error).message }, null, 2));
    else console.error(`Login failed: ${(error as Error).message}`);
    return 1;
  }
}
