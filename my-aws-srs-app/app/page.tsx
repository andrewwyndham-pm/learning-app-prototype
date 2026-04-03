'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

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
  const [message, setMessage] = useState<string | null>(null);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCardPreview[]>([]);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsAuthenticated(Boolean(session?.user));
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setMessage('Account created. Check your email if confirmation is enabled, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setMessage('Signed in successfully.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Signed out.');
  }

  async function handleBootstrap(action: 'claim-orphans' | 'create-starter-cards') {
    setIsBootstrapping(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sign in before bootstrapping cards.');
      }

      const response = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Bootstrap request failed.');
      }

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

      if (!session?.access_token) {
        throw new Error('Sign in before generating flashcards.');
      }

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

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to generate flashcards.');
      }

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef6ff,_#f8fafc_55%,_#e5edf7)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-700">StretchCards</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight text-slate-950">
            Stretch your memory with spaced repetition.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Paste your notes, generate flashcards, and review them with an optimized spaced repetition schedule.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/review"
              className="rounded-full bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Open review queue
            </Link>
            <Link
              href="/manage"
              className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Manage Cards
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Sign out
            </button>
          </div>
          {isAuthenticated ? (
            <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Create Flashcards</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">Paste notes and generate flashcards</h2>
                </div>
            
              </div>

              <form onSubmit={handleIngest} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Subject</span>
                    <input
                      type="text"
                      value={subject}
                      onChange={event => setSubject(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                      placeholder="Authentication"
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
                  {generatedCards.length > 0 ? (
                    <Link
                      href="/review"
                      className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      Review new cards
                    </Link>
                  ) : null}
                </div>
              </form>
              {ingestMessage ? (
                <p className="mt-4 text-sm text-slate-600">{ingestMessage}</p>
              ) : null}
              {generatedCards.length > 0 ? (
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
              ) : null}
            </div>
          ) : null}
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Bootstrap data</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
              Use these tools once you are signed in to claim old cards with no owner or create a small starter deck
              for end-to-end auth testing.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!isAuthenticated || isBootstrapping}
                onClick={() => handleBootstrap('claim-orphans')}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Claim orphaned cards
              </button>
              <button
                type="button"
                disabled={!isAuthenticated || isBootstrapping}
                onClick={() => handleBootstrap('create-starter-cards')}
                className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create starter cards
              </button>
            </div>
          </div>
        </section>

        {!isAuthenticated ? (
          <section className="flex items-center">
            <div className="w-full rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      mode === 'sign-in' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('sign-up')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${
                      mode === 'sign-up' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
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
              </>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
