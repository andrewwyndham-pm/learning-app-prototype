'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase-client';
import type { Flashcard } from '@/types';

type SortColumn = 'created_at' | 'last_review' | 'subject';
type SortDirection = 'asc' | 'desc';

function formatDate(value: string | null) {
  if (!value) {
    return 'Never';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString();
}

function compareNullableStrings(left: string | null, right: string | null, direction: SortDirection) {
  const leftValue = (left ?? '').toLowerCase();
  const rightValue = (right ?? '').toLowerCase();

  return direction === 'asc'
    ? leftValue.localeCompare(rightValue)
    : rightValue.localeCompare(leftValue);
}

function compareNullableDates(left: string | null, right: string | null, direction: SortDirection) {
  const leftValue = left ? new Date(left).getTime() : -Infinity;
  const rightValue = right ? new Date(right).getTime() : -Infinity;

  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
}

export default function ManageCardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    async function fetchCards() {
      setIsLoading(true);
      setErrorMessage(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
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

      const { data, error } = await supabase
        .from('flashcards')
        .select('*');

      if (error) {
        console.error('Error fetching cards:', error);
        setErrorMessage('Unable to load your cards.');
      } else {
        setCards(data ?? []);
      }

      setIsLoading(false);
    }

    void fetchCards();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setCards([]);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
        void fetchCards();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const sortedCards = useMemo(() => {
    const nextCards = [...cards];

    nextCards.sort((left, right) => {
      if (sortColumn === 'subject') {
        return compareNullableStrings(left.subject, right.subject, sortDirection);
      }

      if (sortColumn === 'last_review') {
        return compareNullableDates(left.last_review, right.last_review, sortDirection);
      }

      return compareNullableDates(left.created_at, right.created_at, sortDirection);
    });

    return nextCards;
  }, [cards, sortColumn, sortDirection]);

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === 'subject' ? 'asc' : 'desc');
  }

  async function handleDelete(cardId: string) {
    setIsDeletingId(cardId);
    setErrorMessage(null);

    const { error } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', cardId);

    if (error) {
      console.error('Error deleting card:', error);
      setErrorMessage('Unable to delete that flashcard.');
      setIsDeletingId(null);
      return;
    }

    setCards(currentCards => currentCards.filter(card => card.id !== cardId));
    setIsDeletingId(null);
  }

  function sortLabel(column: SortColumn) {
    if (sortColumn !== column) {
      return '';
    }

    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-xl">Loading cards...</div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">Sign in required</h1>
          <p className="mt-3 text-gray-600">You need an active account before you can manage cards.</p>
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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Manage Cards</p>
            <h1 className="mt-2 text-4xl font-semibold text-slate-950">All flashcards</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Back to home
            </Link>
            <Link
              href="/review"
              className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Open review queue
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-sm text-slate-600">
                  <th className="px-6 py-4 font-semibold">Card</th>
                  <th className="px-6 py-4 font-semibold">
                    <button type="button" onClick={() => toggleSort('subject')} className="font-semibold hover:text-slate-950">
                      Subject{sortLabel('subject')}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-semibold">
                    <button type="button" onClick={() => toggleSort('created_at')} className="font-semibold hover:text-slate-950">
                      Created on{sortLabel('created_at')}
                    </button>
                  </th>
                  <th className="px-6 py-4 font-semibold">
                    <button type="button" onClick={() => toggleSort('last_review')} className="font-semibold hover:text-slate-950">
                      Last reviewed{sortLabel('last_review')}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right font-semibold">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCards.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No flashcards yet.
                    </td>
                  </tr>
                ) : (
                  sortedCards.map(card => (
                    <tr key={card.id} className="align-top text-sm text-slate-700">
                      <td className="max-w-md px-6 py-4">
                        <p className="font-medium text-slate-900">{card.front}</p>
                      </td>
                      <td className="px-6 py-4">{card.subject ?? 'Unassigned'}</td>
                      <td className="px-6 py-4">{formatDate(card.created_at)}</td>
                      <td className="px-6 py-4">{formatDate(card.last_review)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(card.id)}
                          disabled={isDeletingId === card.id}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Delete ${card.front}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                            <path d="M4 7h16" strokeLinecap="round" />
                            <path d="M10 11v6" strokeLinecap="round" />
                            <path d="M14 11v6" strokeLinecap="round" />
                            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
