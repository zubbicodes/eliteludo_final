-- Fast active-match sync via private Realtime Broadcast channels.
-- Channel topic format: match:<match_id>:game

alter table realtime.messages enable row level security;

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

create or replace function public.broadcast_match_event(
  p_match_id uuid,
  p_event text,
  p_payload jsonb
) returns void
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  perform realtime.send(
    p_payload,
    p_event,
    'match:' || p_match_id::text || ':game',
    true
  );
end;
$$;

revoke all on function public.broadcast_match_event(uuid, text, jsonb) from public;
grant execute on function public.broadcast_match_event(uuid, text, jsonb) to service_role;
