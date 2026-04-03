import { NextRequest, NextResponse } from 'next/server';

import { generateFlashcards } from '@/lib/gemini';
import {
  extractSourceText,
  fetchNoteDetail,
  GranolaNotFoundError,
  isInAwsFolder,
  listNotesSince,
} from '@/lib/granola';
import { supabaseAdmin } from '@/lib/supabase';

// ---------- Auth ----------

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) throw new Error('Missing required environment variable: SYNC_SECRET');
  return request.headers.get('x-sync-secret') === secret;
}

// ---------- Sync state helpers ----------

async function readLastSyncAt(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('sync_state')
    .select('value')
    .eq('key', 'last_sync_at')
    .single();

  return data?.value ?? '1970-01-01T00:00:00.000Z';
}

async function writeLastSyncAt(isoTimestamp: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sync_state')
    .upsert({ key: 'last_sync_at', value: isoTimestamp });

  if (error) throw new Error(`Failed to update sync_state: ${error.message}`);
}

// ---------- Idempotency helpers ----------

async function isAlreadySeen(noteId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('granola_processed_notes')
    .select('note_id')
    .eq('note_id', noteId)
    .maybeSingle();

  return data !== null;
}

// Mark a note as seen regardless of whether it was in the AWS folder.
// This prevents re-fetching its detail on future runs.
async function markSeen(noteId: string): Promise<void> {
  await supabaseAdmin
    .from('granola_processed_notes')
    .upsert({ note_id: noteId });
}

// ---------- Per-note processing ----------

type NoteOutcome =
  | { status: 'skipped_already_seen' }
  | { status: 'skipped_not_in_folder' }
  | { status: 'skipped_no_text' }
  | { status: 'created'; cardsCount: number };

async function processNote(
  noteId: string,
  noteTitle: string | null,
  userId: string,
): Promise<NoteOutcome> {
  if (await isAlreadySeen(noteId)) {
    return { status: 'skipped_already_seen' };
  }

  let note;
  try {
    note = await fetchNoteDetail(noteId);
  } catch (err) {
    if (err instanceof GranolaNotFoundError) {
      await markSeen(noteId); // won't come back
      return { status: 'skipped_not_in_folder' };
    }
    throw err;
  }

  if (!isInAwsFolder(note)) {
    // Mark seen so we never fetch this note's detail again
    await markSeen(noteId);
    return { status: 'skipped_not_in_folder' };
  }

  console.log(`  → AWS note found: "${noteTitle ?? noteId}" — generating flashcards...`);

  const sourceText = extractSourceText(note);
  if (!sourceText) {
    await markSeen(noteId);
    return { status: 'skipped_no_text' };
  }

  const subject = note.title ? note.title.slice(0, 100) : 'AWS Course';
  const lectureDate = note.created_at.slice(0, 10);

  const generatedCards = await generateFlashcards({ sourceText });

  const now = new Date().toISOString();
  const records = generatedCards.map(card => ({
    back: card.back,
    front: card.front,
    lecture_date: lectureDate,
    next_review: now,
    subject,
    user_id: userId,
  }));

  const { error } = await supabaseAdmin.from('flashcards').insert(records);
  if (error) throw new Error(`Failed to insert flashcards for note ${noteId}: ${error.message}`);

  await markSeen(noteId);
  console.log(`  ✓ Created ${generatedCards.length} cards for "${subject}"`);
  return { status: 'created', cardsCount: generatedCards.length };
}

// ---------- Route handler ----------

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = process.env.GRANOLA_USER_ID;
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required environment variable: GRANOLA_USER_ID' },
        { status: 500 },
      );
    }

    const syncStartedAt = new Date().toISOString();
    const lastSyncAt = await readLastSyncAt();
    console.log(`Granola sync started. Scanning notes since ${lastSyncAt}`);

    const summary = {
      notesScanned: 0,
      cardsCreated: 0,
      skipped: { alreadySeen: 0, notInFolder: 0, noText: 0 },
      errors: [] as Array<{ noteId: string; error: string }>,
    };

    let cursor: string | undefined;
    do {
      const page = await listNotesSince(lastSyncAt, cursor);
      console.log(`  Fetched page of ${page.notes.length} notes (hasMore: ${page.hasMore})`);

      for (const noteSummary of page.notes) {
        summary.notesScanned++;
        console.log(`  [${summary.notesScanned}] Checking: "${noteSummary.title ?? noteSummary.id}"`);

        try {
          const outcome = await processNote(noteSummary.id, noteSummary.title, userId);
          if (outcome.status === 'created') {
            summary.cardsCreated += outcome.cardsCount;
          } else if (outcome.status === 'skipped_already_seen') {
            summary.skipped.alreadySeen++;
          } else if (outcome.status === 'skipped_not_in_folder') {
            summary.skipped.notInFolder++;
          } else if (outcome.status === 'skipped_no_text') {
            summary.skipped.noText++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`  ✗ Error processing note ${noteSummary.id}:`, message);
          summary.errors.push({ noteId: noteSummary.id, error: message });
        }
      }

      cursor = page.hasMore && page.cursor ? page.cursor : undefined;
    } while (cursor !== undefined);

    // Only advance the watermark on a clean run.
    // Notes already marked as seen are protected from re-processing regardless.
    if (summary.errors.length === 0) {
      await writeLastSyncAt(syncStartedAt);
    }

    console.log(`Granola sync complete:`, summary);

    return NextResponse.json(
      { ...summary, lastSyncAt, syncStartedAt },
      { status: summary.errors.length > 0 ? 207 : 200 },
    );
  } catch (err) {
    console.error('Granola sync fatal error:', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
