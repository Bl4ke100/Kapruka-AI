import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["-y", "mcp-remote", "https://mcp.kapruka.com/mcp"],
    env: { ...process.env, npm_config_cache: "/tmp/.npm" }
  });
  
  const client = new Client({ name: "kapruka-agent", version: "1.0.0" }, { capabilities: { tools: {} } as any });
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
  process.exit(0);
}
run();
