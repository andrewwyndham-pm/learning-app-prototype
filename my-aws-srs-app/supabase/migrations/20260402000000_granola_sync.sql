-- Tracks the last successful Granola sync timestamp (and any future sync state)
create table if not exists public.sync_state (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Seed the initial watermark so upserts always find a row
insert into public.sync_state (key, value)
values ('last_sync_at', '1970-01-01T00:00:00.000Z')
on conflict (key) do nothing;

-- Tracks which Granola note IDs have already been processed.
-- Prevents double-ingestion if the sync re-runs over the same time window.
create table if not exists public.granola_processed_notes (
  note_id      text        primary key,
  processed_at timestamptz not null default timezone('utc', now())
);

-- Note: no RLS is needed on either table.
-- Both are accessed exclusively via the service role key (supabaseAdmin),
-- which bypasses RLS entirely.
