-- Elite Ludo - lock down SECURITY DEFINER helpers

set search_path = public;

alter function public.tg_set_updated_at()
  set search_path = public;

revoke all on function public.collect_daily_reward_for_user(uuid) from public;
revoke all on function public.collect_daily_reward_for_user(uuid) from anon;
revoke all on function public.collect_daily_reward_for_user(uuid) from authenticated;
grant execute on function public.collect_daily_reward_for_user(uuid) to service_role;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
