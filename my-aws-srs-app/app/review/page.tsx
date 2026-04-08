'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Flashcard, Rating } from '@/types';

export default function ReviewPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDueCards() {
      setIsLoading(true);
      setErrorMessage(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error loading session:', sessionError);
        setErrorMessage('Unable to load your session.');
        setIsLoading(false);
        return;
      }

      if (!session?.user) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const today = new Date().toISOString();
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .lte('next_review', today)
        .order('next_review', { ascending: true });

      if (error) {
        console.error('Error fetching cards:', error);
        setErrorMessage('Unable to load your review cards.');
      } else {
        setCards((data || []) as Flashcard[]);
      }
      setIsLoading(false);
    }

    fetchDueCards();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCards([]);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
        void fetchDueCards();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRate = async (rating: Rating) => {
    if (isUpdating) return;
    setIsUpdating(true);

    const card = cards[currentCardIndex];

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('You must be signed in to review cards.');
      }

      const response = await fetch('/api/review', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId: card.id, rating }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? 'Failed to update card');
      }

      setCurrentCardIndex(prevIndex => prevIndex + 1);
      setIsFlipped(false);
    } catch (error) {
      console.error('Rating error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update card.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-xl">Loading review session...</div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Sign in required</h1>
          <p className="mt-3 text-gray-600">You need an active account before you can review cards.</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (cards.length === 0 || currentCardIndex >= cards.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-4xl font-bold">You&apos;re all done! ✅</h1>
          <p className="mt-2 text-lg text-gray-600">No more cards to review today. Great job!</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Back to home
          </Link>
        </div>
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
      </main>
    );
  }

  const currentCard = cards[currentCardIndex];

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <Link
        href="/"
        className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        aria-label="Back to home"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Home
      </Link>
      <div className="w-full max-w-2xl">
        <p className="text-center text-sm text-gray-500 mb-4">{currentCardIndex + 1} of {cards.length}</p>
        {errorMessage ? <p className="mb-4 text-center text-sm text-red-600">{errorMessage}</p> : null}
        <div
          className={`flex h-80 w-full items-center justify-center rounded-lg border p-6 shadow-lg transition-colors duration-300 ${
            isFlipped ? 'bg-gray-100' : 'bg-white'
          }`}
        >
          <p className={`text-center ${isFlipped ? 'text-xl' : 'text-2xl'}`}>
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
        </div>

        <div className="mt-8">
          {!isFlipped ? (
            <button onClick={handleFlip} className="w-full px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Flip
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button onClick={() => handleRate(Rating.Again)} disabled={isUpdating} className="px-4 py-3 font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400">Again</button>
              <button onClick={() => handleRate(Rating.Hard)} disabled={isUpdating} className="px-4 py-3 font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-gray-400">Hard</button>
              <button onClick={() => handleRate(Rating.Good)} disabled={isUpdating} className="px-4 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">Good</button>
              <button onClick={() => handleRate(Rating.Easy)} disabled={isUpdating} className="px-4 py-3 font-semibold text-white bg-sky-500 rounded-lg hover:bg-sky-600 disabled:bg-gray-400">Easy</button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
