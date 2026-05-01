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
  players: Player[];
  currentPlayerIdx: number;
  dicePool: number[];
  consecutiveSixes: number;
  status: GameStatus;
  winnerColor: Color | null;
  lastRollByColor: Partial<Record<Color, number>>;
  lastMove: unknown;
};
type MatchPlayer = { user_id: string; color: Color };

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
    status: isSix ? "awaiting_roll" : "awaiting_move",
    lastRollByColor,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let matchId: string;
  try {
    ({ matchId } = await req.json());
    if (!matchId) throw new Error();
  } catch {
    return new Response("matchId required", { status: 400, headers: cors });
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
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  // Fetch match
  const { data: match, error: matchErr } = await svc
    .from("matches")
    .select("id, board_state, current_turn_user_id, status, players")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) {
    return new Response("Match not found", { status: 404, headers: cors });
  }
  if (match.status !== "active") {
    return new Response("Match not active", { status: 409, headers: cors });
  }
  if (match.current_turn_user_id !== user.id) {
    return new Response("Not your turn", { status: 403, headers: cors });
  }

  const boardState = match.board_state as GameState;
  if (boardState.status !== "awaiting_roll") {
    return new Response("Not awaiting roll", { status: 409, headers: cors });
  }

  const value = rollDice();
  const newBoardState = addRoll(boardState, value);

  // Determine whose turn it is now (column must stay in sync with board_state)
  const nextColor = newBoardState.players[newBoardState.currentPlayerIdx].color;
  const matchPlayers = match.players as MatchPlayer[];
  const nextPlayer = matchPlayers.find((p) => p.color === nextColor);
  const nextTurnUserId = nextPlayer?.user_id ?? match.current_turn_user_id;

  const { error: updateErr } = await svc
    .from("matches")
    .update({ board_state: newBoardState, current_turn_user_id: nextTurnUserId })
    .eq("id", matchId);

  if (updateErr) {
    return new Response("Update failed", { status: 500, headers: cors });
  }

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "roll",
    payload: { value, newStatus: newBoardState.status },
  });

  return new Response(JSON.stringify({ value }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
