// send-relance-inscription : relance « inscription inachevée » des comptes
// ATHLETE sans fiche qui ont passé /consentements.
//
// Auth appelant : header x-relance-secret == RELANCE_SECRET (secret DÉDIÉ).
//
// TROIS MODES, du plus inoffensif au seul qui écrit à des tiers :
//
//   { "mode": "apercu", "campagne": "inscription_inachevee_v1" }
//     → le nombre de destinataires et leurs user_id. N'envoie RIEN.
//
//   { "mode": "test", "a": "bptds22@gmail.com", "fournisseur"?: "apple" }
//     → UN courriel, même gabarit que la campagne, à une adresse de la liste
//       blanche RELANCE_TEST_DESTINATAIRES — et à elle seule. Le compte qui
//       porte cette adresse fournit le prénom et le jeton de désabonnement
//       (le lien du test est donc RÉEL : le cliquer désabonne ce compte).
//       N'écrit PAS le journal.
//
//   { "mode": "envoi", "campagne": "...", "confirmer": "ENVOYER 32" }
//     → la campagne. `confirmer` doit recopier le nombre EXACT de
//       destinataires rendu par l'aperçu : un appel copié-collé, rejoué ou
//       lancé contre la mauvaise base ne part pas.
//
// IDEMPOTENCE, EN TROIS COUCHES :
//   1. relance_inscription_cibles() exclut déjà quiconque a une ligne
//      RESERVE ou ENVOYE pour la campagne ;
//   2. la RÉSERVATION précède l'appel Resend : deux exécutions concurrentes
//      se heurtent à l'index unique relances_une_par_campagne, la seconde
//      passe son tour ;
//   3. Resend reçoit une Idempotency-Key (campagne + user_id) : un nouvel
//      essai après un plantage ne doublerait pas un envoi réellement parti.
//
// Le destinataire n'est JAMAIS journalisé en clair (console comprise) :
// user_id seulement.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FROM, APP_URL, SUPPORT } from "../_shared/emailLayout.ts";
import { signerJetonDesabonnement } from "../_shared/jetonDesabonnement.ts";
import { buildBody, SUJET } from "./email.ts";

const RELANCE_SECRET = Deno.env.get("RELANCE_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DESABONNEMENT_SECRET = Deno.env.get("DESABONNEMENT_SECRET") ?? "";
const TEST_DESTINATAIRES = (Deno.env.get("RELANCE_TEST_DESTINATAIRES") ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const CAMPAGNE_RE = /^[a-z0-9_]{1,64}$/;
/** Resend plafonne à 2 requêtes/s par défaut : on reste en dessous. */
const PAUSE_MS = 600;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

interface Cible {
  user_id: string;
  email: string;
  prenom: string | null;
  fournisseur: string | null;
  inscrit_le: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function envoyer(c: Cible, idempotence: string | null): Promise<{ ok: true; id: string | null } | { ok: false; erreur: string }> {
  const jeton = await signerJetonDesabonnement(c.user_id, DESABONNEMENT_SECRET);
  const t = encodeURIComponent(jeton);
  const { html, text } = buildBody({
    prenom: c.prenom,
    fournisseur: c.fournisseur,
    inscritLe: c.inscrit_le,
    desabonnementUrl: `${APP_URL}/desabonnement?t=${t}`,
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
      to: c.email,
      reply_to: SUPPORT,
      subject: SUJET,
      html,
      text,
      // Désabonnement natif (RFC 8058) : Gmail et Apple Mail affichent leur
      // propre bouton, qui POSTe sur la route — sans ouvrir de page.
      headers: {
        "List-Unsubscribe": `<${APP_URL}/api/desabonnement?t=${t}>, <mailto:${SUPPORT}?subject=desabonnement>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [{ name: "campagne", value: "relance_inscription" }],
    }),
  });

  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    return { ok: false, erreur: `Resend ${res.status} ${corps}`.slice(0, 500) };
  }
  const j = await res.json().catch(() => ({}));
  return { ok: true, id: (j as { id?: string })?.id ?? null };
}

async function lireCibles(campagne: string): Promise<Cible[]> {
  const { data, error } = await supabase.rpc("relance_inscription_cibles", { p_campagne: campagne });
  if (error) throw new Error(`relance_inscription_cibles : ${error.message}`);
  return (data ?? []) as Cible[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!RELANCE_SECRET || req.headers.get("x-relance-secret") !== RELANCE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!RESEND_API_KEY || DESABONNEMENT_SECRET.length < 32) {
    return json({ ok: false, erreur: "Configuration incomplète (RESEND_API_KEY ou DESABONNEMENT_SECRET)." }, 500);
  }

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ ok: false, erreur: "JSON invalide" }, 400); }
  const mode = p.mode;

  // ── test ────────────────────────────────────────────────────────────
  if (mode === "test") {
    const a = typeof p.a === "string" ? p.a.trim().toLowerCase() : "";
    if (!a || !TEST_DESTINATAIRES.includes(a)) {
      return json({ ok: false, erreur: "Destinataire de test hors liste blanche (RELANCE_TEST_DESTINATAIRES)." }, 403);
    }
    const { data: u, error } = await supabase
      .from("users").select("id, first_name, created_at").eq("email", a).maybeSingle();
    if (error || !u) return json({ ok: false, erreur: "Aucun compte ne porte cette adresse." }, 404);

    const { data: au } = await supabase.auth.admin.getUserById(u.id as string);
    const fournisseurReel = (au?.user?.app_metadata as { provider?: string } | undefined)?.provider ?? null;
    const fournisseur = typeof p.fournisseur === "string" ? p.fournisseur : fournisseurReel;

    const r = await envoyer({
      user_id: u.id as string,
      email: a,
      prenom: (u.first_name as string | null) ?? null,
      fournisseur,
      inscrit_le: (u.created_at as string) ?? new Date().toISOString(),
    }, null);
    return json(r.ok
      ? { ok: true, mode: "test", resend_id: r.id, fournisseur_rendu: fournisseur }
      : { ok: false, mode: "test", erreur: r.erreur }, r.ok ? 200 : 502);
  }

  const campagne = typeof p.campagne === "string" ? p.campagne : "";
  if (!CAMPAGNE_RE.test(campagne)) return json({ ok: false, erreur: "campagne invalide" }, 400);

  // ── apercu ──────────────────────────────────────────────────────────
  if (mode === "apercu") {
    const cibles = await lireCibles(campagne);
    return json({
      ok: true, mode: "apercu", campagne, nombre: cibles.length,
      confirmer_avec: `ENVOYER ${cibles.length}`,
      par_fournisseur: cibles.reduce<Record<string, number>>((acc, c) => {
        const k = c.fournisseur ?? "inconnu"; acc[k] = (acc[k] ?? 0) + 1; return acc;
      }, {}),
      user_ids: cibles.map((c) => c.user_id),
    });
  }

  // ── envoi ───────────────────────────────────────────────────────────
  if (mode === "envoi") {
    const cibles = await lireCibles(campagne);
    if (p.confirmer !== `ENVOYER ${cibles.length}`) {
      return json({
        ok: false,
        erreur: `Confirmation attendue : "ENVOYER ${cibles.length}". Relancer l'aperçu si le nombre a changé.`,
      }, 409);
    }

    const bilan = { envoyes: 0, deja_pris: 0, echecs: 0, echecs_user_ids: [] as string[] };
    for (const c of cibles) {
      // RÉSERVER avant d'envoyer. unique_violation = une autre exécution
      // (ou une précédente) a déjà cette personne : on passe.
      const { data: resa, error: errResa } = await supabase
        .from("relances_inscription")
        .insert({ user_id: c.user_id, campagne })
        .select("id").single();
      if (errResa) {
        if (errResa.code === "23505") { bilan.deja_pris++; continue; }
        throw new Error(`réservation ${c.user_id} : ${errResa.message}`);
      }

      const r = await envoyer(c, `relance/${campagne}/${c.user_id}`);
      const maj = r.ok
        ? { statut: "ENVOYE", resend_id: r.id, envoye_le: new Date().toISOString() }
        : { statut: "ECHEC", erreur: r.erreur };
      const { error: errMaj } = await supabase.from("relances_inscription").update(maj).eq("id", resa.id);
      if (errMaj) {
        // La ligne reste RESERVE : la personne est bloquée, ce qui est le
        // bon côté de l'erreur (pas de double envoi). Visible dans l'admin.
        console.error(`[relance] maj journal ${resa.id} (user ${c.user_id}) : ${errMaj.message}`);
      }
      if (r.ok) bilan.envoyes++;
      else { bilan.echecs++; bilan.echecs_user_ids.push(c.user_id); console.error(`[relance] échec user ${c.user_id} : ${r.erreur}`); }

      await new Promise((ok) => setTimeout(ok, PAUSE_MS));
    }
    return json({ ok: true, mode: "envoi", campagne, prevus: cibles.length, ...bilan });
  }

  return json({ ok: false, erreur: "mode inconnu (apercu | test | envoi)" }, 400);
});
