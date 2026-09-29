// send-relance-partenaires : courriel aux PARENTS pour le consentement
// « visibilité partenaires » (registre §52). Calqué sur send-relance-inscription.
//
// Auth appelant : header x-relance-secret == RELANCE_PARTENAIRES_SECRET
// (secret DÉDIÉ — pas celui de la relance d'inscription).
//
// TROIS MODES, du plus inoffensif au seul qui écrit à des tiers :
//
//   { "mode": "apercu", "campagne": "partenaires_parents_v1" }
//     → le nombre de destinataires et leurs athlete_id. N'envoie RIEN,
//       ne réserve RIEN.
//
//   { "mode": "test", "a": "bptds22@gmail.com" }
//     → UN courriel, même gabarit, à une adresse de la liste blanche
//       RELANCE_TEST_DESTINATAIRES. Prénoms fictifs. Le lien de réponse pointe
//       ?t=apercu : la page s'affiche, ses boutons sont inactifs — AUCUN
//       consentement réel ne peut naître d'un test. N'écrit rien en base.
//
//   { "mode": "envoi", "campagne": "...", "confirmer": "ENVOYER 33" }
//     → la campagne. `confirmer` doit recopier le nombre EXACT rendu par
//       l'aperçu.
//
// IDEMPOTENCE, EN TROIS COUCHES (comme la relance d'inscription) :
//   1. relance_partenaires_cibles() exclut qui a une ligne RESERVE/ENVOYE ;
//   2. la RÉSERVATION (relance_partenaires_reserver : journal + jeton haché)
//      précède l'appel Resend ; l'index unique départage deux exécutions ;
//   3. Idempotency-Key Resend (campagne + athlete_id).
//
// Le jeton EN CLAIR n'existe qu'en mémoire, le temps de construire le lien ;
// la base n'en garde que le haché. Aucun courriel n'est journalisé en clair
// (console comprise) : athlete_id seulement.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FROM, APP_URL, SUPPORT } from "../_shared/emailLayout.ts";
import { signerJetonDesabonnementParent } from "../_shared/jetonDesabonnement.ts";
import { buildBody, sujet } from "./email.ts";

const SECRET = Deno.env.get("RELANCE_PARTENAIRES_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const DESABONNEMENT_SECRET = Deno.env.get("DESABONNEMENT_SECRET") ?? "";
const TEST_DESTINATAIRES = (Deno.env.get("RELANCE_TEST_DESTINATAIRES") ?? "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const CAMPAGNE_RE = /^[a-z0-9_]{1,64}$/;
const PAUSE_MS = 600;
/** athlete_id fictif du test : le lien de désabonnement du test est signé,
 *  mais ne vise personne (parent_desabonner rend false, sans écriture). */
const ATHLETE_TEST = "00000000-0000-0000-0000-000000000000";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

interface Cible {
  athlete_id: string;
  parent_email: string;
  parent_prenom: string | null;
  prenom: string | null;
  fournisseur: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function envoyer(
  a: string, prenomAthlete: string | null, prenomParent: string | null,
  athleteId: string, jetonConsentement: string, idempotence: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; erreur: string }> {
  const t = encodeURIComponent(await signerJetonDesabonnementParent(athleteId, DESABONNEMENT_SECRET));
  const { html, text } = buildBody({
    prenomAthlete, prenomParent,
    consentementUrl: `${APP_URL}/consentement-partenaires?t=${encodeURIComponent(jetonConsentement)}`,
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
      tags: [{ name: "campagne", value: "relance_partenaires" }],
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
  const { data, error } = await supabase.rpc("relance_partenaires_cibles", { p_campagne: campagne });
  if (error) throw new Error(`relance_partenaires_cibles : ${error.message}`);
  return (data ?? []) as Cible[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-relance-secret") !== SECRET) {
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
    const r = await envoyer(a, "Alex", "Dominique", ATHLETE_TEST, "apercu", null);
    return json(r.ok ? { ok: true, mode: "test", resend_id: r.id } : { ok: false, mode: "test", erreur: r.erreur },
                r.ok ? 200 : 502);
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
      athlete_ids: cibles.map((c) => c.athlete_id),
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

    const bilan = { envoyes: 0, deja_pris: 0, echecs: 0, echecs_athlete_ids: [] as string[] };
    for (const c of cibles) {
      const { data: resa, error: errResa } = await supabase
        .rpc("relance_partenaires_reserver", { p_athlete_id: c.athlete_id, p_campagne: campagne })
        .single();
      if (errResa) {
        if (errResa.code === "23505") { bilan.deja_pris++; continue; }
        throw new Error(`réservation ${c.athlete_id} : ${errResa.message}`);
      }
      const { relance_id, jeton } = resa as { relance_id: string; jeton: string };

      const r = await envoyer(c.parent_email, c.prenom, c.parent_prenom, c.athlete_id, jeton,
                              `relance-partenaires/${campagne}/${c.athlete_id}`);
      const maj = r.ok
        ? { statut: "ENVOYE", resend_id: r.id, envoye_le: new Date().toISOString() }
        : { statut: "ECHEC", erreur: r.erreur };
      const { error: errMaj } = await supabase.from("relances_partenaires").update(maj).eq("id", relance_id);
      if (errMaj) {
        // La ligne reste RESERVE : bloquée, jamais doublée. Visible en admin.
        console.error(`[relance-partenaires] maj journal ${relance_id} (athlete ${c.athlete_id}) : ${errMaj.message}`);
      }
      if (r.ok) bilan.envoyes++;
      else {
        bilan.echecs++; bilan.echecs_athlete_ids.push(c.athlete_id);
        console.error(`[relance-partenaires] échec athlete ${c.athlete_id} : ${r.erreur}`);
      }
      await new Promise((ok) => setTimeout(ok, PAUSE_MS));
    }
    return json({ ok: true, mode: "envoi", campagne, prevus: cibles.length, ...bilan });
  }

  return json({ ok: false, erreur: "mode inconnu (apercu | test | envoi)" }, 400);
});
