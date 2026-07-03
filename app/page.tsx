"use client";
import Link from "next/link";
import { createClient } from "./lib/supabase"; // Corrected path to match app/lib/supabase.ts
import { useState, useEffect } from "react";
import FlashcardViewer from "./components/FlashcardViewer";
import type { Card } from "./lib/types";

interface User {
  id: string;
  email?: string;
}

const MIN_INPUT_LENGTH = 20; // Below this, Claude doesn't have enough to work with

// Builds a deck title from the first card's question instead of the raw pasted
// input — raw input can contain IPA symbols, code comments, or anything else
// someone pastes, none of which makes a good title. Truncates at a word
// boundary so titles don't get cut off mid-word.
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
  const [error, setError] = useState("");

  // --- 1. Authentic Session Listener Hook ---
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

  // --- 2. Google OAuth Handshake Functions ---
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

  // --- 3. Database Save Pipeline ---
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

  // --- 4. The AI Communication Courier Function ---
  async function generate() {
    if (text.trim().length < MIN_INPUT_LENGTH) {
      setError(`Paste a bit more text (at least ${MIN_INPUT_LENGTH} characters) so there's enough to work with.`);
      return;
    }

    setError("");
    setCards([]);
    setLoading(true);

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      setError(data.error);
    } else {
      setCards(data.cards);
    }
  }

  // --- Rendered UI ---
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Top bar */}
        <div className="flex justify-between items-center mb-10">
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

        <div className="bg-white border border-line rounded-lg shadow-[0_1px_2px_rgba(32,26,43,0.06)] p-1 mb-3">
          <textarea
            className="w-full h-36 resize-none bg-transparent p-4 text-[15px] leading-relaxed placeholder:text-ink-soft/60 focus:outline-none"
            placeholder="Paste your notes, an article, or a topic to study..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <button
          onClick={generate}
          disabled={loading || !text.trim()}
          className="bg-highlighter text-ink font-medium px-5 py-2.5 rounded-md hover:bg-highlighter-hover active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Generating…" : "Generate flashcards"}
        </button>

        {error && (
          <div className="mt-4 border-l-2 border-error bg-error-bg text-error text-sm px-4 py-3 rounded-r-md">
            {error}
          </div>
        )}

        {/* Loading skeleton — tilted index cards instead of a spinner */}
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