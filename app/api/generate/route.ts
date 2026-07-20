import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { chunkText, needsChunking } from "../../lib/textChunking";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MIN_INPUT_LENGTH = 20;
const MAX_INPUT_LENGTH = 20000; // keep in sync with the frontend cap

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

async function generateCardsForChunk(
  chunk: string
): Promise<{ question: string; answer: string }[]> {
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

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Transform the following text material into structured flashcards:\n\n${chunk}` },
    ],
    model: "openai/gpt-oss-120b",
    temperature: 0.3,
  });

  const rawResponse = completion.choices[0]?.message?.content?.trim() || "{}";
  const parsedData = JSON.parse(rawResponse);

  if (!isValidCards(parsedData?.cards)) {
    throw new Error("Malformed card structure from a chunk");
  }

  return parsedData.cards;
}

export async function POST(req: Request) {
  try {
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

    const chunks = chunkText(trimmed);

    let results;
    try {
      results = await Promise.allSettled(
        chunks.map((chunk) => generateCardsForChunk(chunk))
      );
    } catch (groqErr: any) {
      console.error("Groq API call failed:", groqErr);
      return NextResponse.json(
        { error: "The AI service is temporarily unavailable. Please try again shortly." },
        { status: 502 }
      );
    }

    const mergedCards: { question: string; answer: string }[] = [];
    let failedChunks = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        mergedCards.push(...result.value);
      } else {
        failedChunks++;
        console.error("A chunk failed to generate cards:", result.reason);
      }
    }

    // Only fail the whole request if every chunk failed. One or two bad
    // chunks out of many shouldn't nuke a deck that's otherwise mostly good —
    // the user still gets cards for the material that worked.
    if (mergedCards.length === 0) {
      return NextResponse.json(
        { error: "Couldn't process the notes into flashcards. Please try again." },
        { status: 502 }
      );
    }

    if (!isValidCards(mergedCards)) {
      console.error("Merged cards failed validation:", mergedCards);
      return NextResponse.json(
        { error: "The AI response wasn't in the right format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      cards: mergedCards,
      ...(failedChunks > 0 && {
        warning: `${failedChunks} of ${chunks.length} sections couldn't be processed. Your deck may be missing some cards.`,
      }),
    });
  } catch (error: any) {
    console.error("Groq Generation Route Error:", error);
    return NextResponse.json(
      { error: "Something went wrong processing your notes. Please try again." },
      { status: 500 }
    );
  }
}