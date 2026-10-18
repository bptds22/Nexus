/* ═══════════════════════════════════════════════════════════════
   « Recherche » du partenaire (P1, 1.4.5) — l'adaptateur pur entre une
   ligne de top_athletes_view et la carte native de la recherche recruteur
   (AthleteCardMobile). Aucune donnée nouvelle : seulement les colonnes que
   la recherche partenaire lisait déjà. Ce que la vue ne porte pas n'est PAS
   inventé (pas de coche « vérifié », pas de statut de recrutement, pas de
   dossard) : la carte se contente d'un champ vide.
═══════════════════════════════════════════════════════════════ */

import { pastillesBadges, textePastille } from "@/lib/queries/shared/athleteBadges";

/** Les colonnes de top_athletes_view que la carte lit. */
export interface LigneRecherchePartenaire {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cote_globale_entraineur: number | null;
  annee_diplomation: number | null;
  photo_url: string | null;
  sport_name: string | null;
  position_name: string | null;
  school_name: string | null;
  badges: unknown;
}

/** La forme `a` d'AthleteCardMobile (components/shared/RecruteurRechercheMobile.tsx). */
export interface CarteRecherchePartenaire {
  id: string;
  firstName: string;
  lastName: string;
  photo: string;
  position: string;
  sportName: string;
  school: string;
  graduationYear: number;
  stars: number;
  badges: { badgeId: string; label: string }[];
  isVerified: boolean;
  isFavorited: boolean;
  jersey: string;
  recruitmentStatus: string;
  committedSchoolName: string | null;
  openToOffers: boolean | null;
  noTeam: boolean;
  identityVisible: boolean;
}

export function versCarteRecherche(r: LigneRecherchePartenaire): CarteRecherchePartenaire {
  return {
    id: r.id,
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    photo: r.photo_url ?? "",
    position: r.position_name ?? "",
    sportName: r.sport_name ?? "",
    school: r.school_name ?? "",
    graduationYear: r.annee_diplomation ?? 0,
    // Absence de cote : 0, que la carte affiche comme « non évalué » (coteAffichee).
    stars: r.cote_globale_entraineur ?? 0,
    badges: pastillesBadges(r.badges).map((d) => ({ badgeId: d.code, label: textePastille(d) })),
    // La vue ne projette pas la date de validation : pas de coche plutôt qu'une coche inventée.
    isVerified: false,
    isFavorited: false,
    jersey: "",
    recruitmentStatus: "",
    committedSchoolName: null,
    openToOffers: null,
    noTeam: false,
    // La vue filtre déjà l'éligibilité partenaire (is_partner_eligible_athlete) : identité visible.
    identityVisible: true,
  };
}

/** Le nombre de filtres actifs (pastille du bouton « Filtres »), hors recherche texte et tri par défaut. */
export function nombreFiltresActifs(f: {
  sport: string; position: string; promotion: string; region: string; orgType: string; genre: string;
  minRating: string; withSportBadge: boolean; withVideoOnly: boolean; sortBy: string;
}): number {
  return [f.sport, f.position, f.promotion, f.region, f.orgType, f.genre, f.minRating].filter(Boolean).length
    + (f.withSportBadge ? 1 : 0) + (f.withVideoOnly ? 1 : 0) + (f.sortBy !== "cote_desc" ? 1 : 0);
}
