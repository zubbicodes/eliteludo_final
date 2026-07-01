# Elite Ludo Two-Week Launch Rescue Plan

## Summary
Launch target is **Android first in 2 weeks**, with iOS kept code-safe but not treated as the release blocker. The client requirement stays locked: **golden black premium skin**. The priority is **smooth gameplay and polished first impression**, even if weak secondary surfaces are hidden for v1.

This is a rescue/hardening plan for the existing `eliteludo_final` app, not a rewrite. Current state is usable: rules tests, typecheck, and lint pass. The main work is loading, asset discipline, render smoothness, and premium art direction.

## Key Changes

### 1. Launch Lockdown
- Freeze new features immediately.
- Keep v1 visible scope to: splash/preload, auth, onboarding, home, offline game, 2-player online, private room, result screen, basic shop/daily reward.
- Hide or mark as “coming soon” if unstable: friends, clubs, chest, advanced crown progression, IAP if sandbox is not verified by day 10.
- Keep Supabase backend as-is; only fix launch-critical bugs and realtime/gameplay reliability.

### 2. Splash And Preload System
- Replace the current time-only splash behavior with a real boot gate.
- Add a startup preload layer that completes before routing to home/login:
  - fonts
  - auth session
  - settings
  - profile and wallet if logged in
  - critical home images
  - first game-board assets
  - dice/token assets
  - core audio cues
- Use the custom splash progress screen to show real preload stages, not just a 3-second timer.
- Lazy-load noncritical assets after home appears: later city cards, shop art, crowns, chest art, secondary tabs.
- Add a timeout fallback so broken network/profile calls do not trap the user on splash forever.

### 3. Asset Performance Pass
- Add an asset audit/compression workflow.
- Convert large decorative PNGs to optimized WebP where safe.
- Resize assets to actual mobile display sizes:
  - full-screen backgrounds: max 1080px wide
  - lobby cards: max displayed size plus 2x density
  - crowns/icons: no 500KB crown PNGs in v1
  - no single non-splash UI image above 300KB unless justified
- Remove unused Expo/react starter images from packaged assets.
- Split assets into:
  - `critical`: preload during splash
  - `home`: load before home render
  - `game`: load before match render
  - `deferred`: lazy only when screen opens
- Add CI/manual check that reports oversized assets before release.

### 4. Gameplay Smoothness
- Keep `src/game/*` rule engine unchanged except for bug fixes.
- Refactor token movement:
  - remove per-hop JS `setTimeout` chains from token animation
  - run token hop path with Reanimated UI-thread sequencing
  - call JS completion once at the final animation callback
- Refactor dice:
  - remove `setInterval`/React state during rolling
  - pre-render/cache six dice faces
  - animate roll transform and face cycling on UI thread
- Reduce React work during active match:
  - memoize token hit targets and HUD props
  - keep board as cached Skia picture
  - avoid creating new `Set`/arrays inline during render for frequently updated props
  - keep particles short and bounded
- Keep local visual feedback immediate, then reconcile with Supabase authoritative result.

### 5. Premium Skin Pass
- Keep black/gold theme, but reduce “all-gold everything” fatigue.
- Replace the most synthetic procedural visuals with authored or pre-rendered assets first:
  - dice faces
  - token pieces
  - roll button
  - win/loss banners
  - main mode cards
- Board should remain colorful and readable; gold should frame the game, not overpower it.
- Create one consistent visual hierarchy:
  - main action button strongest
  - coins/gems readable but small
  - game board clear
  - popups compact and asset-led
- Use Ludo Star only as reference for density, spacing, animation rhythm, and polish level.

### 6. Backend And Multiplayer Hardening
- Keep Supabase Broadcast for live match sync.
- Verify Edge Functions for:
  - server dice roll
  - move validation
  - skip turn
  - forfeit
  - match reward settlement
- Ensure multiplayer never waits for heavy UI work before showing board.
- Add reconnect recovery:
  - load `matches.board_state` snapshot on reconnect
  - ignore stale/duplicate realtime events
  - avoid repeated polling during healthy Broadcast sync
- Treat wallet/reward changes as server-authoritative.

## Two-Week Schedule
- **Days 1-2:** boot gate, real splash preload, asset inventory, remove unused assets, define critical/deferred asset lists.
- **Days 3-4:** image compression/resizing, lazy loading, sound preload, startup timing measurement on Android.
- **Days 5-6:** dice refactor, token movement refactor, reduce match-screen React churn.
- **Days 7-8:** premium visual pass for board/table/dice/token/home primary cards/result screen.
- **Days 9-10:** Supabase function verification, 2-device multiplayer tests, private room tests, reconnect tests.
- **Days 11-12:** release hardening: Android signed build, clean install QA, low-end device profiling, crash fixes.
- **Days 13-14:** final content lock, store assets/config, Play internal testing build, final regression pass.

## Test Plan
Automated checks must pass after each major batch:
- `npm test`
- `npm run typecheck`
- `npm run lint`

Add/verify tests for:
- preload timeout and routing fallback
- stale/duplicate realtime event rejection
- optimistic move reconciliation
- dice/move rules unchanged after animation refactor
- match reward idempotency

Manual launch QA:
- cold start from fresh install under 3 seconds target after native splash/custom preload
- offline 2p/3p/4p full game
- 2-device online match
- private room create/join
- reconnect/background/foreground during match
- result reward flow
- daily reward claim
- home/shop/profile/settings navigation
- 30-minute no-crash Android session on a mid-range device

## Acceptance Criteria
- Game opens to usable home without visible asset popping on critical surfaces.
- Match screen loads with board, tokens, dice, HUD, and sounds ready.
- Token movement and dice rolling feel smooth without React-state stutter.
- No oversized obvious image causes startup hitch.
- Online turn flow works on two real devices.
- Weak/unverified features are hidden rather than shipped half-broken.
- Signed Android build is ready for Play internal testing.

## Assumptions
- Default launch is **Android only** in this two-week window.
- iOS remains a follow-up hardening target.
- Client’s black/gold skin requirement is fixed.
- We optimize current project instead of rewriting in Flutter/Cocos.
- Recovered Ludo Star assets are used as reference only unless ownership is explicitly confirmed.
- Voice chat is out of scope.
