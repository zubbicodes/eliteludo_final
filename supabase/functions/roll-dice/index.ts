import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types (inlined from src/game/types.ts) ────────────────────────────────────

type Color = "red" | "green" | "yellow" | "blue";
type TokenLocation =
  | { kind: "home"; slot: 0 | 1 | 2 | 3 }
  | { kind: "track"; index: number }
  | { kind: "home_col"; index: 0 | 1 | 2 | 3 | 4 }
  | { kind: "finished" };
type Token = { id: string; color: Color; location: TokenLocation };
type Player = {
  color: Color;
  isAI: boolean;
  name: string;
  avatarId: number;
  tokens: [Token, Token, Token, Token];
};
type GameStatus =
  | "awaiting_roll"
  | "rolling"
  | "awaiting_move"
  | "animating"
  | "finished";
type GameState = {
  version?: number;
  players: Player[];
  currentPlayerIdx: number;
  dicePool: number[];
  consecutiveSixes: number;
  status: GameStatus;
  winnerColor: Color | null;
  lastRollByColor: Partial<Record<Color, number>>;
  lastMove: unknown;
};
type MatchPlayer = { user_id: string; color: Color; is_bot?: boolean };
const MATCH_BROADCAST_EVENT = "match_event";

const COLOR_START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};
const HOME_COL_LENGTH = 5;
const TOTAL_TRACK_HOPS = 50;
const OUTER_TRACK_LENGTH = 52;
const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ── Rules (inlined from src/game/rules.ts — only addRoll needed) ─────────────

function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}

function advanceToNextPlayer(state: GameState): GameState {
  let nextIdx = (state.currentPlayerIdx + 1) % state.players.length;
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[nextIdx];
    if (!p.tokens.every((t) => t.location.kind === "finished")) break;
    nextIdx = (nextIdx + 1) % state.players.length;
  }
  return {
    ...state,
    currentPlayerIdx: nextIdx,
    dicePool: [],
    consecutiveSixes: 0,
    status: "awaiting_roll",
    lastMove: null,
  };
}

function addRoll(state: GameState, value: number): GameState {
  const isSix = value === 6;
  const sixes = isSix ? state.consecutiveSixes + 1 : 0;
  const color = state.players[state.currentPlayerIdx].color;
  const lastRollByColor = { ...state.lastRollByColor, [color]: value };

  if (sixes >= 3) {
    return advanceToNextPlayer({
      ...state,
      dicePool: [],
      consecutiveSixes: 0,
      lastRollByColor,
    });
  }

  return {
    ...state,
    dicePool: [...state.dicePool, value],
    consecutiveSixes: sixes,
    status: "awaiting_move",
    lastRollByColor,
  };
}

function nextVersion(state: GameState): number {
  return (typeof state.version === "number" ? state.version : 0) + 1;
}

function turnOwnerUserId(
  matchPlayers: MatchPlayer[],
  color: Color,
  fallbackUserId: string,
): string {
  const player = matchPlayers.find((p) => p.color === color);
  if (player && !player.is_bot && !player.user_id.startsWith("bot-")) return player.user_id;
  return matchPlayers.find((p) => !p.is_bot && !p.user_id.startsWith("bot-"))?.user_id ?? fallbackUserId;
}

async function broadcastMatchEvent(
  svc: ReturnType<typeof createClient>,
  matchId: string,
  payload: Record<string, unknown>,
) {
  await svc.rpc("broadcast_match_event", {
    p_match_id: matchId,
    p_event: MATCH_BROADCAST_EVENT,
    p_payload: payload,
  });
}

function tryMove(token: Token, dice: number): TokenLocation | null {
  const loc = token.location;
  const color = token.color;
  if (loc.kind === "finished") return null;
  if (loc.kind === "home") {
    if (dice !== 6) return null;
    return { kind: "track", index: COLOR_START_INDEX[color] };
  }
  if (loc.kind === "track") {
    const start = COLOR_START_INDEX[color];
    const currentHop = (loc.index - start + OUTER_TRACK_LENGTH) % OUTER_TRACK_LENGTH;
    const nextHop = currentHop + dice;
    if (nextHop <= TOTAL_TRACK_HOPS) {
      return { kind: "track", index: (start + nextHop) % OUTER_TRACK_LENGTH };
    }
    const colIdx = nextHop - TOTAL_TRACK_HOPS - 1;
    if (colIdx === HOME_COL_LENGTH) return { kind: "finished" };
    if (colIdx > HOME_COL_LENGTH) return null;
    return { kind: "home_col", index: colIdx as 0 | 1 | 2 | 3 | 4 };
  }
  const nextIdx = loc.index + dice;
  if (nextIdx === HOME_COL_LENGTH) return { kind: "finished" };
  if (nextIdx > HOME_COL_LENGTH) return null;
  return { kind: "home_col", index: nextIdx as 0 | 1 | 2 | 3 | 4 };
}

function samePlace(a: TokenLocation, b: TokenLocation): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "home") return b.kind === "home" && a.slot === b.slot;
  if (a.kind === "track") return b.kind === "track" && a.index === b.index;
  if (a.kind === "home_col") return b.kind === "home_col" && a.index === b.index;
  return b.kind === "finished";
}

function hasValidMove(state: GameState, color: Color): boolean {
  const player = state.players.find((p) => p.color === color);
  if (!player) return false;
  const uniqueDice = Array.from(new Set(state.dicePool));
  for (const die of uniqueDice) {
    for (const token of player.tokens) {
      const to = tryMove(token, die);
      if (!to) continue;
      const isOpeningFromBase = token.location.kind === "home";
      const destIsSafe = to.kind === "track" && SAFE_TRACK_INDICES.has(to.index);
      const blockedByOwn =
        !isOpeningFromBase &&
        !destIsSafe &&
        to.kind !== "finished" &&
        player.tokens.some((t) => t.id !== token.id && samePlace(t.location, to));
      if (!blockedByOwn) return true;
    }
  }
  return false;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ success: false, reason: "Unauthorized" }, 401);
  }

  let matchId: string;
  try {
    ({ matchId } = await req.json());
    if (!matchId) throw new Error();
  } catch {
    return json({ success: false, reason: "matchId required" }, 400);
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve caller identity
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) {
    return json({ success: false, reason: "Unauthorized" }, 401);
  }

  // Fetch match
  const { data: match, error: matchErr } = await svc
    .from("matches")
    .select("id, board_state, current_turn_user_id, status, players")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return json({ success: false, reason: "Match not found" }, 404);
  }
  const matchPlayers = match.players as MatchPlayer[];
  const caller = matchPlayers.find((p) => p.user_id === user.id);
  if (!caller) {
    return json({ success: false, reason: "Not in match" }, 403);
  }

  const boardState = match.board_state as GameState;
  if (match.status !== "active") {
    return json({ success: false, reason: "Match not active", boardState });
  }
  if (match.current_turn_user_id !== user.id) {
    return json({ success: false, reason: "Turn already advanced", boardState });
  }

  if (boardState.status !== "awaiting_roll") {
    return json({ success: false, reason: "Not awaiting roll", boardState });
  }

  const value = rollDice();
  let newBoardState = addRoll(boardState, value);

  if (newBoardState.status === "awaiting_move") {
    const color = newBoardState.players[newBoardState.currentPlayerIdx].color;
    if (!hasValidMove(newBoardState, color)) {
      newBoardState = advanceToNextPlayer({ ...newBoardState, dicePool: [] });
    }
  }
  newBoardState = { ...newBoardState, version: nextVersion(boardState) };

  // Determine whose turn it is now (column must stay in sync with board_state)
  const nextColor = newBoardState.players[newBoardState.currentPlayerIdx].color;
  const nextTurnUserId = turnOwnerUserId(matchPlayers, nextColor, match.current_turn_user_id);

  const { data: updatedRows, error: updateErr } = await svc
    .from("matches")
    .update({ board_state: newBoardState, current_turn_user_id: nextTurnUserId })
    .eq("id", matchId)
    .eq("current_turn_user_id", user.id)
    .eq("status", "active")
    .select("id");

  if (updateErr) {
    return json({ success: false, reason: "Update failed" }, 500);
  }
  if (!updatedRows || updatedRows.length !== 1) {
    return json({ success: false, reason: "Turn already advanced", boardState }, 409);
  }

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "roll",
    payload: { value, newStatus: newBoardState.status },
  });

  const event = {
    eventId: crypto.randomUUID(),
    matchId,
    type: "roll_result",
    version: newBoardState.version,
    value,
    boardState: newBoardState,
    currentTurnUserId: nextTurnUserId,
  };

  await broadcastMatchEvent(svc, matchId, event);

  return json({ success: true, value, boardState: newBoardState, event });
});
