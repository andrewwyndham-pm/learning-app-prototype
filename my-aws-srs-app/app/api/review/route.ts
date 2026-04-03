// app/api/review/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateNextReview } from '@/lib/fsrs';
import { Rating } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get the card ID and the user's rating from the request
    const { cardId, rating } = await req.json();

    if (!cardId || !rating) {
      return NextResponse.json({ error: 'cardId and rating are required' }, { status: 400 });
    }

    // 2. Fetch the card's current FSRS state from the database
    const { data: card, error: fetchError } = await supabaseAdmin
      .from('flashcards')
      .select('stability, difficulty, last_review')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !card) {
      console.error('Error fetching card:', fetchError);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // 3. Use the FSRS helper to calculate the new state
    const { stability, difficulty, next_review } = calculateNextReview({
      stability: card.stability,
      difficulty: card.difficulty,
      last_review: card.last_review,
      rating: rating as Rating, // Cast the number from JSON to our Enum
    });

    // 4. Update the card in the database with the new values
    const { error: updateError } = await supabaseAdmin
      .from('flashcards')
      .update({
        stability,
        difficulty,
        next_review: next_review.toISOString(),
        last_review: new Date().toISOString(), // Also update the last review date
      })
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating card:', updateError);
      return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
    }

    console.log(`Updated card ${cardId} with rating ${rating}. Next review: ${next_review.toLocaleDateString()}`);

    // 5. Send a success response
    return NextResponse.json({ success: true, next_review });

  } catch (error) {
    console.error('API Review Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
