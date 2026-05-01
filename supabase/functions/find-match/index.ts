import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ────────────────────────────────────────────────────────────────────

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
type InitialGameState = {
  players: Player[];
  currentPlayerIdx: number;
  dicePool: number[];
  consecutiveSixes: number;
  status: "awaiting_roll";
  winnerColor: null;
  lastRollByColor: Record<string, never>;
  lastMove: null;
};

function makeInitialPlayer(
  color: Color,
  name: string,
  avatarId: number,
): Player {
  const tokens = ([0, 1, 2, 3] as const).map((slot) => ({
    id: `${color}-${slot}`,
    color,
    location: { kind: "home" as const, slot },
  })) as Player["tokens"];
  return { color, name, isAI: false, avatarId, tokens };
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let entryFee = 0;
  let botFallback = false;
  try {
    const body = await req.json();
    entryFee = body.entryFee ?? 0;
    botFallback = body.botFallback ?? false;
  } catch {
    // use defaults
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  // Bot fallback: hand back a solo match ID — client runs existing vs-AI path
  if (botFallback) {
    await svc.from("match_queue").delete().eq("user_id", user.id);
    const matchId = `solo-${crypto.randomUUID()}`;
    return new Response(
      JSON.stringify({ matchId, matched: false, isBot: true }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Refresh queue entry (delete + insert to reset timestamp)
  await svc.from("match_queue").delete().eq("user_id", user.id);
  await svc.from("match_queue").insert({
    user_id: user.id,
    mode: "1v1",
    entry_fee: entryFee,
  });

  // Look for another waiting player
  const { data: partner } = await svc
    .from("match_queue")
    .select("id, user_id")
    .eq("mode", "1v1")
    .eq("entry_fee", entryFee)
    .is("match_id", null)
    .neq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!partner) {
    return new Response(
      JSON.stringify({ matchId: null, matched: false }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Fetch both profiles
  const [{ data: myProfile }, { data: partnerProfile }] = await Promise.all([
    svc.from("profiles").select("username, avatar_id").eq("id", user.id).single(),
    svc.from("profiles").select("username, avatar_id").eq("id", partner.user_id).single(),
  ]);

  const myColor: Color = "red";
  const partnerColor: Color = "green";

  const boardState: InitialGameState = {
    players: [
      makeInitialPlayer(myColor, myProfile?.username ?? "Player 1", myProfile?.avatar_id ?? 0),
      makeInitialPlayer(partnerColor, partnerProfile?.username ?? "Player 2", partnerProfile?.avatar_id ?? 1),
    ],
    currentPlayerIdx: 0,
    dicePool: [],
    consecutiveSixes: 0,
    status: "awaiting_roll",
    winnerColor: null,
    lastRollByColor: {},
    lastMove: null,
  };

  const { data: newMatch, error: matchErr } = await svc
    .from("matches")
    .insert({
      mode: "1v1",
      status: "active",
      players: [
        {
          user_id: user.id,
          color: myColor,
          username: myProfile?.username,
          avatar_id: myProfile?.avatar_id ?? 0,
        },
        {
          user_id: partner.user_id,
          color: partnerColor,
          username: partnerProfile?.username,
          avatar_id: partnerProfile?.avatar_id ?? 1,
        },
      ],
      current_turn_user_id: user.id,
      board_state: boardState,
      entry_fee: entryFee,
      prize_pool: entryFee * 2,
    })
    .select("id")
    .single();

  if (matchErr || !newMatch) {
    return new Response("Failed to create match", { status: 500, headers: cors });
  }

  // Link both queue entries to the new match
  await svc
    .from("match_queue")
    .update({ match_id: newMatch.id })
    .in("user_id", [user.id, partner.user_id]);

  return new Response(
    JSON.stringify({ matchId: newMatch.id, matched: true }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
