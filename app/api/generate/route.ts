import { NextRequest, NextResponse } from "next/server"; // Imports Next.js tools to read incoming web requests and send back server responses

// This function intercepts incoming HTTP "POST" requests sent to the '/api/generate' URL route
export async function POST(req: NextRequest) {
  try {
    // Unpacks the incoming network JSON package from page.tsx and extracts the "text" variable containing your notes
    const { text } = await req.json();

    // Safety Guard: If there is no text, or if it's too short (less than 20 characters), stop immediately
    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Please provide more text to generate flashcards from." },
        { status: 400 } // Sends a "400 Bad Request" status code back to your frontend
      );
    }

    // Server-to-Server Bridge: Securely knocks on Groq API's door
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", // Sending a package payload to Groq
      headers: {
        "Content-Type": "application/json",
        // Pulls your secret API key straight from the server's environment vault (hidden from user inspection)
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Specifies the exact LLM thinking engine to handle the work
        response_format: { type: "json_object" }, // Strict mode: Forces the AI to talk ONLY in structured computer code (JSON)
        temperature: 0.8, // Creative variance: Your added setting to ensure cards change on every single click!
        messages: [
          {
            role: "user",
            // System instructions telling the AI exactly what behavior to adopt and providing your text variable
            content: `You are a flashcard generator. Given the input text, create a JSON object containing an array of 8-12 flashcards covering key facts.
            
IMPORTANT: Vary your focus! Select different concepts, terms, angles, or details each time so that multiple requests on the same text produce entirely unique card decks.

Respond ONLY with a valid JSON object matching this schema exactly...:
            {
              "cards": [
                {"question": "What is HTML?", "answer": "HyperText Markup Language"}
              ]
            }

            Input Text:
            ${text}`, // Dynamic string interpolation merging your input notes into the prompt
          },
        ],
      }),
    });

    // Waits for Groq to finish its thinking calculations and converts the response stream into a readable data object
    const data = await response.json();
    
    // Error Safeguard: If Groq rejected the key or its servers are down, flag it here
    if (!response.ok) {
      console.error("Groq API Error:", data); // Prints error data inside your private local terminal logs
      return NextResponse.json({ error: "Groq API call failed" }, { status: response.status });
    }

    // Drills deep inside the standard OpenAI/Groq response object to extract the raw text string containing the AI's answer
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    console.log("RAW AI OUTPUT:", raw); // Keeps a local log copy of what the AI produced before parsing it

    // Takes that plain raw text string and compiles it into an active, live JavaScript object
    const parsedJson = JSON.parse(raw);
    
    // Returns a beautiful, clean array list back to page.tsx to populate your cards array state variable
    return NextResponse.json({ cards: parsedJson.cards || [] });

  } catch (err) {
    // If JSON parsing fails (the AI output formatting breaks) or the server crashes, catch it gracefully right here
    console.error("SERVER EXCEPTION:", err);
    return NextResponse.json(
      { error: "AI returned malformed output or server failed. Try again." },
      { status: 500 } // "500 Internal Server Error" means a severe unexpected backend crash occurred
    );
  }
}