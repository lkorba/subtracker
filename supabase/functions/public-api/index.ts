// Public API — API-key authenticated CRUD on the caller's subscriptions.
// Auth: Bearer token = st_<base64url>; the token's SHA-256 hex is looked up in
// api_keys. The platform JWT check is disabled for this function (deployed
// with --no-verify-jwt): API keys are not Supabase JWTs, this function is the
// auth layer, and every query is scoped by the resolved user_id.
// ponytail: no rate limiting; add when a real consumer shows up.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BILLING_CYCLES = new Set(["weekly", "monthly", "quarterly", "yearly"]);
const STATUSES = new Set(["active", "trialing", "paused", "cancelled"]);

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json(401, { error: "missing bearer token" });
  const hash = await sha256Hex(token);
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, name")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!key) return json(401, { error: "invalid or revoked api key" });
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  const uid = key.user_id;

  const url = new URL(req.url);
  const rawParts = url.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  // Platform passes the full path: functions/v1/public-api/... — cut up to the slug.
  const fnIdx = rawParts.indexOf("public-api");
  const parts = fnIdx >= 0 ? rawParts.slice(fnIdx + 1) : rawParts;

  if (parts[0] === "me") return json(200, { ok: true, key_name: key.name });

  if (parts[0] !== "subscriptions") return json(404, { error: "not found" });

  if (parts.length === 1) {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) return json(500, { error: error.message });
      return json(200, { data });
    }
    if (req.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json(400, { error: "invalid json body" });
      }
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const cost = Number(body.cost);
      if (!name) return json(400, { error: "name is required" });
      if (!Number.isFinite(cost) || cost < 0)
        return json(400, { error: "cost must be a non-negative number" });
      const currency =
        typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)
          ? body.currency
          : "USD";
      const billing_cycle = BILLING_CYCLES.has(String(body.billing_cycle))
        ? String(body.billing_cycle)
        : "monthly";
      const status = STATUSES.has(String(body.status)) ? String(body.status) : "active";
      const date = (v: unknown) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
      const row = {
        user_id: uid,
        name,
        cost,
        currency,
        billing_cycle,
        status,
        category: typeof body.category === "string" ? body.category : "Other",
        next_billing_date: date(body.next_billing_date),
        trial_ends: date(body.trial_ends),
        notes: typeof body.notes === "string" ? body.notes : null,
        url: typeof body.url === "string" ? body.url : null,
        plan: typeof body.plan === "string" ? body.plan : null,
        icon: typeof body.icon === "string" ? body.icon : null,
        color: typeof body.color === "string" ? body.color : null,
      };
      const { data, error } = await supabase.from("subscriptions").insert(row).select().single();
      if (error) return json(500, { error: error.message });
      return json(201, { data });
    }
    return json(405, { error: "method not allowed" });
  }

  const id = parts[1];
  if (!/^[0-9a-f-]{36}$/.test(id)) return json(400, { error: "invalid id" });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "not found" });
    return json(200, { data });
  }

  if (req.method === "PATCH") {
    const { data: prev, error: prevErr } = await supabase
      .from("subscriptions")
      .select("cost, currency")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();
    if (prevErr) return json(500, { error: prevErr.message });
    if (!prev) return json(404, { error: "not found" });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid json body" });
    }
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim() || undefined;
    if (body.cost !== undefined) {
      const cost = Number(body.cost);
      if (!Number.isFinite(cost) || cost < 0)
        return json(400, { error: "cost must be a non-negative number" });
      patch.cost = cost;
    }
    if (body.currency !== undefined && /^[A-Z]{3}$/.test(String(body.currency)))
      patch.currency = body.currency;
    if (body.billing_cycle !== undefined && BILLING_CYCLES.has(String(body.billing_cycle)))
      patch.billing_cycle = body.billing_cycle;
    if (body.status !== undefined && STATUSES.has(String(body.status))) patch.status = body.status;
    for (const f of ["category", "notes", "url", "plan", "icon", "color"] as const) {
      if (body[f] !== undefined) patch[f] = typeof body[f] === "string" ? body[f] : null;
    }
    for (const f of ["next_billing_date", "trial_ends"] as const) {
      if (body[f] !== undefined) {
        patch[f] =
          typeof body[f] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body[f]) ? body[f] : null;
      }
    }
    if (Object.keys(patch).length === 0) return json(400, { error: "no fields to update" });

    const { data, error } = await supabase
      .from("subscriptions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .single();
    if (error) return json(500, { error: error.message });

    // Price change → price history, same behavior as the web app.
    if (patch.cost !== undefined && Number(patch.cost) !== Number(prev.cost)) {
      await supabase.from("price_history").insert({
        user_id: uid,
        subscription_id: id,
        cost: Number(prev.cost),
        currency: String(patch.currency ?? prev.currency),
      });
    }
    return json(200, { data });
  }

  if (req.method === "DELETE") {
    const { data, error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .single();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "not found" });
    return json(200, { data });
  }

  return json(405, { error: "method not allowed" });
});
