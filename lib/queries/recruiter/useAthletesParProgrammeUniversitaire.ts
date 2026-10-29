"use client";

/* Filtre « Programme universitaire visé » de la recherche du recruteur universitaire (D5 Q6, BP 2026-10-29).
   La recherche charge déjà TOUS les athlètes visibles (recruiter_search_athletes, p_limit null) : ce filtre
   rend seulement les id des cégépiens dont le libellé visé contient le texte, et la page croise. Lecture
   directe d'athletes : les policies décident (un recruteur collégial ne lit aucun cégépien). */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export const MIN_PROGRAMME_UNIVERSITAIRE = 2;

/** null tant que le filtre est vide ou trop court (le filtre n'agit pas). */
export function useAthletesParProgrammeUniversitaire(texte: string, actif: boolean) {
  const terme = texte.trim().replace(/[%_]/g, "").replace(/\s+/g, " ");
  const enService = actif && terme.length >= MIN_PROGRAMME_UNIVERSITAIRE;
  return useQuery<Set<string>>({
    queryKey: ["athletes-programme-universitaire", terme],
    enabled: enService,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("athletes")
        .select("id")
        .ilike("programme_universitaire_vise", `%${terme}%`);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.id as string));
    },
  });
}
