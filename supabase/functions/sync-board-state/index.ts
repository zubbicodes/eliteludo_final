import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Color = "red" | "green" | "yellow" | "blue";
type GameState = {
  players: { color: Color }[];
  currentPlayerIdx: number;
  status: string;
  winnerColor: Color | null;
  [key: string]: unknown;
};
type MatchPlayer = { user_id: string; color: Color };

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
  let boardState: GameState;
  try {
    const body = await req.json();
    matchId = body.matchId;
    boardState = body.boardState;
    if (!matchId || !boardState?.players?.length) throw new Error();
  } catch {
    return json({ success: false, reason: "matchId and boardState required" }, 400);
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
  if (match.current_turn_user_id !== user.id) {
    return json({ success: false, reason: "Turn already advanced" });
  }

  const currentColor = boardState.players[boardState.currentPlayerIdx]?.color;
  const nextPlayer = matchPlayers.find((p) => p.color === currentColor);
  if (!nextPlayer) return json({ success: false, reason: "Invalid next turn" }, 400);

  const patch: Record<string, unknown> = {
    board_state: boardState,
    current_turn_user_id: nextPlayer.user_id,
  };

  if (boardState.status === "finished" && boardState.winnerColor) {
    const winner = matchPlayers.find((p) => p.color === boardState.winnerColor);
    patch.status = "finished";
    patch.winner_user_id = winner?.user_id ?? null;
    patch.finished_at = new Date().toISOString();
  }

  const { error: updateErr } = await svc
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .eq("status", "active");

  if (updateErr) return json({ success: false, reason: "Update failed" }, 500);

  return json({ success: true, currentTurnUserId: nextPlayer.user_id });
});
