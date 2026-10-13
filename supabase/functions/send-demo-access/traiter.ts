// send-demo-access/traiter.ts — le cœur de l'envoi, dépendances INJECTÉES
// (client Supabase, fetch) pour tourner sous Deno (index.ts) et sous Node
// (preuve locale contre la base Docker, Resend simulé). Même modèle que
// send-demo-inscription/traiter.ts.
//
// Deux envois indépendants, chacun RÉCLAMÉ (A_ENVOYER → EN_COURS) par un
// UPDATE conditionnel : deux appels concurrents, un seul gagne. ENVOYE ne se
// pose que sur un 2xx de Resend. Un accès révoqué ne reçoit JAMAIS son lien
// (la RPC ne remet pas courriel_statut à A_ENVOYER, et on revérifie ici).
// L'adresse n'est jamais journalisée : l'id seulement.

import { FROM, SUPPORT } from "../_shared/emailLayout.ts";
import { courrielAcces, avisAcces, type DemandeAcces } from "./email.ts";

// deno-lint-ignore no-explicit-any
type Client = any;

export interface Dependances {
  supabase: Client;
  fetch: typeof fetch;
  resendApiKey: string;
  resendUrl?: string;
}

export const DESTINATAIRE_AVIS = "info@nexussports.ca";

type Etat = "ENVOYE" | "RIEN_A_FAIRE" | "ECHEC";
export interface Resultat { courriel: Etat; avis: Etat; erreur?: string }

async function reclamer(supabase: Client, id: string, colonne: "courriel_statut" | "avis_statut", approuveSeulement: boolean): Promise<boolean> {
  let q = supabase.from("demo_access").update({ [colonne]: "EN_COURS" }).eq("id", id).eq(colonne, "A_ENVOYER");
  if (approuveSeulement) q = q.eq("status", "approved");
  const { data } = await q.select("id").maybeSingle();
  return !!data;
}

async function envoyer(deps: Dependances, cle: string, corps: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await deps.fetch(deps.resendUrl ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": cle },
      body: JSON.stringify(corps),
    });
    if (!res.ok) return `Resend ${res.status} ${await res.text().catch(() => "")}`.slice(0, 500);
    return null;
  } catch (e) {
    return `réseau : ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function traiterDemande(deps: Dependances, id: string): Promise<Resultat> {
  const { supabase } = deps;
  const { data: r, error } = await supabase.from("demo_access")
    .select("id, first_name, last_name, email, cegep_autre, role, wants_1on1, token, status, nb_demandes, schools:cegep_id(name)")
    .eq("id", id).maybeSingle();
  if (error) return { courriel: "ECHEC", avis: "ECHEC", erreur: error.message };
  if (!r) return { courriel: "RIEN_A_FAIRE", avis: "RIEN_A_FAIRE" };

  const d: DemandeAcces = {
    id: r.id, prenom: r.first_name, nom: r.last_name, courriel: r.email,
    cegep: r.schools?.name ?? (r.cegep_autre ? `Autre : ${r.cegep_autre}` : null),
    role: r.role, wants_1on1: !!r.wants_1on1, token: r.token,
  };
  const resultat: Resultat = { courriel: "RIEN_A_FAIRE", avis: "RIEN_A_FAIRE" };

  if (await reclamer(supabase, id, "courriel_statut", true)) {
    const c = courrielAcces(d);
    const err = await envoyer(deps, `demo-acces/${id}/${r.nb_demandes}`, {
      from: FROM, to: d.courriel, reply_to: SUPPORT, subject: c.sujet, html: c.html, text: c.text,
      tags: [{ name: "campagne", value: "demo_acces" }],
    });
    await supabase.from("demo_access").update(err
      ? { courriel_statut: "ECHEC", envoi_erreur: err }
      : { courriel_statut: "ENVOYE" }).eq("id", id);
    resultat.courriel = err ? "ECHEC" : "ENVOYE";
    if (err) resultat.erreur = err;
  }

  if (await reclamer(supabase, id, "avis_statut", false)) {
    const a = avisAcces(d);
    const err = await envoyer(deps, `demo-acces-avis/${id}/${r.nb_demandes}`, {
      from: FROM, to: DESTINATAIRE_AVIS, reply_to: d.courriel, subject: a.sujet, html: a.html, text: a.text,
      tags: [{ name: "campagne", value: "demo_acces_avis" }],
    });
    await supabase.from("demo_access").update(err
      ? { avis_statut: "ECHEC", envoi_erreur: err }
      : { avis_statut: "ENVOYE" }).eq("id", id);
    resultat.avis = err ? "ECHEC" : "ENVOYE";
    if (err) resultat.erreur = err;
  }
  return resultat;
}
