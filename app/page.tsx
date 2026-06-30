"use client";

import { useState } from "react";

type Card = { question: string; answer: string };

export default function Home() {
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  async function generate() {
    setCurrentIndex(0);
    setFlipped(false);
    setCards([]);

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

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">AI Flashcard Generator</h1>

      <textarea
        className="w-full h-40 border rounded p-3 mb-3"
        placeholder="Paste your notes here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={generate}
        disabled={loading || !text.trim()}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Flashcards"}
      </button>

      {error && <p className="text-red-600 mt-3">{error}</p>}

{cards.length > 0 && (
  <div className="mt-8">
    <p className="text-sm text-gray-500 mb-2">
      Card {currentIndex + 1} of {cards.length}
    </p>

    <div
      onClick={() => setFlipped(!flipped)}
      className="border rounded-lg p-8 min-h-[180px] flex items-center justify-center text-center cursor-pointer select-none hover:shadow-md transition"
    >
      <p className="text-lg">
        {flipped ? cards[currentIndex].answer : cards[currentIndex].question}
      </p>
    </div>

    <p className="text-xs text-gray-400 text-center mt-2">
      Click card to flip
    </p>

    <div className="flex justify-between mt-4">
      <button
        onClick={() => {
          setFlipped(false);
          setCurrentIndex((i) => Math.max(0, i - 1));
        }}
        disabled={currentIndex === 0}
        className="px-4 py-2 border rounded disabled:opacity-30"
      >
        ← Prev
      </button>
      <button
        onClick={() => {
          setFlipped(false);
          setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
        }}
        disabled={currentIndex === cards.length - 1}
        className="px-4 py-2 border rounded disabled:opacity-30"
      >
        Next →
      </button>
    </div>
  </div>
)}
</main>
 );
}