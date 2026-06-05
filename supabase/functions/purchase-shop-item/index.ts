import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ShopKind = "token_skin" | "dice_skin" | "crown";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const body = await req.json().catch(() => ({}));
  const itemId = String(body.itemId ?? "");
  const kind = String(body.kind ?? "") as ShopKind;
  const currency = String(body.currency ?? "coins");
  const price = Math.max(0, Number(body.price ?? 0));
  if (!itemId || !["token_skin", "dice_skin", "crown"].includes(kind) || currency !== "coins") {
    return new Response("Invalid item", { status: 400, headers: cors });
  }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  const { data: profile, error: profileErr } = await svc
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) return new Response("Profile not found", { status: 404, headers: cors });
  if (Number(profile.coins ?? 0) < price) {
    return new Response(
      JSON.stringify({ success: false, reason: "insufficient_funds", balance: Number(profile.coins ?? 0) }),
      { status: 402, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { data: cosmetics } = await svc
    .from("profile_cosmetics")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const tokenSkins = new Set<string>(cosmetics?.unlocked_token_skins ?? ["classic"]);
  const diceSkins = new Set<string>(cosmetics?.unlocked_dice_skins ?? ["classic"]);
  const crowns = new Set<string>(cosmetics?.unlocked_crowns ?? []);
  if (kind === "token_skin") tokenSkins.add(itemId);
  if (kind === "dice_skin") diceSkins.add(itemId);
  if (kind === "crown") crowns.add(itemId);

  const balance = Number(profile.coins ?? 0) - price;
  await svc.from("profiles").update({ coins: balance }).eq("id", user.id);
  await svc.from("profile_cosmetics").upsert({
    user_id: user.id,
    unlocked_token_skins: [...tokenSkins],
    unlocked_dice_skins: [...diceSkins],
    unlocked_crowns: [...crowns],
    selected_token_skin: kind === "token_skin" ? itemId : cosmetics?.selected_token_skin ?? "classic",
    selected_dice_skin: kind === "dice_skin" ? itemId : cosmetics?.selected_dice_skin ?? "classic",
    selected_crown: kind === "crown" ? itemId : cosmetics?.selected_crown ?? null,
    updated_at: new Date().toISOString(),
  });
  await svc.from("transactions").insert({
    user_id: user.id,
    type: "shop_purchase",
    amount: -price,
    currency: "coins",
    metadata: { item_id: itemId, kind },
  });

  return new Response(JSON.stringify({ success: true, itemId, balance }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
