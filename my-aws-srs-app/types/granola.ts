// Types for the Granola public API (https://public-api.granola.ai/v1)

// --- List Notes endpoint: GET /v1/notes ---

export interface GranolaNoteSummary {
  id: string;           // pattern: not_[alphanumeric]
  object: 'note';
  title: string | null;
  created_at: string;   // ISO 8601
  updated_at: string;   // ISO 8601
}

export interface GranolaListNotesResponse {
  notes: GranolaNoteSummary[];
  hasMore: boolean;
  cursor: string | null; // pass as ?cursor= to fetch the next page
}

// --- Get Note endpoint: GET /v1/notes/{id} ---

export interface GranolaFolder {
  id: string;       // pattern: fol_[alphanumeric]
  object: 'folder';
  name: string;
}

export interface GranolaTranscriptSegment {
  speaker: string | null;
  text: string;
  start_time: number | null; // seconds from meeting start
}

export interface GranolaNoteDetail {
  id: string;
  object: 'note';
  title: string | null;
  created_at: string;
  updated_at: string;
  summary_text: string | null;
  summary_markdown: string | null;
  transcript: GranolaTranscriptSegment[] | null;
  folder_membership: GranolaFolder[]; // folders this note belongs to
}
