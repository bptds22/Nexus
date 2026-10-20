/* Consentement partenaires v2 (2026-10-19) — tronc partagé web / appli.

   La v2 couvre AUSSI les vidéos et les réseaux sociaux. Côté base
   (20261018150000) : tant qu'un athlète n'a pas donné d'accord v2, le partenaire
   voit le reste de sa fiche comme avant (si la v1 est acceptée), mais ni ses
   vidéos ni ses réseaux. Un retrait coupe tout.

   La demande : une carte plein écran à l'ouverture (layout athlète, web et
   appli), choix « Oui, je partage » / « Non » sans défaut, et « Plus tard »
   (revient après 3 jours, 3 fois au plus — la base décide, `a_afficher`).
   Le push unique de la campagne ouvre ROUTE_CONSENTEMENT_V2. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/policyVersion";

export const ROUTE_CONSENTEMENT_V2 = "/athlete/consentement-partenaires";

export type StatutV2 = "V2" | "V1" | "AUCUN";

export type EtatV2 = {
  aAfficher: boolean;
  statut: StatutV2;
  refuse: boolean;
  demandeParent: boolean;
  plusTardNb: number;
  peutSeul: boolean;
};

export type ReponseV2 = "OUI" | "NON" | "PLUS_TARD";

/** Ce que la base a fait de la réponse. */
export type IssueV2 = "ACCEPTEE" | "DEMANDE_PARENT" | "REFUSEE" | "PLUS_TARD";

/** `consentement_partenaire_v2_etat()` : null si pas de fiche athlète ou erreur (jamais bloquant). */
export async function lireEtatV2(supabase: SupabaseClient): Promise<EtatV2 | null> {
  const { data, error } = await supabase.rpc("consentement_partenaire_v2_etat");
  if (error) {
    console.warn(`[consentement v2] lecture : ${erreurLisible(error)}`);
    return null;
  }
  const d = data as Record<string, unknown> | null;
  if (!d || d.ok !== true) return null;
  return {
    aAfficher: d.a_afficher === true,
    statut: (d.statut as StatutV2) ?? "AUCUN",
    refuse: d.refuse === true,
    demandeParent: d.demande_parent === true,
    plusTardNb: typeof d.plus_tard_nb === "number" ? d.plus_tard_nb : 0,
    peutSeul: d.peut_seul === true,
  };
}

/** `consentement_partenaire_v2_repondre()` : l'issue, ou le message d'erreur à montrer. */
export async function repondreV2(
  supabase: SupabaseClient,
  reponse: ReponseV2,
): Promise<{ issue: IssueV2 } | { erreur: string }> {
  const { data, error } = await supabase.rpc("consentement_partenaire_v2_repondre", {
    p_reponse: reponse,
    p_policy_version: PRIVACY_POLICY_VERSION,
  });
  if (error) {
    console.error(`[consentement v2] réponse ${reponse} : ${erreurLisible(error)}`);
    return { erreur: TEXTES_V2.echec };
  }
  const d = data as { ok?: boolean; etat?: string; reason?: string } | null;
  if (d?.ok === true && d.etat) return { issue: d.etat as IssueV2 };
  if (d?.reason === "parent_absent") return { erreur: TEXTES_V2.parentAbsent };
  console.error(`[consentement v2] réponse ${reponse} refusée : ${JSON.stringify(d)}`);
  return { erreur: TEXTES_V2.echec };
}

/** Après l'onboarding : le choix EXPLICITE fait à l'inscription (metadata
 *  `choix_partenaires_v2`, texte v2 affiché) part à la base. « OUI » journalise
 *  l'accord (set_my_partner_visibility, politique v2 → v2) ; « NON » clôt la
 *  demande v2. Absent (inscription d'avant, moins de 14 ans) : rien, la carte
 *  viendra plus tard. Jamais bloquant. */
export async function transmettreChoixInscription(
  supabase: SupabaseClient,
  meta: Record<string, unknown> | null | undefined,
): Promise<void> {
  const choix = meta?.choix_partenaires_v2;
  try {
    if (choix === "OUI") {
      const { data, error } = await supabase.rpc("set_my_partner_visibility", {
        p_granted: true,
        p_policy_version: PRIVACY_POLICY_VERSION,
      });
      if (error || (data as { ok?: boolean } | null)?.ok !== true) {
        console.error(`[consentement v2] inscription OUI : ${error ? erreurLisible(error) : JSON.stringify(data)}`);
      }
    } else if (choix === "NON") {
      await repondreV2(supabase, "NON");
    }
  } catch (err) {
    console.error(`[consentement v2] inscription : ${erreurLisible(err)}`);
  }
}

export const TEXTES_V2 = {
  titre: "Nouveau : tes vidéos et tes réseaux",
  chapeauV1:
    "Tu as déjà accepté que les partenaires de Nexus voient ta carte. Ils peuvent maintenant voir aussi tes vidéos et tes réseaux sociaux — seulement si tu es d’accord.",
  chapeauAucun:
    "Les partenaires de Nexus (médias sportifs, podcasts, camps…) peuvent mettre ta carte, tes vidéos et tes réseaux sociaux en valeur — seulement si tu es d’accord.",
  moinsDe14: "Tu as moins de 14 ans : si tu dis oui, on demande l’accord de ton parent.",
  oui: "Oui, je partage",
  non: "Non",
  plusTard: "Plus tard",
  nonV1: "Non : les partenaires continuent de voir ta carte, mais pas tes vidéos ni tes réseaux.",
  nonAucun: "Non : rien n’est partagé avec les partenaires.",
  parametres: "Tu peux changer d’avis en tout temps dans tes paramètres.",
  merciOui: "C’est fait : les partenaires peuvent voir ta carte, tes vidéos et tes réseaux.",
  merciParent: "On a demandé l’accord de ton parent. Rien n’est partagé avant sa réponse.",
  merciNon: "C’est noté. On ne te le redemandera pas.",
  parentAbsent:
    "Tu as moins de 14 ans : il faut l’accord de ton parent, et aucun parent n’est lié à ton compte. Demande-lui de créer son compte parent.",
  echec: "Ta réponse n’a pas pu être enregistrée. Réessaie.",
  // Paramètres : un accord v1 qui peut s'étendre.
  etendreTitre: "Vidéos et réseaux sociaux",
  etendreTexte: "Les partenaires voient ta carte, mais pas tes vidéos ni tes réseaux sociaux.",
  etendreBouton: "Partager aussi mes vidéos et mes réseaux",
  etendreFait: "Les partenaires voient ta carte, tes vidéos et tes réseaux sociaux.",
} as const;
