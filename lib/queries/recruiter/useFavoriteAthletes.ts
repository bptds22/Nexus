/* ═══════════════════════════════════════════════════════════════
   useFavoriteAthletes — TanStack hook (iter 5.3a)
   Compose useFavorites (ids) + useAthletesByIds (hydratation) +
   useFavoriteCounts (counts globaux) puis applique la transformation
   FavoriAthlete utilisée par la page Favoris.

   favoritedAt et daysIdle sont assignés mais jamais lus dans la page
   actuelle → on les met à "" / 0 (perte non-visuelle).
═══════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { useFavorites } from "@/lib/queries/shared/useFavorites";
import { useFavoriteCounts } from "@/lib/queries/shared/useFavoriteCounts";
import { useAthletesByIds, type AthleteRow } from "@/lib/queries/shared/useAthletesByIds";
import { parseDistinctions } from "@/lib/config/badges";

export interface FavoriAthlete {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  position: string;
  sport: string;
  sportName: string;
  school: string;
  region: string;
  graduationYear: number;
  stars: number;
  isVerified: boolean;
  lastValidation?: string | null;
  hasVideo: boolean;
  heightWeight: string;
  favoritedAt: string;
  pipelineStage: string | null;
  pipelineMovedAt: string | null;
  daysIdle: number;
  favCount: number;
  jersey: string;
  recruitmentStatus: string;
  committedSchoolName: string;
  openToOffers: boolean | null;
  badges: { badgeId: string; label: string; icon: string }[];
  noTeam: boolean;
}

const BADGE_MAP: Record<string, { label: string; icon: string }> = {
  captain: { label: "Capitaine", icon: "shield" },
  allstar: { label: "Équipe d'étoiles", icon: "star" },
  team_leader: { label: "Leader", icon: "award" },
};

function transformAthlete(a: AthleteRow, favCount: number): FavoriAthlete {
  const sportRel = a.sports;
  const sportObj = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
  const posRel = a.positions;
  const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { abreviation?: string } | null;
  const schoolRel = a.schools;
  const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; region?: string } | null;
  const committedSchoolRel = a.committed_school;
  const committedSchool = (Array.isArray(committedSchoolRel) ? committedSchoolRel[0] : committedSchoolRel) as { name?: string } | null;
  const evalRel = a.evaluations;
  const eval0 = (Array.isArray(evalRel) ? evalRel[0] : evalRel) as { cote_globale?: number | null; distinctions?: unknown } | null;
  // #56 — parseDistinctions gère string[] (legacy) ET {badge,detail} (objet).
  const distinctions = parseDistinctions(eval0?.distinctions);

  const ft = a.taille_pieds;
  const inches = a.taille_pouces;
  const lbs = a.poids_lbs;
  const hwParts: string[] = [];
  if (ft) hwParts.push(`${ft}'${inches || 0}"`);
  if (lbs) hwParts.push(`${lbs} lbs`);

  return {
    id: a.id,
    firstName: a.first_name || "Athlète",
    lastName: a.last_name || "",
    photo: a.photo_url || "",
    position: pos?.abreviation || "",
    sport: (sportObj?.nom || "").toLowerCase().replace(/ /g, "_"),
    sportName: sportObj?.nom || "",
    school: school?.name || "",
    region: school?.region || "",
    graduationYear: a.annee_diplomation || 0,
    stars: (eval0?.cote_globale as number) ?? (a.cote_globale_entraineur as number) ?? 0,
    isVerified: !!a.verified,
    lastValidation: a.last_profile_validation,
    hasVideo: !!a.video_faits_saillants_url,
    heightWeight: hwParts.join(" · "),
    favoritedAt: "", // non utilisé dans le rendu actuel (assigné mais jamais lu)
    pipelineStage: null,
    pipelineMovedAt: null,
    daysIdle: 0, // idem
    favCount,
    jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
    recruitmentStatus: a.recruitment_status || "OUVERT",
    committedSchoolName: committedSchool?.name || "",
    openToOffers: a.open_to_offers ?? null,
    badges: distinctions
      .filter((d) => !!BADGE_MAP[d.badge])
      .map((d) => ({ badgeId: d.badge, label: BADGE_MAP[d.badge].label, icon: BADGE_MAP[d.badge].icon })),
    noTeam: !a.school_id,
  };
}

export function useFavoriteAthletes() {
  const { data: favoriteIds = [], isLoading: l1 } = useFavorites();
  const { data: athletes = [], isLoading: l2 } = useAthletesByIds(favoriteIds);
  const { data: favCountMap = {}, isLoading: l3 } = useFavoriteCounts();

  const transformedAthletes = useMemo(
    () => athletes.map((a) => transformAthlete(a, favCountMap[a.id] || 1)),
    [athletes, favCountMap],
  );

  return {
    athletes: transformedAthletes,
    isLoading: l1 || (favoriteIds.length > 0 && l2) || l3,
  };
}
