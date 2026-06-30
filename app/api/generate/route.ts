import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Please provide more text to generate flashcards from." },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" }, // Forces structured JSON output
        messages: [
          {
            role: "user",
            content: `You are a flashcard generator. Given the input text, create a JSON object containing an array of 8-12 flashcards covering key facts.
            
            Respond ONLY with a valid JSON object matching this schema exactly:
            {
              "cards": [
                {"question": "What is HTML?", "answer": "HyperText Markup Language"}
              ]
            }

            Input Text:
            ${text}`,
          },
        ],
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Groq API Error:", data);
      return NextResponse.json({ error: "Groq API call failed" }, { status: response.status });
    }

    const raw = data.choices?.[0]?.message?.content ?? "{}";
    console.log("RAW AI OUTPUT:", raw);

    const parsedJson = JSON.parse(raw);
    return NextResponse.json({ cards: parsedJson.cards || [] });

  } catch (err) {
    console.error("SERVER EXCEPTION:", err);
    return NextResponse.json(
      { error: "AI returned malformed output or server failed. Try again." },
      { status: 500 }
    );
  }
}