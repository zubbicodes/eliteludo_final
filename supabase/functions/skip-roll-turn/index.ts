import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Color = "red" | "green" | "yellow" | "blue";
type GameState = {
  version?: number;
  players: {
    color: Color;
    tokens: { location: { kind: string } }[];
  }[];
  currentPlayerIdx: number;
  dicePool: number[];
  consecutiveSixes: number;
  status: string;
  winnerColor: Color | null;
  lastMove: unknown;
  [key: string]: unknown;
};
type MatchPlayer = { user_id: string; color: Color; is_bot?: boolean };
const MATCH_BROADCAST_EVENT = "match_event";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ success: false, reason: "Unauthorized" }, 401);

  let matchId: string;
  let expectedPlayerIdx: number | undefined;
  try {
    ({ matchId, expectedPlayerIdx } = await req.json());
    if (!matchId) throw new Error();
  } catch {
    return json({ success: false, reason: "matchId required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
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
  if (match.status !== "active") return json({ success: false, reason: "Match not active" });

  const matchPlayers = match.players as MatchPlayer[];
  const caller = matchPlayers.find((p) => p.user_id === user.id);
  if (!caller) return json({ success: false, reason: "Not in match" }, 403);

  const boardState = match.board_state as GameState;
  if (boardState.status !== "awaiting_roll") {
    return json({ success: false, reason: "Not awaiting roll" });
  }
  if (
    typeof expectedPlayerIdx === "number" &&
    boardState.currentPlayerIdx !== expectedPlayerIdx
  ) {
    return json({ success: false, reason: "Turn already advanced" });
  }
  if (boardState.winnerColor) return json({ success: false, reason: "Match finished" });

  const skippedColor = boardState.players[boardState.currentPlayerIdx].color;
  const newBoardState = { ...advanceToNextPlayer(boardState), version: nextVersion(boardState) };
  const nextColor = newBoardState.players[newBoardState.currentPlayerIdx].color;
  const nextTurnUserId = turnOwnerUserId(matchPlayers, nextColor, match.current_turn_user_id);

  const { data: updatedRows, error: updateErr } = await svc
    .from("matches")
    .update({
      board_state: newBoardState,
      current_turn_user_id: nextTurnUserId,
    })
    .eq("id", matchId)
    .eq("current_turn_user_id", match.current_turn_user_id)
    .eq("status", "active")
    .select("id");

  if (updateErr) return json({ success: false, reason: "Update failed" }, 500);
  if (!updatedRows || updatedRows.length !== 1) {
    return json({ success: false, reason: "Turn already advanced", boardState }, 409);
  }

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "skip",
    payload: {
      reason: "roll_timeout",
      skippedColor,
      skippedTurnUserId: match.current_turn_user_id,
      nextTurnUserId,
    },
  });

  const event = {
    eventId: crypto.randomUUID(),
    matchId,
    type: "turn_skipped",
    version: newBoardState.version,
    boardState: newBoardState,
    currentTurnUserId: nextTurnUserId,
    reason: "roll_timeout",
  };

  await broadcastMatchEvent(svc, matchId, event);

  return json({
    success: true,
    boardState: newBoardState,
    currentTurnUserId: nextTurnUserId,
    event,
  });
});
