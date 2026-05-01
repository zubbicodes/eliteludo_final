-- Elite Ludo — match queue for 1v1 matchmaking

set search_path = public;

-- ----- match_queue -----
create table if not exists public.match_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode match_mode not null default '1v1',
  entry_fee int not null default 0,
  joined_at timestamptz not null default now(),
  match_id uuid references public.matches(id) on delete set null
);

-- One active (unmatched) queue entry per user
create unique index if not exists match_queue_active_user_idx
  on public.match_queue(user_id)
  where match_id is null;

create index if not exists match_queue_open_idx
  on public.match_queue(mode, entry_fee, joined_at)
  where match_id is null;

alter table public.match_queue enable row level security;

drop policy if exists "queue_select_own" on public.match_queue;
create policy "queue_select_own" on public.match_queue
  for select using (auth.uid() = user_id);

drop policy if exists "queue_insert_own" on public.match_queue;
create policy "queue_insert_own" on public.match_queue
  for insert with check (auth.uid() = user_id);

drop policy if exists "queue_delete_own" on public.match_queue;
create policy "queue_delete_own" on public.match_queue
  for delete using (auth.uid() = user_id);

-- Allow the current-turn player to push board state after local moves.
-- Edge Functions (service_role) bypass RLS for privileged writes.
drop policy if exists "matches_update_current_player" on public.matches;
create policy "matches_update_current_player" on public.matches
  for update
  using (auth.uid() = current_turn_user_id)
  with check (auth.uid() = current_turn_user_id);

-- Enable Realtime so both tables stream changes to connected clients
alter publication supabase_realtime add table public.match_queue;
alter publication supabase_realtime add table public.matches;
