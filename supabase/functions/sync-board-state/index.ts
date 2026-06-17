import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Color = "red" | "green" | "yellow" | "blue";
type GameState = {
  version?: number;
  players: { color: Color }[];
  currentPlayerIdx: number;
  status: string;
  winnerColor: Color | null;
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

function nextVersion(state: GameState): number {
  return (typeof state.version === "number" ? state.version : 0) + 1;
}

function isBotPlayer(player?: MatchPlayer): boolean {
  return !!player && (!!player.is_bot || player.user_id.startsWith("bot-"));
}

function firstHumanUserId(matchPlayers: MatchPlayer[]): string | null {
  return matchPlayers.find((p) => !isBotPlayer(p))?.user_id ?? null;
}

function turnOwnerUserId(
  matchPlayers: MatchPlayer[],
  color: Color,
  fallbackUserId: string,
): string {
  const player = matchPlayers.find((p) => p.color === color);
  if (player && !isBotPlayer(player)) return player.user_id;
  return firstHumanUserId(matchPlayers) ?? fallbackUserId;
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
  let boardState: GameState;
  try {
    const body = await req.json();
    matchId = body.matchId;
    boardState = body.boardState;
    if (!matchId || !boardState?.players?.length) throw new Error();
  } catch {
    return json({ success: false, reason: "matchId and boardState required" }, 400);
  }
  if (boardState.status === "animating") {
    return json({ success: false, reason: "Refusing transient animation state" });
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
    .select("id, status, current_turn_user_id, players")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) return json({ success: false, reason: "Match not found" }, 404);
  if (match.status !== "active") return json({ success: false, reason: "Match not active" });

  const matchPlayers = match.players as MatchPlayer[];
  const caller = matchPlayers.find((p) => p.user_id === user.id);
  if (!caller) return json({ success: false, reason: "Not in match" }, 403);
  const driverUserId = firstHumanUserId(matchPlayers);
  const persistedBoardState = match.board_state as GameState;
  const persistedColor = persistedBoardState.players[persistedBoardState.currentPlayerIdx]?.color;
  const persistedPlayer = matchPlayers.find((p) => p.color === persistedColor);
  const isPersistedBotTurn = isBotPlayer(persistedPlayer);
  if (
    match.current_turn_user_id !== user.id &&
    !(driverUserId === user.id && isPersistedBotTurn)
  ) {
    return json({ success: false, reason: "Turn already advanced" });
  }

  const currentColor = boardState.players[boardState.currentPlayerIdx]?.color;
  if (!currentColor) return json({ success: false, reason: "Invalid next turn" }, 400);
  const committedBoardState = { ...boardState, version: nextVersion(boardState) };
  const currentTurnUserId = turnOwnerUserId(matchPlayers, currentColor, match.current_turn_user_id);

  const patch: Record<string, unknown> = {
    board_state: committedBoardState,
    current_turn_user_id: currentTurnUserId,
  };

  if (committedBoardState.status === "finished" && committedBoardState.winnerColor) {
    const winner = matchPlayers.find((p) => p.color === committedBoardState.winnerColor);
    patch.status = "finished";
    patch.winner_user_id = winner && !isBotPlayer(winner) ? winner.user_id : null;
    patch.finished_at = new Date().toISOString();
  }

  const { error: updateErr } = await svc
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .eq("status", "active");

  if (updateErr) return json({ success: false, reason: "Update failed" }, 500);

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "sync",
    payload: {
      status: committedBoardState.status,
      currentColor,
      currentTurnUserId,
      source: "bot_driver",
    },
  });

  const event = {
    eventId: crypto.randomUUID(),
    matchId,
    type: committedBoardState.status === "finished" ? "match_finished" : "state_snapshot",
    version: committedBoardState.version,
    boardState: committedBoardState,
    currentTurnUserId,
    winnerColor: committedBoardState.winnerColor,
    winnerUserId: patch.winner_user_id ?? null,
  };

  await broadcastMatchEvent(svc, matchId, event);

  return json({ success: true, boardState: committedBoardState, currentTurnUserId, event });
});
