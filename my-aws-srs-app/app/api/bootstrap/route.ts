import { NextRequest, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase';

const starterCards = [
  {
    front: 'What does SRS stand for?',
    back: 'Spaced repetition system.',
    subject: 'Foundations',
  },
  {
    front: 'What does FSRS optimize for?',
    back: 'Scheduling each review at the best future time based on memory stability and difficulty.',
    subject: 'Foundations',
  },
  {
    front: 'Why is row-level security important in Supabase?',
    back: 'It ensures each authenticated user can only access rows permitted by policy.',
    subject: 'Supabase',
  },
];

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!accessToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { user };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);

    if ('error' in auth) {
      return auth.error;
    }

    const { user } = auth;
    const { action } = await request.json();

    if (action === 'claim-orphans') {
      const { data, error } = await supabaseAdmin
        .from('flashcards')
        .update({ user_id: user.id })
        .is('user_id', null)
        .select('id');

      if (error) {
        console.error('Error claiming orphaned cards:', error);
        return NextResponse.json({ error: 'Failed to claim cards' }, { status: 500 });
      }

      return NextResponse.json({ claimedCount: data.length, success: true });
    }

    if (action === 'create-starter-cards') {
      const now = new Date().toISOString();
      const cards = starterCards.map(card => ({
        ...card,
        next_review: now,
        user_id: user.id,
      }));

      const { data, error } = await supabaseAdmin
        .from('flashcards')
        .insert(cards)
        .select('id');

      if (error) {
        console.error('Error creating starter cards:', error);
        return NextResponse.json({ error: 'Failed to create starter cards' }, { status: 500 });
      }

      return NextResponse.json({ createdCount: data.length, success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Bootstrap API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
