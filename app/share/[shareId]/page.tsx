import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import PublicFlashcardViewer from './PublicFlashcardViewer';
import CloneDeckButton from '../../components/CloneDeckButton';

// This page uses Server Components for SEO and performance
export default async function SharedDeckPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting in server context
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookie removal in server context
          }
        },
      },
    }
  );

  // Fetch the deck by share_id
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id, title, created_at, user_id')
    .eq('share_id', shareId)
    .single();

  if (deckError || !deck) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold mb-2">Deck not found</h1>
          <p className="text-gray-500">
            This deck doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Fetch the cards for this deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, question, answer, position')
    .eq('deck_id', deck.id)
    .order('position', { ascending: true });

  if (cardsError || !cards) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold mb-2">Error loading deck</h1>
          <p className="text-gray-500">Could not load the cards for this deck.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="border-b border-line bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-display text-xl font-semibold">
              {deck.title}
            </h1>
            <p className="text-sm text-gray-500">
              Shared flashcard deck • {cards.length} cards
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <CloneDeckButton shareId={shareId} />
            </Suspense>
            <a
              href="/"
              className="text-sm bg-teal text-white px-4 py-2 rounded-md font-medium hover:bg-teal/90 transition-colors"
            >
              Create your own
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        <PublicFlashcardViewer cards={cards} deckTitle={deck.title} />
      </div>

      {/* Footer */}
      <footer className="border-t border-line mt-12">
        <div className="max-w-4xl mx-auto px-6 py-4 text-sm text-gray-500">
          <p>Made with Flashcard.app • Study smarter, not harder</p>
        </div>
      </footer>
    </div>
  );
}
