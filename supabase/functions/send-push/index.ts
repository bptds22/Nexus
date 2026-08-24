// send-push : envoi de notifications via FCM HTTP v1.
// Auth appelant : header x-push-secret == PUSH_DISPATCH_SECRET.
// Lit les tokens de l'utilisateur (service role, bypass RLS), envoie à chaque
// appareil EN CONCURRENCE (paquets de BATCH_SIZE), supprime les tokens morts
// (UNREGISTERED).
//
// Pourquoi la concurrence : la boucle était séquentielle, donc la latence de
// la fonction était PROPORTIONNELLE au nombre de jetons du destinataire —
// mesuré le 2026-08-23 : 42 jetons, ~200 ms l'aller-retour FCM, 8,9 s au
// total, alors que pg_net abandonne à 5 s (son défaut, notify_on_message ne
// passe pas timeout_milliseconds). Le push aboutissait mais était enregistré
// comme expiré. Voir docs/push-pgnet-timeout-20260823.md.

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

  // Paquets de 10 : assez pour que la latence cesse de suivre le nombre de
  // jetons, assez petit pour ne pas ouvrir 40+ connexions FCM d'un coup.
  const BATCH_SIZE = 10;

  /* Journal par jeton EN ÉCHEC. Aujourd'hui on ne sait pas POURQUOI 41 jetons
     morts ne sont pas purgés : le critère ne retient que 404/UNREGISTERED, et
     la fonction ne trace rien. Cette ligne existe pour décider du critère sur
     des chiffres, pas sur une intuition — elle ne change aucun comportement.
     Ne journalise que la QUEUE du jeton (12 derniers caractères) : de quoi
     distinguer deux appareils, jamais de quoi en réutiliser un. Aucun contenu
     de message, aucun nom, aucun courriel. */
  const logFailure = (token: string, httpStatus: number | null, fcmCode: string | null) => {
    console.log(JSON.stringify({
      evt: "push_token_failed",
      user_id,
      token_tail: token.slice(-12),
      http_status: httpStatus,
      fcm_code: fcmCode,
    }));
  };

  const sendOne = async (token: string): Promise<{ ok: boolean; dead: boolean }> => {
    const r = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_SA.project_id}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token, notification: { title, body }, data: stringData } }),
      },
    );
    if (r.ok) return { ok: true, dead: false };
    const errBody = await r.json().catch(() => ({}));
    const code = errBody?.error?.details?.[0]?.errorCode ?? errBody?.error?.status;
    logFailure(token, r.status, code ?? null);
    // Conservateur : on ne supprime QUE sur token périmé, pas sur INVALID_ARGUMENT
    // (qui peut juste signaler un payload mal formé pendant le debug).
    return { ok: false, dead: r.status === 404 || code === "UNREGISTERED" };
  };

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const slice = tokens.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(slice.map(({ token }) => sendOne(token)));
    results.forEach((res, j) => {
      if (res.status === "fulfilled") {
        if (res.value.ok) { sent++; return; }
        failed++;
        if (res.value.dead) dead.push(slice[j].token);
        return;
      }
      // Rejet réseau (fetch qui lève). Compté en échec, JAMAIS purgé : on ne
      // sait pas si le jeton est mort ou si c'est le réseau qui a lâché.
      failed++;
      logFailure(slice[j].token, null, "FETCH_REJECTED");
    });
  }

  let removed = 0;
  if (dead.length) {
    await supabase.from("device_tokens").delete().in("token", dead);
    removed = dead.length;
  }

  return new Response(JSON.stringify({ sent, failed, removed }),
    { headers: { "Content-Type": "application/json" } });
});
