/* ═══════════════════════════════════════════════════════════════
   useAthleteAutocomplete — suggestions pendant la frappe (max 10).

   BASCULÉ SUR recruiter_search_athletes (chantier bascule RPC).

   Ce hook est le seul du lot qui ne pouvait PAS passer par
   recruiter_athlete_cards : cette RPC prend des IDs, or ici on part
   d'une chaîne de recherche. Il fallait donc la RPC de recherche.

   ── Pourquoi l'ancien `.or(first_name.ilike...)` était un trou ──
   Le nom n'y était pas seulement PROJETÉ, il était FILTRÉ dessus. Un
   filtre est une divulgation : en tapant des préfixes successifs on
   déduit par dichotomie le nom d'un athlète qu'on n'a pas le droit de
   voir, sans que ce nom apparaisse jamais à l'écran. Retirer la colonne
   de la projection n'y aurait rien changé.

   Le serveur tranche maintenant, et il le fait AVANT le WHERE :

       v_search := CASE WHEN v_tier_ok
                        THEN NULLIF(btrim(COALESCE(p_search,'')),'')
                   END;

   Si le tier de l'appelant ne donne pas droit à la recherche par nom,
   v_search est NULL et le filtre ne s'applique tout simplement pas —
   il n'y a pas de version client de cette règle à contourner.

   p_limit 10 est délibéré ici : c'est une liste de suggestions pendant
   la frappe, pas la Recherche. La page Recherche, elle, passe p_limit
   NULL (= illimité côté serveur, cf. le LIMIT CASE de la fonction) et
   ne doit surtout pas hériter de ce 10.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { displayFullName, type RecruiterAthleteCard } from "@/lib/queries/shared/recruiterAthleteCards";

export interface AutocompleteAthlete {
  id: string;
  /** Décision SERVEUR. false = nom, photo et dossard sont ABSENTS. */
  identityVisible: boolean;
  /** Déjà résolu — « Identité réservée » sous masquage. Ne pas
   *  reconstruire par interpolation, ni en dériver des initiales. */
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  jersey: string | null;
  sport: string | null;
  position: string | null;
  school: string | null;
}

/** Le sur-ensemble rendu par recruiter_search_athletes. Deux colonnes de
 *  plus que RecruiterAthleteCard : created_at et team_gender. */
type SearchRow = RecruiterAthleteCard & {
  created_at: string | null;
  team_gender: string | null;
};

export function useAthleteAutocomplete(query: string) {
  const trimmed = query.trim();
  return useQuery<AutocompleteAthlete[]>({
    queryKey: ["athleteAutocomplete", trimmed.toLowerCase()],
    queryFn: async () => {
      if (trimmed.length < 2) return [];
      const supabase = createClient();

      // Plus d'échappement manuel de % et , : la chaîne ne sert plus à
      // construire un filtre PostgREST, elle part en paramètre.
      const { data, error } = await supabase.rpc("recruiter_search_athletes", {
        p_search: trimmed,
        p_limit: 10,
      });
      if (error) throw error;

      return ((data ?? []) as SearchRow[]).map((a) => ({
        id: a.id,
        identityVisible: a.identity_visible,
        fullName: displayFullName(a),
        // Sous masquage le serveur rend NULL : `?? ""` garde le contrat
        // `string` sans jamais afficher "null".
        firstName: a.first_name ?? "",
        lastName: a.last_name ?? "",
        photoUrl: a.photo_url,
        jersey: a.numero_jersey,
        sport: a.sport_nom,
        position: a.position_abbr,
        school: a.school_name,
      }));
    },
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}
