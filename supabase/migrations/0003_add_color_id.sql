-- Add token color preference to profiles.
-- color_id stores the player's chosen token color (red/green/blue/yellow).
alter table public.profiles
  add column if not exists color_id text not null default 'red';
