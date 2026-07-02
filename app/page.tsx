"use client";

import { createClient } from "./lib/supabase";
import { useState, useEffect } from "react"; 

// TypeScript blueprint: promises our app that every card object MUST have text question and answer strings
type Card = { question: string; answer: string };

export default function Home() {
  // --- Memory State Slots ---
  const [text, setText] = useState(""); // Tracks whatever the user types inside the textarea box
  const [cards, setCards] = useState<Card[]>([]); // Holds the array of flashcards returned from the backend AI
  const [loading, setLoading] = useState(false); // Tracks whether the application is waiting on the AI API call
  const [saving, setSaving] = useState(false); // Tracks whether the deck is actively uploading to Supabase
  const [error, setError] = useState(""); // Holds any error message strings if something goes wrong
  const [currentIndex, setCurrentIndex] = useState(0); // Tracks the index number of the card currently visible on screen
  const [flipped, setFlipped] = useState(false); // Binary switch: false = show question, true = show answer
  const [user, setUser] = useState<any>(null); // Stores current logged in user object

  // --- Auth Observer Hook ---
// --- Auth Observer Hook ---
  useEffect(() => {
    const supabase = createClient();
    
    // 1. Manually check and force set the session immediately
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        const { data } = await supabase.auth.getUser();
        if (data?.user) setUser(data.user);
      }
    };
    
    checkUser();

    // 2. Listen for subsequent login/logout state changes with explicit types
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Auth Control Functions ---
async function loginWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Redirects back to http://localhost:3000
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        flowType: 'implicit', // 👈 ADD THIS: Forces token flow instead of code exchange
      },
    });
    if (error) console.error("Login error:", error.message);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    alert("Logged out successfully.");
  }

  // --- Database Sync Function ---
  async function saveDeck() {
    if (!user) {
      alert("Please log in to save your decks!");
      return;
    }

    if (!cards || cards.length === 0) {
      alert("Generate some flashcards first before saving!");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const deckTitle = "My AI Flashcard Deck";

      // 2. Insert the parent folder row into the 'decks' table
      const { data: deckData, error: deckError } = await supabase
        .from("decks")
        .insert([
          {
            user_id: user.id,
            title: deckTitle,
          },
        ])
        .select()
        .single();

      if (deckError) throw deckError;

      // 3. Format all the individual cards to link to this new deck's ID
      const cardsToInsert = cards.map((card, index) => ({
        deck_id: deckData.id,
        question: card.question,
        answer: card.answer,
        position: index,
      }));

      // 4. Batch insert all rows into the 'cards' table simultaneously
      const { error: cardsError } = await supabase
        .from("cards")
        .insert(cardsToInsert);

      if (cardsError) throw cardsError;

      alert(`🎉 Deck "${deckTitle}" successfully saved to your profile!`);
    } catch (err: any) {
      console.error("Error saving deck:", err);
      alert(`Failed to save deck: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  // --- The AI Communication Courier Function ---
  async function generate() {
    setCurrentIndex(0); // Resets review deck back to the first card for the new batch
    setFlipped(false);  // Forces the deck to start on the question side, not the answer side
    setCards([]);
    setError("");       // Clear previous errors
    setLoading(true);   // Wipes out old flashcards from the screen immediately

    try {
      // Sends a network request over to our private backend folder route
      const res = await fetch("/api/generate", {
        method: "POST", // Using POST to securely transmit data inside a package body
        headers: { "Content-Type": "application/json" }, // Tells the backend that the incoming data package is JSON format
        body: JSON.stringify({ text }), // Takes our typed state string and turns it into a serialized network package
      });

      const data = await res.json(); // Waits for the backend server to respond and converts its raw text package back into data
      
      // If the server response payload contains an error message property...
      if (data.error) {
        setError(data.error); // Display that error message to the user
      } else {
        setCards(data.cards); // Otherwise, successfully load the fresh AI array into our card memory slot
      }
    } catch (err) {
      setError("Something went wrong while communicating with the AI backend.");
    } finally {
      setLoading(false); // Turns off the loading state since the request is completed
    }
  }

  // --- What Gets Rendered to the Screen ---
  return (
    <main className="max-w-2xl mx-auto p-8">
      {/* Auth Header Panel */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold">AI Flashcard Generator</h1>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button onClick={logout} className="text-xs bg-gray-200 px-3 py-1.5 rounded hover:bg-gray-300 transition">
              Sign Out
            </button>
          </div>
        ) : (
          <button onClick={loginWithGoogle} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 transition">
            Sign In with Google
          </button>
        )}
      </div>

      {/* Input textbox tracking every single keystroke directly into our "text" state variable */}
      <textarea
        className="w-full h-40 border rounded p-3 mb-3"
        placeholder="Paste your notes here..."
        value={text} // Synchronizes the box value with our React text state memory
        onChange={(e) => setText(e.target.value)} // Every time a key is pressed, capture the text event and save it
      />

      {/* Action button that fires the generate function when clicked. It grays out if loading is true OR the box is empty */}
      <button
        onClick={generate}
        disabled={loading || !text.trim()}
        className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate Flashcards"}
      </button>

      {/* Conditional Rendering: Only creates this text tag on screen if an error state string actually exists */}
      {error && <p className="text-red-600 mt-3">{error}</p>}

      {/* Conditional Stage: Only displays this entire review block if our cards array length is greater than 0 */}
      {cards.length > 0 && (
        <div className="mt-8">
          {/* Displays current card position indicator (e.g. "Card 1 of 10") */}
          <p className="text-sm text-gray-500 mb-2">
            Card {currentIndex + 1} of {cards.length}
          </p>

          {/* Interactive Card Container Box */}
          <div
            onClick={() => setFlipped(!flipped)} // On click, invert the flipped status (turns true to false, or false to true)
            className="border rounded-lg p-8 min-h-[180px] flex items-center justify-center text-center cursor-pointer select-none hover:shadow-md transition"
          >
            <p className="text-lg">
              {/* Ternary condition: Is flipped true? If yes, render the answer text. If no, render the question text */}
              {flipped ? cards[currentIndex].answer : cards[currentIndex].question}
            </p>
          </div>

          <p className="text-xs text-gray-400 text-center mt-2">
            Click card to flip
          </p>

          {/* Slider Navigation Panel configured to loop infinitely */}
          <div className="flex justify-between items-center mt-4">
            {/* Prev Button: Loops back to the end if pressed on the first card */}
            <button
              onClick={() => {
                setFlipped(false); // Resets flip state back to question view before changing cards
                setCurrentIndex((i) => (i === 0 ? cards.length - 1 : i - 1)); // If at 0, teleport to last card index
              }}
              className="px-4 py-2 border rounded hover:bg-gray-50 transition"
            >
              ← Prev
            </button>

            {/* Save Deck Trigger Button */}
            <button
              onClick={saveDeck}
              disabled={saving}
              className="px-5 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 disabled:opacity-50 transition"
            >
              {saving ? "Saving..." : "Save Deck"}
            </button>
            
            {/* Next Button: Loops back to the start if pressed on the last card */}
            <button
              onClick={() => {
                setFlipped(false); // Resets flip state back to question view before changing cards
                setCurrentIndex((i) => (i === cards.length - 1 ? 0 : i + 1)); // If at the end, teleport back to index 0
              }}
              className="px-4 py-2 border rounded hover:bg-gray-50 transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}