# Graph Report - .  (2026-04-29)

## Corpus Check
- 54 files · ~67,140 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 193 nodes · 189 edges · 25 communities detected
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Auth UI Flow|Auth UI Flow]]
- [[_COMMUNITY_Game Rules Engine|Game Rules Engine]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Profile Edit Flow|Profile Edit Flow]]
- [[_COMMUNITY_Daily Reward & Polish|Daily Reward & Polish]]
- [[_COMMUNITY_Home & Matchmaking|Home & Matchmaking]]
- [[_COMMUNITY_Core Game Modules|Core Game Modules]]
- [[_COMMUNITY_In-Game UI Components|In-Game UI Components]]
- [[_COMMUNITY_Project Plan & Tech Stack|Project Plan & Tech Stack]]
- [[_COMMUNITY_Wallet & Date Helpers|Wallet & Date Helpers]]
- [[_COMMUNITY_Settings & Haptics|Settings & Haptics]]
- [[_COMMUNITY_Auth Store & Social Provider|Auth Store & Social Provider]]
- [[_COMMUNITY_Result Screen Coloring|Result Screen Coloring]]
- [[_COMMUNITY_Token Colors|Token Colors]]
- [[_COMMUNITY_Username Validation|Username Validation]]
- [[_COMMUNITY_Avatar Catalog|Avatar Catalog]]
- [[_COMMUNITY_Game Screen|Game Screen]]
- [[_COMMUNITY_Theme Colors|Theme Colors]]
- [[_COMMUNITY_Supabase Client Setup|Supabase Client Setup]]
- [[_COMMUNITY_Skia Dice|Skia Dice]]
- [[_COMMUNITY_PRD Document|PRD Document]]
- [[_COMMUNITY_Master Prompt|Master Prompt]]
- [[_COMMUNITY_ESLint (Expo flat)|ESLint (Expo flat)]]
- [[_COMMUNITY_Spacing Scale|Spacing Scale]]
- [[_COMMUNITY_Radius Scale|Radius Scale]]

## God Nodes (most connected - your core abstractions)
1. `React` - 15 edges
2. `HomeScreen (tab)` - 10 edges
3. `SettingsScreen` - 9 edges
4. `EditProfileScreen` - 6 edges
5. `getValidMoves()` - 5 edges
6. `ProfileScreen (tab)` - 5 edges
7. `BurstView (per-burst container)` - 5 edges
8. `tryMove()` - 4 edges
9. `applyMove()` - 4 edges
10. `src/game/types.ts` - 4 edges

## Surprising Connections (you probably didn't know these)
- `DailyRewardModal` --implements--> `Next-up list (animations, daily reward, sound)`  [INFERRED]
  src/components/DailyRewardModal.tsx → docs/CLAUDE_MEMORY.md
- `haptics helper API` --conceptually_related_to--> `Next-up list (animations, daily reward, sound)`  [INFERRED]
  src/utils/haptics.ts → docs/CLAUDE_MEMORY.md
- `Particles (Skia canvas overlay)` --implements--> `Next-up list (animations, daily reward, sound)`  [INFERRED]
  src/skia/Particles.tsx → docs/CLAUDE_MEMORY.md
- `Phase plan (duplicate transcript)` --semantically_similar_to--> `Phase 0-5 plan (Elite Ludo)`  [INFERRED] [semantically similar]
  2026-04-27-224046-hi-take-a-look-at-these-files-prdmd-masterprom.txt → 2026-04-27-175929-hi-take-a-look-at-these-files-prdmd-masterprom.txt
- `EditProfileScreen` --references--> `typography tokens`  [EXTRACTED]
  app/edit-profile.tsx → src/theme/typography.ts

## Hyperedges (group relationships)
- **Persisted Zustand stores backed by AsyncStorage** — wallet_usewalletstore, profile_useprofilestore, settings_usesettingsstore [INFERRED 0.90]
- **Auth flow: login/signup -> onboarding -> home tabs** — login_loginscreen, signup_signupscreen, onboarding_onboardingscreen, home_homescreen [EXTRACTED 0.95]
- **Username + Avatar + TokenColor identity selection (shared by onboarding & edit-profile)** — onboarding_onboardingscreen, edit_profile_editprofilescreen, profile_setprofile [INFERRED 0.90]
- **Particle burst rendering pipeline (capture/win celebrations)** — particles_particles, particles_burstview, particles_particle, particles_rand [EXTRACTED 0.90]
- **Profile customization constants & validators** — profile_avatars, profile_token_colors, profile_validateusername, profile_getavatar, profile_gettokencolor [EXTRACTED 0.85]
- **Phase 2 polish layer (haptics + particles + daily reward)** — haptics_haptics, particles_particles, dailyrewardmodal_dailyrewardmodal, claude_memory_next_items [INFERRED 0.75]

## Communities

### Community 0 - "Auth UI Flow"
Cohesion: 0.05
Nodes (9): Facebook/Meta, JavaScript, Partial React Logo, React, React JavaScript Library, React Logo, React Logo Represents, UI Component (+1 more)

### Community 1 - "Game Rules Engine"
Cohesion: 0.11
Nodes (17): chooseMove(), score(), isSameTrackCell(), progressFor(), trackIndexForHop(), addRoll(), advanceToNextPlayer(), applyMove() (+9 more)

### Community 2 - "App Shell & Routing"
Cohesion: 0.13
Nodes (19): AuthLayout, RootLayout (app shell), TabsLayout, SplashScreen, LoginScreen, LoginScreen.stubAuth (provider OAuth stub), profile.clear, profile.hydrate (+11 more)

### Community 3 - "Profile Edit Flow"
Cohesion: 0.18
Nodes (13): EditProfileScreen, EditProfileScreen.onCancel, EditProfileScreen.onSave, OnboardingScreen, OnboardingScreen.onContinue, profile.setProfile, useProfileStore (zustand), getCachedSettings (sync read) (+5 more)

### Community 4 - "Daily Reward & Polish"
Cohesion: 0.2
Nodes (12): Next-up list (animations, daily reward, sound), DAILY_REWARDS reference (from wallet store), DailyRewardModal, DayCard (7-day reward ladder cell), enabled() guard (platform + setting), haptics helper API, BurstKind (capture | win), BurstView (per-burst container) (+4 more)

### Community 5 - "Home & Matchmaking"
Cohesion: 0.24
Nodes (11): GAME_MODES constant, HomeScreen (tab), HomeScreen.onClaim, HomeScreen.startGame, MatchmakingScreen, NewGame (vs-AI redirector), wallet.claimDaily, DAILY_REWARDS ladder (+3 more)

### Community 6 - "Core Game Modules"
Cohesion: 0.6
Nodes (6): src/game/ai.ts, src/game/board.ts, src/game/rules.ts, src/game/types.ts, src/skia/Board.tsx, src/stores/game.ts

### Community 8 - "In-Game UI Components"
Cohesion: 0.5
Nodes (5): Dice pool model (multi-die visible), DiceTray, MiniDie (last-roll indicator), PLAYER_HEX color map, PlayerProfile

### Community 9 - "Project Plan & Tech Stack"
Cohesion: 0.4
Nodes (5): Phase status notes (P0/P1 done, P2 partial), Phase 0-5 plan (Elite Ludo), Locked tech stack (Expo + Skia + Reanimated + Zustand + Supabase), Working agreement (PRD-first, pure rules, server-authoritative), Phase plan (duplicate transcript)

### Community 10 - "Wallet & Date Helpers"
Cohesion: 0.83
Nodes (3): todayStr(), yesterdayStr(), ymd()

### Community 11 - "Settings & Haptics"
Cohesion: 0.5
Nodes (2): getCachedSettings(), enabled()

### Community 12 - "Auth Store & Social Provider"
Cohesion: 0.5
Nodes (4): AuthState (session/user/isHydrating), useAuthStore, PROVIDER_CONFIG (google/facebook/phone), SocialButton

### Community 15 - "Result Screen Coloring"
Cohesion: 1.0
Nodes (2): PLAYER_HEX color map, ResultScreen (game outcome)

### Community 16 - "Token Colors"
Cohesion: 1.0
Nodes (2): getTokenColor, TOKEN_COLORS list

### Community 17 - "Username Validation"
Cohesion: 1.0
Nodes (2): isUsernameValid, validateUsername

### Community 18 - "Avatar Catalog"
Cohesion: 1.0
Nodes (2): AVATARS list (8 avatar options), getAvatar

### Community 35 - "Game Screen"
Cohesion: 1.0
Nodes (1): app/game/[matchId].tsx

### Community 36 - "Theme Colors"
Cohesion: 1.0
Nodes (1): src/theme/colors.ts

### Community 37 - "Supabase Client Setup"
Cohesion: 1.0
Nodes (1): src/supabase/client.ts

### Community 38 - "Skia Dice"
Cohesion: 1.0
Nodes (1): src/skia/Dice.tsx

### Community 39 - "PRD Document"
Cohesion: 1.0
Nodes (1): Product Requirements Document

### Community 40 - "Master Prompt"
Cohesion: 1.0
Nodes (1): Master Prompt for Claude Code

### Community 41 - "ESLint (Expo flat)"
Cohesion: 1.0
Nodes (1): ESLint Config (Expo flat)

### Community 42 - "Spacing Scale"
Cohesion: 1.0
Nodes (1): spacing scale

### Community 43 - "Radius Scale"
Cohesion: 1.0
Nodes (1): radius scale

## Knowledge Gaps
- **46 isolated node(s):** `app/game/[matchId].tsx`, `src/theme/colors.ts`, `src/supabase/client.ts`, `src/skia/Dice.tsx`, `src/skia/Board.tsx` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Settings & Haptics`** (4 nodes): `settings.ts`, `haptics.ts`, `getCachedSettings()`, `enabled()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Result Screen Coloring`** (2 nodes): `PLAYER_HEX color map`, `ResultScreen (game outcome)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Token Colors`** (2 nodes): `getTokenColor`, `TOKEN_COLORS list`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Username Validation`** (2 nodes): `isUsernameValid`, `validateUsername`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Avatar Catalog`** (2 nodes): `AVATARS list (8 avatar options)`, `getAvatar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Game Screen`** (1 nodes): `app/game/[matchId].tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Colors`** (1 nodes): `src/theme/colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client Setup`** (1 nodes): `src/supabase/client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Skia Dice`** (1 nodes): `src/skia/Dice.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PRD Document`** (1 nodes): `Product Requirements Document`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Master Prompt`** (1 nodes): `Master Prompt for Claude Code`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint (Expo flat)`** (1 nodes): `ESLint Config (Expo flat)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Spacing Scale`** (1 nodes): `spacing scale`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Radius Scale`** (1 nodes): `radius scale`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HomeScreen (tab)` connect `Home & Matchmaking` to `App Shell & Routing`, `Profile Edit Flow`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `SettingsScreen` connect `App Shell & Routing` to `Home & Matchmaking`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getValidMoves()` (e.g. with `isSameTrackCell()` and `chooseMove()`) actually correct?**
  _`getValidMoves()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `app/game/[matchId].tsx`, `src/theme/colors.ts`, `src/supabase/client.ts` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth UI Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Game Rules Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._