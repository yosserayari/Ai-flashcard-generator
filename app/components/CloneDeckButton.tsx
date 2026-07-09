"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../lib/supabase";

interface CloneDeckButtonProps {
  shareId: string;
}

export default function CloneDeckButton({ shareId }: CloneDeckButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const autoCloneAttempted = useRef(false);

  // Track auth state the same way the rest of the app does
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }: any) => {
      setUser(data?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: any) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // If we just came back from the Google redirect (?clone=1), finish the
  // clone automatically as soon as we know who the user is.
  useEffect(() => {
    const shouldAutoClone = searchParams.get("clone") === "1";
    if (shouldAutoClone && user && !autoCloneAttempted.current) {
      autoCloneAttempted.current = true;
      cloneDeck();

      // Strip ?clone=1 so refreshing the page doesn't re-trigger it
      const url = new URL(window.location.href);
      url.searchParams.delete("clone");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  async function loginWithGoogle() {
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/share/${shareId}?clone=1`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) setError(error.message);
  }

  async function cloneDeck() {
    setError("");
    setCloning(true);
    const supabase = createClient();

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Please sign in first.");

      // Look up the original deck via its public share_id
      const { data: originalDeck, error: deckError } = await supabase
        .from("decks")
        .select("id, title")
        .eq("share_id", shareId)
        .single();

      if (deckError || !originalDeck) throw new Error("Couldn't find this deck.");

      const { data: originalCards, error: cardsError } = await supabase
        .from("cards")
        .select("question, answer, position")
        .eq("deck_id", originalDeck.id)
        .order("position", { ascending: true });

      if (cardsError) throw new Error("Couldn't load the cards to copy.");

      // Create a fresh deck owned by the visitor. No share_id is copied over —
      // their new deck is private by default, same as any deck they'd create themselves.
      const { data: newDeck, error: newDeckError } = await supabase
        .from("decks")
        .insert([{ title: originalDeck.title, user_id: currentUser.id }])
        .select()
        .single();

      if (newDeckError || !newDeck) throw new Error("Couldn't create your copy.");

      const cardsToInsert = (originalCards || []).map((card: any, index: number) => ({
        deck_id: newDeck.id,
        question: card.question,
        answer: card.answer,
        position: card.position ?? index,
      }));

      if (cardsToInsert.length > 0) {
        const { error: insertCardsError } = await supabase.from("cards").insert(cardsToInsert);
        if (insertCardsError) throw new Error("Couldn't copy the cards.");
      }

      setDone(true);
      router.push("/history");
    } catch (err: any) {
      console.error("Clone error:", err);
      setError(err.message || "Failed to clone this deck.");
    } finally {
      setCloning(false);
    }
  }

  function handleClick() {
    if (!user) {
      loginWithGoogle();
    } else {
      cloneDeck();
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={cloning || done}
        className="text-sm bg-ink text-paper px-4 py-2 rounded-md font-medium hover:bg-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cloning ? "Cloning…" : done ? "Saved to your account ✓" : "Clone this deck"}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}