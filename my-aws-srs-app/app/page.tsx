'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase-client';

interface GeneratedCardPreview {
  back: string;
  front: string;
  id: string;
  lecture_date: string | null;
  next_review: string;
  subject: string | null;
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [subject, setSubject] = useState('');
  const [lectureDate, setLectureDate] = useState('');
  const [cardCount, setCardCount] = useState('5');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reviewQueueCount, setReviewQueueCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCardPreview[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(Boolean(session?.user));
      if (session?.user) void loadReviewQueueCount();
    }

    async function loadReviewQueueCount() {
      const { count } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .lte('next_review', new Date().toISOString());
      setReviewQueueCount(count ?? 0);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      if (session?.user) void loadReviewQueueCount();
      else setReviewQueueCount(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage('Signed in successfully.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setMenuOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  async function handleBootstrap(action: 'claim-orphans' | 'create-starter-cards') {
    setIsBootstrapping(true);
    setMessage(null);
    setMenuOpen(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('Sign in before bootstrapping cards.');

      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'Bootstrap request failed.');

      if (action === 'claim-orphans') {
        setMessage(`Claimed ${payload.claimedCount} orphaned card(s).`);
      } else {
        setMessage(`Created ${payload.createdCount} starter card(s).`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bootstrap request failed.');
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function handleIngest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsIngesting(true);
    setIngestMessage(null);
    setGeneratedCards([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('Sign in before generating flashcards.');

      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardCount: Number(cardCount),
          lectureDate: lectureDate || null,
          sourceText,
          subject,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to generate flashcards.');

      setGeneratedCards(payload.cards ?? []);
      setIngestMessage(`Generated ${payload.createdCount} flashcard(s) from your notes.`);
      setSourceText('');
    } catch (error) {
      setIngestMessage(error instanceof Error ? error.message : 'Failed to generate flashcards.');
    } finally {
      setIsIngesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef6ff,_#f8fafc_55%,_#e5edf7)] text-slate-900">

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">StretchCards</span>

        {isAuthenticated && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
              aria-label="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 0 1 1.262.125l.962.962a1 1 0 0 1 .125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.295a1 1 0 0 1 .804.98v1.36a1 1 0 0 1-.804.98l-1.473.295a6.95 6.95 0 0 1-.587 1.416l.834 1.25a1 1 0 0 1-.125 1.262l-.962.962a1 1 0 0 1-1.262.125l-1.25-.834a6.953 6.953 0 0 1-1.416.587l-.295 1.473a1 1 0 0 1-.98.804H9.32a1 1 0 0 1-.98-.804l-.295-1.473a6.953 6.953 0 0 1-1.416-.587l-1.25.834a1 1 0 0 1-1.262-.125l-.962-.962a1 1 0 0 1-.125-1.262l.834-1.25a6.95 6.95 0 0 1-.587-1.416l-1.473-.295A1 1 0 0 1 1 10.68V9.32a1 1 0 0 1 .804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 0 1 .125-1.262l.962-.962A1 1 0 0 1 5.379 2.03l1.25.834a6.953 6.953 0 0 1 1.416-.587L8.34 1.804ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-lg">
                <Link
                  href="/manage"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
                    <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                  Manage cards
                </Link>

                <div className="my-1 border-t border-slate-100" />

                <p className="px-4 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Bootstrap</p>
                <button
                  type="button"
                  disabled={isBootstrapping}
                  onClick={() => handleBootstrap('claim-orphans')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
                    <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.061-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.062 1.06a.75.75 0 0 0 1.061 1.061l1.061-1.061ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.062a.75.75 0 0 0-1.06 1.061l1.06 1.061ZM5.404 6.464a.75.75 0 0 0 1.06-1.06L5.403 4.343a.75.75 0 0 0-1.06 1.06l1.06 1.061Z" />
                  </svg>
                  Claim orphaned cards
                </button>
                <button
                  type="button"
                  disabled={isBootstrapping}
                  onClick={() => handleBootstrap('create-starter-cards')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-400">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" />
                  </svg>
                  Create starter cards
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.08a.75.75 0 1 0-1.004-1.114l-2.5 2.5a.75.75 0 0 0 0 1.108l2.5 2.5a.75.75 0 1 0 1.004-1.114l-1.048-1.08H18.25A.75.75 0 0 0 19 10Z" clipRule="evenodd" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-2xl flex-col items-center px-6 pb-8 pt-16 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
          Stretch your memory<br />with spaced repetition.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-slate-500">
          Paste your notes, generate flashcards, and review them on an optimized schedule.
        </p>

        {isAuthenticated ? (
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/review"
              className="relative inline-flex items-center gap-2 rounded-full bg-slate-950 px-8 py-4 text-lg font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              Open review queue
              {reviewQueueCount !== null && reviewQueueCount > 0 && (
                <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-sky-500 px-1.5 text-xs font-bold text-white">
                  {reviewQueueCount}
                </span>
              )}
            </Link>
            {reviewQueueCount === 0 && (
              <p className="text-sm text-slate-400">No cards due — you&apos;re all caught up.</p>
            )}
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
      </section>

      {/* Authenticated: ingest form */}
      {isAuthenticated ? (
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="relative">
            <div className="absolute inset-x-0 -top-px flex justify-center">
              <span className="bg-[#f0f5fc] px-4 text-sm text-slate-400">or generate new flashcards</span>
            </div>
            <div className="border-t border-slate-200" />
          </div>

          <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur">
            <h2 className="text-xl font-semibold text-slate-950">Generate flashcards from notes</h2>

            <form onSubmit={handleIngest} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Subject</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={event => setSubject(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                    placeholder="e.g. Authentication"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Date</span>
                  <input
                    type="date"
                    value={lectureDate}
                    onChange={event => setLectureDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  value={sourceText}
                  onChange={event => setSourceText(event.target.value)}
                  className="min-h-56 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 outline-none transition focus:border-sky-500 focus:bg-white"
                  placeholder="Paste lecture notes, textbook excerpts, or a transcript summary here."
                  required
                />
              </label>

              <div className="flex flex-wrap items-end gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Cards to generate</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={cardCount}
                    onChange={event => setCardCount(event.target.value)}
                    className="w-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isIngesting}
                  className="rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                >
                  {isIngesting ? 'Generating...' : 'Generate flashcards'}
                </button>
                {generatedCards.length > 0 && (
                  <Link
                    href="/review"
                    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
                  >
                    Review new cards
                  </Link>
                )}
              </div>
            </form>

            {ingestMessage ? <p className="mt-4 text-sm text-slate-600">{ingestMessage}</p> : null}

            {generatedCards.length > 0 && (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-slate-950">Generated cards</h3>
                  <span className="text-sm text-slate-500">{generatedCards.length} created</span>
                </div>
                <div className="mt-4 space-y-3">
                  {generatedCards.map(card => (
                    <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Front</p>
                      <p className="mt-2 text-base text-slate-900">{card.front}</p>
                      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Back</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{card.back}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Unauthenticated: centered sign-in card */
        <section className="mx-auto max-w-md px-6 pb-20">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('sign-in')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'sign-in' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('sign-up')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === 'sign-up' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sign up
              </button>
            </div>

            <h2 className="mt-6 text-2xl font-semibold text-slate-950">
              {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">Use email and password to continue.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {isSubmitting ? 'Submitting...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
          </div>
        </section>
      )}
    </main>
  );
}
