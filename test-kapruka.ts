import { getKaprukaTools } from './src/lib/mcp.js';

async function main() {
  console.log("Connecting to Kapruka MCP...");
  const tools = await getKaprukaTools();
  console.log("Successfully retrieved tools!");
  
  if (tools['kapruka_search_products']) {
    console.log("Testing kapruka_search_products for 'chocolate cake'...");
    const result = await tools['kapruka_search_products'].execute({
      q: 'chocolate cake',
      limit: 3
    });
    console.log("Result from Kapruka:");
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("kapruka_search_products tool not found!");
  }
  process.exit(0);
}

// Since src/lib/mcp is in TS, we need to run via tsx or similar.
// We can use tsx since Next.js sets up the environment, but tsx isn't installed globally.
// I'll just write it and run it using npx tsx.
main().catch(console.error);
