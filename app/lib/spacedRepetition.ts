/**
 * Calculates the next review date, interval, and ease factor for a flashcard
 * based on an adapted SM2 Spaced Repetition Algorithm.
 */
export function calculateNextReview(
  currentInterval: number,
  currentEase: number,
  rating: "easy" | "hard"
) {
  let nextInterval = 1;
  let nextEase = currentEase;

  if (rating === "easy") {
    // Increment the review window progressively
    if (currentInterval === 1) {
      nextInterval = 3; // First successful review jumps to 3 days
    } else {
      nextInterval = Math.ceil(currentInterval * currentEase);
    }
    // Boost the ease factor slightly for smooth scaling
    nextEase = Math.min(currentEase + 0.15, 3.0);
  } else {
    // "Hard" resets the interval chain back to immediate practice
    nextInterval = 1;
    // Lower the ease factor so this card appears more frequently in the future
    nextEase = Math.max(currentEase - 0.3, 1.3);
  }

  // Generate the target UTC review date
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

  return {
    next_review_at: nextReviewAt.toISOString(),
    interval_days: nextInterval,
    ease_factor: nextEase,
  };
}