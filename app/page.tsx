"use client"; // Tells Next.js to run this code in the user's browser, allowing clicks and typing

import { useState } from "react"; // Imports React's memory storage system (hooks)

// TypeScript blueprint: promises our app that every card object MUST have text question and answer strings
type Card = { question: string; answer: string };

export default function Home() {
  // --- Memory State Slots ---
  const [text, setText] = useState(""); // Tracks whatever the user types inside the textarea box
  const [cards, setCards] = useState<Card[]>([]); // Holds the array of flashcards returned from the backend AI
  const [loading, setLoading] = useState(false); // Tracks whether the application is waiting on the AI API call
  const [error, setError] = useState(""); // Holds any error message strings if something goes wrong
  const [currentIndex, setCurrentIndex] = useState(0); // Tracks the index number of the card currently visible on screen
  const [flipped, setFlipped] = useState(false); // A binary switch: false = show question, true = show answer

  // --- The AI Communication Courier Function ---
  async function generate() {
    setCurrentIndex(0); // Resets review deck back to the first card for the new batch
    setFlipped(false);  // Forces the deck to start on the question side, not the answer side
    setCards([]);       // Wipes out old flashcards from the screen immediately

    // Sends a network request over to our private backend folder route
    const res = await fetch("/api/generate", {
      method: "POST", // Using POST to securely transmit data inside a package body
      headers: { "Content-Type": "application/json" }, // Tells the backend that the incoming data package is JSON format
      body: JSON.stringify({ text }), // Takes our typed state string and turns it into a serialized network package
    });

    const data = await res.json(); // Waits for the backend server to respond and converts its raw text package back into data
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
      <h1 className="text-2xl font-bold mb-4">AI Flashcard Generator</h1>

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
          <p className="text-sm text-gray-500 mb-2">
            Card {currentIndex + 1} of {cards.length} {/* +1 is used because coding arrays always start counting at index 0 */}
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