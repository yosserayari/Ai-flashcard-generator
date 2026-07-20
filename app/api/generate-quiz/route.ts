import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MIN_INPUT_LENGTH = 20;
const MAX_INPUT_LENGTH = 20000; // keep in sync with the frontend cap

// --- Simple in-memory rate limiter (same approach as /api/generate) ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

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

interface QuizCard {
  question: string;
  correctAnswer: string;
  distractors: string[];
}

function isValidQuizCards(value: unknown): value is QuizCard[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as any).question === "string" &&
        (c as any).question.trim() &&
        typeof (c as any).correctAnswer === "string" &&
        (c as any).correctAnswer.trim() &&
        Array.isArray((c as any).distractors) &&
        (c as any).distractors.length === 3 &&
        (c as any).distractors.every(
          (d: any) => typeof d === "string" && d.trim()
        )
    )
  );
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "You're generating quizzes quickly — please wait a minute and try again." },
        { status: 429 }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "No text provided for quiz generation." }, { status: 400 });
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
      You are an expert educational tool that writes multiple-choice quiz questions from study material.
      Your task is to parse the user's provided study notes, lecture slides, or articles and extract the core concepts into quiz questions with one correct answer and three plausible wrong answers (distractors).
      CRITICAL SYSTEM CONSTRAINTS:
      1. Return your response ONLY as a raw, valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json.
      2. The JSON structure MUST exactly follow this schema:
         {
           "cards": [
             {
               "question": "The question or prompt being tested",
               "correctAnswer": "The single correct answer, concise",
               "distractors": ["Wrong answer 1", "Wrong answer 2", "Wrong answer 3"]
             }
           ]
         }
      3. Distractors must be genuinely plausible — same category, similar length and specificity as the correct answer, and drawn from concepts actually present in or adjacent to the source text. Avoid distractors that are obviously silly, unrelated, or trivially eliminated.
      4. Extract between 4 to 10 distinct high-yield questions depending on the density of the source text. Ensure all nested quotes inside strings are escaped safely.
    `;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transform the following text material into multiple-choice quiz questions:\n\n${trimmed}` }
        ],
        model: "openai/gpt-oss-120b",
        temperature: 0.4,
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
        { error: "Couldn't process the notes into a quiz. Please try again." },
        { status: 500 }
      );
    }

    if (!isValidQuizCards(parsedData?.cards)) {
      console.error("Groq returned malformed quiz structure:", parsedData);
      return NextResponse.json(
        { error: "The AI response wasn't in the right format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: parsedData.cards });
  } catch (error: any) {
    console.error("Groq Quiz Generation Route Error:", error);
    return NextResponse.json(
      { error: "Something went wrong processing your notes. Please try again." },
      { status: 500 }
    );
  }
}