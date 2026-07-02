// send-push : envoi de notifications via FCM HTTP v1.
// Auth appelant : header x-push-secret == PUSH_DISPATCH_SECRET.
// Lit les tokens de l'utilisateur (service role, bypass RLS), envoie à chaque
// appareil, supprime les tokens morts (UNREGISTERED).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "https://esm.sh/jose@5";

const FCM_SA = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
const DISPATCH_SECRET = Deno.env.get("PUSH_DISPATCH_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// cache du token OAuth entre invocations chaudes
let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.value;

  const key = await importPKCS8(FCM_SA.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(FCM_SA.client_email)
    .setSubject(FCM_SA.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.value;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-push-secret") !== DISPATCH_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const { user_id, title, body, data } = payload ?? {};
  if (!user_id || !title || !body) {
    return new Response("user_id, title, body requis", { status: 400 });
  }

  // FCM v1 : les valeurs de data DOIVENT être des strings
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) stringData[k] = String(v);

  const { data: tokens, error } = await supabase
    .from("device_tokens").select("token").eq("user_id", user_id);
  if (error) return new Response(`DB: ${error.message}`, { status: 500 });
  if (!tokens?.length) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, removed: 0, note: "aucun token" }),
      { headers: { "Content-Type": "application/json" } });
  }

  const accessToken = await getAccessToken();
  let sent = 0, failed = 0;
  const dead: string[] = [];

  for (const { token } of tokens) {
    const r = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_SA.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token, notification: { title, body }, data: stringData } }),
      },
    );
    if (r.ok) { sent++; continue; }
    failed++;
    const errBody = await r.json().catch(() => ({}));
    const code = errBody?.error?.details?.[0]?.errorCode ?? errBody?.error?.status;
    // Conservateur : on ne supprime QUE sur token périmé, pas sur INVALID_ARGUMENT
    // (qui peut juste signaler un payload mal formé pendant le debug).
    if (r.status === 404 || code === "UNREGISTERED") dead.push(token);
  }

  let removed = 0;
  if (dead.length) {
    await supabase.from("device_tokens").delete().in("token", dead);
    removed = dead.length;
  }

  return new Response(JSON.stringify({ sent, failed, removed }),
    { headers: { "Content-Type": "application/json" } });
});
