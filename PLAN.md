# Ludo Gameplay Performance Refactor

## Summary
Refactor rendering and animation around a strict split: `src/game/*` remains the authoritative rules engine, Supabase remains authoritative for multiplayer board state, and a new UI-thread animation layer owns visual token/dice motion. Current `npm test` and `npm run typecheck` pass and must stay green after each batch.

## Key Changes
- Split `app/game/[matchId].tsx` into a thin orchestrator plus gameplay modules:
  - `GameSessionController`: solo/multiplayer lifecycle, timers, AI, Supabase calls.
  - `GameBoardSurface`: board, token layer, particles, picker.
  - `GameHud`: top HUD, seats, local command bar, modals.
  - `useRealtimeBoardQueue`: throttled Supabase event application.
  - `useTokenAnimationController`: UI-thread token animation state and completion callbacks.

- Keep `src/game/rules.ts`, win conditions, dice rules, capture rules, turn switching, and Supabase Edge Function contracts unchanged.

## Rendering And Animation
- Replace the declarative board tree in `BoardCanvas` with a cached static Skia picture:
  - Build the board once per `{ size, perspectiveColor }` using `Skia.PictureRecorder()` or `createPicture`.
  - Render via `<Canvas><Picture picture={cachedBoardPicture} /></Canvas>`.
  - Keep `boardGeometry()` as the shared geometry contract.

- Move tokens from one React/Skia canvas per token to one token layer:
  - Pre-render token art by color/size into cached Skia pictures/images.
  - Use Skia `<Atlas />` to draw all token sprites in a single canvas draw path.
  - Keep transparent `Pressable`/RNGH hit targets only for selectable tokens, positioned from cached token centers, so input remains simple while token painting is GPU-batched.

- Replace JS timer-based movement completion:
  - Token movement uses Reanimated shared values for `x`, `y`, `scale/glow`, and hop arc.
  - Use `withSequence`/`withTiming` on the UI thread.
  - Call `runOnJS(onMoveAnimationComplete)` exactly once from the final animation callback.
  - Remove the `setTimeout(total)` move-settle effect from the route.

- Fix dice rendering:
  - Remove `Date.now()` from `Dice` render.
  - Cache six dice faces as Skia pictures/images per size.
  - Drive rolling rotation, tilt, scale, and displayed face index via Reanimated shared values or `useFrameCallback`, with no React rerenders during the roll.

- Convert timer UI to UI-thread animation:
  - Replace `rollTimerRemaining` state updates every 250ms with a Reanimated progress shared value.
  - Use JS only for the timeout action when progress reaches zero.

## Supabase And State Flow
- Add optimistic local visual flow:
  - Local roll starts dice animation immediately.
  - Local token tap starts visual movement immediately from the chosen `MoveOption`.
  - Multiplayer still sends `rollDiceServer` / `moveTokenServer`; authoritative returned board state reconciles after animation.

- Add realtime batching:
  - Queue incoming `MatchRealtimeEvent`s in a ref.
  - Coalesce by highest board `version` per animation frame or short window, about 50-100ms.
  - Continue rejecting duplicate/stale events through `shouldApplyMatchEvent`.
  - Do not apply remote board snapshots while a local optimistic animation for the same move is in flight unless the server version contradicts it.

- Narrow React subscriptions:
  - Use Zustand selectors for only the slices each component needs.
  - Memoize HUD seats, token hit targets, picker props, and dice pool rows.
  - Wrap stable presentational components in `React.memo`.

## Test Plan
- Run after each implementation batch:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`

- Add focused tests for:
  - Realtime queue applies only the newest valid event version.
  - Duplicate/stale event rejection remains unchanged.
  - Optimistic local move reconciliation does not double-apply a move.
  - Existing game-rule tests still cover captures, safe cells, bonus rolls, three sixes, finish/win, and turn order.

- Manual verification:
  - Solo 2p/3p/4p bot games: roll, bonus roll, move, capture, finish, win.
  - Multiplayer: local roll/move animates immediately, remote updates reconcile, reconnect/snapshot still works.
  - Profile modal, exit/forfeit, room presence, and result navigation still work.

## Assumptions
- Target is locked 60 FPS where available and best-effort 120 FPS on high-refresh devices; implementation will avoid hardcoding frame duration.
- No rule-engine, Edge Function, or database schema behavior changes.
- Existing dirty worktree changes are preserved and not reverted.
