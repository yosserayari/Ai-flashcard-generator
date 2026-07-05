"use client";
import Link from "next/link";
import { createClient } from "./lib/supabase";
import { useState, useEffect, useRef } from "react";
import FlashcardViewer from "./components/FlashcardViewer";
import type { Card } from "./lib/types";

interface User {
  id: string;
  email?: string;
}

const MIN_INPUT_LENGTH = 20;
const MAX_INPUT_LENGTH = 20000; // guards against runaway Groq calls / cost on huge pastes
const GENERATE_TIMEOUT_MS = 30000;

function deriveDeckTitle(cards: Card[]): string {
  const source = cards[0]?.question?.trim() || "Untitled deck";
  const words = source.split(/\s+/);
  let title = "";
  for (const word of words) {
    const next = title ? `${title} ${word}` : word;
    if (next.length > 45) break;
    title = next;
  }
  if (!title) title = source.slice(0, 45);
  return title.length < source.length ? `${title}…` : title;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [ankiExporting, setAnkiExporting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. Auth session listener ---
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then((res: { data?: { user?: any } }) => {
      const authUser = res?.data?.user;
      if (authUser) setUser(authUser as User);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session ? (session.user as User) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loginWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) console.error("Login error:", error.message);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  async function saveDeck() {
    if (cards.length === 0) return;
    if (!user) {
      alert("Please log in to save your decks!");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const { data: deckData, error: deckError } = await supabase
        .from('decks')
        .insert([{ title: deriveDeckTitle(cards), user_id: user.id }])
        .select()
        .single();

      if (deckError) throw deckError;

      const cardsToInsert = cards.map((card, index) => ({
        deck_id: deckData.id,
        question: card.question,
        answer: card.answer,
        position: index
      }));

      const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);
      if (cardsError) throw cardsError;

      alert("Deck saved! Find it anytime under History. 🎉");
    } catch (error: any) {
      console.error("Error saving deck:", error.message || error);
      alert(error.message || "Failed to save the deck.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfLoading(true);
    setError("");

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => (item as any).str).join(" ");
        extractedText += pageText + "\n";
      }

      if (!extractedText.trim()) {
        // Common cause: scanned slides / image-only PDF with no embedded text layer.
        throw new Error(
          "No readable text found in this PDF. If it's a scanned document or image-based slides, try an OCR tool first, or paste the text manually."
        );
      }

      setText((prev) => (prev + (prev ? "\n\n" : "") + extractedText.trim()).slice(0, MAX_INPUT_LENGTH));
    } catch (err: any) {
      console.error("PDF Parsing Error:", err);
      setError(err.message || "Failed to extract text from this PDF.");
    } finally {
      setPdfLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // --- Real Anki .apkg export — built server-side (see app/api/export-anki/route.ts) ---
  // The sql.js library anki-apkg-export depends on needs real Node fs/path, which don't
  // exist in the browser. Rather than fighting the bundler to fake them client-side,
  // we just send the cards to a server route and download the file it returns.
async function handleAnkiExport() {
    if (cards.length === 0) return;

    setAnkiExporting(true);
    setError("");

    try {
      const deckTitle = deriveDeckTitle(cards).replace(/…/g, "").trim() || "Flashcard deck";

      const res = await fetch("/api/export-anki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards, title: deckTitle }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to build the Anki file.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const safeTitle = deckTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeTitle || "deck"}.apkg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Anki export failed:", err);
      setError(err.message || "Couldn't build the Anki file. Try again, or use CSV/TXT export instead.");
    } finally {
      setAnkiExporting(false);
    }
  }

  async function generate() {
    const trimmed = text.trim();

    if (trimmed.length < MIN_INPUT_LENGTH) {
      setError(`Paste a bit more text (at least ${MIN_INPUT_LENGTH} characters) so there's enough to work with.`);
      return;
    }
    if (trimmed.length > MAX_INPUT_LENGTH) {
      setError(`That's a lot of text — trim it to under ${MAX_INPUT_LENGTH.toLocaleString()} characters and try again.`);
      return;
    }

    setError("");
    setCards([]);
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error("The server sent back something unexpected. Please try again.");
      }

      if (!res.ok || data.error) {
        setError(data?.error || "Something went wrong generating flashcards. Please try again.");
        return;
      }

      if (!Array.isArray(data.cards) || data.cards.length === 0) {
        setError("No flashcards came back for that text — try pasting a bit more content.");
        return;
      }

      setCards(data.cards);
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("This is taking too long — the server may be busy. Please try again in a moment.");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
      console.error("Generate error:", err);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  const anyBusy = loading || pdfLoading || ankiExporting;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Top bar */}
        <div className="flex justify-between items-center mb-10 gap-3 flex-wrap">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Flashcard<span className="text-highlighter">.</span>
          </h1>
          <div className="flex items-center gap-4">
            {user && (
              <Link
                href="/history"
                className="text-sm border border-line px-3 py-1.5 rounded-md hover:border-ink transition-colors"
              >
                History
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-ink-soft font-label hidden sm:inline">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm border border-line px-3 py-1.5 rounded-md hover:border-ink transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="text-sm bg-ink text-paper px-4 py-2 rounded-md font-medium hover:bg-teal transition-colors"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {/* Hero / input */}
        <div className="mb-3">
          <p className="font-label text-xs uppercase tracking-widest text-teal mb-2">
            New deck
          </p>
          <h2 className="font-display text-3xl leading-tight mb-6">
            Turn any notes into flashcards
          </h2>
        </div>

        <div className="bg-white border border-line rounded-lg shadow-[0_1px_2px_rgba(32,26,43,0.06)] p-1 mb-1 relative">
          <textarea
            className="w-full h-36 resize-none bg-transparent p-4 text-[15px] leading-relaxed placeholder:text-ink-soft/60 focus:outline-none"
            placeholder="Paste your notes, an article, or a topic to study..."
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_INPUT_LENGTH))}
            maxLength={MAX_INPUT_LENGTH}
          />
          {pdfLoading && (
            <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center text-sm font-medium text-teal animate-pulse">
              Extracting PDF text...
            </div>
          )}
        </div>

        {/* Privacy note — builds trust before someone pastes real course material */}
        <p className="text-xs text-ink-soft/60 mb-3">
          Your text is only sent to generate cards and isn't stored unless you hit "Save deck."
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={generate}
            disabled={anyBusy || !text.trim()}
            className="bg-highlighter text-ink font-medium px-5 py-2.5 rounded-md hover:bg-highlighter-hover active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Generating…" : "Generate flashcards"}
          </button>

          <label className={`text-sm border border-line px-4 py-2.5 rounded-md transition-colors inline-flex items-center gap-2 font-medium bg-white ${anyBusy ? "opacity-40 cursor-not-allowed" : "hover:border-ink cursor-pointer"}`}>
            📁 Upload PDF
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handlePdfUpload}
              disabled={anyBusy}
              className="hidden"
            />
          </label>

          {!loading && cards.length > 0 && (
            <button
              onClick={handleAnkiExport}
              disabled={ankiExporting}
              className="text-sm bg-teal text-white px-4 py-2.5 rounded-md font-medium hover:bg-teal/90 transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📥 {ankiExporting ? "Building file…" : "Export Anki (.apkg)"}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 border-l-2 border-error bg-error-bg text-error text-sm px-4 py-3 rounded-r-md">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="relative h-48 mt-10 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute w-56 h-36 bg-white border border-line rounded-lg shadow-md animate-pulse"
                style={{
                  transform: `rotate(${(i - 1) * 6}deg) translateX(${(i - 1) * 14}px)`,
                  zIndex: 3 - i,
                }}
              />
            ))}
          </div>
        )}

        {/* Study view */}
        {!loading && cards.length > 0 && (
          <div className="mt-10">
            <FlashcardViewer cards={cards} onSave={saveDeck} saving={saving} />
          </div>
        )}
      </main>
    </div>
  );
}