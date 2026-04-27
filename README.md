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

- Expo SDK 54 (managed) · React Native 0.81 · expo-router 6
- Zustand · @shopify/react-native-skia · react-native-reanimated 3
- Supabase (auth, Postgres, Realtime, Edge Functions)

## Layout

```
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

- **Phase 0** — scaffold + splash on device. ✅
- Phase 1 — core game (board, dice, tokens, AI, win condition).
- Phase 2 — polish & home screen.
- Phase 3 — auth & multiplayer.
- Phase 4 — economy & monetization.
- Phase 5 — ship.
