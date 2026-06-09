import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Starting npx mcp-remote...");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "mcp-remote", "https://mcp.kapruka.com/mcp"]
  });
  
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  console.log("Connecting...");
  await client.connect(transport);
  console.log("Connected");
  const tools = await client.listTools();
  console.log(JSON.stringify(tools, null, 2));
  process.exit(0);
}

main().catch(console.error);
