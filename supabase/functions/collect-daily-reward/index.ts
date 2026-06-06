import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const { data, error } = await svc.rpc("collect_daily_reward_for_user", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("collect_daily_reward_for_user failed:", error);
    return new Response("Failed to collect daily reward", { status: 500, headers: cors });
  }

  const status = data?.success === false && data?.reason === "already_collected" ? 409 : 200;
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
