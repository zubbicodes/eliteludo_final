# Elite Ludo — Product Requirements Document (PRD)

**Version:** 1.0
**Owner:** Ahmed Kamal
**Target launch:** 30 days from project start
**Platforms:** Android (Play Store) — iOS deferred to v2

---

## 1. Product Vision

Elite Ludo is a premium-feeling, single & multiplayer Ludo game for the South Asian and Middle Eastern mobile market. The hook is a luxury black-and-gold visual identity ("Elite" branding) that differentiates it from cluttered, cartoony competitors like Ludo Star and Ludo King. Core gameplay is classic Ludo; differentiation is aesthetic + smooth UX + a city-themed crown collection metagame.

**Tagline:** "Roll like royalty."

---

## 2. Goals & Non-Goals

### Goals (v1, ship in 30 days)
- Playable single-player vs AI (1, 2, or 3 bots)
- 2-player and 4-player online multiplayer (turn-based, via Supabase Realtime)
- Premium black-and-gold visual identity, polished animations
- Coin economy with daily rewards and a basic shop
- 20-city Crowns Collection metagame (cosmetic unlocks)
- Google AdMob (banner + rewarded video) and one IAP product (coin pack)
- Published to Google Play Store

### Non-Goals (deferred to v2)
- iOS version
- Real 3D dice physics
- Real-money tournaments (legal/regulatory complexity)
- In-game chat (canned emojis/quick messages only in v1)
- Friend system / social features beyond invite-via-link
- Multiple game modes (only classic Ludo in v1; no Quick mode, no Master mode)
- Localization beyond English + Urdu

---

## 3. Target Audience

- **Primary:** Pakistan, India, Bangladesh, UAE, Saudi Arabia
- **Age:** 18–45, casual mobile gamers
- **Devices:** Mid-range Android (4GB RAM, Snapdragon 6-series or equivalent) and up. Must run smoothly on a Redmi Note 10 or similar baseline.
- **Languages:** English (primary), Urdu (secondary, for menus only — game logic stays in English)

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend framework | Expo SDK (latest stable) + React Native | Existing team skill, fast iteration, EAS Build for Android |
| Animation | react-native-reanimated 3 | 60fps native animations |
| Custom drawing | @shopify/react-native-skia | GPU-accelerated 2D rendering for board, dice, particles |
| Navigation | expo-router | File-based routing |
| State management | Zustand | Lightweight, simpler than Redux |
| Backend | Supabase (auth, Postgres, Realtime, Storage) | Already familiar, generous free tier, real-time subscriptions for multiplayer |
| Auth | Supabase Auth (phone + Google) | Phone for SA market, Google for convenience |
| Multiplayer transport | Supabase Realtime (Postgres changes + broadcast channels) | Sufficient for turn-based |
| Ads | react-native-google-mobile-ads | AdMob banner + rewarded video |
| IAP | expo-in-app-purchases (or RevenueCat free tier) | Coin pack purchases |
| Analytics | PostHog or Firebase Analytics (free) | Funnel + retention tracking |
| Crash reporting | Sentry (free tier) | Production error tracking |
| Build & deploy | EAS Build + EAS Submit | Zero local Android setup |

---

## 5. Feature List

### 5.1 Onboarding & Auth
- Splash screen with logo (1.5s)
- Sign-in screen: "Continue with Google" + "Continue with Phone (OTP)"
- First-time user flow: pick username, pick token color, pick avatar (from 8 preset avatars)
- Grant 1,000 starter coins
- Skip-able tutorial overlay on first game

### 5.2 Home Screen
- Top bar: settings gear, Ludo Pass timer, coin balance, currency balance
- Hero area: animated logo + invite banner ("X invites you to a room")
- Primary CTA: "Play 1 on 1" (matchmaking)
- Secondary CTAs: Two leaderboard tiles (weekly, all-time) with countdown timers
- Shop section: 5-6 tiles for Play Special, Play Minigames, treasure chests
- Bottom row: minor unlocks, witching hour event

### 5.3 Game Modes (v1)
- **Quick Match (1v1):** Match with 1 random player or AI bot if no one available within 10s
- **4-Player Match:** Public room with 4 random players, AI fills empty seats after 20s
- **Vs Computer:** Offline solo vs 1-3 AI bots (3 difficulty levels)
- **Private Room:** Generate room code, share via WhatsApp, friends join via code

### 5.4 Core Gameplay (Classic Ludo Rules)
- 4 colors: green, yellow, red, blue
- Each player has 4 tokens, must roll a 6 to leave home
- Roll a 6 = bonus roll (max 3 sixes in a row, then turn ends)
- Capture: landing on opponent's token sends it back to home
- Safe squares: starred cells protect tokens
- Win condition: get all 4 tokens to center home
- Standard Ludo board: 15×15 grid, 52 outer cells + 4 home columns

### 5.5 Multiplayer (Supabase Realtime)
- Match state stored in `matches` table
- Each move written as a row in `match_moves` table
- Clients subscribe to Realtime changes
- Server-authoritative validation via Supabase Edge Function (anti-cheat)
- 30-second turn timer; auto-skip if exceeded
- Disconnect handling: 60s grace, then bot takes over

### 5.6 Economy
- **Coins:** Earned by winning, daily rewards, watching ads. Spent on entry fees and cosmetics.
- **Gems (premium):** Bought via IAP. Used for premium cosmetics. (v1: gems exist in UI but only one IAP product — gem pack — to test the IAP flow.)
- **Daily rewards:** 7-day cycle, escalating value, must collect each day
- **Match rewards:** Win = entry fee × 2 minus 10% rake. Loss = 0.

### 5.7 Crowns Collection (Metagame)
- 20 cities, each with a unique crown asset
- Unlock by winning N matches in that city's "club" (tournament tier)
- Pure cosmetic prestige — shown on profile and in-match
- Drives retention by giving long-term goals

### 5.8 Shop
- Coin packs (3 tiers): 1,000 / 5,000 / 15,000 coins for ad-watch / IAP
- Token skins (cosmetic): unlock via gems or special events
- Dice skins (cosmetic): unlock via gems or crown completion

### 5.9 Monetization
- **AdMob banner:** Bottom of home screen only (not during gameplay)
- **AdMob rewarded video:** "Watch ad for 100 coins" button on home screen, "Double your winnings" after match
- **IAP:** Single coin pack at $0.99 (tests the funnel)

### 5.10 Settings
- Sound on/off
- Music on/off
- Vibration on/off
- Language: English / Urdu
- Logout
- Delete account (legal requirement for Play Store)
- Privacy policy link
- Terms of service link

---

## 6. User Flows

### 6.1 First-time user
Splash → Sign in (Google) → Pick username → Pick avatar → Tutorial overlay → Home → Tap Play 1 on 1 → Match found → Game → Win/loss screen → Home

### 6.2 Returning user
Splash → Auto-login → Daily reward popup (if applicable) → Home → Play

### 6.3 Multiplayer match
Home → Play 1 on 1 → Searching... (max 10s) → Match found / Bot fallback → Game board loads → Both players ready → First turn → ... → Win condition → Result screen → Coins awarded → Home

---

## 7. Data Model (Supabase)

### `profiles`
- `id` (uuid, FK to auth.users)
- `username` (text, unique)
- `avatar_id` (int)
- `coins` (bigint, default 1000)
- `gems` (bigint, default 0)
- `xp` (bigint, default 0)
- `level` (int, default 1)
- `wins` (int, default 0)
- `losses` (int, default 0)
- `crowns_unlocked` (jsonb, array of city slugs)
- `created_at`, `updated_at`

### `matches`
- `id` (uuid)
- `mode` (enum: '1v1', '4p', 'vs_ai', 'private')
- `status` (enum: 'waiting', 'active', 'finished', 'abandoned')
- `players` (jsonb, array of {user_id, color, position, ready})
- `current_turn_user_id` (uuid)
- `current_turn_started_at` (timestamptz)
- `board_state` (jsonb, token positions)
- `winner_user_id` (uuid, nullable)
- `entry_fee` (int)
- `prize_pool` (int)
- `created_at`, `finished_at`

### `match_moves`
- `id` (bigserial)
- `match_id` (uuid, FK)
- `user_id` (uuid)
- `move_type` (enum: 'roll', 'move_token', 'skip')
- `payload` (jsonb: dice value, token id, from/to cells)
- `created_at`

### `daily_rewards`
- `user_id` (uuid)
- `day_number` (int 1-7)
- `last_collected_at` (timestamptz)
- `streak_active` (bool)

### `transactions`
- `id` (uuid)
- `user_id` (uuid)
- `type` (enum: 'match_win', 'match_loss', 'daily_reward', 'iap', 'ad_reward', 'shop_purchase')
- `amount` (bigint, signed)
- `currency` (enum: 'coins', 'gems')
- `metadata` (jsonb)
- `created_at`

---

## 8. Security & Anti-Cheat

- All match state changes go through a Supabase Edge Function that validates the move against the current `board_state` before writing
- Client never directly writes to `matches.board_state`
- Dice rolls happen server-side (Edge Function generates the random number)
- Coin balance changes only happen server-side via Edge Functions
- Row Level Security (RLS) on all tables: users can only read their own profile, can only write their own moves

---

## 9. Performance Targets

- Cold start: < 3 seconds on baseline device (Redmi Note 10)
- Hot start: < 1 second
- Frame rate: 60fps in menus, 60fps during gameplay (no drops below 45fps even on win celebration)
- APK size: < 50 MB (use WebP, compress assets aggressively)
- Multiplayer turn round-trip: < 800ms on 4G

---

## 10. Analytics Events to Track

- `app_open`
- `signup_started` / `signup_completed`
- `match_started` (with mode)
- `match_finished` (with mode, result, duration)
- `coin_balance_changed` (delta, source)
- `iap_initiated` / `iap_completed` / `iap_failed`
- `ad_shown` / `ad_clicked` / `ad_rewarded`
- `daily_reward_collected` (day number)
- `crown_unlocked` (city)
- `crash` (auto from Sentry)

---

## 11. 30-Day Milestone Plan

### Week 1: Foundation & Core Game
- Day 1-2: Project setup, Supabase setup, schema, auth
- Day 3-5: Board rendering, token rendering, dice UI, click handling
- Day 6-7: Single-player game logic against AI bot, win condition

### Week 2: Polish & Animation
- Day 8-10: Reanimated token movement, dice roll animation, capture animation
- Day 11-12: Home screen, navigation, daily reward UI
- Day 13-14: Sound integration, button feedback, screen transitions

### Week 3: Multiplayer & Economy
- Day 15-17: Supabase Realtime integration, matchmaking, turn sync
- Day 18-19: Edge Functions for move validation, anti-cheat, coin updates
- Day 20-21: AdMob integration, IAP integration, shop screen

### Week 4: Ship It
- Day 22-23: Crowns collection, tournament selection, win/loss screens
- Day 24-25: Bug bash on real devices, performance optimization
- Day 26-27: Store assets (screenshots, description, icon), Play Console setup
- Day 28-29: Submit to Play Console, internal testing track
- Day 30: Public launch

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Designer can't deliver assets in time | Start her on the highest-priority assets (board, tokens, dice) day 1; use placeholder shapes in code so dev isn't blocked |
| Supabase Realtime latency on Pakistani 4G | Test early on real network; add optimistic UI for own moves |
| Play Store review delay (new dev account = days to weeks) | Submit to internal testing track by day 22, not day 28 |
| AdMob policy violations | Read AdMob policies day 1, no ads during gameplay, no incentivized clicks |
| Multiplayer desync bugs | Server is source of truth, always reconcile on Realtime events |
| Performance on low-end Android | Test on real budget device weekly, not just emulator |

---

## 13. Definition of Done (v1)

A user can:
- Download from Play Store
- Sign in with Google
- Play a complete game vs AI bot offline
- Play a complete game vs another real player online
- Earn coins, collect daily reward, see balance update
- Watch a rewarded ad and receive coins
- Complete an IAP purchase (test mode)
- Unlock at least one crown
- Log out and back in with state preserved

App must not crash during a 30-minute play session on a Redmi Note 10.

Design Figma Link : https://www.figma.com/design/2tTmK6bl3dd2LM4DoJcujb/Elite-Ludo?node-id=0-1&t=RfJjtcQ6Xl52oBJf-1
