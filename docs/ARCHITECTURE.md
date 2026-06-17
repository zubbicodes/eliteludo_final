# Elite Ludo Architecture Notes

## Fast Multiplayer Sync

Active multiplayer matches use a Supabase hybrid model:

- Supabase Auth, Postgres, RLS, Edge Functions, wallet state, rewards, match history, and audit logs remain the backend source of truth.
- Gameplay actions are still server-authoritative: the client asks an Edge Function to roll, move, skip, or forfeit; the function validates, commits the new board state, records an audit row, then broadcasts the committed result.
- Live match delivery uses private Supabase Realtime Broadcast channels with topic `match:<matchId>:game`.
- 2-player online matches also use Presence on the same channel. Gameplay controls stay locked until both human players are present.
- If an opponent who was already present leaves the channel and does not return during the grace period, the remaining player calls `claim-opponent-left`; the server finishes the match and broadcasts `match_finished`.
- `matches.board_state.version` is monotonic. Clients ignore duplicate events and events at or behind their current version.
- `getMatch(matchId)` remains the recovery path for initial load, reconnect, and `sync_required` events.

## Why Not Socket.io For V1

Socket.io is deferred because it would add a separate authoritative game server, hosting, Redis or another room adapter, sticky-session/autoscaling concerns, deployment monitoring, and another security boundary. Supabase Broadcast gives the app the low-latency game-event path it needs while keeping money, auth, anti-cheat audit, and persistence in one system for the first market release.
