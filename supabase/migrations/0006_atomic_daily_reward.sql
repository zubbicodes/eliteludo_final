-- Elite Ludo - atomic daily reward collection
--
-- Keeps daily reward state, profile coins, and the transaction ledger in one
-- database transaction. Edge Functions call this with the authenticated user id.

set search_path = public;

create or replace function public.collect_daily_reward_for_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward_amounts int[] := array[100, 150, 200, 300, 400, 500, 1000];
  reward_row public.daily_rewards%rowtype;
  profile_row public.profiles%rowtype;
  now_utc timestamptz := now();
  collected_today boolean := false;
  streak_active_next boolean := true;
  visible_day int;
  next_day int;
  reward_amount int;
  next_available text;
begin
  if p_user_id is null then
    return jsonb_build_object('success', false, 'reason', 'missing_user');
  end if;

  select *
    into reward_row
    from public.daily_rewards
    where user_id = p_user_id
    for update;

  if not found then
    insert into public.daily_rewards (user_id)
    values (p_user_id)
    returning * into reward_row;
  end if;

  if reward_row.last_collected_at is not null then
    collected_today :=
      (reward_row.last_collected_at at time zone 'utc')::date =
      (now_utc at time zone 'utc')::date;
  end if;

  next_available := to_char(
    date_trunc('day', now_utc at time zone 'utc') + interval '1 day',
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  );

  if collected_today then
    return jsonb_build_object(
      'success', false,
      'reason', 'already_collected',
      'dayNumber', reward_row.day_number,
      'streakActive', reward_row.streak_active,
      'nextAvailable', next_available
    );
  end if;

  streak_active_next := reward_row.streak_active;
  if reward_row.last_collected_at is not null and now_utc - reward_row.last_collected_at > interval '48 hours' then
    streak_active_next := false;
  end if;

  visible_day := case when streak_active_next then reward_row.day_number else 1 end;
  reward_amount := reward_amounts[visible_day];
  next_day := least(visible_day + 1, 7);

  select *
    into profile_row
    from public.profiles
    where id = p_user_id
    for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'profile_not_found');
  end if;

  update public.daily_rewards
    set day_number = next_day,
        last_collected_at = now_utc,
        streak_active = true
    where user_id = p_user_id;

  update public.profiles
    set coins = profile_row.coins + reward_amount
    where id = p_user_id;

  insert into public.transactions (user_id, type, amount, currency, metadata)
  values (
    p_user_id,
    'daily_reward',
    reward_amount,
    'coins',
    jsonb_build_object('day_number', visible_day, 'streak_reset', not streak_active_next)
  );

  return jsonb_build_object(
    'success', true,
    'dayNumber', visible_day,
    'rewardAmount', reward_amount,
    'balance', profile_row.coins + reward_amount,
    'streakActive', true,
    'nextAvailable', next_available
  );
end;
$$;

revoke all on function public.collect_daily_reward_for_user(uuid) from public;
grant execute on function public.collect_daily_reward_for_user(uuid) to service_role;
