import { createClient } from '../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== TEST SHARE API ===');
    
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'No auth token',
        step: 1
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token received');
    
    const supabase = createClient(token);
    
    // Test 1: Get user from token
    console.log('Testing: Get user from token');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('User error:', userError);
      return NextResponse.json({
        error: 'Invalid token',
        step: 2,
        details: userError?.message
      }, { status: 401 });
    }
    
    console.log('User found:', user.email);
    
    // Test 2: Get all decks for this user
    console.log('Testing: Get all decks for user');
    const { data: userDecks, error: userDecksError } = await supabase
      .from('decks')
      .select('id, title, share_id')
      .eq('user_id', user.id);
    
    console.log('User decks count:', userDecks?.length || 0);
    console.log('User decks:', userDecks);
    
    if (userDecksError) {
      console.log('Error getting user decks:', userDecksError);
    }
    
    // Test 3: Get ALL decks (to see if any exist)
    console.log('Testing: Get all decks');
    const { data: allDecks, error: allDecksError } = await supabase
      .from('decks')
      .select('id, title, user_id, share_id')
      .limit(10);
    
    console.log('All decks count:', allDecks?.length || 0);
    console.log('All decks:', allDecks);
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      userDecks: userDecks || [],
      allDecks: allDecks || [],
      message: 'Check the server console for detailed logs'
    });
    
  } catch (error: any) {
    console.error('Test API error:', error);
    return NextResponse.json({
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
}