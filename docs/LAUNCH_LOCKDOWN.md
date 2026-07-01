# Elite Ludo Launch Lockdown

Two-week release target: Android first. Keep iOS code-safe, but do not let iOS packaging block the Android internal test build.

## V1 Visible Scope

- Splash and real startup preload
- Auth, signup, onboarding, profile, settings
- Home screen, daily reward, basic shop
- Offline Ludo against bots
- 2-player online matchmaking
- Private room create/join
- Result screen and server-authoritative rewards

## Hidden Or Soft-Parked For V1

- Friends tab
- Clubs tab
- Chest tab
- Advanced social flows
- Unverified IAP purchase surfaces
- Any feature that cannot pass a clean-install device test by day 10

## Performance Gates

- No critical image asset above 300KB unless explicitly approved.
- No image asset above 1MB in the release bundle.
- Match screen must not use JS timers for token hop sequencing or dice face cycling.
- Splash must route with a timeout fallback if profile, wallet, or network preload fails.
- Run before each release candidate:

```bash
npm test
npm run typecheck
npm run lint
npm run audit:assets
```

Use strict mode for the final release candidate:

```bash
npm run audit:assets -- --strict
```
