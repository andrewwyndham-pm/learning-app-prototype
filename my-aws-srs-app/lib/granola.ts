import type {
  GranolaListNotesResponse,
  GranolaNoteDetail,
} from '@/types/granola';

const BASE_URL = 'https://public-api.granola.ai/v1';

// Granola rate limit: 5 req/s sustained, 25 req per 5s burst.
// We stay well under the sustained limit with a 250ms gap between calls.
const RATE_LIMIT_DELAY_MS = 250;
const MAX_RETRIES = 4;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${requireEnv('GRANOLA_API_KEY')}`,
    'Content-Type': 'application/json',
  };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wraps fetch with exponential backoff on 429 responses.
async function fetchWithRetry(url: string): Promise<Response> {
  let delay = RATE_LIMIT_DELAY_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await sleep(delay);
    const res = await fetch(url, { headers: authHeaders() });

    if (res.status !== 429) return res;

    // Back off exponentially: 250ms → 500ms → 1s → 2s → 4s
    const retryAfter = res.headers.get('retry-after');
    delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * 2;
    console.warn(`Granola 429 on ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
  }

  throw new Error(`Granola rate limit exceeded after ${MAX_RETRIES} retries: ${url}`);
}

// Fetch a page of note summaries created after the given ISO 8601 timestamp.
// Pass `cursor` to continue pagination from a previous response.
export async function listNotesSince(
  createdAfter: string,
  cursor?: string,
): Promise<GranolaListNotesResponse> {
  const params = new URLSearchParams({ created_after: createdAfter });
  if (cursor) params.set('cursor', cursor);

  const res = await fetchWithRetry(`${BASE_URL}/notes?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Granola listNotes failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GranolaListNotesResponse>;
}

// Fetch the full detail for a single note, including transcript and folder membership.
export async function fetchNoteDetail(noteId: string): Promise<GranolaNoteDetail> {
  const res = await fetchWithRetry(`${BASE_URL}/notes/${noteId}`);

  if (res.status === 404) {
    throw new GranolaNotFoundError(`Granola note not found: ${noteId}`);
  }

  if (!res.ok) {
    throw new Error(`Granola fetchNote failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GranolaNoteDetail>;
}

// Sentinel error for 404s so callers can skip gracefully without aborting the run.
export class GranolaNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GranolaNotFoundError';
  }
}

// Returns true if the note belongs to the folder configured in GRANOLA_AWS_FOLDER_ID.
export function isInAwsFolder(note: GranolaNoteDetail): boolean {
  const folderId = requireEnv('GRANOLA_AWS_FOLDER_ID');
  return note.folder_membership.some(f => f.id === folderId);
}

// Extracts the best available plain text for flashcard generation.
// Prefers the full transcript (richer content); falls back to the AI summary.
export function extractSourceText(note: GranolaNoteDetail): string | null {
  if (note.transcript && note.transcript.length > 0) {
    return note.transcript
      .map(seg => (seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text))
      .join('\n');
  }

  if (note.summary_text && note.summary_text.trim().length > 0) {
    return note.summary_text.trim();
  }

  return null;
}
