import { createClient, createServerClient } from '../../../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== Share API called ===');
    
    const { id: deckId } = await params;
    console.log('1. Deck ID from params:', deckId);
    
    // Validate deckId
    if (!deckId) {
      console.log('2. Invalid deck ID - empty');
      return NextResponse.json(
        { error: 'Invalid deck ID' },
        { status: 400 }
      );
    }
    
    const authHeader = request.headers.get('Authorization');
    console.log('3. Authorization header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('4. No valid auth header');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    console.log('5. Token received (first 20 chars):', token.substring(0, 20) + '...');
    
    const supabase = createServerClient(token);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    


    if (userError) {
      console.log('8. User error:', userError);
    }
    
    if (!user) {
      console.log('9. No user found');
      return NextResponse.json(
        { error: 'Unauthorized - Invalid session' },
        { status: 401 }
      );
    }

    console.log('10. User authenticated:', user.email);
    console.log('11. User ID:', user.id);

    // Try to find the deck
    console.log('12. Looking for deck with ID:', deckId);
    console.log('13. Also checking user_id:', user.id);
    
    // First, let's check if the deck exists at all (without user filter)
    const { data: allDecks, error: allDecksError } = await supabase
      .from('decks')
      .select('id, title, user_id')
      .limit(10);
    
    console.log('14. All decks in DB (first 10):', allDecks);
    console.log('15. All decks error:', allDecksError);
    
    // Now try to find the specific deck
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('id', deckId)
      .maybeSingle();

    if (deckError) {
      console.log('16. Deck fetch error:', deckError);
      return NextResponse.json(
        { error: 'Database error: ' + deckError.message },
        { status: 500 }
      );
    }

    if (!deck) {
      console.log('17. Deck not found with ID:', deckId);
      console.log('18. All decks in DB:', allDecks);
      return NextResponse.json(
        { error: 'Deck not found' },
        { status: 404 }
      );
    }

    console.log('19. Deck found:', deck);
    console.log('20. Deck user_id:', deck.user_id);
    console.log('21. Current user_id:', user.id);

    if (deck.user_id !== user.id) {
      console.log('22. User doesn\'t own this deck');
      return NextResponse.json(
        { error: 'You don\'t have permission to share this deck' },
        { status: 403 }
      );
    }

    // Determine the base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://ai-flashcard-generator-rosy.vercel.app' 
                     : 'http://localhost:3000');
    console.log('23. Base URL:', baseUrl);

    // If deck already has a share_id, return it
    if (deck.share_id) {
      const shareUrl = `${baseUrl}/share/${deck.share_id}`;
      console.log('24. Existing share URL:', shareUrl);
      
      return NextResponse.json({
        shareId: deck.share_id,
        shareUrl,
        isNew: false
      });
    }

    // Generate new share_id
    const shareId = nanoid(10);
    console.log('25. Generated share_id:', shareId);

    // Update deck with share_id
    const { error: updateError } = await supabase
      .from('decks')
      .update({ share_id: shareId })
      .eq('id', deckId);

    if (updateError) {
      console.log('26. Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to generate share link: ' + updateError.message },
        { status: 500 }
      );
    }

    const shareUrl = `${baseUrl}/share/${shareId}`;
    console.log('27. New share URL:', shareUrl);
    console.log('=== Share API completed successfully ===');

    return NextResponse.json({
      shareId,
      shareUrl,
      isNew: true
    });

  } catch (error: any) {
    console.error('=== Share API error ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Internal server error: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
}