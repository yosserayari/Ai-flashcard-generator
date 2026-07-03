"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";
import FlashcardViewer from "../components/FlashcardViewer";
import type { Card } from "../lib/types";

interface SavedDeck {
  id: string;
  title: string;
  created_at?: string;
}

export default function HistoryPage() {
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // The currently opened deck, if any — showing its viewer replaces the list
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    setLoadingDecks(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDecks([]);
        return;
      }
      const { data, error } = await supabase
        .from("decks")
        .select("id, title, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDecks(data || []);
    } catch (err: any) {
      console.error("Error fetching decks:", err.message);
    } finally {
      setLoadingDecks(false);
    }
  }

  async function openDeck(deck: SavedDeck) {
    setSelectedDeck(deck);
    setLoadingCards(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("question, answer")
        .eq("deck_id", deck.id)
        .order("position", { ascending: true });
      if (error) throw error;
      setSelectedCards(data || []);
    } catch (err: any) {
      console.error("Error loading cards:", err.message);
    } finally {
      setLoadingCards(false);
    }
  }

  async function deleteDeck(deckId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this deck? This can't be undone.")) return;

    setDeletingId(deckId);
    const supabase = createClient();
    try {
      const { error } = await supabase.from("decks").delete().eq("id", deckId);
      if (error) throw error;

      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      if (selectedDeck?.id === deckId) {
        setSelectedDeck(null);
        setSelectedCards([]);
      }
    } catch (err: any) {
      console.error("Error deleting deck:", err.message);
      alert("Failed to delete deck. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
            Flashcard<span className="text-highlighter">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm border border-line px-3 py-1.5 rounded-md hover:border-ink transition-colors"
          >
            + New deck
          </Link>
        </div>

        <p className="font-label text-xs uppercase tracking-widest text-teal mb-6">
          History
        </p>

        {selectedDeck ? (
          <div>
            <button
              onClick={() => { setSelectedDeck(null); setSelectedCards([]); }}
              className="font-label text-xs text-ink-soft hover:text-teal transition-colors mb-6"
            >
              ← Back to history
            </button>

            {loadingCards ? (
              <p className="text-sm text-ink-soft/60">Loading…</p>
            ) : selectedCards.length === 0 ? (
              <p className="text-sm text-ink-soft/60 italic">This deck has no cards.</p>
            ) : (
              <FlashcardViewer cards={selectedCards} deckLabel={selectedDeck.title} />
            )}
          </div>
        ) : loadingDecks ? (
          <p className="text-sm text-ink-soft/60">Loading…</p>
        ) : decks.length === 0 ? (
          <p className="text-sm text-ink-soft/60 italic">
            Nothing saved yet — generate a deck and save it to see it here.
          </p>
        ) : (
          <div className="border-t border-line">
            {decks.map((deck, i) => (
              <div
                key={deck.id}
                onClick={() => openDeck(deck)}
                className="group flex items-center justify-between gap-4 py-4 border-b border-line cursor-pointer"
              >
                <div className="flex items-baseline gap-4 min-w-0">
                  <span className="font-label text-xs text-ink-soft/50 shrink-0 w-6">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{deck.title}</p>
                    {deck.created_at && (
                      <p className="text-xs text-ink-soft/60 font-label mt-0.5">
                        {new Date(deck.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => deleteDeck(deck.id, e)}
                  disabled={deletingId === deck.id}
                  className="text-xs text-error opacity-0 group-hover:opacity-100 hover:underline disabled:opacity-40 transition-opacity shrink-0"
                >
                  {deletingId === deck.id ? "…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}