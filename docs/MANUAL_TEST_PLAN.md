# Elite Ludo Manual Integration Test Plan

Use this checklist for flows that unit tests cannot fully cover because they depend on Supabase, native modules, device behavior, AdMob, or store sandbox services.

## Setup

- Install dependencies with `npm install`.
- Fill `.env.local` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
- Apply all Supabase migrations in `supabase/migrations`.
- Deploy Edge Functions in `supabase/functions`.
- Test on at least one Android device or emulator.
- Use test AdMob IDs and store sandbox accounts until production credentials are ready.

## Automated Baseline

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run lint` passes with no warnings.

## Auth And Profile

- Fresh install opens splash, then routes unauthenticated users to login.
- Email signup creates a Supabase user and profile row.
- Returning user opens splash, hydrates the saved session, and lands on home.
- Onboarding saves username, avatar, and token color.
- Edit profile persists changes and home/profile screens reflect them after refresh.
- Logout clears the session and returns to auth.

## Multiplayer Matchmaking

- A signed-in user with enough coins can enter a 2-player city club.
- Entry fee is deducted once when matchmaking starts.
- Cancelling before match found refunds or restores the expected wallet state.
- Two users entering the same mode can be matched into the same match.
- If no player appears within the fallback window, the flow creates or enters a bot-backed match.
- 4-player mode creates the expected player slots and can fill missing seats with bots.
- Private room creation returns a room code.
- Joining a valid private room navigates both users into the same match.
- Invalid room code shows a clear failure state and does not deduct coins permanently.

## Game Sync And Rules

- Server dice roll is used for multiplayer turns.
- Local player cannot act during opponent turn.
- Board state updates on the other device after a roll and move settle.
- Captures send opponent tokens home on unsafe cells.
- Safe cells prevent captures.
- Three consecutive sixes forfeits the turn.
- Captures and finishing a token grant the expected bonus roll.
- Winner navigates to result screen on all active clients.
- Reconnecting or reopening an active match loads the latest board state.

## Wallet And Rewards

- Daily reward modal appears when `daily_rewards.canCollect` is true.
- Collecting daily reward updates wallet balance and day number.
- Collecting twice on the same day is blocked by the backend.
- Match winner receives the configured prize once.
- Reward settlement is idempotent if the result screen is opened twice.
- Losing player receives no win reward.
- City crown progress increments after eligible wins.
- Newly unlocked crown appears in profile/shop state.

## Ads

- Home banner renders with the configured test ad unit in a native build.
- App does not crash in Expo Go or environments where the native ads module is unavailable.
- Rewarded ad grants coins only after the earned reward event.
- Closing a rewarded ad early grants no coins.
- Ad reward endpoint rejects malformed or unauthenticated requests.

## IAP

- Shop coin pack opens the platform purchase sheet in sandbox.
- Successful sandbox purchase calls `verify-iap-purchase`.
- Coins are granted once for a purchase token.
- Replaying the same token returns the already-granted path and does not duplicate coins.
- Cancelled purchase leaves wallet unchanged and shows a recoverable message.
- IAP unavailable path does not crash the shop.

## Release Readiness

- Replace test AdMob app and unit IDs with production IDs.
- Confirm Play Console product ID matches `elite_ludo_coin_pack_1000` or update `app.json`.
- Confirm privacy policy and terms links are live.
- Verify app icon, adaptive icon, splash screen, and package name.
- Run a signed Android build on a physical mid-range device.
- Run at least one full auth -> matchmaking -> game -> reward -> shop session from a clean install.
