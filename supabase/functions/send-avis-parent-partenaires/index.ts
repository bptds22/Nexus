// send-avis-parent-partenaires : AVIS au parent quand un athlète de 14 à 17
// ans active LUI-MÊME sa visibilité partenaires médias (décision BP
// 2026-10-02 ; politique 2026-10-v1, section 7.5 ; migration 20261002170000).
//
// Appelée par le trigger aviser_parent_partenaires() via pg_net, avec
// { avis_id } SEULEMENT : aucune donnée personnelle ne transite par la file
// pg_net. La fonction relit tout en base (service_role).
//
// Auth : header x-parent-notice-secret == PARENT_NOTICE_SECRET — le secret de
// la famille « avis parent » (send-parent-notice), déjà au Vault et dans
// l'environnement des fonctions : aucun réglage manuel à faire.
//
// DEUX MODES :
//   { "avis_id": "<uuid>" }            → l'avis réel (journal avis_parent_partenaires)
//   { "mode": "test", "a": "<courriel>" } → un courriel au même gabarit, à une
//       adresse de RELANCE_TEST_DESTINATAIRES. Prénoms fictifs, lien vers
//       l'accueil. N'écrit rien en base.
//
// IDEMPOTENCE : la ligne du journal passe RESERVE → ENVOYE | ECHEC | ANNULE ;
// une ligne qui n'est plus RESERVE n'est jamais renvoyée ; Idempotency-Key
// Resend = avis-partenaires/<avis_id>. Aucun courriel journalisé en clair.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FROM, APP_URL, SUPPORT } from "../_shared/emailLayout.ts";
import { signerJetonDesabonnementParent } from "../_shared/jetonDesabonnement.ts";
import { buildBody, sujet } from "./email.ts";

const SECRET = Deno.env.get("PARENT_NOTICE_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DESABONNEMENT_SECRET = Deno.env.get("DESABONNEMENT_SECRET") ?? "";
const TEST_DESTINATAIRES = (Deno.env.get("RELANCE_TEST_DESTINATAIRES") ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** athlete_id fictif du test : le lien de désabonnement est signé mais ne vise personne. */
const ATHLETE_TEST = "00000000-0000-0000-0000-000000000000";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function envoyer(
  a: string, prenomAthlete: string | null, prenomParent: string | null, athleteId: string,
  portailUrl: string, espaceExistant: boolean, idempotence: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; erreur: string }> {
  const t = encodeURIComponent(await signerJetonDesabonnementParent(athleteId, DESABONNEMENT_SECRET));
  const { html, text } = buildBody({
    prenomAthlete, prenomParent, portailUrl, espaceExistant,
    desabonnementUrl: `${APP_URL}/desabonnement-parent?t=${t}`,
  });
  const headers: Record<string, string> = {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (idempotence) headers["Idempotency-Key"] = idempotence;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: FROM,
      to: a,
      reply_to: SUPPORT,
      subject: sujet(prenomAthlete),
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${APP_URL}/api/desabonnement-parent?t=${t}>, <mailto:${SUPPORT}?subject=desabonnement>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "campagne", value: "avis_parent_partenaires" }],
    }),
  });
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    return { ok: false, erreur: `Resend ${res.status} ${corps}`.slice(0, 500) };
  }
  const j = await res.json().catch(() => ({}));
  return { ok: true, id: (j as { id?: string })?.id ?? null };
}

/** Le lien vers l'espace parent : compte lié → /parent/consentements ;
 *  sinon une invitation non réclamée (réutilisée, ou créée) → /parent/claim. */
async function lienPortail(athleteId: string, parentEmail: string): Promise<{ url: string; existant: boolean }> {
  const { count } = await supabase.from("parent_athletes")
    .select("id", { count: "exact", head: true }).eq("athlete_id", athleteId);
  if ((count ?? 0) > 0) return { url: `${APP_URL}/parent/consentements`, existant: true };

  const { data: inv } = await supabase.from("parent_invitations")
    .select("token, expires_at").eq("athlete_id", athleteId).is("claimed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  let token = (inv && new Date(inv.expires_at as string) > new Date()) ? (inv.token as string) : null;
  if (!token) {
    const neuf = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    if (inv) {
      // Invitation expirée : on la renouvelle plutôt que d'en empiler une seconde
      // (unicité « une invitation ouverte par athlète »).
      await supabase.from("parent_invitations")
        .update({ token: neuf, expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() })
        .eq("athlete_id", athleteId).is("claimed_at", null);
    } else {
      await supabase.from("parent_invitations")
        .insert({ token: neuf, athlete_id: athleteId, parent_email: parentEmail });
    }
    token = neuf;
  }
  return { url: `${APP_URL}/parent/claim?token=${encodeURIComponent(token)}`, existant: false };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-parent-notice-secret") !== SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_API_KEY || DESABONNEMENT_SECRET.length < 32) {
    return json({ ok: false, erreur: "Configuration incomplète (RESEND_API_KEY ou DESABONNEMENT_SECRET)." }, 500);
  }
  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ ok: false, erreur: "JSON invalide" }, 400); }

  // ── test ────────────────────────────────────────────────────────────
  if (p.mode === "test") {
    const a = typeof p.a === "string" ? p.a.trim().toLowerCase() : "";
    if (!a || !TEST_DESTINATAIRES.includes(a)) {
      return json({ ok: false, erreur: "Destinataire de test hors liste blanche (RELANCE_TEST_DESTINATAIRES)." }, 403);
    }
    const r = await envoyer(a, "Alex", "Dominique", ATHLETE_TEST, APP_URL, false, null);
    return json(r.ok ? { ok: true, mode: "test", resend_id: r.id } : { ok: false, mode: "test", erreur: r.erreur },
                r.ok ? 200 : 502);
  }

  // ── avis réel ───────────────────────────────────────────────────────
  const avisId = typeof p.avis_id === "string" ? p.avis_id : "";
  if (!UUID_RE.test(avisId)) return json({ ok: false, erreur: "avis_id invalide" }, 400);

  const { data: avis, error: errAvis } = await supabase.from("avis_parent_partenaires")
    .select("id, athlete_id, statut").eq("id", avisId).maybeSingle();
  if (errAvis || !avis) return json({ ok: false, erreur: "avis introuvable" }, 404);
  if (avis.statut !== "RESERVE") return json({ ok: true, deja: avis.statut });

  const { data: a } = await supabase.from("athletes")
    .select("id, first_name, parent_email, parent_first_name, partner_visibility_opt_in")
    .eq("id", avis.athlete_id).maybeSingle();
  const parentEmail = (a?.parent_email as string | null)?.trim() ?? "";
  if (!a || !parentEmail || a.partner_visibility_opt_in !== true) {
    // Retirée entre-temps, ou plus de courriel parent : rien à annoncer.
    await supabase.from("avis_parent_partenaires").update({ statut: "ANNULE" }).eq("id", avisId);
    return json({ ok: true, annule: true });
  }

  const portail = await lienPortail(a.id as string, parentEmail);
  const r = await envoyer(parentEmail, a.first_name as string | null, a.parent_first_name as string | null,
                          a.id as string, portail.url, portail.existant, `avis-partenaires/${avisId}`);
  await supabase.from("avis_parent_partenaires").update(
    r.ok ? { statut: "ENVOYE", resend_id: r.id, envoye_le: new Date().toISOString() }
         : { statut: "ECHEC", erreur: r.erreur },
  ).eq("id", avisId);
  if (!r.ok) console.error(`[avis-parent-partenaires] échec athlete ${a.id} : ${r.erreur}`);
  return json(r.ok ? { ok: true, resend_id: r.id } : { ok: false, erreur: r.erreur }, r.ok ? 200 : 502);
});
