'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase';

interface ShareDeckButtonProps {
  deckId: string;
  deckTitle: string;
  existingShareId?: string;
}

export default function ShareDeckButton({ deckId, deckTitle, existingShareId }: ShareDeckButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        console.log('ShareButton - Auth check:', !!session);
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (existingShareId) {
      // Use the full URL for production
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     (typeof window !== 'undefined' ? window.location.origin : '');
      const url = `${baseUrl}/share/${existingShareId}`;
      setShareUrl(url);
    }
  }, [existingShareId]);

  const generateShareLink = async () => {
    if (!isAuthenticated) {
      alert('Please sign in first to share decks!');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please sign in first to share decks!');
        setIsLoading(false);
        return;
      }

      console.log('Sharing deck with ID:', deckId);
      
      const response = await fetch(`/api/decks/${deckId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate share link');
      }

      // Use the URL from the response or construct it
      const shareUrl = data.shareUrl || `${window.location.origin}/share/${data.shareId}`;
      setShareUrl(shareUrl);
      setShowModal(true);
    } catch (error: any) {
      console.error('Share error:', error);
      alert(error.message || 'Failed to create share link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const openInNewTab = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    console.log('ShareButton - Not authenticated, hiding');
    return null;
  }

  const hasExistingShare = !!shareUrl;

  return (
    <>
      <button
        onClick={hasExistingShare ? () => setShowModal(true) : generateShareLink}
        disabled={isLoading}
        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors inline-flex items-center gap-1.5 ${
          hasExistingShare 
            ? 'bg-teal/10 text-teal hover:bg-teal/20 border border-teal/20' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={hasExistingShare ? 'Copy share link' : 'Generate share link'}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {isLoading ? '...' : hasExistingShare ? 'Share' : 'Share'}
      </button>

      {showModal && shareUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Share "{deckTitle}"</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Anyone with this link can study this deck without signing in
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={openInNewTab}
                className="w-full bg-teal text-white px-4 py-2 rounded-md font-medium hover:bg-teal/90 transition-colors"
              >
                Open in New Tab
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="w-full border border-gray-300 px-4 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
