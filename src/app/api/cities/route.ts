import { NextResponse } from "next/server";
import { getMcpClient } from "@/lib/mcp";

export async function GET() {
  try {
    const client = await getMcpClient();
    const result = await client.callTool({
      name: "kapruka_list_delivery_cities",
      arguments: { 
        params: { response_format: "json" } // CRITICAL FIX: Python strict validation
      }
    });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = (result.content as any)?.[0]?.text;
    let cities = [];
    
    try {
      cities = content ? JSON.parse(content) : [];
    } catch (parseError) {
      console.error("JSON Parse Error. Raw Kapruka response:", content);
    }
    
    return NextResponse.json({ cities });
  } catch (error) {
    console.error("[CITIES API ERROR]:", error);
    return NextResponse.json({ cities: [] }, { status: 500 });
  }
}
