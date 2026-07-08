"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";
import FlashcardViewer from "../components/FlashcardViewer";
import ShareDeckButton from "../components/ShareDeckButton";
import type { Card } from "../lib/types";

interface SavedDeck {
  id: string;
  title: string;
  created_at?: string;
  share_id?: string;
}

export default function HistoryPage() {
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The currently opened deck, if any — showing its viewer replaces the list
  const [selectedDeck, setSelectedDeck] = useState<SavedDeck | null>(null);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    checkUserAndFetchDecks();
  }, []);

  async function checkUserAndFetchDecks() {
    setIsLoading(true);
    const supabase = createClient();
    
    try {
      // Check if user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('User not authenticated');
        setUser(null);
        setDecks([]);
        setIsLoading(false);
        return;
      }
      
      setUser(user);
      
      // Fetch decks for this user
      const { data, error } = await supabase
        .from("decks")
        .select("id, title, created_at, share_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      
      console.log('Fetched decks:', data);
      setDecks(data || []);
    } catch (err: any) {
      console.error("Error fetching decks:", err.message);
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper text-ink">
        <main className="max-w-2xl mx-auto px-6 py-10">
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
          <div className="text-center py-12">
            <p className="text-gray-500">Please sign in to view your decks.</p>
            <Link href="/" className="text-teal hover:underline mt-2 inline-block">
              Go to home page
            </Link>
          </div>
        </main>
      </div>
    );
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
                className="group flex items-center justify-between gap-4 py-4 border-b border-line"
              >
                {/* Clickable deck area */}
                <div 
                  onClick={() => openDeck(deck)}
                  className="flex items-baseline gap-4 min-w-0 flex-1 cursor-pointer"
                >
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

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Share Button - Always show if user is logged in */}
                  <ShareDeckButton 
                    deckId={deck.id} 
                    deckTitle={deck.title}
                    existingShareId={deck.share_id}
                  />
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => deleteDeck(deck.id, e)}
                    disabled={deletingId === deck.id}
                    className="text-xs text-error opacity-0 group-hover:opacity-100 hover:underline disabled:opacity-40 transition-opacity"
                  >
                    {deletingId === deck.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
