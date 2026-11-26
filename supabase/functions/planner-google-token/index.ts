import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Guarda o refresh token do Google (nunca exposto ao navegador) e troca por access tokens curtos.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const admin = createClient(url, service, { db: { schema: "planner" } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user }, error: uerr } = await admin.auth.getUser(jwt);
  if (uerr || !user) return json({ error: "unauthorized" }, 401);

  let body: { action?: string; refresh_token?: string } = {};
  try { body = await req.json(); } catch { /* vazio */ }

  if (body.action === "store") {
    if (!body.refresh_token || typeof body.refresh_token !== "string") return json({ error: "missing_refresh_token" }, 400);
    const { error } = await admin.from("google_tokens").upsert({
      user_id: user.id, refresh_token: body.refresh_token, updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: "store_failed", detail: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === "access") {
    if (!clientId || !clientSecret) return json({ error: "server_not_configured" }, 500);
    const { data: row, error } = await admin.from("google_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "read_failed", detail: error.message }, 500);
    if (!row) return json({ error: "needs_reauth" }, 401);

    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: row.refresh_token, grant_type: "refresh_token",
      }),
    });
    const tok = await r.json();
    if (!r.ok) {
      if (tok.error === "invalid_grant") {
        await admin.from("google_tokens").delete().eq("user_id", user.id);
        return json({ error: "needs_reauth" }, 401);
      }
      return json({ error: "google_error", detail: tok.error }, 502);
    }
    return json({ access_token: tok.access_token, expires_in: tok.expires_in });
  }

  return json({ error: "unknown_action" }, 400);
});
