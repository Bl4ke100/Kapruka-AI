import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { getKaprukaTools } from "@/lib/mcp";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const language = body.language || 'English';

  // Vercel AI SDK might send an array directly, or an object with a messages property
  const rawMessages = Array.isArray(body) ? body : body.messages || [];
  console.log("=== RAWMESSAGES ===");
  console.dir(rawMessages, { depth: null });
  console.log("===================");

  // Robustly convert @ai-sdk/react v3/v4 format to ai v6 CoreMessage format
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const messages = rawMessages.reduce((acc: any[], msg: any) => {
    if (msg.role === 'user' || msg.role === 'system') {
      const textContent = msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text) || "";
      acc.push({ role: msg.role, content: textContent });
    } else if (msg.role === 'assistant') {
      // ONLY look for completed tool results to prevent Gemini 400 errors
      const toolResults = msg.toolInvocations?.filter((t: any) => t.state === 'result') || [];

      if (toolResults.length > 0) {
        // 1. Push assistant turn containing the completed tool calls
        acc.push({
          role: 'assistant',
          content: toolResults.map((t: any) => ({
            type: 'tool-call',
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            args: t.args
          }))
        });

        // 2. Push the corresponding tool results
        acc.push({
          role: 'tool',
          content: toolResults.map((t: any) => ({
            type: 'tool-result',
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            result: t.result
          }))
        });

        // 3. Push final text
        const textContent = msg.content || (msg.parts?.find((p: any) => p.type === 'text')?.text) || "";
        if (textContent) {
          acc.push({ role: 'assistant', content: textContent });
        }
      } else {
        // No completed tool calls, just normal text
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

  // Search Tool Interceptor & Fallback Loop
  if (tools.kapruka_search_products) {
    const originalSearchExecute = tools.kapruka_search_products.execute;
    tools.kapruka_search_products.execute = async (args: any, context: any) => {
      let query = args.q || "";

      // 1. Query Expansion for generic words
      const genericMap: Record<string, string> = {
        "cake": "birthday cake",
        "cakes": "kapruka cakes",
        "gift": "gift basket",
        "gifts": "gift hampers",
        "flower": "fresh flowers",
        "flowers": "fresh flowers",
        "chocolate": "chocolate box"
      };

      const normalizedQuery = query.trim().toLowerCase();
      if (genericMap[normalizedQuery]) {
        query = genericMap[normalizedQuery];
      }

      console.log("[KAPRUKA SEARCH] First Attempt:", query);
      let response = await originalSearchExecute({ ...args, q: query }, context);

      // 2. Fallback Loop
      if (response && Array.isArray(response.results) && response.results.length === 0) {
        console.log(`[KAPRUKA SEARCH] Empty results for '${query}'. Triggering fallback loop...`);

        let fallbackQuery = "gift basket";
        if (query.toLowerCase().includes("cake")) fallbackQuery = "gateau";
        if (query.toLowerCase().includes("flower") || query.toLowerCase().includes("rose")) fallbackQuery = "kapruka roses";

        console.log(`[KAPRUKA SEARCH] Retrying with fallback: '${fallbackQuery}'`);
        response = await originalSearchExecute({ ...args, q: fallbackQuery }, context);
      }

      console.log("[KAPRUKA SEARCH] Final Response Length:", response?.results?.length || 0, response);
      return response;
    };
  }

  // Delivery Tool Error Handler
  if (tools.kapruka_check_delivery) {
    const originalDeliveryExecute = tools.kapruka_check_delivery.execute;
    tools.kapruka_check_delivery.execute = async (args: any, context: any) => {
      console.log("[DELIVERY CHECK ARGS]:", args);

      const sanitizedArgs = { ...args };

      // CRITICAL FIX: The SDK schema exposes 'date', but Kapruka strictly needs 'delivery_date'.
      // We safely map it here so Gemini doesn't fail Zod validation!
      if (sanitizedArgs.date && !sanitizedArgs.delivery_date) {
        sanitizedArgs.delivery_date = sanitizedArgs.date;
        delete sanitizedArgs.date; // Remove the invalid key before hitting Kapruka
      }

      try {
        const rawResponse = await originalDeliveryExecute(sanitizedArgs, context);
        console.log("[MCP DELIVERY RAW RESPONSE]:", rawResponse);
        const result = rawResponse;
        
        if (typeof result === 'string' && result.includes('Error')) {
          console.error("[TOOL VALIDATION ERROR]:", result);
          return { error: true, message: "Delivery check validation failed.", details: result };
        }
        return result;
      } catch (error) {
        console.error("[TOOL ERROR] kapruka_check_delivery:", error);
        return {
          error: true,
          message: "The Kapruka API failed to check delivery.",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    };
  }

  // Checkout Tool Error Handler
  if (tools.kapruka_create_order) {
    const originalCheckoutExecute = tools.kapruka_create_order.execute;
    tools.kapruka_create_order.execute = async (args: any, context: any) => {
      try {
        // CRITICAL FIX: Sanitize args to prevent Pydantic extra_forbidden errors
        const sanitizedArgs = JSON.parse(JSON.stringify(args));
        if (sanitizedArgs.sender?.phone) delete sanitizedArgs.sender.phone;
        if (sanitizedArgs.params?.sender?.phone) delete sanitizedArgs.params.sender.phone;

        console.log("[CHECKOUT ARGS]:", sanitizedArgs);
        const res = await originalCheckoutExecute(sanitizedArgs, context);
        console.log("[MCP CHECKOUT RAW RESPONSE]:", res);
        return res;
      } catch (error) {
        console.error("[TOOL ERROR] kapruka_create_order:", error);
        return {
          error: true,
          message: "The Kapruka API failed to create the order.",
          details: error instanceof Error ? error.message : "Unknown error"
        };
      }
    };
  }

  // Tracking Tool Error Handler
  if (tools.kapruka_track_order) {
    const originalTrackExecute = tools.kapruka_track_order.execute;
    tools.kapruka_track_order.execute = async (args: any, context: any) => {
      try {
        // Extract the ID regardless of what Gemini named the key to bypass Zod crashes
        const rawId = args.order_id || args.order_number || args.id || (args.params ? Object.values(args.params)[0] : Object.values(args)[0]);
        const sanitizedArgs = { params: { order_number: rawId } };

        console.log("[TRACK ORDER ARGS]:", sanitizedArgs);
        const res = await originalTrackExecute(sanitizedArgs, context);
        console.log("[MCP TRACK RAW]:", res);
        return res;
      } catch (error) {
        console.error("[TOOL ERROR]:", error);
        return { error: true, message: "Failed to track." };
      }
    };
  }

  const system = `# MISSION
You are a minimalist, lightning-fast, and highly accurate AI shopping assistant for Kapruka (Sri Lanka's largest e-commerce platform). Your goal is to guide users to the perfect product and confidently trigger the interactive UI carousel using tools.

CRITICAL STATE OVERRIDE 1 (SELECT): If the user's message starts with \`[ACTION: SELECT_PRODUCT]\`, they chose an item. You are STRICTLY FORBIDDEN from executing ANY tools (including \`kapruka_search_products\` or \`kapruka_get_product\`). Your ONLY action is to instantly reply with plain text asking for their Delivery City and Date. You MUST secretly save the exact ID provided in the tag.
CRITICAL STATE OVERRIDE 2 (DELIVERY): If the user's message starts with \`[ACTION: CHECK_DELIVERY]\`, they gave delivery info. You are STRICTLY FORBIDDEN from being silent or executing search tools. You MUST reply with the exact text "Checking delivery availability..." AND instantly execute the \`kapruka_check_delivery\` tool using the \`product_id\` (from step 1), \`city\`, and \`delivery_date\` (YYYY-MM-DD).
CRITICAL STATE OVERRIDE 3 (CHECKOUT): If the user's message starts with \`[ACTION: PROCEED_TO_CHECKOUT]\`, delivery is confirmed. You are STRICTLY FORBIDDEN from executing ANY tools. Your ONLY permitted action is to reply with standard text asking for the 3 final details: 1. Recipient Name & Phone, 2. Sender Name (ONLY name, no phone), 3. A short gift message.
CRITICAL STATE OVERRIDE 4 (SUBMIT): If the user's message starts with \`[ACTION: SUBMIT_ORDER_DETAILS]\`, THEY HAVE PROVIDED ALL FINAL ORDER DETAILS. You are STRICTLY FORBIDDEN from being silent. You MUST reply with the exact text "Generating your secure Kapruka checkout link..." AND instantly execute the \`kapruka_create_order\` tool. To get the required ID for this tool, use the exact ID that was provided in the \`[ACTION: SELECT_PRODUCT]\` tag in the chat history.
CRITICAL STATE OVERRIDE 5 (TRACKING): If the user asks to track an order but DOES NOT provide an order number, you are STRICTLY FORBIDDEN from executing any tools. Your ONLY action is to reply with text asking for the order number. If the user DOES provide an order number, you MUST reply with the exact text "Locating your order..." AND instantly execute the kapruka_track_order tool using that number.

# MANDATORY CONVERSATIONAL WORKFLOW
You must strictly follow this exact turn-by-turn sequence with the user. Do not skip steps.

1. WELCOME: Greet the user casually and ask what they are looking for.
2. GATHER REQUIREMENTS: Once the user states an interest, DO NOT search yet. You must first ask for the specific details needed to make a good recommendation:
   - Who is the recipient? (e.g., Mom, friend, kid)
   - What is the specific occasion? (e.g., Mother's Day, birthday)
   - What is their maximum budget in LKR? (e.g., 10,000 LKR)
3. THE SEARCH TRIGGER: Only after the user provides these details, state exactly one sentence confirming you are searching (e.g., "Looking for the perfect art gifts for your mom within 10,000 LKR now..."). Then, immediately execute the \`kapruka_search_products\` tool.
4. SELECTION & DELIVERY CHECK: When the user selects a product from the carousel, immediately ask for their Delivery City and Date.
   - Use \`kapruka_list_delivery_cities\` if you need to resolve a vernacular city name.
   - Execute \`kapruka_check_delivery\` to confirm delivery is possible and get the shipping rate.
5. ORDER DETAILS: Once delivery is confirmed, ask the user for the final required details in one friendly message:
   - Recipient Name & Phone Number
   - Sender Name
   - A short Gift Message
6. CHECKOUT EXECUTION: Once all details are gathered, explicitly state "Generating your secure Kapruka checkout link..." and instantly execute the \`kapruka_create_order\` tool.
   - NEVER output the raw URL in text. Rely on the frontend to render the payment button from your tool call.

CRITICAL POST-DELIVERY RULE: When the \`kapruka_check_delivery\` tool returns a successful result, you MUST NOT just confirm the delivery and stop. In the EXACT SAME MESSAGE where you confirm delivery is possible, you MUST proactively ask the user for: 1. Recipient Name & Phone, 2. Sender Name, 3. A short gift message.

CRITICAL CHECKOUT RULE: The moment the user provides those final details, you MUST immediately execute the \`kapruka_create_order\` tool. Do not ask for further confirmation. Execute the tool and tell the user you are generating their payment link.

# OUTPUT INTERACTION FORMAT & CAROUSEL RULES
- CRITICAL: Never summarize, describe, or list product options using raw text or markdown lists. 
- You must rely 100% on the frontend UI to render the visual product carousel directly from your tool call payload.
- CRITICAL GUIDANCE RULE: Whenever you execute \`kapruka_search_products\` and return a list of items, you MUST explicitly tell the user how to select one. Do not just list the items and stop. Always end your text message BEFORE the tool call with a clear, friendly instruction like: 'Swipe through these options and tell me the exact name of the one you want to order!'
- CRITICAL DELIVERY RULE: Use the exact parameter names defined in the schema. Execute the delivery check tool silently.
- CRITICAL CHECKOUT TRANSITION: Once you have successfully executed \`kapruka_check_delivery\` for an item, YOU ARE STRICTLY FORBIDDEN from running it again for that same item. When the user agrees to proceed, your ONLY permitted action is to reply with text asking for the 3 final details (Recipient Name/Phone, Sender Name/Phone, Gift Message). DO NOT execute any tools until you have all 3 of those details.

# OPERATIONAL PROTOCOLS (TOKEN HYGIENE)
1. TOOL EXECUTION GUARDRAIL: Before calling \`kapruka_search_products\`, you MUST check the chat history. If your previous action was returning a list of products, and the user's message is selecting one of those products (e.g., 'I want the mug', 'Get me the first one', or typing the exact product name), YOU ARE STRICTLY FORBIDDEN from calling the search tool again. Your ONLY permitted action is to reply with text asking for the Delivery City and Date to advance the checkout flow.
2. Pass \`limit=6\` to every single product search tool call. Never request a large list.
2. If a tool returns a validation or network error, DO NOT retry with modified arguments. Report the failure to the user instantly in one short sentence.
3. Stop execution loops instantly if a single user turn requires more than 2 consecutive tool calls.
4. Keep all conversational text ultra-concise. No corporate filler, no elongated pleasantries.
5. CRITICAL SEARCH RULE: When using \`kapruka_search_products\`, NEVER use generic single words like 'cake' or 'gift'. You MUST extract 2-3 highly descriptive keywords based on the user's exact request (e.g., use 'kids birthday cake', 'superhero cake', or 'chocolate ribbon cake'). NEVER use the \`category\` parameter, as guessing the wrong exact-match string will cause the search to fail completely.
6. CRITICAL FALLBACK RULE: If your first search returns an empty array, DO NOT tell the user no products were found. You MUST automatically execute a second search using a slightly different keyword variation.

# BOUNDARIES & SCOPE
- You are strictly a shopping agent for Kapruka. 
- If the user asks about completely unrelated topics (e.g., coding, complex math, global politics), politely decline and gently steer them back to finding a gift or product on Kapruka.
- Support casual English, Tanglish, and Sinhala if initiated by the user.`;

  let languageRule = "";
  if (language === "Sinhala") {
    languageRule = "\n\nCRITICAL LANGUAGE RULE: You must respond to the user exclusively in Sinhala, using the Sinhala alphabet. NEVER use literal, word-for-word robotic translations. Instead, use highly meaningful, culturally natural, and conversational Sinhala typical of friendly Sri Lankan customer service. Even for mandatory system phrases like 'Locating your order...', 'Checking delivery availability...', and 'Generating your secure Kapruka checkout link...', you MUST translate them into natural, conversational Sinhala.";
  } else if (language === "Tamil" || language === "Tanglish") {
    languageRule = "\n\nCRITICAL LANGUAGE RULE: You must respond to the user in Tanglish (conversational Sri Lankan English mixed with Tamil phrasing). NEVER use literal, word-for-word translations. Instead, use meaningful, culturally natural, and casual Tanglish expressions. Even for mandatory system phrases like 'Locating your order...', 'Checking delivery availability...', and 'Generating your secure Kapruka checkout link...', you MUST translate them into natural Tanglish.";
  }

  const finalSystemPrompt = system + languageRule;

  const recentMessages = messages.slice(-15);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    messages: recentMessages,
    system: finalSystemPrompt,
    tools,
    maxSteps: 5, // CRITICAL: Forces the server to execute the tracking tool
  });

  return result.toUIMessageStreamResponse();
}
