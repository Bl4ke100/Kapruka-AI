async function testChat() {
  console.log("Sending request to Kapruka AI Agent...");
  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Find me a chocolate cake" }]
      })
    });

    if (!res.ok) {
      console.error("HTTP Error:", res.status, await res.text());
      process.exit(1);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    console.log("Receiving stream...");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      process.stdout.write(chunk);
    }
    console.log("\n\nTest completed successfully!");
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

testChat();
