-- Elite Ludo — RLS policies
-- Default stance: deny everything from clients. Edge Functions use the
-- service_role key (which bypasses RLS) to perform privileged writes.

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_moves enable row level security;
alter table public.daily_rewards enable row level security;
alter table public.transactions enable row level security;

-- ----- profiles -----
-- Public read of basic identity (username/avatar/level) is fine for leaderboards
-- later, but for v1 we restrict to the owner. Tighten/loosen in a later migration.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- INSERT happens via the on_auth_user_created trigger (security definer).
-- No client INSERT policy on purpose.

-- ----- matches -----
-- A user can read a match if their uid appears in players[].user_id.
drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant" on public.matches
  for select using (
    exists (
      select 1 from jsonb_array_elements(players) p
      where (p->>'user_id')::uuid = auth.uid()
    )
  );

-- All match writes go through Edge Functions (service_role). No client INSERT/UPDATE/DELETE policies.

-- ----- match_moves -----
drop policy if exists "match_moves_select_participant" on public.match_moves;
create policy "match_moves_select_participant" on public.match_moves
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = match_moves.match_id
        and exists (
          select 1 from jsonb_array_elements(m.players) p
          where (p->>'user_id')::uuid = auth.uid()
        )
    )
  );

-- INSERTs go through Edge Functions only.

-- ----- daily_rewards -----
drop policy if exists "daily_rewards_select_own" on public.daily_rewards;
create policy "daily_rewards_select_own" on public.daily_rewards
  for select using (auth.uid() = user_id);

-- Collection happens via Edge Function so server controls reward amount + streak logic.

-- ----- transactions -----
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

-- INSERTs only via Edge Functions.
