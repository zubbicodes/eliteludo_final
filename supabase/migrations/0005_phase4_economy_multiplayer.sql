-- Elite Ludo - Phase 4 schema additions

set search_path = public;

-- Transaction types used by the Phase 4 economy.
alter type transaction_type add value if not exists 'entry_fee';
alter type transaction_type add value if not exists 'refund';

-- Room codes and finish metadata for private rooms and reward settlement.
alter table public.matches
  add column if not exists room_code text unique,
  add column if not exists host_user_id uuid references auth.users(id) on delete set null,
  add column if not exists city_slug text,
  add column if not exists reward_settled_at timestamptz;

create index if not exists matches_room_code_idx on public.matches(room_code)
  where room_code is not null;

-- Allow queue rows for all match modes, including private lobby metadata.
alter table public.match_queue
  add column if not exists room_code text,
  add column if not exists cancelled_at timestamptz;

create index if not exists match_queue_room_code_idx on public.match_queue(room_code)
  where room_code is not null;

-- Cosmetic inventory and selections.
create table if not exists public.profile_cosmetics (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlocked_token_skins jsonb not null default '["classic"]'::jsonb,
  unlocked_dice_skins jsonb not null default '["classic"]'::jsonb,
  unlocked_crowns jsonb not null default '[]'::jsonb,
  selected_token_skin text not null default 'classic',
  selected_dice_skin text not null default 'classic',
  selected_crown text,
  updated_at timestamptz not null default now()
);

alter table public.profile_cosmetics enable row level security;

drop policy if exists "cosmetics_select_own" on public.profile_cosmetics;
create policy "cosmetics_select_own" on public.profile_cosmetics
  for select using (auth.uid() = user_id);

drop policy if exists "cosmetics_update_own" on public.profile_cosmetics;
create policy "cosmetics_update_own" on public.profile_cosmetics
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- City crown progress.
create table if not exists public.crown_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  city_slug text not null,
  wins int not null default 0,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, city_slug)
);

alter table public.crown_progress enable row level security;

drop policy if exists "crown_progress_select_own" on public.crown_progress;
create policy "crown_progress_select_own" on public.crown_progress
  for select using (auth.uid() = user_id);

-- IAP receipt idempotency.
create table if not exists public.iap_receipts (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  amount int not null,
  currency currency_kind not null default 'coins',
  granted_at timestamptz not null default now()
);

alter table public.iap_receipts enable row level security;

drop policy if exists "iap_receipts_select_own" on public.iap_receipts;
create policy "iap_receipts_select_own" on public.iap_receipts
  for select using (auth.uid() = user_id);

-- Server-created defaults for new users.
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

  insert into public.profile_cosmetics (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;
