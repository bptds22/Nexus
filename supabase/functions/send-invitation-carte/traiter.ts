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

import { FROM, SUPPORT, APP_URL } from "./config.ts";
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

/** L'expéditeur : « Nexus », depuis info@nexussports.ca — jamais au nom du
 *  recruteur (retour BP 2026-09-28), qui est nommé dans l'objet et le corps. */
export function expediteur(): string {
  return FROM;
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

  const envoi = await envoyerCourriel(deps, {
    jetonInvitationId: inv.id,
    idempotence: `carte-invitation/${inv.id}`,
    campagne: "invitation_carte_prospect",
    donnees: { prenom: carte.prenom, recruteur, cegep: nomCegep, courriel: carte.courriel },
  });
  if (!envoi.ok) return echec(envoi.erreur);
  const j = { id: envoi.resendId ?? undefined };
  const maintenant = new Date().toISOString();

  // Le marqueur ne se pose QUE sur un 2xx de Resend (acceptation par la
  // passerelle, pas livraison) — jamais sur la tentative.
  await supabase.from("cartes_prospect_invitations")
    .update({ statut: "ENVOYE", envoye_le: maintenant, resend_id: j.id ?? null }).eq("id", inv.id);
  // Visible par l'unité : « Invitation envoyée le … », tracé au journal par trigger.
  await supabase.from("cartes_prospect").update({ invitee_le: maintenant }).eq("id", carte.id);
  return { ok: true, statut: "ENVOYE", resend_id: j.id ?? null };
}

/** L'envoi lui-même, COMMUN à l'invitation et au rappel : même gabarit, même
 *  expéditeur, même désabonnement (jeton de l'invitation d'origine — même
 *  adresse, donc même empreinte au registre LCAP). */
async function envoyerCourriel(
  deps: Dependances,
  o: {
    jetonInvitationId: string;
    idempotence: string;
    campagne: string;
    rappel?: boolean;
    donnees: { prenom: string | null; recruteur: string | null; cegep: string; courriel: string };
  },
): Promise<{ ok: true; resendId: string | null } | { ok: false; erreur: string }> {
  const jeton = encodeURIComponent(await signerJetonInvitation(o.jetonInvitationId, deps.desabonnementSecret));
  const { html, text } = buildBody({
    ...o.donnees,
    desabonnementUrl: `${APP_URL}/desabonnement?t=${jeton}`,
    rappel: !!o.rappel,
  });
  let res: Response;
  try {
    res = await deps.fetch(deps.resendUrl ?? "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": o.idempotence,
      },
      body: JSON.stringify({
        from: expediteur(),
        to: o.donnees.courriel,
        reply_to: SUPPORT,
        subject: sujet(o.donnees.cegep, !!o.rappel),
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${APP_URL}/api/desabonnement?t=${jeton}>, <mailto:${SUPPORT}?subject=desabonnement>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "campagne", value: o.campagne }],
      }),
    });
  } catch (e) {
    return { ok: false, erreur: `réseau : ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) {
    const corps = await res.text().catch(() => "");
    return { ok: false, erreur: `Resend ${res.status} ${corps}` };
  }
  const j = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, resendId: j.id ?? null };
}

/** Le RAPPEL demandé par un recruteur (demander_rappel_invitation, décision BP
 *  2026-09-30). La base a déjà décidé et réservé ; on réclame la ligne
 *  (A_ENVOYER → EN_COURS, un seul gagnant), on envoie, et SEULEMENT sur un 2xx
 *  de Resend, finaliser_rappel_carte pose le compteur, la date et le journal. */
export async function traiterRappel(deps: Dependances, rappelId: string): Promise<Resultat> {
  const { supabase } = deps;
  const { data: rap, error: errClaim } = await supabase
    .from("cartes_prospect_rappels")
    .update({ statut: "EN_COURS" })
    .eq("id", rappelId)
    .eq("statut", "A_ENVOYER")
    .select("id, carte_id, invitation_id, demande_par")
    .maybeSingle();
  if (errClaim) return { ok: false, statut: "ECHEC", erreur: `réclamation : ${errClaim.message}` };
  if (!rap) return { ok: true, statut: "RIEN_A_FAIRE" };

  const echec = async (erreur: string): Promise<Resultat> => {
    await supabase.from("cartes_prospect_rappels").update({ statut: "ECHEC", erreur: erreur.slice(0, 500) }).eq("id", rap.id);
    return { ok: false, statut: "ECHEC", erreur };
  };

  const { data: carte } = rap.carte_id
    ? await supabase.from("cartes_prospect").select("id, prenom, courriel").eq("id", rap.carte_id).maybeSingle()
    : { data: null };
  if (!carte?.courriel) return echec("carte supprimée ou sans courriel avant le rappel");

  const [{ data: inv }, { data: auteur }] = await Promise.all([
    supabase.from("cartes_prospect_invitations").select("unite_cegep_id").eq("id", rap.invitation_id).maybeSingle(),
    supabase.from("users").select("first_name, last_name").eq("id", rap.demande_par).maybeSingle(),
  ]);
  if (!inv) return echec("invitation d'origine introuvable");
  const { data: cegep } = await supabase.from("schools").select("name").eq("id", inv.unite_cegep_id).maybeSingle();
  const recruteur = auteur ? `${auteur.first_name ?? ""} ${auteur.last_name ?? ""}`.trim() || null : null;
  const nomCegep = (cegep?.name as string | undefined)?.trim() || "cégep";

  const envoi = await envoyerCourriel(deps, {
    jetonInvitationId: rap.invitation_id,
    idempotence: `carte-rappel/${rap.id}`,
    campagne: "rappel_invitation_carte_prospect",
    rappel: true,
    donnees: { prenom: carte.prenom, recruteur, cegep: nomCegep, courriel: carte.courriel },
  });
  if (!envoi.ok) return echec(envoi.erreur);

  const { error: errFin } = await supabase.rpc("finaliser_rappel_carte", { p_rappel: rap.id, p_resend_id: envoi.resendId });
  if (errFin) return { ok: false, statut: "ECHEC", erreur: `parti, mais non consigné : ${errFin.message}` };
  return { ok: true, statut: "ENVOYE", resend_id: envoi.resendId };
}
