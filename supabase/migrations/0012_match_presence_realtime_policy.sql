-- Extend private match channel authorization to Presence as well as Broadcast.
-- Needed after 0011 if it was already applied with broadcast-only policies.

drop policy if exists "match_broadcast_select_participant" on realtime.messages;
create policy "match_broadcast_select_participant"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) ~ '^match:[0-9a-fA-F-]{36}:game$'
    and exists (
      select 1
      from public.matches m
      where 'match:' || m.id::text || ':game' = (select realtime.topic())
        and exists (
          select 1
          from jsonb_array_elements(m.players) p
          where p->>'user_id' = (select auth.uid())::text
        )
    )
  );

drop policy if exists "match_broadcast_insert_participant" on realtime.messages;
create policy "match_broadcast_insert_participant"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) ~ '^match:[0-9a-fA-F-]{36}:game$'
    and exists (
      select 1
      from public.matches m
      where 'match:' || m.id::text || ':game' = (select realtime.topic())
        and exists (
          select 1
          from jsonb_array_elements(m.players) p
          where p->>'user_id' = (select auth.uid())::text
        )
    )
  );
