// send-invitation-carte/traiter.ts — le cœur de l'envoi, sans Deno.serve ni
// import réseau : le client Supabase, fetch et la configuration sont INJECTÉS,
// pour que la même fonction tourne sous Deno (index.ts) et sous Node (preuve
// locale contre la base Docker, Resend simulé).
//
// La base a DÉJÀ décidé (trigger cartes_prospect_inviter, à la création de la
// carte) : ici on ne fait qu'envoyer une ligne A_ENVOYER, UNE fois.
//
// UNE FOIS, EN TROIS COUCHES :
//   1. la ligne n'existe qu'à la création (trigger AFTER INSERT), au plus une
//      par carte (index unique) ;
//   2. on la RÉCLAME (A_ENVOYER → EN_COURS) par un UPDATE conditionnel :
//      deux appels concurrents, un seul gagne ;
//   3. Resend reçoit une Idempotency-Key (carte-invitation/<id>).
//
// L'adresse n'est JAMAIS journalisée (console comprise) : id d'invitation seulement.

import { FROM_ADRESSE_NU, SUPPORT, APP_URL } from "./config.ts";
import { signerJetonInvitation } from "../_shared/jetonDesabonnement.ts";
import { buildBody, sujet } from "./email.ts";

// deno-lint-ignore no-explicit-any
type Client = any;

export interface Dependances {
  supabase: Client;
  fetch: typeof fetch;
  resendApiKey: string;
  desabonnementSecret: string;
  /** Surchargeable pour la preuve locale (Resend simulé). */
  resendUrl?: string;
}

export type Resultat =
  | { ok: true; statut: "ENVOYE"; resend_id: string | null }
  | { ok: true; statut: "RIEN_A_FAIRE" }
  | { ok: false; statut: "ECHEC"; erreur: string };

/** Nom d'affichage de l'expéditeur : « Prénom Nom via Nexus ». Les
 *  guillemets et chevrons sont retirés — ils casseraient l'en-tête From. */
export function expediteur(recruteur: string | null): string {
  const nom = (recruteur ?? "").replace(/["<>\\\r\n]/g, "").trim();
  return nom ? `"${nom} via Nexus" <${FROM_ADRESSE_NU}>` : `Nexus <${FROM_ADRESSE_NU}>`;
}

export async function traiterInvitation(deps: Dependances, invitationId: string): Promise<Resultat> {
  const { supabase } = deps;

  // 2. Réclamer la ligne. Personne d'autre ne l'enverra.
  const { data: inv, error: errClaim } = await supabase
    .from("cartes_prospect_invitations")
    .update({ statut: "EN_COURS" })
    .eq("id", invitationId)
    .eq("statut", "A_ENVOYER")
    .select("id, carte_id, unite_cegep_id")
    .maybeSingle();
  if (errClaim) return { ok: false, statut: "ECHEC", erreur: `réclamation : ${errClaim.message}` };
  if (!inv) return { ok: true, statut: "RIEN_A_FAIRE" };

  const echec = async (erreur: string): Promise<Resultat> => {
    await supabase.from("cartes_prospect_invitations").update({ statut: "ECHEC", erreur: erreur.slice(0, 500) }).eq("id", inv.id);
    return { ok: false, statut: "ECHEC", erreur };
  };

  const { data: carte } = await supabase
    .from("cartes_prospect").select("id, prenom, courriel, cree_par").eq("id", inv.carte_id).maybeSingle();
  if (!carte?.courriel) return echec("carte supprimée ou sans courriel avant l'envoi");

  const [{ data: auteur }, { data: cegep }] = await Promise.all([
    carte.cree_par
      ? supabase.from("users").select("first_name, last_name").eq("id", carte.cree_par).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("schools").select("name").eq("id", inv.unite_cegep_id).maybeSingle(),
  ]);
  const recruteur = auteur ? `${auteur.first_name ?? ""} ${auteur.last_name ?? ""}`.trim() || null : null;
  const nomCegep = (cegep?.name as string | undefined)?.trim() || "cégep";

  const jeton = encodeURIComponent(await signerJetonInvitation(inv.id, deps.desabonnementSecret));
  const { html, text } = buildBody({
    prenom: carte.prenom,
    recruteur,
    cegep: nomCegep,
    courriel: carte.courriel,
    desabonnementUrl: `${APP_URL}/desabonnement?t=${jeton}`,
  });

  let res: Response;
  try {
    res = await deps.fetch(deps.resendUrl ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `carte-invitation/${inv.id}`,
      },
      body: JSON.stringify({
        from: expediteur(recruteur),
        to: carte.courriel,
        reply_to: SUPPORT,
        subject: sujet(nomCegep),
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${APP_URL}/api/desabonnement?t=${jeton}>, <mailto:${SUPPORT}?subject=desabonnement>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "campagne", value: "invitation_carte_prospect" }],
      }),
    });
  } catch (e) {
    return echec(`réseau : ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    return echec(`Resend ${res.status} ${corps}`);
  }
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  const maintenant = new Date().toISOString();

  // Le marqueur ne se pose QUE sur un 2xx de Resend (acceptation par la
  // passerelle, pas livraison) — jamais sur la tentative.
  await supabase.from("cartes_prospect_invitations")
    .update({ statut: "ENVOYE", envoye_le: maintenant, resend_id: j.id ?? null }).eq("id", inv.id);
  // Visible par l'unité : « Invitation envoyée le … », tracé au journal par trigger.
  await supabase.from("cartes_prospect").update({ invitee_le: maintenant }).eq("id", carte.id);
  return { ok: true, statut: "ENVOYE", resend_id: j.id ?? null };
}
