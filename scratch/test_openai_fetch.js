const key = "chatgptkey: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";

async function run() {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helper." },
      { role: "user", content: "Say CONNECTED" }
    ],
    temperature: 0.2
  };
  
  try {
    console.log("Starting fetch to:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response text:", text);
  } catch (err) {
    console.error("Fetch failed!");
    console.error(err);
    if (err.cause) {
      console.error("Underlying cause:", err.cause);
    }
  }
}

run();
