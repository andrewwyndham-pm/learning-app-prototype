create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  front text not null,
  back text not null,
  subject text,
  lecture_date date,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  last_review timestamptz,
  next_review timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint flashcards_front_not_blank check (char_length(trim(front)) > 0),
  constraint flashcards_back_not_blank check (char_length(trim(back)) > 0),
  constraint flashcards_difficulty_nonnegative check (difficulty >= 0),
  constraint flashcards_stability_nonnegative check (stability >= 0)
);

alter table public.flashcards
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists subject text,
  add column if not exists lecture_date date,
  add column if not exists stability double precision not null default 0,
  add column if not exists difficulty double precision not null default 0,
  add column if not exists last_review timestamptz,
  add column if not exists next_review timestamptz not null default timezone('utc', now());

alter table public.flashcards
  alter column front set not null,
  alter column back set not null,
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now()),
  alter column stability set default 0,
  alter column difficulty set default 0,
  alter column next_review set default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_front_not_blank'
      and conrelid = 'public.flashcards'::regclass
  ) then
    alter table public.flashcards
      add constraint flashcards_front_not_blank check (char_length(trim(front)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_back_not_blank'
      and conrelid = 'public.flashcards'::regclass
  ) then
    alter table public.flashcards
      add constraint flashcards_back_not_blank check (char_length(trim(back)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_difficulty_nonnegative'
      and conrelid = 'public.flashcards'::regclass
  ) then
    alter table public.flashcards
      add constraint flashcards_difficulty_nonnegative check (difficulty >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_stability_nonnegative'
      and conrelid = 'public.flashcards'::regclass
  ) then
    alter table public.flashcards
      add constraint flashcards_stability_nonnegative check (stability >= 0);
  end if;
end
$$;

create index if not exists flashcards_user_id_next_review_idx
  on public.flashcards (user_id, next_review asc);

create index if not exists flashcards_subject_idx
  on public.flashcards (subject);

drop trigger if exists set_flashcards_updated_at on public.flashcards;

create trigger set_flashcards_updated_at
before update on public.flashcards
for each row
execute function public.set_updated_at();

alter table public.flashcards enable row level security;

drop policy if exists "Users can read their own flashcards" on public.flashcards;
create policy "Users can read their own flashcards"
on public.flashcards
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own flashcards" on public.flashcards;
create policy "Users can insert their own flashcards"
on public.flashcards
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own flashcards" on public.flashcards;
create policy "Users can update their own flashcards"
on public.flashcards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own flashcards" on public.flashcards;
create policy "Users can delete their own flashcards"
on public.flashcards
for delete
to authenticated
using (auth.uid() = user_id);
