// send-demo-inscription/traiter.ts — le cœur de l'envoi, dépendances INJECTÉES
// (client Supabase, fetch) pour tourner sous Deno (index.ts) et sous Node
// (preuve locale contre la base Docker, Resend simulé).
//
// Deux envois indépendants, chacun RÉCLAMÉ (A_ENVOYER → EN_COURS) par un
// UPDATE conditionnel : deux appels concurrents, un seul gagne. Le marqueur
// ENVOYE ne se pose que sur un 2xx de Resend. L'adresse n'est jamais
// journalisée : l'id d'inscription seulement.

import { FROM, SUPPORT } from "../_shared/emailLayout.ts";
import { confirmation, avis, type Inscription } from "./email.ts";

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
export interface Resultat { confirmation: Etat; avis: Etat; erreur?: string }

const encoderBase64 = (s: string): string => {
  const octets = new TextEncoder().encode(s);
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin);
};

async function reclamer(supabase: Client, id: string, colonne: "confirmation_statut" | "avis_statut"): Promise<boolean> {
  const { data } = await supabase.from("demo_inscriptions")
    .update({ [colonne]: "EN_COURS" }).eq("id", id).eq(colonne, "A_ENVOYER").select("id").maybeSingle();
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

export async function traiterInscription(deps: Dependances, id: string): Promise<Resultat> {
  const { supabase } = deps;
  const { data: r, error } = await supabase.from("demo_inscriptions")
    .select("id, prenom, nom, courriel, cegep_autre, interets, interet_autre, veut_compte, role, participation, nb_soumissions, confirmation_statut, avis_statut, schools:cegep_id(name), sports:sport_id(nom)")
    .eq("id", id).maybeSingle();
  if (error) return { confirmation: "ECHEC", avis: "ECHEC", erreur: error.message };
  if (!r) return { confirmation: "RIEN_A_FAIRE", avis: "RIEN_A_FAIRE" };

  const i: Inscription = {
    id: r.id, prenom: r.prenom, nom: r.nom, courriel: r.courriel,
    cegep: r.schools?.name ?? (r.cegep_autre ? `Autre : ${r.cegep_autre}` : null),
    sport: r.sports?.nom ?? null,
    role: r.role, interets: r.interets ?? [], interet_autre: r.interet_autre,
    veut_compte: r.veut_compte, participation: r.participation, nb_soumissions: r.nb_soumissions,
  };
  const resultat: Resultat = { confirmation: "RIEN_A_FAIRE", avis: "RIEN_A_FAIRE" };

  if (await reclamer(supabase, id, "confirmation_statut")) {
    const c = confirmation(i);
    const err = await envoyer(deps, `demo-confirmation/${id}/${i.participation}`, {
      from: FROM, to: i.courriel, reply_to: SUPPORT, subject: c.sujet, html: c.html, text: c.text,
      ...(c.ics ? { attachments: [{ filename: "demo-nexus-12-octobre.ics", content: encoderBase64(c.ics), content_type: "text/calendar; charset=utf-8; method=PUBLISH" }] } : {}),
      tags: [{ name: "campagne", value: "demo_12_octobre" }],
    });
    await supabase.from("demo_inscriptions").update(err
      ? { confirmation_statut: "ECHEC", envoi_erreur: err }
      : { confirmation_statut: "ENVOYE", confirmation_envoyee_le: new Date().toISOString() }).eq("id", id);
    resultat.confirmation = err ? "ECHEC" : "ENVOYE";
    if (err) resultat.erreur = err;
  }

  if (await reclamer(supabase, id, "avis_statut")) {
    const a = avis(i);
    const err = await envoyer(deps, `demo-avis/${id}/${i.nb_soumissions}`, {
      from: FROM, to: DESTINATAIRE_AVIS, reply_to: i.courriel, subject: a.sujet, html: a.html, text: a.text,
      tags: [{ name: "campagne", value: "demo_12_octobre_avis" }],
    });
    await supabase.from("demo_inscriptions").update(err
      ? { avis_statut: "ECHEC", envoi_erreur: err }
      : { avis_statut: "ENVOYE", avis_envoye_le: new Date().toISOString() }).eq("id", id);
    resultat.avis = err ? "ECHEC" : "ENVOYE";
    if (err) resultat.erreur = err;
  }
  return resultat;
}
