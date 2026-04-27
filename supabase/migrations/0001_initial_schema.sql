-- Elite Ludo — initial schema (PRD §7)
-- Tables: profiles, matches, match_moves, daily_rewards, transactions

set search_path = public;

create extension if not exists "pgcrypto";

-- ----- enums -----
do $$ begin
  create type match_mode as enum ('1v1', '4p', 'vs_ai', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_status as enum ('waiting', 'active', 'finished', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type move_type as enum ('roll', 'move_token', 'skip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency_kind as enum ('coins', 'gems');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_type as enum (
    'match_win', 'match_loss', 'daily_reward', 'iap', 'ad_reward', 'shop_purchase'
  );
exception when duplicate_object then null; end $$;

-- ----- profiles -----
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_id int not null default 0,
  coins bigint not null default 1000,
  gems bigint not null default 0,
  xp bigint not null default 0,
  level int not null default 1,
  wins int not null default 0,
  losses int not null default 0,
  crowns_unlocked jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

-- ----- matches -----
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  mode match_mode not null,
  status match_status not null default 'waiting',
  players jsonb not null default '[]'::jsonb,
  current_turn_user_id uuid references auth.users(id) on delete set null,
  current_turn_started_at timestamptz,
  board_state jsonb not null default '{}'::jsonb,
  winner_user_id uuid references auth.users(id) on delete set null,
  entry_fee int not null default 0,
  prize_pool int not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists matches_status_idx on public.matches (status);
create index if not exists matches_current_turn_idx on public.matches (current_turn_user_id);

-- ----- match_moves -----
create table if not exists public.match_moves (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  move_type move_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_moves_match_idx on public.match_moves (match_id, id);
create index if not exists match_moves_user_idx on public.match_moves (user_id);

-- ----- daily_rewards -----
create table if not exists public.daily_rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day_number int not null default 1 check (day_number between 1 and 7),
  last_collected_at timestamptz,
  streak_active boolean not null default true
);

-- ----- transactions -----
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  amount bigint not null,
  currency currency_kind not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ----- updated_at trigger for profiles -----
create or replace function public.tg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- ----- new-user → profile trigger -----
-- A new auth.users row gets a starter profile with 1000 coins and a temp username.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      'player_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
  )
  on conflict (id) do nothing;

  insert into public.daily_rewards (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
