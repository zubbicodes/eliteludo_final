# Implement Fast Supabase Hybrid Multiplayer

## Summary

Implement the previous performance plan using the existing Supabase setup. Keep Supabase as the backend, but move active match sync from Postgres Changes + polling to Supabase Realtime Broadcast. Do not add the starter `todos` `App.tsx` or `utils/supabase.ts`; this project already has `@supabase/supabase-js` installed and an existing client in `src/supabase/client.ts`.

I have the MCP of SUpabase

## Key Changes

- Add a match realtime layer:
  - Create a client wrapper for private match Broadcast channels.
  - Support events: `state_snapshot`, `roll_result`, `move_result`, `turn_skipped`, `match_finished`, `player_left`, `sync_required`.
  - Include `matchId`, `version`, `eventId`, and compact payloads so clients can ignore stale/duplicate events.
- Replace live game subscription:
  - Replace `subscribeMatch` usage in the game screen with Broadcast channel subscription.
  - Keep `getMatch(matchId)` for initial load and reconnect recovery.
  - Remove the constant 1.8s polling loop from active gameplay.
- Keep queue subscription mostly unchanged for now:
  - `match_queue` Postgres Changes can remain because matchmaking is low-frequency compared with gameplay.
- Make Edge Functions broadcast after authoritative updates:
  - `roll-dice`, `move-token`, `skip-roll-turn`, and `forfeit-match` should validate, commit DB state, insert audit move, then broadcast the committed result.
  - Add/increment `board_state.version` or equivalent `turnSeq` on every authoritative game mutation.
- Fix server rule drift:
  - Fix the `move-token` function bug where `advanceToNextPlayer` references `move.dieValue` outside scope.
  - Align server `applyMove` / `finishMove` behavior with `src/game/rules.ts`.
  - Prefer extracting shared rule logic or adding parity tests before expanding multiplayer features.

## Implementation Steps

- Supabase setup:
  - Keep existing `src/supabase/client.ts`.
  - Update `.env.local` with the provided `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
  - Do not expose service role keys in Expo public env vars.
- Client networking:
  - Add a typed realtime helper under `src/supabase/`.
  - Update `src/supabase/matches.ts` so match sync uses Broadcast for gameplay and Postgres Changes only where appropriate.
  - Update `app/game/[matchId].tsx` to join the match Broadcast channel after initial `getMatch`.
  - On channel reconnect or missed/stale version, call `getMatch` once and apply the authoritative snapshot.
- Gameplay smoothness:
  - Keep local roll/move animations immediate.
  - Treat server response/Broadcast as authority, not as the thing that starts visual feedback.
  - Reduce `ROLL_TIMER_TICK_MS` from `100` to `250`, or move timer display to Reanimated/shared value to reduce React renders.
- Edge Functions:
  - Add broadcast emission to `roll-dice`, `move-token`, `skip-roll-turn`, and `forfeit-match`.
  - Return the same event payload from the HTTP function that gets broadcast to opponents.
  - Preserve DB writes for wallet, match history, result settlement, and anti-cheat audit.
- Docs:
  - Update `docs/MANUAL_TEST_PLAN.md` with Broadcast/reconnect/latency checks.
  - Add a short architecture note explaining why Socket.io is deferred.

## Test Plan

- Run existing checks:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
- Add or update tests:
  - Rule parity for client/server movement, capture, bonus roll, skip, finish, invalid move.
  - Stale event handling: lower `version` events are ignored.
  - Duplicate event handling: same `eventId` does not apply twice.
  - Reconnect handling: missing version triggers one `getMatch` snapshot.
- Manual device tests:
  - Two signed-in devices in 1v1 match.
  - Roll appears on opponent quickly without polling.
  - Move/capture/finish events stay ordered.
  - Background one device, return, and verify state snapshot recovery.
  - Turn timeout skips correctly.
  - Bot-backed matches still work locally.
- Scale tests:
  - Simulate hundreds to thousands of channels before market release.
  - Track channel join success, p95 action latency, Edge Function duration, DB CPU, and Realtime message rate.

## Assumptions

- Target is 10K DAU, not 10K concurrent players.
- Supabase hybrid remains the chosen direction.
- Socket.io is not implemented for v1.
- The provided Supabase publishable key can be used in `.env.local`; it is not a secret, but service role keys must never be added to public Expo env vars.
- Starter Supabase tutorial files are ignored because this is already an Expo Router app with a working Supabase client.
