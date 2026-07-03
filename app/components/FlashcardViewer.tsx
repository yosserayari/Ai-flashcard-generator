"use client";
import { useState, useEffect } from "react";
import type { Card } from "../lib/types";

interface FlashcardViewerProps {
  cards: Card[];
  deckLabel?: string;      // shown next to the counter, e.g. the deck's saved title
  onSave?: () => void;     // pass this in only where saving makes sense (home page)
  saving?: boolean;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Fallback label for export filenames when no deckLabel was passed in
function fallbackLabel(cards: Card[]): string {
  const source = cards[0]?.question?.trim() || "flashcards";
  return source.split(/\s+/).slice(0, 6).join(" ");
}

export default function FlashcardViewer({ cards, deckLabel, onSave, saving }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Reset to the first card whenever a different deck's cards are handed in
  useEffect(() => {
    setCurrentIndex(0);
    setFlipped(false);
  }, [cards]);

  if (cards.length === 0) return null;

  function exportCSV() {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const header = "question,answer\n";
    const rows = cards.map((c) => `${escape(c.question)},${escape(c.answer)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    downloadBlob(blob, `${(deckLabel || fallbackLabel(cards)).trim()}.csv`);
  }

  function exportTXT() {
    const content = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    downloadBlob(blob, `${(deckLabel || fallbackLabel(cards)).trim()}.txt`);
  }

  const card = cards[currentIndex];

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="font-label text-xs uppercase tracking-widest text-ink-soft">
          {deckLabel ? `${deckLabel} · ` : ""}
          Card {currentIndex + 1} / {cards.length}
        </p>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="text-xs border border-line px-2.5 py-1 rounded hover:border-teal hover:text-teal transition-colors">
            CSV
          </button>
          <button onClick={exportTXT} className="text-xs border border-line px-2.5 py-1 rounded hover:border-teal hover:text-teal transition-colors">
            TXT
          </button>
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="text-xs bg-ink text-paper px-3 py-1 rounded hover:bg-teal transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save deck"}
            </button>
          )}
        </div>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="relative bg-white border border-line rounded-lg shadow-[0_4px_14px_rgba(32,26,43,0.08)] p-10 min-h-[200px] flex items-center justify-center text-center cursor-pointer select-none hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(32,26,43,0.1)] transition-all"
      >
        <div className="absolute top-5 left-6 right-6 h-px bg-line" />
        <p className="text-lg leading-relaxed">{flipped ? card.answer : card.question}</p>
        <span className="absolute bottom-3 right-4 font-label text-[10px] uppercase tracking-widest text-ink-soft/50">
          {flipped ? "Answer" : "Question"}
        </span>
      </div>

      <p className="text-xs text-ink-soft/60 text-center mt-3">Click card to flip</p>

      <div className="flex justify-between mt-5">
        <button
          onClick={() => { setFlipped(false); setCurrentIndex((i) => (i === 0 ? cards.length - 1 : i - 1)); }}
          className="text-sm px-4 py-2 border border-line rounded-md hover:border-ink transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => { setFlipped(false); setCurrentIndex((i) => (i === cards.length - 1 ? 0 : i + 1)); }}
          className="text-sm px-4 py-2 border border-line rounded-md hover:border-ink transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}