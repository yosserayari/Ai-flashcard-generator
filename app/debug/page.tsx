'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [decks, setDecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function debug() {
      try {
        const supabase = createClient();
        
        // Check authentication
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        
        if (!user) {
          setLoading(false);
          return;
        }
        
        // Get all decks
        const { data: decks, error } = await supabase
          .from('decks')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          setError(error.message);
        } else {
          setDecks(decks || []);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    debug();
  }, []);

  if (loading) {
    return <div className="p-8">Loading debug info...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
      
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-2">Authentication</h2>
        {user ? (
          <div>
            <p>✅ Logged in as: <strong>{user.email}</strong></p>
            <p>User ID: <code className="bg-gray-200 px-2 py-1 rounded text-sm">{user.id}</code></p>
          </div>
        ) : (
          <p>❌ Not logged in</p>
        )}
      </div>

      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="font-semibold mb-2">Decks in Database ({decks.length})</h2>
        {error && (
          <p className="text-red-500">Error: {error}</p>
        )}
        {decks.length === 0 ? (
          <p className="text-gray-500">No decks found in the database.</p>
        ) : (
          <div className="space-y-2">
            {decks.map((deck) => (
              <div key={deck.id} className="p-3 bg-white rounded border">
                <p><strong>ID:</strong> <code className="text-sm">{deck.id}</code></p>
                <p><strong>Title:</strong> {deck.title}</p>
                <p><strong>Share ID:</strong> {deck.share_id || 'Not shared yet'}</p>
                <p><strong>Created:</strong> {new Date(deck.created_at).toLocaleString()}</p>
                <p><strong>User ID:</strong> <code className="text-sm">{deck.user_id}</code></p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-yellow-50 rounded-lg">
        <h2 className="font-semibold mb-2">Test Share API</h2>
        {decks.length > 0 && (
          <div>
            <p className="mb-2">Try sharing the first deck:</p>
            <button
              onClick={async () => {
                const deck = decks[0];
                try {
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  
                  const response = await fetch(`/api/decks/${deck.id}/share`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${session?.access_token}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  const result = await response.json();
                  console.log('Share API Response:', result);
                  alert(JSON.stringify(result, null, 2));
                } catch (err: any) {
                  alert('Error: ' + err.message);
                }
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Test Share API
            </button>
          </div>
        )}
      </div>
    </div>
  );
}