-- RageCheck Supabase schema
-- Run this in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text,
  content text not null,
  word_count integer not null check (word_count >= 0),
  heat_score integer not null check (heat_score between 0 and 100),
  outrage_score integer not null check (outrage_score between 0 and 100),
  bw_score integer not null check (bw_score between 0 and 100),
  us_them_score integer not null check (us_them_score between 0 and 100),
  fight_score integer not null check (fight_score between 0 and 100),
  total_score double precision not null default 0,
  density double precision not null default 0,
  verdict text not null default '',
  core_facts jsonb not null default '[]'::jsonb,
  signal_details jsonb not null default '{}'::jsonb,
  left_focus text,
  right_focus text,
  created_at timestamptz not null default now()
);

create index if not exists analyses_created_at_idx on public.analyses (created_at desc);
create index if not exists analyses_total_score_idx on public.analyses (total_score desc);

alter table public.analyses enable row level security;

-- Public read access
drop policy if exists "analyses_public_read" on public.analyses;
create policy "analyses_public_read"
  on public.analyses
  for select
  to public
  using (true);

-- Insert allowed for authenticated users only
drop policy if exists "analyses_insert_authenticated" on public.analyses;
create policy "analyses_insert_authenticated"
  on public.analyses
  for insert
  to authenticated
  with check (true);

grant select on table public.analyses to anon, authenticated;
grant insert on table public.analyses to authenticated;
