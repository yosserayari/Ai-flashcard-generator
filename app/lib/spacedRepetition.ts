export function calculateNextReview(
  currentInterval: number,
  currentEase: number,
  rating: "easy" | "hard"
) {
  let nextInterval = 1;
  let nextEase = currentEase;

  if (rating === "easy") {
    if (currentInterval === 1) {
      nextInterval = 3;
    } else {
      nextInterval = Math.ceil(currentInterval * currentEase);
    }
    nextEase = Math.min(currentEase + 0.15, 3.0);
  } else {
    nextInterval = 1;
    nextEase = Math.max(currentEase - 0.3, 1.3);
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  return {
    next_review_at: nextReviewAt.toISOString(),
    interval_days: nextInterval,
    ease_factor: nextEase,
  };
}

/** A card is "due" if it's never been reviewed, or its review date has passed. */
export function isCardDue(nextReviewAt?: string | null): boolean {
  if (!nextReviewAt) return true;
  return new Date(nextReviewAt) <= new Date();
}

/** Simple mastery threshold: an ease factor of 2.5+ means the card is sticking. */
/** A card is "mastered" only if it's actually been reviewed and its ease has grown past the default. */
export function isCardMastered(easeFactor?: number | null): boolean {
  return typeof easeFactor === "number" && easeFactor > 2.5;
}
