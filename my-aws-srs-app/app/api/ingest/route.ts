import { NextRequest, NextResponse } from 'next/server';

import { generateFlashcards } from '@/lib/gemini';
import { supabaseAdmin } from '@/lib/supabase';

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
    const body = await request.json();
    const sourceText = typeof body.sourceText === 'string' ? body.sourceText : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : null;
    const lectureDate = typeof body.lectureDate === 'string' ? body.lectureDate : null;
    const cardCount = typeof body.cardCount === 'number' ? body.cardCount : undefined;

    if (!sourceText.trim()) {
      return NextResponse.json({ error: 'sourceText is required' }, { status: 400 });
    }

    const generatedCards = await generateFlashcards({
      cardCount,
      sourceText,
    });

    const now = new Date().toISOString();
    const records = generatedCards.map(card => ({
      back: card.back,
      front: card.front,
      lecture_date: lectureDate,
      next_review: now,
      subject,
      user_id: user.id,
    }));

    const { data, error } = await supabaseAdmin
      .from('flashcards')
      .insert(records)
      .select('id, front, back, subject, lecture_date, next_review');

    if (error) {
      console.error('Error inserting generated cards:', error);
      return NextResponse.json({ error: 'Failed to save generated cards' }, { status: 500 });
    }

    return NextResponse.json({
      cards: data,
      createdCount: data.length,
      success: true,
    });
  } catch (error) {
    console.error('Ingest API error:', error);

    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('GEMINI_API_KEY') || message.includes('sourceText') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
