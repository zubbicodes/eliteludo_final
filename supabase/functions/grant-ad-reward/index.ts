import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });

  const body = await req.json().catch(() => ({}));
  const amount = Math.max(1, Math.min(Number(body.rewardAmount ?? 100), 500));
  const placement = String(body.placement ?? "unknown");
  const adUnitId = String(body.adUnitId ?? "unknown");

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

  const balance = Number(profile.coins ?? 0) + amount;
  await svc.from("profiles").update({ coins: balance }).eq("id", user.id);
  await svc.from("transactions").insert({
    user_id: user.id,
    type: "ad_reward",
    amount,
    currency: "coins",
    metadata: { placement, ad_unit_id: adUnitId },
  });

  return new Response(JSON.stringify({ success: true, amount, balance }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
