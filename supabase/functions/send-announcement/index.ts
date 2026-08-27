// send-announcement : orchestrateur d'annonces push (canal hors messagerie).
// Auth appelant : header x-push-secret == PUSH_DISPATCH_SECRET (même secret
// que send-push, même Vault, même patron).
//
// Appelé UNE seule fois par `public.send_push_announcement`, avec la liste
// des usagers DÉJÀ résolue côté SQL. Il répond 202 immédiatement et fait le
// travail dans EdgeRuntime.waitUntil : pg_net obtient sa réponse en ~50 ms,
// donc son timeout (5 s par défaut, la cause du faux négatif documenté dans
// docs/push-pgnet-timeout-20260823.md) ne peut plus mordre. C'est la
// différence de fond avec notify_on_message, qui reste inchangée.
//
// L'envoi lui-même délègue à `send-push`, une fois par USAGER : la dédup est
// donc structurelle (un usager à 42 jetons = un appel, et un seul compté au
// bilan), et send-push garde sa boucle par paquets de 10 jetons à l'intérieur.
//
// LA SONDE. FCM renvoie INVALID_ARGUMENT aussi bien pour « ce jeton est
// invalide » que pour « ton payload est malformé ». Purger dessus sans
// discernement viderait device_tokens du parc entier sur un payload cassé.
// Donc : on envoie d'abord à UN usager. Si au moins un de ses jetons passe,
// le payload est prouvé valide — les échecs suivants sont alors imputables
// au jeton, et la purge élargie est autorisée pour le reste du fan-out. Si
// la sonde échoue en totalité, on s'arrête : status ERROR, zéro suppression.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISPATCH_SECRET = Deno.env.get("PUSH_DISPATCH_SECRET")!;
const SEND_PUSH_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BATCH_SIZE = 10; // usagers en parallèle (send-push parallélise ses jetons)

interface PushResult {
  sent: number;
  failed: number;
  removed: number;
  codes?: Record<string, number>;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (req.headers.get("x-push-secret") !== DISPATCH_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: {
    announcement_id?: string;
    title?: string;
    body?: string;
    user_ids?: string[];
  };
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { announcement_id, title, body, user_ids } = payload ?? {};
  if (!announcement_id || !title || !body || !Array.isArray(user_ids) || user_ids.length === 0) {
    return new Response("announcement_id, title, body, user_ids requis", { status: 400 });
  }

  const work = run(announcement_id, title, body, user_ids);

  // Si le runtime sait prolonger l'isolat après la réponse, on rend la main
  // tout de suite. Sinon on attend : mieux vaut tenir pg_net 10 s que voir
  // l'isolat tué au milieu du fan-out.
  const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(work);
    return new Response(JSON.stringify({ accepted: user_ids.length, announcement_id }),
      { status: 202, headers: { "Content-Type": "application/json" } });
  }
  const summary = await work;
  return new Response(JSON.stringify(summary),
    { headers: { "Content-Type": "application/json" } });
});

async function run(id: string, title: string, body: string, userIds: string[]) {
  await supabase.from("push_announcements")
    .update({ status: "RUNNING" }).eq("id", id);

  // data.type = 'announcement' (et non 'message') : c'est ce qui permettra au
  // deep-link de la Phase 6 de router une annonce autrement qu'un fil. Les
  // binaires actuels (1.2.3 compris) ignorent `data` — inerte, sans risque.
  const data = { type: "announcement", announcement_id: id };

  const tally = {
    users_ok: 0, users_ko: 0,
    tokens_sent: 0, tokens_failed: 0, tokens_purged: 0,
    failure_codes: {} as Record<string, number>,
  };

  const absorb = (r: PushResult | null) => {
    if (!r) { tally.users_ko++; return; }
    tally.tokens_sent += r.sent;
    tally.tokens_failed += r.failed;
    tally.tokens_purged += r.removed;
    for (const [code, n] of Object.entries(r.codes ?? {})) {
      tally.failure_codes[code] = (tally.failure_codes[code] ?? 0) + n;
    }
    // Un usager compte UNE fois, quel que soit son nombre d'appareils.
    if (r.sent > 0) tally.users_ok++; else tally.users_ko++;
  };

  try {
    // ── Sonde ────────────────────────────────────────────────────────
    const probe = await pushTo(userIds[0], title, body, data, id, false);
    absorb(probe);

    if (!probe || probe.sent === 0) {
      await supabase.from("push_announcements").update({
        ...tally,
        status: "ERROR",
        error: "Sonde en échec : aucun jeton du premier destinataire n'a été accepté par FCM. Envoi interrompu, aucun jeton supprimé.",
        completed_at: new Date().toISOString(),
      }).eq("id", id);
      return { ...tally, status: "ERROR" };
    }

    // ── Fan-out ──────────────────────────────────────────────────────
    // Payload prouvé valide par la sonde → purge élargie autorisée.
    const rest = userIds.slice(1);
    for (let i = 0; i < rest.length; i += BATCH_SIZE) {
      const slice = rest.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        slice.map((u) => pushTo(u, title, body, data, id, true)),
      );
      for (const res of results) {
        absorb(res.status === "fulfilled" ? res.value : null);
      }
    }

    await supabase.from("push_announcements").update({
      ...tally,
      status: "DONE",
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    return { ...tally, status: "DONE" };
  } catch (err) {
    await supabase.from("push_announcements").update({
      ...tally,
      status: "ERROR",
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    return { ...tally, status: "ERROR" };
  }
}

async function pushTo(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
  collapseId: string,
  purgeInvalid: boolean,
): Promise<PushResult | null> {
  const r = await fetch(SEND_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-secret": DISPATCH_SECRET },
    body: JSON.stringify({
      user_id: userId,
      title,
      body,
      data,
      // Deux jetons vivants pointant le MÊME appareil se remplacent au lieu
      // de s'empiler. Un usager à deux appareils reçoit bien deux notifs :
      // device_tokens n'a pas de colonne appareil, donc on ne peut pas
      // distinguer « second appareil » de « jeton périmé » — on couvre, et
      // l'OS déduplique ce qui doit l'être.
      collapse_id: collapseId,
      purge_invalid: purgeInvalid,
    }),
  });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}
