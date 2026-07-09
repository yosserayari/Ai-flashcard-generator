"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase";
import FlashcardViewer from "../components/FlashcardViewer";
import ShareDeckButton from "../components/ShareDeckButton";
import { calculateNextReview, isCardDue, isCardMastered } from "../lib/spacedRepetition";
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

  // "all" shows every card in the deck, "due" filters to cards ready for review
  const [reviewMode, setReviewMode] = useState<"all" | "due">("all");

  useEffect(() => {
    checkUserAndFetchDecks();
  }, []);

  async function checkUserAndFetchDecks() {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.log('User not authenticated');
        setUser(null);
        setDecks([]);
        setIsLoading(false);
        return;
      }

      setUser(user);

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
    setReviewMode("all");
    setLoadingCards(true);
    const supabase = createClient();
    try {
      // Pull everything needed for spaced repetition, not just question/answer
      const { data, error } = await supabase
        .from("cards")
        .select("id, question, answer, deck_id, interval_days, ease_factor, next_review_at")
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

  // Same rating handler as the home page, now available for saved decks too
  async function handleRateCard(cardId: string, rating: "easy" | "hard") {
    const targetCard = selectedCards.find((c) => c.id === cardId);
    if (!targetCard) return;

    const supabase = createClient();

    const currentInterval = targetCard.interval_days ?? 1;
    const currentEase = targetCard.ease_factor ?? 2.5;

    const updates = calculateNextReview(currentInterval, currentEase, rating);

    const { error: dbError } = await supabase
      .from("cards")
      .update({
        next_review_at: updates.next_review_at,
        interval_days: updates.interval_days,
        ease_factor: updates.ease_factor,
      })
      .eq("id", cardId);

    if (dbError) {
      console.error("Failed to persist card rating update:", dbError.message);
      return;
    }

    setSelectedCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              interval_days: updates.interval_days,
              ease_factor: updates.ease_factor,
              next_review_at: updates.next_review_at,
            }
          : c
      )
    );
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

  // Derived view data for the currently open deck
  const dueCards = selectedCards.filter((c) => isCardDue(c.next_review_at));
  const masteredCount = selectedCards.filter((c) => isCardMastered(c.ease_factor)).length;
  const cardsToShow = reviewMode === "due" ? dueCards : selectedCards;

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
              <div className="space-y-4">
                {/* Mastery progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-ink-soft/60 font-label mb-1">
                    <span>{masteredCount} of {selectedCards.length} mastered</span>
                    <span>{Math.round((masteredCount / selectedCards.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-line rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal transition-all"
                      style={{ width: `${(masteredCount / selectedCards.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* All / Due toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setReviewMode("all")}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-colors ${
                      reviewMode === "all"
                        ? "bg-ink text-paper border-ink"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    All cards ({selectedCards.length})
                  </button>
                  <button
                    onClick={() => setReviewMode("due")}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-colors ${
                      reviewMode === "due"
                        ? "bg-ink text-paper border-ink"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    Due today ({dueCards.length})
                  </button>
                </div>

                {cardsToShow.length === 0 ? (
                  <p className="text-sm text-ink-soft/60 italic py-8 text-center">
                    Nothing due right now — nice work. Check back later or switch to "All cards."
                  </p>
                ) : (
                  <FlashcardViewer
                    cards={cardsToShow}
                    deckLabel={selectedDeck.title}
                    onRateCard={handleRateCard}
                  />
                )}
              </div>
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
                  <ShareDeckButton
                    deckId={deck.id}
                    deckTitle={deck.title}
                    existingShareId={deck.share_id}
                  />

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