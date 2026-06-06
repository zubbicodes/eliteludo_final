-- Avoid UUID casts on match JSON players because bot-backed matches can contain
-- non-UUID user_id values. Realtime evaluates SELECT policies for row delivery.
drop policy if exists "matches_select_participant" on public.matches;
create policy "matches_select_participant" on public.matches
  for select
  using (
    exists (
      select 1
      from jsonb_array_elements(players) p
      where p->>'user_id' = auth.uid()::text
    )
  );

drop policy if exists "match_moves_select_participant" on public.match_moves;
create policy "match_moves_select_participant" on public.match_moves
  for select
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_moves.match_id
        and exists (
          select 1
          from jsonb_array_elements(m.players) p
          where p->>'user_id' = auth.uid()::text
        )
    )
  );
