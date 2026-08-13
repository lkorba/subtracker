// Deletes the calling user's auth account. All user data (subscriptions,
// categories) is removed by ON DELETE CASCADE on auth.users.
// Invoked from the client via supabase.functions.invoke("delete-account");
// the user's JWT is verified before anything is deleted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) {
      return json(500, { message: "Server misconfigured" });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { message: "Unauthorized" });
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: verifyError,
    } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (verifyError || !user) {
      return json(401, { message: "Invalid session" });
    }

    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) {
      return json(500, { message: delError.message });
    }

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { message: err instanceof Error ? err.message : "Unknown error" });
  }
});
