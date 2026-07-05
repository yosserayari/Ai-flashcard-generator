"use client";
import React, { useState, useEffect } from "react";
import type { Card } from "../lib/types";

interface FlashcardViewerProps {
  cards: Card[];
  deckLabel?: string;
  onSave?: () => void;
  saving?: boolean;
  onRateCard?: (cardId: string, rating: "easy" | "hard") => Promise<void>;
}

export default function FlashcardViewer({
  cards,
  deckLabel,
  onSave,
  saving = false,
  onRateCard,
}: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) return null;

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  // --- Keyboard Event Listener Feature ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't fire if the user is typing inside an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault(); // Stop page from scrolling down
        handleFlip();
      } else if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, isFlipped, cards]); // Re-bind when state adjustments occur

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + cards.map(e => `"${e.question.replace(/"/g, '""')}","${e.answer.replace(/"/g, '""')}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${deckLabel || "flashcards"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    const txtContent = cards.map(e => `${e.question}\t${e.answer}`).join("\n");
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deckLabel || "flashcards"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Controls Bar */}
      <div className="flex justify-between items-center text-sm border-b border-line pb-3">
        <span className="font-medium text-ink-soft">
          CARD {currentIndex + 1} / {cards.length}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="px-3 py-1 border border-line rounded bg-white hover:border-ink transition text-xs"
          >
            CSV
          </button>
          <button 
            onClick={handleExportTXT}
            className="px-3 py-1 border border-line rounded bg-white hover:border-ink transition text-xs"
          >
            TXT
          </button>
          {onSave && !currentCard.deck_id && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1 bg-ink text-paper rounded hover:bg-teal transition text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save deck"}
            </button>
          )}
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div 
        onClick={handleFlip}
        className="w-full min-h-[220px] bg-white border border-line rounded-xl shadow-sm p-8 flex items-center justify-center cursor-pointer select-none transition-all duration-300 hover:shadow-md relative overflow-hidden"
      >
        <div className="text-center max-w-xl">
          <p className="text-lg md:text-xl font-medium leading-relaxed">
            {isFlipped ? currentCard.answer : currentCard.question}
          </p>
        </div>
        <span className="absolute bottom-3 right-4 font-label text-[10px] uppercase tracking-wider text-ink-soft/40">
          {isFlipped ? "Answer" : "Question"}
        </span>
      </div>

      <p className="text-center text-xs text-ink-soft/50">
        Click card or press <kbd className="px-1.5 py-0.5 bg-paper border border-line rounded text-[10px]">Space</kbd> to flip
      </p>

      {/* Spaced Repetition Actions */}
      {isFlipped && onRateCard && (
        <div className="flex justify-center gap-3 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRateCard(currentCard.id!, "hard");
              handleNext();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-red-200 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition shadow-sm"
          >
            🔴 Hard (Reset)
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRateCard(currentCard.id!, "easy");
              handleNext();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-green-200 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition shadow-sm"
          >
            🟢 Easy (Advance)
          </button>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={handlePrev}
          className="px-4 py-2 border border-line rounded-lg text-sm font-medium bg-white hover:border-ink transition active:scale-[0.98]"
        >
          ← Prev
        </button>
        <span className="text-xs text-ink-soft/40 hidden sm:inline font-label">
          ← / → keys navigate
        </span>
        <button
          onClick={handleNext}
          className="px-4 py-2 border border-line rounded-lg text-sm font-medium bg-white hover:border-ink transition active:scale-[0.98]"
        >
          Next →
        </button>
      </div>
    </div>
  );
}