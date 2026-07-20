/* ═══════════════════════════════════════════════════════════════
   useAthleteSearch — TanStack hook (iter 5.3b)
   Hook principal de la page Recherche. Reproduit fidèlement le
   useEffect main athlete query (lignes 397-590 du legacy) avec
   sérialisation des filtres dans la queryKey.

   Pattern critique : `placeholderData: keepPreviousData` →
   pendant un nouveau fetch sur changement de filtre, l'ancienne
   grille reste affichée (UX type Instagram). Pas de skeleton
   intermédiaire.

   ⚠️ NE PAS inclure favorites/favCounts dans queryKey ni dans la
   transformation : ils sont composés dans le useMemo `filtered` de
   la page (line 638 du legacy). Évite un refetch complet à chaque
   toggle de favori.

   orgType est aussi appliqué client-side dans le useMemo `filtered`
   de la page (pour la même raison de stabilité du cache).
═══════════════════════════════════════════════════════════════ */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { createClient } from "@/lib/supabase/client";
import { parseDistinctions } from "@/lib/config/badges";
import { firstTeamGender } from "@/lib/config/gender";

export interface AthleteSearchFilters {
  search: string;           // déjà débouncé en amont
  sport: string;            // valeur du dropdown (peut être vide)
  promotion: string;        // string parce qu'on parse en int dans la query
  verifiedOnly: boolean;
  withVideoOnly: boolean;
  minRating: string;        // string parce qu'on parse en float
  filterOuvertDemenager: boolean;
  filterOuvertPrive: boolean;
  filterOuvertAnglophone: boolean;
  filterNewOnly: boolean;
  minGpa: string;           // string parce qu'on parse en float
  sortBy: string;
  sportId: string | null;
  isFreeRecruiter: boolean;
  maxSearchResults: number;
}

export interface SearchAthleteRow {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  sport: string;
  position: string;
  school: string;
  region: string;
  graduationYear: number;
  niveau: "Sec. 5";
  heightDisplay: string;
  weightDisplay: string;
  isVerified: boolean;
  lastValidation: string | null;
  isFavorited: boolean;     // placeholder, overridé en page
  hasVideo: boolean;
  badges: { badgeId: string; label: string; icon: string }[];
  favorites: number;        // placeholder, overridé en page
  views: number;
  stars: number;
  heightWeight: string;
  gpa: number;
  academicBadges: string[];
  jersey: string;
  sportName: string;
  recruitmentStatus: string;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
  commitmentStatus: "aucun";
  orgType: "scolaire" | "ligue_civile" | undefined;
  ouvertDemenager: boolean;
  ouvertPrive: boolean;
  ouvertAnglophone: boolean;
  createdAt: string;
  noTeam: boolean;
  context: string | null;
  /** teams.gender de l'équipe de l'athlète — "Masculin" | "Féminin" | "Mixte".
   *  null quand l'athlète n'est rattaché à AUCUNE équipe (team_athletes vide),
   *  ce qui est le cas de la grande majorité des athlètes aujourd'hui. Le filtre
   *  les exclut donc dès qu'un genre est sélectionné. Volontairement PAS
   *  athletes.genre : ce champ-là est à moitié vide et encodé de 2 façons. */
  teamGender: string | null;
}


const BADGE_MAP: Record<string, { label: string; icon: string }> = {
  captain: { label: "Capitaine", icon: "shield" },
  allstar: { label: "Équipe d'étoiles", icon: "star" },
  team_leader: { label: "Leader", icon: "award" },
};

export function useAthleteSearch(filters: AthleteSearchFilters) {
  return useQuery<SearchAthleteRow[]>({
    queryKey: ["athletes", filters],
    queryFn: async (): Promise<SearchAthleteRow[]> => {
      const supabase = createClient();

      // Free recruiters: identité stripped server-side (devtools-proof)
      const identityCols = filters.isFreeRecruiter ? "" : "first_name, last_name,";

      let query = supabase
        .from("athletes")
        .select(`
          id, ${identityCols} photo_url, verified, last_profile_validation,
          annee_diplomation, numero_jersey, video_faits_saillants_url, school_id,
          cote_globale_entraineur,
          taille_pieds,
          taille_pouces,
          poids_lbs,
          mentions_academiques,
          moyenne_generale,
          statut_recrutement_override,
          recruitment_status, committed_school_id, open_to_offers,
          pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone, created_at,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region, type),
          committed_school:schools!committed_school_id(name),
          context,
          team_athletes(teams!team_id(gender)),
          evaluations(distinctions, updated_at)
        ` as unknown as "*")
        .eq("status", "ACTIF");

      // Server-side filters — reproduction exacte du legacy
      if (!filters.isFreeRecruiter && filters.search.trim().length >= 3) {
        const q = filters.search.trim().replace(/[%,]/g, "");
        query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
      }
      if (filters.sportId) query = query.eq("sport_id", filters.sportId);
      if (filters.promotion) query = query.eq("annee_diplomation", parseInt(filters.promotion));
      if (filters.verifiedOnly) query = query.eq("verified", true);
      if (filters.withVideoOnly) query = query.not("video_faits_saillants_url", "is", null);
      if (filters.minGpa) query = query.gte("moyenne_generale", parseFloat(filters.minGpa));
      if (filters.minRating) query = query.gte("cote_globale_entraineur", parseFloat(filters.minRating));
      if (filters.filterOuvertDemenager) query = query.eq("pret_changer_region", true);
      if (filters.filterOuvertPrive) query = query.eq("ouvert_cegep_prive", true);
      if (filters.filterOuvertAnglophone) query = query.eq("ouvert_cegep_anglophone", true);
      if (filters.filterNewOnly) {
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", tenDaysAgo);
      }

      // Server-side sort
      // Note iter 6.0b : "plus_vus" n'a pas de colonne dénormalisée view_count
      // côté athletes — fallback raisonnable sur cote_globale_entraineur, le
      // tri "Plus vus" effectif demande une vue agrégée (TODO migration).
      switch (filters.sortBy) {
        case "rating_desc":
        case "favorites_desc":
        case "plus_vus":
          query = query.order("cote_globale_entraineur", { ascending: false, nullsFirst: false });
          break;
        case "rating_asc":
          query = query.order("cote_globale_entraineur", { ascending: true, nullsFirst: false });
          break;
        case "grad_asc":
          query = query.order("annee_diplomation", { ascending: true });
          break;
        case "grad_desc":
          query = query.order("annee_diplomation", { ascending: false });
          break;
        case "name_asc":
          query = query.order("last_name", { ascending: true });
          break;
      }

      // Tier cap (post-filtres/sort)
      if (filters.maxSearchResults !== -1) {
        query = query.limit(filters.maxSearchResults);
      }

      const { data: athleteData, error } = await query;
      if (error) throw error;
      if (!athleteData) return [];

      // Mapping → SearchAthleteRow (reproduction exacte du legacy lignes 489-569)
      return athleteData.map((a: Record<string, unknown>): SearchAthleteRow => {
        const sportRel = Array.isArray(a.sports) ? a.sports[0] : a.sports;
        const posRel = Array.isArray(a.positions) ? a.positions[0] : a.positions;
        const schoolRel = Array.isArray(a.schools) ? a.schools[0] : a.schools;
        const committedSchoolRel = Array.isArray(a.committed_school) ? a.committed_school[0] : a.committed_school;
        const evalRel = selectBestEvaluation(Array.isArray(a.evaluations) ? a.evaluations : a.evaluations ? [a.evaluations] : []);
        // #56 — parseDistinctions gère string[] (legacy) ET {badge,detail} (objet,
        // 10 rows en prod), filtre les badges inconnus. Plus de cast "as string[]".
        const distinctions = parseDistinctions((evalRel as Record<string, unknown> | null)?.distinctions);
        return {
          id: a.id as string,
          firstName: (a.first_name as string) || "",
          lastName: (a.last_name as string) || "",
          photo: (a.photo_url as string) || "",
          sport: ((sportRel as Record<string, string> | null)?.nom || "").toLowerCase().replace(/ /g, "_"),
          position: (posRel as Record<string, string> | null)?.abreviation || "",
          school: (schoolRel as Record<string, string> | null)?.name || "",
          region: (schoolRel as Record<string, string> | null)?.region || "",
          graduationYear: (a.annee_diplomation as number) || 0,
          niveau: "Sec. 5" as const,
          heightDisplay: "",
          weightDisplay: "",
          isVerified: a.verified as boolean,
          lastValidation: (a.last_profile_validation as string) || null,
          isFavorited: false, // composé en page
          hasVideo: !!a.video_faits_saillants_url,
          badges: distinctions
            .filter((d) => !!BADGE_MAP[d.badge])
            .map((d) => ({ badgeId: d.badge, label: BADGE_MAP[d.badge].label, icon: BADGE_MAP[d.badge].icon })),
          favorites: 0, // composé en page
          views: 0,
          stars: (a.cote_globale_entraineur as number) || 0,
          heightWeight: (() => {
            const ft = a.taille_pieds as number | null;
            const inches = a.taille_pouces as number | null;
            const lbs = a.poids_lbs as number | null;
            const parts: string[] = [];
            if (ft) parts.push(`${ft}'${inches || 0}"`);
            if (lbs) parts.push(`${lbs} lbs`);
            return parts.join(" · ");
          })(),
          gpa: (a.moyenne_generale as number) || 0,
          academicBadges: (a.mentions_academiques as string[]) || [],
          jersey: a?.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
          sportName: (sportRel as Record<string, string> | null)?.nom || "",
          recruitmentStatus: (a?.recruitment_status as string) || "OUVERT",
          committedSchoolName: (committedSchoolRel as Record<string, string> | null)?.name || null,
          openToOffers: (a?.open_to_offers as boolean | null) ?? null,
          commitmentStatus: "aucun",
          orgType: (!a.school_id
            ? undefined
            : (schoolRel as Record<string, string> | null)?.type === "LIGUE_CIVILE"
              ? "ligue_civile"
              : "scolaire") as "scolaire" | "ligue_civile" | undefined,
          ouvertDemenager: a.pret_changer_region === true,
          ouvertPrive: a.ouvert_cegep_prive === true,
          ouvertAnglophone: a.ouvert_cegep_anglophone === true,
          createdAt: (a.created_at as string) || "",
          noTeam: !a.school_id,
          context: (a.context as string | null) ?? null,
          teamGender: firstTeamGender(a.team_athletes),
        };
      });
    },
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}
