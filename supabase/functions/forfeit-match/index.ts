import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Color = "red" | "green" | "yellow" | "blue";
type GameState = {
  players: { color: Color; isAI: boolean }[];
  currentPlayerIdx: number;
  status: string;
  winnerColor: Color | null;
  [key: string]: unknown;
};
type MatchPlayer = {
  user_id: string;
  color: Color;
  is_bot?: boolean;
};

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
  if (!authHeader) return json({ success: false, reason: "Unauthorized" }, 401);

  let matchId: string;
  try {
    ({ matchId } = await req.json());
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
    .select("id, board_state, current_turn_user_id, status, players, winner_user_id")
    .eq("id", matchId)
    .single();

  if (matchErr || !match) return json({ success: false, reason: "Match not found" }, 404);

  if (match.status === "finished") {
    const board = match.board_state as GameState;
    return json({
      success: true,
      winnerUserId: match.winner_user_id,
      winnerColor: board.winnerColor,
      reason: "Already finished",
    });
  }

  if (match.status !== "active") {
    return json({ success: false, reason: "Match not active" }, 409);
  }

  const players = match.players as MatchPlayer[];
  const leaving = players.find((p) => p.user_id === user.id);
  if (!leaving) return json({ success: false, reason: "Not in match" }, 403);

  const winner = players.find((p) => p.user_id !== user.id && !p.is_bot) ??
    players.find((p) => p.user_id !== user.id);
  if (!winner) {
    return json({ success: false, reason: "No opponent to award" }, 409);
  }

  const boardState = match.board_state as GameState;
  const winnerIdx = boardState.players.findIndex((p) => p.color === winner.color);
  const nextBoardState: GameState = {
    ...boardState,
    currentPlayerIdx: winnerIdx >= 0 ? winnerIdx : boardState.currentPlayerIdx,
    status: "finished",
    winnerColor: winner.color,
    dicePool: [],
    lastMove: null,
  };

  const { data: updatedMatch, error: updateErr } = await svc
    .from("matches")
    .update({
      status: "finished",
      winner_user_id: winner.user_id,
      current_turn_user_id: winner.user_id,
      board_state: nextBoardState,
      finished_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (updateErr) return json({ success: false, reason: "Update failed" }, 500);
  if (!updatedMatch) return json({ success: false, reason: "Match already settled" }, 409);

  await svc.from("match_moves").insert({
    match_id: matchId,
    user_id: user.id,
    move_type: "forfeit",
    payload: {
      leavingUserId: user.id,
      leavingColor: leaving.color,
      winnerUserId: winner.user_id,
      winnerColor: winner.color,
    },
  });

  return json({
    success: true,
    winnerUserId: winner.user_id,
    winnerColor: winner.color,
  });
});
