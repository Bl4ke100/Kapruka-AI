import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool as aiTool, jsonSchema } from "ai";

export async function getMcpClient() {
  const transport = new StdioClientTransport({
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["-y", "mcp-remote", "https://mcp.kapruka.com/mcp"],
    env: {
      ...process.env,
      npm_config_cache: "/tmp/.npm" 
    }
  });
  
  const client = new Client(
    { name: "kapruka-agent", version: "1.0.0" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { capabilities: { tools: {} } as any }
  );
  
  await client.connect(transport);
  return client;
}

export async function getKaprukaTools() {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiTools: Record<string, any> = {};
  
  for (const t of tools) {
    aiTools[t.name] = aiTool({
      description: t.description || "",
      parameters: jsonSchema(t.inputSchema),
      // @ts-expect-error ai sdk tool signature mismatch with any
      execute: async (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalArgs: any = {};
        
        // FastMCP tools typically expect arguments to be nested inside a 'params' object.
        // However, the advertised schema might be flattened depending on the model/generator.
        // We force-wrap the arguments into a 'params' object if they aren't already.
        if (args && !args.params) {
          finalArgs.params = { ...args };
        } else {
          Object.assign(finalArgs, args);
        }
        
        // Ensure response_format is injected for Kapruka API endpoints to return JSON
        if (finalArgs.params) {
          finalArgs.params.response_format = "json";
        } else {
          finalArgs.response_format = "json";
        }

        try {
          const result = await client.callTool({
            name: t.name,
            arguments: finalArgs as Record<string, unknown>
          });
          
          const content = result.content as any;
          if (content && content.length > 0 && content[0].type === "text") {
            try {
              return JSON.parse(content[0].text);
            } catch {
              return content[0].text;
            }
          }
          return result;
        } catch (error) {
          console.error(`Error executing tool ${t.name}:`, error);
          return { error: `Failed to execute ${t.name}. The Kapruka API took too long to respond or encountered an error.` };
        }
      }
    });
  }
  
  return aiTools;
}
