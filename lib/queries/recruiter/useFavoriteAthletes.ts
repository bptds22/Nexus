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
import { useAthletesByIds } from "@/lib/queries/shared/useAthletesByIds";
import { displayFullName, type RecruiterAthleteCard } from "@/lib/queries/shared/recruiterAthleteCards";
import { pastillesBadges, textePastille } from "@/lib/queries/shared/athleteBadges";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";

export interface FavoriAthlete {
  id: string;
  /** Décision SERVEUR (identity_visible de la RPC). false = nom, photo et
   *  dossard sont ABSENTS de la réponse, pas juste cachés à l'écran. */
  identityVisible: boolean;
  /** Libellé déjà résolu — « Identité réservée » sous masquage. Ne jamais
   *  reconcaténer firstName + lastName pour l'affichage. */
  fullName: string;
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
  badges: { badgeId: string; label: string; icon?: string }[];
  noTeam: boolean;
}

/* VOIE 2 — BADGE_MAP est SUPPRIMÉE. Elle ne connaissait que 3 des 22 codes
   (captain, allstar, team_leader) et FILTRAIT le reste : un athlète portant
   qi, clutch ou verrou n'affichait aucune pastille, sans que rien ne le
   signale. Avec les codes du catalogue elle n'aurait plus rien matché du
   tout — zéro badge sur toutes les cartes.
   Le libellé vient désormais de la RPC, qui le projette depuis le catalogue.
   `icon` devient OPTIONNELLE : le catalogue n'a pas d'iconographie, et en
   inventer une pour 22 badges serait pire qu'aucune. Le libellé porte le
   sens ; l'icône n'était qu'un ornement sur 3 codes. */

function transformAthlete(a: RecruiterAthleteCard, favCount: number): FavoriAthlete {
  // La RPC projette à plat — plus d'embeds à déballer, donc plus de
  // `Array.isArray(...) ? [0] : ...` : PostgREST rendait un embed to-one
  // tantôt objet, tantôt tableau à un élément selon la forme du select.
  const evalRel = a.evaluations;
  const eval0 = selectBestEvaluation(Array.isArray(evalRel) ? evalRel : evalRel ? [evalRel] : []) as { cote_globale?: number | null; distinctions?: unknown } | null;
  // VOIE 2 — pastillesBadges lit la projection de la RPC (code + libellé).
  const distinctions = pastillesBadges(eval0?.distinctions);

  const ft = a.taille_pieds;
  const inches = a.taille_pouces;
  const lbs = a.poids_lbs;
  const hwParts: string[] = [];
  if (ft) hwParts.push(`${ft}'${inches || 0}"`);
  if (lbs) hwParts.push(`${lbs} lbs`);

  return {
    id: a.id,
    identityVisible: a.identity_visible,
    // displayFullName porte les trois cas (carte absente, masquée, nom
    // partiel) — jamais d'interpolation directe qui produirait "null null".
    fullName: displayFullName(a),
    // Sous masquage le serveur rend NULL : `?? ""` garde le contrat
    // `string` sans jamais afficher "null". Le repli "Athlète" a disparu —
    // il masquait un nom vide derrière un faux nom.
    firstName: a.first_name ?? "",
    lastName: a.last_name ?? "",
    photo: a.photo_url ?? "",
    position: a.position_abbr ?? "",
    sport: (a.sport_nom ?? "").toLowerCase().replace(/ /g, "_"),
    sportName: a.sport_nom ?? "",
    school: a.school_name ?? "",
    region: a.school_region ?? "",
    graduationYear: a.annee_diplomation ?? 0,
    stars: (eval0?.cote_globale as number) ?? a.cote_globale ?? 0,
    isVerified: !!a.verified,
    lastValidation: a.last_profile_validation,
    // a_une_video : booléen dérivé serveur. L'URL de la vidéo n'est pas
    // nécessaire pour afficher un badge « a une vidéo ».
    hasVideo: !!a.a_une_video,
    heightWeight: hwParts.join(" · "),
    favoritedAt: "", // non utilisé dans le rendu actuel (assigné mais jamais lu)
    pipelineStage: null,
    pipelineMovedAt: null,
    daysIdle: 0, // idem
    favCount,
    jersey: a.numero_jersey != null && a.numero_jersey !== "" ? String(a.numero_jersey) : "",
    recruitmentStatus: a.recruitment_status || "OUVERT",
    committedSchoolName: a.committed_school_name ?? "",
    openToOffers: a.open_to_offers ?? null,
    badges: distinctions
      .map((d) => ({ badgeId: d.code, label: textePastille(d) })),
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
