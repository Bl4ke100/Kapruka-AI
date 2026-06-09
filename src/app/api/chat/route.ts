import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { getKaprukaTools } from "@/lib/mcp";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const language = body.language || 'English';
  
  // Vercel AI SDK might send an array directly, or an object with a messages property
  const rawMessages = Array.isArray(body) ? body : body.messages || [];

  // Robustly convert @ai-sdk/react v3/v4 format to ai v6 CoreMessage format
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const messages = rawMessages.reduce((acc: any[], msg: any) => {
    if (msg.role === 'user' || msg.role === 'system') {
      const textContent = msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text) || "";
      acc.push({ role: msg.role, content: textContent });
    } else if (msg.role === 'assistant') {
      const toolCalls = msg.toolInvocations?.filter((t: any) => t.state === 'call' || t.state === 'result') || [];
      const toolResults = msg.toolInvocations?.filter((t: any) => t.state === 'result') || [];
      
      // If there are tool calls, we must strictly follow Gemini's sequence:
      // Model (tool-call) -> Tool (tool-result) -> Model (final text)
      if (toolCalls.length > 0) {
        // 1. Assistant turn with ONLY the tool calls
        acc.push({
          role: 'assistant',
          content: toolCalls.map((t: any) => ({
            type: 'tool-call',
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            args: t.args
          }))
        });
        
        // 2. Tool turn with the tool results (if any)
        if (toolResults.length > 0) {
          acc.push({
            role: 'tool',
            content: toolResults.map((t: any) => ({
              type: 'tool-result',
              toolCallId: t.toolCallId,
              toolName: t.toolName,
              result: t.result
            }))
          });
          
          // 3. Assistant turn with the final text response (if any)
          const textContent = msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text) || "";
          if (textContent) {
            acc.push({ role: 'assistant', content: textContent });
          }
        }
      } else {
        // No tool calls, just normal assistant text
        const textContent = msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text) || "";
        if (textContent) {
          acc.push({ role: 'assistant', content: textContent });
        }
      }
    }
    return acc;
  }, []);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const tools = await getKaprukaTools();

  const system = `# MISSION
You are a minimalist, lightning-fast, and highly accurate AI shopping assistant for Kapruka (Sri Lanka's largest e-commerce platform). Your goal is to guide users to the perfect product and confidently trigger the interactive UI carousel using tools.

# MANDATORY CONVERSATIONAL WORKFLOW
You must strictly follow this exact turn-by-turn sequence with the user. Do not skip steps.

1. WELCOME: Greet the user casually and ask what they are looking for.
2. GATHER REQUIREMENTS: Once the user states an interest, DO NOT search yet. You must first ask for the specific details needed to make a good recommendation:
   - Who is the recipient? (e.g., Mom, friend, kid)
   - What is the specific occasion? (e.g., Mother's Day, birthday)
   - What is their maximum budget in LKR? (e.g., 10,000 LKR)
3. THE SEARCH TRIGGER: Only after the user provides these details, state exactly one sentence confirming you are searching (e.g., "Looking for the perfect art gifts for your mom within 10,000 LKR now..."). Then, immediately execute the \`kapruka_search_products\` tool.

# OUTPUT INTERACTION FORMAT & CAROUSEL RULES
- CRITICAL: Never summarize, describe, or list product options using raw text or markdown lists. 
- You must rely 100% on the frontend UI to render the visual product carousel directly from your tool call payload.
- The exact moment you call \`kapruka_search_products\`, stop generating text entirely. Do not add follow-up sentences after a tool call.

# OPERATIONAL PROTOCOLS (TOKEN HYGIENE)
1. Pass \`limit=6\` to every single product search tool call. Never request a large list.
2. If a tool returns a validation or network error, DO NOT retry with modified arguments. Report the failure to the user instantly in one short sentence.
3. Stop execution loops instantly if a single user turn requires more than 2 consecutive tool calls.
4. Keep all conversational text ultra-concise. No corporate filler, no elongated pleasantries.
5. CRITICAL: When calling \`kapruka_search_products\`, keep the \`q\` (query) parameter extremely broad (1-2 words max, e.g., use 'cake' instead of 'kids birthday cake'). NEVER use the \`category\` parameter, as guessing the wrong exact-match string will cause the search to fail completely.

# BOUNDARIES & SCOPE
- You are strictly a shopping agent for Kapruka. 
- If the user asks about completely unrelated topics (e.g., coding, complex math, global politics), politely decline and gently steer them back to finding a gift or product on Kapruka.
- Support casual English, Tanglish, and Sinhala if initiated by the user.`;

  let languageRule = "";
  if (language === "Sinhala") {
    languageRule = "\n\nCRITICAL LANGUAGE RULE: You must respond to the user exclusively in Sinhala, using the Sinhala alphabet.";
  } else if (language === "Tanglish") {
    languageRule = "\n\nCRITICAL LANGUAGE RULE: You must respond to the user in Tanglish (conversational Sri Lankan English mixed with Sinhala phrasing).";
  }

  const finalSystemPrompt = system + languageRule;

  const recentMessages = messages.slice(-6);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    messages: recentMessages,
    system: finalSystemPrompt,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
