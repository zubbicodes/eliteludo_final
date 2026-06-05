import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COIN_PACK_PRODUCT_ID = "elite_ludo_coin_pack_1000";
const COIN_PACK_AMOUNT = 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId ?? "");
  const purchaseToken = String(body.purchaseToken ?? "");
  const platform = String(body.platform ?? "android");
  if (productId !== COIN_PACK_PRODUCT_ID || purchaseToken.length < 8) {
    return new Response(
      JSON.stringify({ success: false, reason: "invalid_purchase" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: cors });

  const { data: existing } = await svc
    .from("iap_receipts")
    .select("amount")
    .eq("purchase_token", purchaseToken)
    .maybeSingle();
  if (existing) {
    return new Response(
      JSON.stringify({ success: true, productId, amount: existing.amount, alreadyGranted: true }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const { data: profile, error: profileErr } = await svc
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) return new Response("Profile not found", { status: 404, headers: cors });

  const balance = Number(profile.coins ?? 0) + COIN_PACK_AMOUNT;
  await svc.from("profiles").update({ coins: balance }).eq("id", user.id);
  await svc.from("iap_receipts").insert({
    purchase_token: purchaseToken,
    user_id: user.id,
    product_id: productId,
    amount: COIN_PACK_AMOUNT,
  });
  await svc.from("transactions").insert({
    user_id: user.id,
    type: "iap",
    amount: COIN_PACK_AMOUNT,
    currency: "coins",
    metadata: { product_id: productId, purchase_token: purchaseToken, platform },
  });

  return new Response(JSON.stringify({ success: true, productId, amount: COIN_PACK_AMOUNT, balance }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
