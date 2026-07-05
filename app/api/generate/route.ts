import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MIN_INPUT_LENGTH = 20;
const MAX_INPUT_LENGTH = 20000; // keep in sync with the frontend cap

// --- Simple in-memory rate limiter ---
// Good enough for an MVP getting its first 5-50 testers. NOTE: this resets on
// every server restart/deploy, and on serverless platforms (Vercel etc.) each
// instance has its own memory, so it's not a hard global limit — it just stops
// casual abuse and accidental loops. If this app gets real traffic, swap this
// for Upstash Redis or Vercel KV so the counter is shared across instances.
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 generations per IP per minute

const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(ip, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isValidCards(value: unknown): value is { question: string; answer: string }[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as any).question === "string" &&
        typeof (c as any).answer === "string" &&
        (c as any).question.trim() &&
        (c as any).answer.trim()
    )
  );
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "You're generating decks quickly — please wait a minute and try again." },
        { status: 429 }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No text provided for card generation." }, { status: 400 });
    }

    const trimmed = text.trim();

    if (trimmed.length < MIN_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Please provide at least ${MIN_INPUT_LENGTH} characters of text.` },
        { status: 400 }
      );
    }

    if (trimmed.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `That text is too long (max ${MAX_INPUT_LENGTH.toLocaleString()} characters). Please shorten it and try again.` },
        { status: 400 }
      );
    }

    const systemPrompt = `
      You are an expert educational tool and specialized study assistant.
      Your task is to parse the user's provided study notes, lecture slides, or articles and extract the core concepts into structural flashcards.
      CRITICAL SYSTEM CONSTRAINTS:
      1. Return your response ONLY as a raw, valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json.
      2. The JSON structure MUST exactly follow this schema:
         {
           "cards": [
             { "question": "Front side: The question, core concept, or technical prompt", "answer": "Back side: The answer, definition, or concise summary statement" }
           ]
         }
      3. Extract between 4 to 10 distinct high-yield cards depending on the density of the source text. Keep definitions and answers crisp, professional, and optimized for active recall. Ensure all nested quotes inside strings are escaped safely.
    `;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transform the following text material into structured flashcards:\n\n${trimmed}` }
        ],
        model: "openai/gpt-oss-120b",
        temperature: 0.3,
      });
    } catch (groqErr: any) {
      console.error("Groq API call failed:", groqErr);
      return NextResponse.json(
        { error: "The AI service is temporarily unavailable. Please try again shortly." },
        { status: 502 }
      );
    }

    const rawResponse = completion.choices[0]?.message?.content?.trim() || "{}";

    let parsedData: any;
    try {
      parsedData = JSON.parse(rawResponse);
    } catch (parseErr) {
      console.error("Failed to parse Groq output as JSON:", rawResponse);
      return NextResponse.json(
        { error: "Couldn't process the notes into flashcards. Please try again." },
        { status: 500 }
      );
    }

    if (!isValidCards(parsedData?.cards)) {
      console.error("Groq returned malformed card structure:", parsedData);
      return NextResponse.json(
        { error: "The AI response wasn't in the right format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: parsedData.cards });
  } catch (error: any) {
    console.error("Groq Generation Route Error:", error);
    return NextResponse.json(
      { error: "Something went wrong processing your notes. Please try again." },
      { status: 500 }
    );
  }
}