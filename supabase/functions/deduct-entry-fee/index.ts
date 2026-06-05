import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  entryFee: number;
  metadata?: Record<string, unknown>;
}

// ── Handler ─────────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let body: RequestBody;
  try {
    body = await req.json();
    if (typeof body.entryFee !== "number" || body.entryFee < 0) {
      throw new Error();
    }
  } catch {
    return new Response("Invalid entryFee", { status: 400, headers: cors });
  }

  const { entryFee, metadata = {} } = body;

  // If no entry fee, allow immediately
  if (entryFee === 0) {
    return new Response(JSON.stringify({ success: true, deducted: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve caller identity
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authErr } = await anon.auth.getUser();
  if (authErr || !user) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  // Fetch current profile
  const { data: profile, error: profileErr } = await svc
    .from("profiles")
    .select("id, coins")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return new Response("Profile not found", { status: 404, headers: cors });
  }

  // Check if user has enough coins
  if (profile.coins < entryFee) {
    return new Response(
      JSON.stringify({ success: false, reason: "insufficient_funds", current: profile.coins, required: entryFee }),
      { status: 402, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Deduct coins
  const { error: updateErr } = await svc
    .from("profiles")
    .update({ coins: profile.coins - entryFee })
    .eq("id", user.id);

  if (updateErr) {
    return new Response("Failed to deduct coins", { status: 500, headers: cors });
  }

  // Record transaction
  const { error: txErr } = await svc.from("transactions").insert({
    user_id: user.id,
    type: "entry_fee",
    amount: -entryFee,
    currency: "coins",
    metadata: { reason: "entry_fee", ...metadata },
  });

  if (txErr) {
    // Log but don't fail - the coins were already deducted
    console.error("Failed to record transaction:", txErr);
  }

  return new Response(
    JSON.stringify({
      success: true,
      deducted: entryFee,
      remaining: profile.coins - entryFee,
      queueToken: crypto.randomUUID(),
    }),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
