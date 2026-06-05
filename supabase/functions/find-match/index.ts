import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Color = "red" | "green" | "yellow" | "blue";
type MatchMode = "1v1" | "4p" | "private";

type Player = {
  color: Color;
  isAI: boolean;
  name: string;
  avatarId: number;
  tokens: { id: string; color: Color; location: { kind: "home"; slot: number } }[];
};

const COLORS: Color[] = ["red", "green", "yellow", "blue"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makePlayer(color: Color, name: string, avatarId: number, isAI = false): Player {
  return {
    color,
    name,
    isAI,
    avatarId,
    tokens: [0, 1, 2, 3].map((slot) => ({
      id: `${color}-${slot}`,
      color,
      location: { kind: "home", slot },
    })),
  };
}

function makeBoardState(players: Player[]) {
  return {
    players,
    currentPlayerIdx: 0,
    dicePool: [],
    consecutiveSixes: 0,
    status: "awaiting_roll",
    winnerColor: null,
    lastRollByColor: {},
    lastMove: null,
  };
}

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function refundEntryFee(svc: any, userId: string, amount: number, reason: string) {
  if (amount <= 0) return 0;
  const { data: profile } = await svc.from("profiles").select("coins").eq("id", userId).single();
  if (!profile) return 0;
  await svc.from("profiles").update({ coins: Number(profile.coins ?? 0) + amount }).eq("id", userId);
  await svc.from("transactions").insert({
    user_id: userId,
    type: "refund",
    amount,
    currency: "coins",
    metadata: { reason },
  });
  return amount;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const body = await req.json().catch(() => ({}));
  const mode = (body.mode === "4p" || body.mode === "private" ? body.mode : "1v1") as MatchMode;
  const entryFee = Math.max(0, Number(body.entryFee ?? 0));
  const botFallback = Boolean(body.botFallback);
  const cancel = Boolean(body.cancel);
  const citySlug = typeof body.citySlug === "string" ? body.citySlug : null;
  const privateAction = body.privateAction === "join" ? "join" : body.privateAction === "create" ? "create" : null;

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  if (cancel) {
    await svc.from("match_queue").update({ cancelled_at: new Date().toISOString() }).eq("user_id", user.id).is("match_id", null);
    await svc.from("match_queue").delete().eq("user_id", user.id).is("match_id", null);
    const refunded = await refundEntryFee(svc, user.id, entryFee, "queue_cancelled");
    return new Response(JSON.stringify({ matchId: null, matched: false, refunded }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: myProfile } = await svc
    .from("profiles")
    .select("username, avatar_id")
    .eq("id", user.id)
    .single();

  if (mode === "private" && privateAction === "create") {
    const code = roomCode();
    const players = [makePlayer("red", myProfile?.username ?? "Host", myProfile?.avatar_id ?? 0)];
    const { data: match, error } = await svc
      .from("matches")
      .insert({
        mode: "private",
        status: "waiting",
        room_code: code,
        host_user_id: user.id,
        players: [{ user_id: user.id, color: "red", username: myProfile?.username, avatar_id: myProfile?.avatar_id ?? 0 }],
        current_turn_user_id: user.id,
        board_state: makeBoardState(players),
        entry_fee: entryFee,
        prize_pool: entryFee,
        city_slug: citySlug,
      })
      .select("id")
      .single();
    if (error || !match) return new Response("Failed to create room", { status: 500, headers: cors });
    return new Response(JSON.stringify({ matchId: match.id, matched: false, roomCode: code }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (mode === "private" && privateAction === "join") {
    const code = String(body.roomCode ?? "").toUpperCase();
    const { data: match } = await svc
      .from("matches")
      .select("id, players, entry_fee, city_slug")
      .eq("room_code", code)
      .eq("status", "waiting")
      .single();
    if (!match) {
      return new Response(JSON.stringify({ matchId: null, matched: false, reason: "room_not_found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const matchPlayers = Array.isArray(match.players) ? match.players : [];
    const color = COLORS[matchPlayers.length] ?? "green";
    const nextPlayers = [
      ...matchPlayers,
      { user_id: user.id, color, username: myProfile?.username, avatar_id: myProfile?.avatar_id ?? 0 },
    ];
    const boardPlayers = nextPlayers.map((p: any, i: number) =>
      makePlayer(p.color, p.username ?? `Player ${i + 1}`, p.avatar_id ?? i),
    );
    await svc.from("matches").update({
      players: nextPlayers,
      status: nextPlayers.length >= 2 ? "active" : "waiting",
      board_state: makeBoardState(boardPlayers),
      prize_pool: Number(match.entry_fee ?? entryFee) * nextPlayers.length,
    }).eq("id", match.id);
    return new Response(JSON.stringify({ matchId: match.id, matched: nextPlayers.length >= 2, roomCode: code }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (botFallback) {
    await svc.from("match_queue").delete().eq("user_id", user.id).is("match_id", null);
    const target = mode === "4p" ? 4 : 2;
    const players = [
      makePlayer("red", myProfile?.username ?? "You", myProfile?.avatar_id ?? 0),
      ...COLORS.slice(1, target).map((color, i) => makePlayer(color, `Bot ${i + 1}`, i + 1, true)),
    ];
    const matchPlayers = players.map((p, i) => ({
      user_id: i === 0 ? user.id : `bot-${crypto.randomUUID()}`,
      color: p.color,
      username: p.name,
      avatar_id: p.avatarId,
      is_bot: p.isAI,
    }));
    const { data: match } = await svc.from("matches").insert({
      mode: mode === "4p" ? "4p" : "1v1",
      status: "active",
      players: matchPlayers,
      current_turn_user_id: user.id,
      board_state: makeBoardState(players),
      entry_fee: entryFee,
      prize_pool: entryFee * target,
      city_slug: citySlug,
    }).select("id").single();
    return new Response(JSON.stringify({ matchId: match?.id ?? `solo-${crypto.randomUUID()}`, matched: false, isBot: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  await svc.from("match_queue").delete().eq("user_id", user.id).is("match_id", null);
  await svc.from("match_queue").insert({
    user_id: user.id,
    mode: mode === "4p" ? "4p" : "1v1",
    entry_fee: entryFee,
    room_code: null,
  });

  const targetCount = mode === "4p" ? 4 : 2;
  const { data: queued } = await svc
    .from("match_queue")
    .select("user_id, joined_at")
    .eq("mode", mode === "4p" ? "4p" : "1v1")
    .eq("entry_fee", entryFee)
    .is("match_id", null)
    .order("joined_at", { ascending: true })
    .limit(targetCount);

  if (!queued || queued.length < targetCount) {
    return new Response(JSON.stringify({ matchId: null, matched: false }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const userIds = queued.map((q: { user_id: string }) => q.user_id);
  const { data: profiles } = await svc
    .from("profiles")
    .select("id, username, avatar_id")
    .in("id", userIds);
  const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const matchPlayers = userIds.map((id: string, i: number) => ({
    user_id: id,
    color: COLORS[i],
    username: byId.get(id)?.username ?? `Player ${i + 1}`,
    avatar_id: byId.get(id)?.avatar_id ?? i,
  }));
  const boardPlayers = matchPlayers.map((p) => makePlayer(p.color, p.username, p.avatar_id));

  const { data: newMatch, error: matchErr } = await svc.from("matches").insert({
    mode: mode === "4p" ? "4p" : "1v1",
    status: "active",
    players: matchPlayers,
    current_turn_user_id: userIds[0],
    board_state: makeBoardState(boardPlayers),
    entry_fee: entryFee,
    prize_pool: entryFee * targetCount,
    city_slug: citySlug,
  }).select("id").single();

  if (matchErr || !newMatch) return new Response("Failed to create match", { status: 500, headers: cors });

  await svc.from("match_queue").update({ match_id: newMatch.id }).in("user_id", userIds).is("match_id", null);

  return new Response(JSON.stringify({ matchId: newMatch.id, matched: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
