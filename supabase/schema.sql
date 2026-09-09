-- WinLog — Supabase schema
-- Reconstructed from application code (winlog.html / api/claude.js) after the
-- original project was lost. Run this in the SQL editor of a NEW Supabase project,
-- then update SUPABASE_URL + SUPABASE_ANON_KEY in Vercel and .env.local.

create table if not exists public.wins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  raw        text not null,
  clean      text not null,
  category   text not null default 'delivery'
             check (category in ('delivery','leadership','stakeholder','strategy','growth')),
  impact     text default '',
  source     text not null default 'text' check (source in ('text','voice')),
  date       timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- loadWins() orders by date desc scoped to user_id; api/claude.js counts a user's
-- wins in the trailing 24h. Both are served by this index.
create index if not exists wins_user_id_date_idx on public.wins (user_id, date desc);

alter table public.wins enable row level security;

-- One policy per command so RLS also constrains INSERT (WITH CHECK).
drop policy if exists "wins_select_own" on public.wins;
create policy "wins_select_own" on public.wins
  for select using (auth.uid() = user_id);

drop policy if exists "wins_insert_own" on public.wins;
create policy "wins_insert_own" on public.wins
  for insert with check (auth.uid() = user_id);

drop policy if exists "wins_update_own" on public.wins;
create policy "wins_update_own" on public.wins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wins_delete_own" on public.wins;
create policy "wins_delete_own" on public.wins
  for delete using (auth.uid() = user_id);
