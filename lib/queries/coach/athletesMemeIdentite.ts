/* Contrôle « cet athlète existe déjà » de l'assistant coach (D1, 2026-10-15).

   RPC coach_athletes_meme_identite : même nom normalisé + même date de naissance,
   fiche ACTIVE. Elle est SECURITY INVOKER : la RLS de `athletes` décide de ce qui
   sort. Le coach ne reçoit donc QUE des fiches qu'il pouvait déjà ouvrir — un
   mineur qu'il ne voit pas ne sort jamais (Loi 25) ; le trigger de la base note
   alors la paire pour l'admin, sans rien dire au coach.

   Partagé web / mobile (le mobile le branchera au lot mobile). */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AthleteMemeIdentite {
  athleteId: string;
  prenom: string;
  nom: string;
  ecole: string | null;
  estLeMien: boolean;
  aUnCompte: boolean;
  courriel: string | null;
}

interface Ligne {
  athlete_id: string;
  prenom: string | null;
  nom: string | null;
  ecole: string | null;
  est_le_mien: boolean | null;
  a_un_compte: boolean | null;
  courriel: string | null;
}

/** Clé de la question posée : on ne repose pas la même deux fois. */
export function cleIdentite(prenom: string, nom: string, dateNaissance: string): string {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return `${n(prenom)}|${n(nom)}|${dateNaissance}`;
}

/** Les fiches visibles de ce coach qui portent la même identité. Erreur → [] (jamais bloquant). */
export async function athletesMemeIdentite(
  supabase: SupabaseClient,
  prenom: string,
  nom: string,
  dateNaissance: string,
): Promise<AthleteMemeIdentite[]> {
  if (!prenom.trim() || !nom.trim() || !dateNaissance) return [];
  const { data, error } = await supabase.rpc("coach_athletes_meme_identite", {
    p_prenom: prenom.trim(),
    p_nom: nom.trim(),
    p_date_naissance: dateNaissance,
  });
  if (error) {
    console.error(`[athletesMemeIdentite] ${error.message}`);
    return [];
  }
  return ((data as Ligne[] | null) ?? []).map((l) => ({
    athleteId: l.athlete_id,
    prenom: l.prenom ?? "",
    nom: l.nom ?? "",
    ecole: l.ecole,
    estLeMien: !!l.est_le_mien,
    aUnCompte: !!l.a_un_compte,
    courriel: l.courriel,
  }));
}
