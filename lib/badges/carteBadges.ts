/* ═══════════════════════════════════════════════════════════════
   Badges d'une CARTE — la règle unique (1.4.5, demande BP).

   MAX_BADGES_CARTE (5) badges au TOTAL, coach et partenaire confondus, puis
   « +N ». Ordre de priorité, du plus au moins affiché :
     1. le badge PERSONNALISÉ du partenaire (son image, sa signature) ;
     2. les autres badges du partenaire (badges du catalogue Nexus posés par lui) ;
     3. les badges du coach.
   À l'intérieur d'un groupe, l'ordre d'arrivée est gardé (pose la plus
   ancienne d'abord pour le partenaire, ordre du coach sinon).

   PUR — aucun accès réseau. Les surfaces ne refont jamais ce tri à la main :
   elles passent par <CarteBadges> (components/shared/CarteBadges.tsx).
═══════════════════════════════════════════════════════════════ */

import { MAX_BADGES_CARTE } from "@/lib/config/badges";
import type { BadgePartenaire } from "@/lib/badges/partenaire";

export interface BadgeCoachCarte {
  badgeId: string;
  label: string;
  icon?: string;
}

export type BadgeCarte =
  | { genre: "partenaire-propre"; cle: string; label: string; organisation: string; iconeUrl: string | null }
  | { genre: "partenaire-nexus"; cle: string; label: string; organisation: string; iconeUrl: string | null }
  | { genre: "coach"; cle: string; label: string; icon?: string };

export interface BadgesCarte {
  visibles: BadgeCarte[];
  /** Ceux qu'on ne montre pas : le « +N » en porte le nombre. */
  reste: BadgeCarte[];
}

export function badgesDeCarte(
  coach: readonly BadgeCoachCarte[] | null | undefined,
  partenaire: readonly BadgePartenaire[] | null | undefined,
  max: number = MAX_BADGES_CARTE,
): BadgesCarte {
  const p = (partenaire ?? []).filter((b) => !b.estMasque);
  const propres: BadgeCarte[] = p.filter((b) => !b.estNexus)
    .map((b) => ({ genre: "partenaire-propre", cle: `pp-${b.id}`, label: b.libelle, organisation: b.organisation, iconeUrl: b.iconeUrl }));
  const nexus: BadgeCarte[] = p.filter((b) => b.estNexus)
    .map((b) => ({ genre: "partenaire-nexus", cle: `pn-${b.id}`, label: b.libelle, organisation: b.organisation, iconeUrl: b.iconeUrl }));
  const coachs: BadgeCarte[] = (coach ?? [])
    .map((b, i) => ({ genre: "coach", cle: `c-${b.badgeId}-${i}`, label: b.label, icon: b.icon }));
  const tous = [...propres, ...nexus, ...coachs];
  const n = Math.max(0, max);
  return { visibles: tous.slice(0, n), reste: tous.slice(n) };
}

/** Même règle sur la FICHE, où les badges sont de grandes vignettes (avec leurs actions : retirer,
 *  masquer) qu'on ne remplace pas par des pastilles. Rend ce qui reste visible, DANS L'ORDRE
 *  D'ORIGINE de chaque liste, et le nombre masqué (le « +N », qui déplie). Priorité : badge
 *  personnalisé du partenaire, autres badges du partenaire, puis coach. */
export function limiterBadgesFiche<P extends { id: string; estNexus: boolean }, C>(
  partenaire: readonly P[],
  coach: readonly C[],
  max: number = MAX_BADGES_CARTE,
): { partenaire: P[]; coach: C[]; reste: number } {
  const ordre: ({ p: P } | { c: number })[] = [
    ...partenaire.filter((b) => !b.estNexus).map((p) => ({ p })),
    ...partenaire.filter((b) => b.estNexus).map((p) => ({ p })),
    ...coach.map((_, c) => ({ c })),
  ];
  const gardes = ordre.slice(0, Math.max(0, max));
  const idsP = new Set(gardes.flatMap((g) => ("p" in g ? [g.p.id] : [])));
  const idxC = new Set(gardes.flatMap((g) => ("c" in g ? [g.c] : [])));
  return {
    partenaire: partenaire.filter((b) => idsP.has(b.id)),
    coach: coach.filter((_, i) => idxC.has(i)),
    reste: Math.max(0, ordre.length - gardes.length),
  };
}
