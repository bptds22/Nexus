/* Nom de l'athlète « à confirmer » (D1b, 2026-10-15) — tronc partagé web / mobile.

   La base (20261015103315) coupe le nom complet Google en prénom / nom et marque
   la fiche `nom_a_confirmer`. Tant que le nom n'est pas confirmé, la fiche sort
   de la recherche recruteur et des listes du coach hors de son effectif.

   Ce module porte les deux RPC et les textes : le bandeau web, le bandeau de
   l'appli, les deux onboardings et les deux listes du coach lisent les mêmes. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";

export type EtatNom = {
  etat: "A_CONFIRMER" | "MANQUANT";
  prenom: string | null;
  nom: string | null;
};

/** `mon_nom_a_confirmer()` : null s'il n'y a rien à confirmer (ou pas de fiche). */
export async function lireEtatNom(supabase: SupabaseClient): Promise<EtatNom | null> {
  const { data, error } = await supabase.rpc("mon_nom_a_confirmer");
  if (error) {
    console.warn(`[nom à confirmer] lecture : ${erreurLisible(error)}`);
    return null;
  }
  return (data as EtatNom[] | null)?.[0] ?? null;
}

/** `confirmer_mon_nom()` : null si c'est fait, sinon le message à montrer. */
export async function confirmerMonNom(
  supabase: SupabaseClient,
  prenom: string,
  nom: string,
): Promise<string | null> {
  if (!prenom.trim() || !nom.trim()) return TEXTES_NOM.obligatoires;
  const { error } = await supabase.rpc("confirmer_mon_nom", { p_prenom: prenom.trim(), p_nom: nom.trim() });
  if (error) {
    console.error(`[nom à confirmer] confirmation : ${erreurLisible(error)}`);
    return TEXTES_NOM.echec;
  }
  return null;
}

/** Après le premier enregistrement de l'onboarding : le nom vu et validé à
 *  l'écran est confirmé — sans quoi le bandeau redemanderait « Est-ce bien
 *  toi ? » juste après. Jamais bloquant. */
export async function confirmerNomSiAConfirmer(
  supabase: SupabaseClient,
  prenom: string,
  nom: string,
): Promise<void> {
  const etat = await lireEtatNom(supabase);
  if (etat?.etat === "A_CONFIRMER") await confirmerMonNom(supabase, prenom, nom);
}

/** L'onboarding montre Prénom / Nom quand l'un manque ou est à confirmer. */
export function nomADemander(prenom: string, nom: string, aConfirmer: boolean): boolean {
  return aConfirmer || !prenom.trim() || !nom.trim();
}

/** Une fiche se montre hors de l'effectif du coach seulement avec un nom confirmé. */
export function nomPresentable(a: { firstName: string; lastName: string; nomAConfirmer?: boolean }): boolean {
  return !!a.firstName.trim() && !!a.lastName.trim() && a.nomAConfirmer !== true;
}

export const TEXTES_NOM = {
  question: "Est-ce bien toi :",
  pourquoi: "Ton profil n'apparaît pas aux recruteurs tant que ton nom n'est pas confirmé.",
  ajouter: "Ajoute ton prénom et ton nom.",
  corriger: "Corrige ton prénom et ton nom.",
  obligatoires: "Ton prénom et ton nom sont obligatoires.",
  echec: "L'enregistrement a échoué. Réessaie.",
  etiquetteCoach: "Nom à confirmer par l'athlète",
} as const;

/** Ligne du coach sous les fiches de l'école retirées faute de nom confirmé. */
export function phraseFichesMasquees(n: number): string {
  return n === 1
    ? "1 fiche de l'école masquée : l'athlète doit confirmer son prénom et son nom."
    : `${n} fiches de l'école masquées : les athlètes doivent confirmer leur prénom et leur nom.`;
}
