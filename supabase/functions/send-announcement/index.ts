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
//
// ═══════════════════════════════════════════════════════════════════════
// RÉVISION DU 2026-08-28 — le bilan mentait, et il perdait des gens.
// ═══════════════════════════════════════════════════════════════════════
// L'annonce `all` 9025aebc visait 69 usagers. Les journaux edge montrent
// exactement 30 appels à send-push, tous en HTTP 200 : 39 usagers n'ont pas
// échoué, ils n'ont JAMAIS été émis — le fetch levait sans partir, très
// probablement sur épuisement des connexions sortantes de l'isolat avec
// BATCH_SIZE = 10 et aucun plafond global. Le bilan, lui, disait
// `users_ko 39, tokens_failed 0, failure_codes {}, status DONE`.
//
// Trois causes, trois corrections :
//
//   1. `pushTo` renvoyait `null` en jetant le code HTTP, et `absorb(null)`
//      n'incrémentait qu'un compteur. Il renvoie désormais un RÉSULTAT
//      DISCRIMINÉ, et tout échec est consigné avec son usager, sa nature et
//      son statut HTTP dans `failures` / `failed_user_ids`.
//   2. Le parallélisme passe de 10 sans borne à CONCURRENCE = 4, en lots
//      SÉQUENTIELS séparés d'une pause, avec UNE seconde tentative sur
//      échec de transport. On parle de dizaines d'usagers, pas de milliers :
//      la robustesse prime sur la vitesse.
//   3. Au-delà de SEUIL_ECHEC de l'audience en échec, l'annonce se clôt en
//      ERROR, pas en DONE. Un envoi qui rate le quart de sa cible n'est pas
//      un succès.
//
// `failed_user_ids` est la poignée de l'audience `retry` de la RPC, qui
// rejoue une annonce vers ses seuls manqués (migration
// 20260828185000_push_announcement_bilan_honnete_et_reprise.sql).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISPATCH_SECRET = Deno.env.get("PUSH_DISPATCH_SECRET")!;
const SEND_PUSH_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Usagers menés de front. Était 10 : c'est ce qui a saturé l'isolat le
// 2026-08-28. send-push parallélise déjà ses propres jetons en interne.
const CONCURRENCE = 4;
// Respiration entre deux lots — laisse les connexions se refermer.
const PAUSE_MS = 150;
// Une seule reprise, et seulement sur échec de TRANSPORT : un refus FCM est
// une réponse, pas un incident réseau, le rejouer ne changerait rien.
const TENTATIVES_TRANSPORT = 2;
const PAUSE_TENTATIVE_MS = 400;
// Part de l'audience en échec au-delà de laquelle l'envoi n'est pas un succès.
const SEUIL_ECHEC = 0.20;

const dors = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PushResult {
  sent: number;
  failed: number;
  removed: number;
  codes?: Record<string, number>;
}

/** Résultat discriminé : un échec porte toujours de quoi l'expliquer. */
type Issue =
  | { ok: true; result: PushResult }
  | { ok: false; kind: "http" | "throw" | "badjson"; status: number | null; note: string };

interface Failure {
  user_id: string;
  kind: string;
  status: number | null;
  note: string;
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
  const failures: Failure[] = [];

  const compte = (code: string) => {
    tally.failure_codes[code] = (tally.failure_codes[code] ?? 0) + 1;
  };

  /** Un usager compte UNE fois, quel que soit son nombre d'appareils. */
  const absorb = (userId: string, issue: Issue) => {
    if (!issue.ok) {
      // C'EST ICI que le bilan mentait. On garde tout : qui, quoi, quel code.
      tally.users_ko++;
      failures.push({ user_id: userId, kind: issue.kind, status: issue.status, note: issue.note });
      compte(issue.status !== null ? `HTTP_${issue.status}` : issue.kind.toUpperCase());
      return;
    }
    const r = issue.result;
    tally.tokens_sent += r.sent;
    tally.tokens_failed += r.failed;
    tally.tokens_purged += r.removed;
    for (const [code, n] of Object.entries(r.codes ?? {})) {
      tally.failure_codes[code] = (tally.failure_codes[code] ?? 0) + n;
    }
    if (r.sent > 0) {
      tally.users_ok++;
    } else {
      // 200 mais zéro jeton accepté : un échec, et un candidat à la reprise.
      tally.users_ko++;
      failures.push({
        user_id: userId,
        kind: "aucun_jeton_accepte",
        status: 200,
        note: `${r.failed} jeton(s) refusé(s) par FCM, ${r.removed} purgé(s)`,
      });
    }
  };

  const bilan = () => ({
    ...tally,
    failures: failures.length > 0 ? failures : null,
    failed_user_ids: failures.length > 0 ? failures.map((f) => f.user_id) : null,
  });

  try {
    // ── Sonde ────────────────────────────────────────────────────────
    const probe = await pushTo(userIds[0], title, body, data, id, false);
    absorb(userIds[0], probe);

    if (!probe.ok || probe.result.sent === 0) {
      await supabase.from("push_announcements").update({
        ...bilan(),
        status: "ERROR",
        error: "Sonde en échec : aucun jeton du premier destinataire n'a été accepté par FCM. Envoi interrompu, aucun jeton supprimé.",
        completed_at: new Date().toISOString(),
      }).eq("id", id);
      return { ...bilan(), status: "ERROR" };
    }

    // ── Fan-out ──────────────────────────────────────────────────────
    // Payload prouvé valide par la sonde → purge élargie autorisée.
    // Lots SÉQUENTIELS de CONCURRENCE usagers : on attend chaque lot avant
    // d'ouvrir le suivant, et on souffle entre les deux.
    const rest = userIds.slice(1);
    for (let i = 0; i < rest.length; i += CONCURRENCE) {
      const slice = rest.slice(i, i + CONCURRENCE);
      const results = await Promise.all(
        slice.map((u) => pushTo(u, title, body, data, id, true)),
      );
      results.forEach((issue, k) => absorb(slice[k], issue));
      if (i + CONCURRENCE < rest.length) await dors(PAUSE_MS);
    }

    // ── Verdict ──────────────────────────────────────────────────────
    // Un envoi qui rate plus de SEUIL_ECHEC de sa cible n'est pas DONE.
    const rate = tally.users_ko / userIds.length;
    const tropDEchecs = rate > SEUIL_ECHEC;
    const statut = tropDEchecs ? "ERROR" : "DONE";

    await supabase.from("push_announcements").update({
      ...bilan(),
      status: statut,
      error: tropDEchecs
        ? `${tally.users_ko} usager(s) sur ${userIds.length} en échec (${Math.round(rate * 100)} %), au-delà du seuil de ${Math.round(SEUIL_ECHEC * 100)} %. Détail par usager dans failures ; rejouer avec l'audience « retry ».`
        : null,
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    return { ...bilan(), status: statut };
  } catch (err) {
    await supabase.from("push_announcements").update({
      ...bilan(),
      status: "ERROR",
      error: String(err instanceof Error ? err.message : err).slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq("id", id);
    return { ...bilan(), status: "ERROR" };
  }
}

/**
 * Un appel à send-push pour UN usager.
 *
 * Ne renvoie jamais `null` : un échec est un objet qui dit pourquoi. C'est
 * la correction de fond du 2026-08-28 — le code HTTP était jeté, donc
 * 39 usagers manqués ressemblaient à zéro erreur.
 *
 * Une seule reprise, et seulement sur échec de TRANSPORT (fetch qui lève) :
 * c'est le mode de panne observé. Un 4xx/5xx de send-push est une réponse
 * de l'application, on ne la rejoue pas.
 */
async function pushTo(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
  collapseId: string,
  purgeInvalid: boolean,
): Promise<Issue> {
  let derniere = "";
  for (let essai = 1; essai <= TENTATIVES_TRANSPORT; essai++) {
    try {
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

      if (!r.ok) {
        const texte = await r.text().catch(() => "");
        return {
          ok: false,
          kind: "http",
          status: r.status,
          note: texte.slice(0, 200) || `send-push a répondu ${r.status}`,
        };
      }

      const parsed = await r.json().catch(() => null) as PushResult | null;
      if (!parsed || typeof parsed.sent !== "number") {
        return {
          ok: false,
          kind: "badjson",
          status: r.status,
          note: "réponse 2xx illisible ou sans champ « sent »",
        };
      }
      return { ok: true, result: parsed };
    } catch (err) {
      derniere = String(err instanceof Error ? err.message : err).slice(0, 200);
      if (essai < TENTATIVES_TRANSPORT) await dors(PAUSE_TENTATIVE_MS);
    }
  }
  return {
    ok: false,
    kind: "throw",
    status: null,
    note: `${TENTATIVES_TRANSPORT} tentative(s) de transport en échec : ${derniere}`,
  };
}
