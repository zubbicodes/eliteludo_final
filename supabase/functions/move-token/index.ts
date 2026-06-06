import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
type MoveOption = {
  tokenId: string;
  dieValue: number;
  from: TokenLocation;
  to: TokenLocation;
  captures: string[];
};
type GameState = {
  players: Player[];
  currentPlayerIdx: number;
  dicePool: number[];
  consecutiveSixes: number;
  status: "awaiting_roll" | "rolling" | "awaiting_move" | "animating" | "finished";
  winnerColor: Color | null;
  lastRollByColor: Partial<Record<Color, number>>;
  lastMove: MoveOption | null;
};
type MatchPlayer = { user_id: string; color: Color };

const COLOR_START_INDEX: Record<Color, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};
const HOME_COL_LENGTH = 5;
const TOKENS_PER_PLAYER = 4;
const TOTAL_TRACK_HOPS = 50;
const OUTER_TRACK_LENGTH = 52;
const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

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

function getValidMoves(state: GameState, color: Color): MoveOption[] {
  const player = state.players.find((p) => p.color === color);
  if (!player) return [];
  const allTokens = state.players.flatMap((p) => p.tokens);
  const uniqueDice = Array.from(new Set(state.dicePool));
  const moves: MoveOption[] = [];

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
      if (blockedByOwn) continue;

      const captures: string[] = [];
      if (to.kind === "track" && !SAFE_TRACK_INDICES.has(to.index)) {
        for (const t of allTokens) {
          if (t.color !== color && samePlace(t.location, to)) captures.push(t.id);
        }
      }
      moves.push({ tokenId: token.id, dieValue: die, from: token.location, to, captures });
    }
  }

  return moves;
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

function applyMove(state: GameState, move: MoveOption): GameState {
  const players = state.players.map((p) => ({
    ...p,
    tokens: p.tokens.map((t) => ({ ...t })) as Player["tokens"],
  }));

  const moved = findToken(players, move.tokenId);
  moved.location = move.to;

  for (const capturedId of move.captures) {
    const captured = findToken(players, capturedId);
    captured.location = freeHomeSlot(players, captured.color);
  }

  const movedPlayer = players.find((p) => p.color === moved.color)!;
  const won = movedPlayer.tokens.every((t) => t.location.kind === "finished");

  return {
    ...state,
    players,
    dicePool: removeOne(state.dicePool, move.dieValue),
    winnerColor: won ? movedPlayer.color : state.winnerColor,
    status: "animating",
    consecutiveSixes: 0,
    lastMove: move,
  };
}

function finishMove(state: GameState): GameState {
  const move = state.lastMove;
  const earnedBonusRoll = !!move && (move.captures.length > 0 || move.to.kind === "finished");
  const cleared = { ...state, lastMove: null };
  if (cleared.winnerColor) return { ...cleared, status: "finished" };
  if (cleared.dicePool.length > 0) {
    const color = cleared.players[cleared.currentPlayerIdx].color;
    const moves = getValidMoves(cleared, color);
    if (moves.length > 0) {
      if (earnedBonusRoll) return { ...cleared, status: "awaiting_roll" };
      return { ...cleared, status: "awaiting_move" };
    }
    if (earnedBonusRoll) return { ...cleared, dicePool: [], status: "awaiting_roll" };
    return advanceToNextPlayer({ ...cleared, dicePool: [] });
  }
  if (earnedBonusRoll) return { ...cleared, status: "awaiting_roll" };
  return advanceToNextPlayer(cleared);
}

function findToken(players: Player[], id: string): Token {
  for (const p of players) {
    for (const t of p.tokens) if (t.id === id) return t;
  }
  throw new Error(`token ${id} not found`);
}

function freeHomeSlot(players: Player[], color: Color): TokenLocation {
  const player = players.find((p) => p.color === color)!;
  const used = new Set(
    player.tokens
      .filter((t) => t.location.kind === "home")
      .map((t) => (t.location as { kind: "home"; slot: number }).slot),
  );
  for (let s = 0; s < TOKENS_PER_PLAYER; s++) {
    if (!used.has(s)) return { kind: "home", slot: s as 0 | 1 | 2 | 3 };
  }
  return { kind: "home", slot: 0 };
}

function removeOne(arr: number[], value: number): number[] {
  const index = arr.indexOf(value);
  if (index < 0) return arr.slice();
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, reason: "Unauthorized" }, 401);

  let matchId: string;
  let tokenId: string;
  let dieValue: number;
  try {
    const body = await req.json();
    matchId = body.matchId;
    tokenId = body.tokenId;
    dieValue = body.dieValue;
    if (!matchId || !tokenId || typeof dieValue !== "number") throw new Error();
  } catch {
    return json({ success: false, reason: "matchId, tokenId and dieValue required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) return json({ success: false, reason: "Unauthorized" }, 401);

  const { data: match, error: matchErr } = await svc
    .from("matches")
    .select("id, board_state, current_turn_user_id, status, players")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) return json({ success: false, reason: "Match not found" }, 404);

  const boardState = match.board_state as GameState;
  const matchPlayers = match.players as MatchPlayer[];
  const caller = matchPlayers.find((p) => p.user_id === user.id);
  if (!caller) return json({ success: false, reason: "Not in match" }, 403);
  if (match.status !== "active") {
    return json({ success: false, reason: "Match not active", boardState });
  }
  if (match.current_turn_user_id !== user.id) {
    return json({ success: false, reason: "Turn already advanced", boardState });
  }
  if (boardState.status !== "awaiting_move") {
    return json({ success: false, reason: "Not awaiting move", boardState });
  }

  const currentColor = boardState.players[boardState.currentPlayerIdx]?.color;
  if (currentColor !== caller.color) {
    return json({ success: false, reason: "Color mismatch", boardState }, 409);
  }

  const move = getValidMoves(boardState, caller.color)
    .find((m) => m.tokenId === tokenId && m.dieValue === dieValue);
  if (!move) return json({ success: false, reason: "Invalid move", boardState }, 409);

  const movedBoardState = applyMove(boardState, move);
  const newBoardState = finishMove(movedBoardState);
  const nextColor = newBoardState.players[newBoardState.currentPlayerIdx].color;
  const nextPlayer = matchPlayers.find((p) => p.color === nextColor);
  const patch: Record<string, unknown> = {
    board_state: newBoardState,
    current_turn_user_id: nextPlayer?.user_id ?? match.current_turn_user_id,
  };

  if (newBoardState.status === "finished" && newBoardState.winnerColor) {
    const winner = matchPlayers.find((p) => p.color === newBoardState.winnerColor);
    patch.status = "finished";
    patch.winner_user_id = winner?.user_id ?? null;
    patch.finished_at = new Date().toISOString();
  }

  const { error: updateErr } = await svc
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .eq("current_turn_user_id", user.id)
    .eq("status", "active");

  if (updateErr) return json({ success: false, reason: "Update failed" }, 500);

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "move_token",
    payload: { tokenId, dieValue, move, nextStatus: newBoardState.status },
  });

  return json({
    success: true,
    move,
    boardState: newBoardState,
    currentTurnUserId: patch.current_turn_user_id,
  });
});
