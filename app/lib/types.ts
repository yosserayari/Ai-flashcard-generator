export interface Card {
  id?: string;             // Optional because newly generated cards don't have it yet
  deck_id?: string;        // Optional until saved to DB
  question: string;
  answer: string;
  position?: number;       // Optional database column
  interval_days?: number;  // Optional tracking column
  ease_factor?: number;    // Optional tracking column
  next_review_at?: string; // Optional tracking column
}

// If you have a Deck interface, it usually looks like this:
export interface Deck {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}