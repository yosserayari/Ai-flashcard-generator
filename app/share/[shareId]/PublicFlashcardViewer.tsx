'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Card } from '../../lib/types';

interface PublicFlashcardViewerProps {
  cards: Card[];
  deckTitle: string;
}

export default function PublicFlashcardViewer({ cards, deckTitle }: PublicFlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsFlipped(!isFlipped);
          break;
        case 'ArrowRight':
          if (isFlipped) {
            if (currentIndex < totalCards - 1) {
              setCurrentIndex(currentIndex + 1);
              setIsFlipped(false);
            }
          }
          break;
        case 'ArrowLeft':
          if (isFlipped && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsFlipped(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, totalCards]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const goToNext = useCallback(() => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, totalCards]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  if (!currentCard) {
    return <div>No cards in this deck</div>;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Progress */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Card {currentIndex + 1} of {totalCards}</span>
          <span>{Math.round(((currentIndex + 1) / totalCards) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div
        className="w-full max-w-2xl h-96 cursor-pointer perspective-1000"
        onClick={handleFlip}
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white border border-line rounded-lg shadow-lg p-8 flex flex-col items-center justify-center">
            <span className="text-xs uppercase tracking-wider text-gray-400 mb-4">Question</span>
            <p className="text-xl text-center leading-relaxed">{currentCard.question}</p>
            <span className="text-sm text-gray-400 mt-8">Click or press Space to flip</span>
          </div>

          {/* Back */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white border border-line rounded-lg shadow-lg p-8 flex flex-col items-center justify-center">
            <span className="text-xs uppercase tracking-wider text-teal mb-4">Answer</span>
            <p className="text-xl text-center leading-relaxed">{currentCard.answer}</p>
            <div className="flex gap-4 mt-8">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevious();
                }}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                disabled={currentIndex === totalCards - 1}
                className="px-4 py-2 text-sm bg-teal text-white rounded-md hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex gap-6 text-sm text-gray-400">
        <span><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Space</kbd> Flip</span>
        <span><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">→</kbd> Next</span>
        <span><kbd className="px-2 py-1 bg-gray-100 rounded text-xs">←</kbd> Previous</span>
      </div>
    </div>
  );
}