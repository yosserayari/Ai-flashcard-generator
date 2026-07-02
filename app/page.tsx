"use client";
import { createClient } from "./lib/supabase"; // Corrected path to match app/lib/supabase.ts
import { useState, useEffect } from "react"; // Added useEffect for the auth listener

// TypeScript blueprint: promises our app that every card object MUST have text question and answer strings
type Card = { question: string; answer: string };

interface User {
  id: string;
  email?: string;
}

export default function Home() {
  // --- Memory State Slots ---
  const [user, setUser] = useState<User | null>(null); // State for holding logged-in user session
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState(""); // Tracks whatever the user types inside the textarea box
  const [cards, setCards] = useState<Card[]>([]); // Holds the array of flashcards returned from the backend AI
  const [loading, setLoading] = useState(false); // Tracks whether the application is waiting on the AI API call
  const [error, setError] = useState(""); // Holds any error message strings if something goes wrong
  const [currentIndex, setCurrentIndex] = useState(0); // Tracks the index number of the card currently visible on screen
  const [flipped, setFlipped] = useState(false); // A binary switch: false = show question, true = show answer

  // --- 1. Authentic Session Listener Hook ---
  useEffect(() => {
    const supabase = createClient();

    // Catch session tokens directly out of the URL hash if present
    supabase.auth.getSession().then((res: { data?: { session?: any } }) => {
      const session = res?.data?.session;
      if (session) {
        setUser(session.user as User);
      }
    });

    // Listen continuously for OAuth redirect success events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session) {
        setUser(session.user as User);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 2. Google OAuth Handshake Functions ---
  async function loginWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) console.error("Login error:", error.message);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }
  // --- 3. Database Save Pipeline ---
  async function saveDeck() {
    if (cards.length === 0) return;
    
    if (!user) {
      alert("Please log in to save your decks!");
      return;
    }
   
    setSaving(true);
    const supabase = createClient();
   
    try {
      // 1. Insert the deck row as an array element (Supabase standard)
      const { data: deckData, error: deckError } = await supabase
        .from('decks')
        .insert([
          {
            title: text.substring(0, 30) || "Generated Flashcard Deck",
            user_id: user.id
          }
        ])
        .select()
        .single();
  
      if (deckError) throw deckError;
  
      // 2. Format cards matching your schema parameters
      const cardsToInsert = cards.map((card) => ({
        deck_id: deckData.id,
        front: card.question, // Maps your frontend 'question' key to database 'front' column
        back: card.answer,   // Maps your frontend 'answer' key to database 'back' column
      }));
  
      // 3. Batch insert all the cards belonging to this deck
      const { error: cardsError } = await supabase
        .from('cards')
        .insert(cardsToInsert);
  
      if (cardsError) throw cardsError;

      alert("Deck saved successfully to your profile! 🎉");
    } catch (error: any) {
      // Access direct properties so the error prints clearly instead of showing {}
      console.error("Error saving deck:", error.message || error);
      alert(error.message || "Failed to save the deck.");
    } finally {
      setSaving(false);
    }
  }

  // --- 3. Database Save Pipeline ---
  
  // --- 4. The AI Communication Courier Function ---
  async function generate() {
    setCurrentIndex(0); // Resets review deck back to the first card for the new batch
    setFlipped(false);  // Forces the deck to start on the question side, not the answer side
    setCards([]);
    setLoading(true);      // Wipes out old flashcards from the screen immediately

    // Sends a network request over to our private backend folder route
    const res = await fetch("/api/generate", {
      method: "POST", // Using POST to securely transmit data inside a package body
      headers: { "Content-Type": "application/json" }, // Tells the backend that the incoming data package is JSON format
      body: JSON.stringify({ text }), // Takes our typed state string and turns it into a serialized network package
    });

    const data = await res.json(); // Waits for the backend server to respond and converts its raw text package back into data
    loading && setLoading(false); // Safeguard loading switch closure
    setLoading(false); // Turns off the loading state since the request is completed

    // If the server response payload contains an error message property...
    if (data.error) {
      setError(data.error); // Display that error message to the user
    } else {
      setCards(data.cards); // Otherwise, successfully load the fresh AI array into our card memory slot
    }
  }

  // --- What Gets Rendered to the Screen ---
  return (
    <main className="max-w-2xl mx-auto p-8">
      {/* Authentic Auth Status Control Bar */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold">AI Flashcard Generator</h1>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Logged in as: <strong>{user.email}</strong></span>
              <button onClick={handleLogout} className="text-sm border px-3 py-1 rounded hover:bg-gray-50">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={loginWithGoogle} className="text-sm bg-black text-white px-4 py-1.5 rounded font-medium">
              Sign In with Google
            </button>
          )}
        </div>
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
        {loading ? "Generating..." : "Generate Flashcards"} {/* If loading is true, text shifts to "Generating..." */}
      </button>

      {/* Conditional Rendering: Only creates this text tag on screen if an error state string actually exists */}
      {error && <p className="text-red-600 mt-3">{error}</p>}

      {/* Conditional Stage: Only displays this entire review block if our cards array length is greater than 0 */}
      {cards.length > 0 && (
        <div className="mt-8">
          {/* Displays current card position indicator (e.g. "Card 1 of 10") */}
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-500">
              Card {currentIndex + 1} of {cards.length} {/* +1 is used because coding arrays always start counting at index 0 */}
            </p>
            {/* Inline Save Deck action button matching your style */}
            <button
              onClick={saveDeck}
              disabled={saving}
              className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Deck"}
            </button>
          </div>

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
          <div className="flex justify-between mt-4">
            {/* Prev Button: Loops back to the end if pressed on the first card */}
            <button
              onClick={() => {
                setFlipped(false); // Resets flip state back to question view before changing cards
                setCurrentIndex((i) => (i === 0 ? cards.length - 1 : i - 1)); // If at 0, teleport to last card index
              }}
              className="px-4 py-2 border rounded"
            >
              ← Prev
            </button>
            
            {/* Next Button: Loops back to the start if pressed on the last card */}
            <button
              onClick={() => {
                setFlipped(false); // Resets flip state back to question view before changing cards
                setCurrentIndex((i) => (i === cards.length - 1 ? 0 : i + 1)); // If at the end, teleport back to index 0
              }}
              className="px-4 py-2 border rounded"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}