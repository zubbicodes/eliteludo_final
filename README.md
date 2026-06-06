# Elite Ludo

Premium black-and-gold Ludo game for Android. Built with Expo + React Native.

See [`docs/PRD.md`](docs/PRD.md) and [`docs/MasterPromot.md`](docs/MasterPromot.md) for product and engineering context.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm start                    # opens Expo dev server, scan QR with Expo Go
```

## Stack

- Expo SDK 54 (managed) - React Native 0.81 - expo-router 6
- Zustand - @shopify/react-native-skia - react-native-reanimated
- Supabase (auth, Postgres, Realtime, Edge Functions)

## Layout

```text
app/                       expo-router screens
src/
  components/              reusable RN components
  game/                    pure TS rules engine (no RN imports)
  skia/                    Skia rendering (Board, Token, Dice, Particles)
  stores/                  Zustand stores
  supabase/                client + queries + realtime helpers
  theme/                   colors, typography, spacing
supabase/
  migrations/              SQL schema + RLS
  functions/               edge functions
docs/                      PRD, master prompt, asset list
assets/                    designer-delivered images / sounds / fonts
```

## Phase status

- **Phase 0 - scaffold and splash:** complete.
- **Phase 1 - core game:** implemented with a pure TypeScript rules engine, Skia board/dice/token rendering, AI turns, captures, bonus rolls, and win detection.
- **Phase 2 - polish and home screen:** implemented with the premium home screen, daily reward modal, haptics, particles, city club selection, profile, settings, and shop surfaces.
- **Phase 3 - auth and multiplayer:** implemented as a Supabase-backed flow with auth screens, profile onboarding, matchmaking, private rooms, Realtime match sync, and server dice rolls. Needs end-to-end device/backend testing.
- **Phase 4 - economy and monetization:** implemented with entry fees, daily rewards, match rewards, shop purchases, rewarded ads, and IAP verification scaffolding. Needs sandbox verification before release.
- **Phase 5 - ship:** not complete. Remaining work is production hardening, Play Store setup, release credentials, real AdMob/IAP configuration, privacy/terms links, QA, analytics/crash reporting, and final device testing.

## Verification

```bash
npm test
npm run typecheck
npm run lint
```

Manual integration coverage lives in [`docs/MANUAL_TEST_PLAN.md`](docs/MANUAL_TEST_PLAN.md).
