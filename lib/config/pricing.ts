/**
 * Pricing config — single source of truth for tier definitions.
 *
 * Consumed by /tarifs and (eventually) UpgradeModal. Anything that needs
 * to display prices, feature lists, or CTAs for a tier should import from
 * here rather than re-declaring values, so a price change touches one file.
 */

export type Persona = "recruteur" | "coach" | "athlete";
export type Billing = "monthly" | "annual";

export type FeatureRow =
  | { kind: "item"; label: string; included: boolean }
  | { kind: "section"; label: string };

export interface Tier {
  id: string;
  name: string;
  nameColor: string;
  monthly: number;
  annual: number;
  annualMonthlyEq: number | null;
  border: string;
  glow: string;
  badge: { label: string; bg: string; fg: string } | null;
  featuresHeader?: string;
  features: FeatureRow[];
  ctaLabel: string;
  ctaClass: string;
  ctaHref: string;
  /** When true, the tier is displayed as a visible card but is NOT
   *  purchasable yet ("Bientôt disponible"). The component must hide the
   *  price and disable checkout. The Stripe price ids stay in
   *  lib/stripe/prices.ts so it can go live later without a data change. */
  comingSoon?: boolean;
}

/* ── RECRUITER ──────────────────────────────────────────────── */

export const RECRUITER_TIERS: Tier[] = [
  {
    id: "rec_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "item", label: "Recherche par sport, région, année, école, position", included: true },
      { kind: "item", label: "Étoiles, cote globale, badge vérifié", included: true },
      { kind: "item", label: "École, sport, promotion, moyenne", included: true },
      { kind: "item", label: "Taille / poids", included: true },
      { kind: "item", label: "Évaluations simplifiées (3 groupes)", included: true },
      { kind: "item", label: "10 résultats par recherche", included: true },
      { kind: "item", label: "10 favoris max", included: true },
      { kind: "item", label: "Filtres avancés", included: false },
      { kind: "item", label: "Identité de l'athlète (nom, photo, jersey)", included: false },
      { kind: "item", label: "Vidéos et parcours académique", included: false },
      { kind: "item", label: "Messagerie coach", included: false },
      { kind: "item", label: "Pipeline de recrutement", included: false },
    ],
    ctaLabel: "Commencer gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 19.99,
    annual: 159,
    annualMonthlyEq: 13.25,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Populaire", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Filtres avancés (taille, poids, cote globale)", included: true },
      { kind: "item", label: "Résultats de recherche illimités", included: true },
      { kind: "item", label: "Nom, photo, numéro de jersey révélés", included: true },
      { kind: "item", label: "Vidéos faits saillants", included: true },
      { kind: "item", label: "Commentaires du coach", included: true },
      { kind: "item", label: "Parcours académique complet", included: true },
      { kind: "item", label: "Coordonnées du coach (email, tel)", included: true },
      { kind: "item", label: "Messagerie coach (10/mois)", included: true },
      { kind: "item", label: "Auto-intro / templates", included: true },
      { kind: "item", label: "Favoris illimités", included: true },
      { kind: "item", label: "Pipeline de recrutement (50 athlètes)", included: true },
      { kind: "item", label: "Activity feed (18 événements)", included: true },
      { kind: "item", label: "Coach reviews — lire et rédiger", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_allstar",
    name: "All Star",
    nameColor: "text-[#E63946]",
    monthly: 29.99,
    annual: 239,
    annualMonthlyEq: 19.92,
    border: "border-2 border-[#E63946]",
    glow: "shadow-[0_0_24px_rgba(230,57,70,0.1)]",
    badge: null,
    featuresHeader: "Tout du plan Pro, plus :",
    features: [
      { kind: "item", label: "Évaluations détaillées (11 critères)", included: true },
      { kind: "item", label: "Statut de recrutement global", included: true },
      { kind: "item", label: "Voir qui a consulté l'athlète", included: true },
      { kind: "item", label: "Messagerie illimitée", included: true },
      { kind: "item", label: "Pipeline illimité", included: true },
      { kind: "item", label: "Pipeline analytics (conversion, temps par statut)", included: true },
      { kind: "item", label: "Listes de prospects custom", included: true },
      { kind: "item", label: "Taux de réponse coaches", included: true },
      { kind: "item", label: "Signaux de compétition", included: true },
      { kind: "item", label: "Gestion CÉGEP", included: true },
    ],
    ctaLabel: "Devenir All Star →",
    ctaClass: "bg-[#E63946] text-white hover:bg-[#D42B22]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
];

/* ── COACH ──────────────────────────────────────────────────── */

export const COACH_TIERS: Tier[] = [
  /* VIDE — le compte coach est entièrement gratuit (lots 1 et 2, 3c84f44).
     Le sélecteur de personas garde son onglet Coach : /tarifs y affiche
     l'encadré mission + la liste `freePersona.coachItems` du dictionnaire.

     POUR RÉINTRODUIRE UNE ADHÉSION : repeupler ce tableau et remettre
     PERSONA_SAVINGS.coach à la bonne valeur. Le rendu rebascule seul sur
     les cartes — aucune modification de app/tarifs/page.tsx n'est requise.
     Les définitions précédentes (Gratuit / Pro 9,99 / All Star 19,99) sont
     récupérables dans l'historique git de ce fichier. */
];

/* ── ATHLETE ────────────────────────────────────────────────── */

export const ATHLETE_TIERS: Tier[] = [
  /* VIDE — le compte athlète est entièrement gratuit. Même mécanique que
     COACH_TIERS ci-dessus : /tarifs affiche `freePersona.athleteItems`.
     Les définitions précédentes (Gratuit / Pro 6,99) sont dans git. */
];

/* ── Savings shown in toggle label per persona.
   All paid tiers now sit at ~33–35% off annual. Using a single flat
   percentage per persona (the component API) rounded to the tier
   average. 0 hides the caption (no paid tiers exist). ── */
export const PERSONA_SAVINGS: Record<Persona, number> = {
  recruteur: 34, // Pro 19.99/159 → 33.7%, All Star 29.99/239 → 33.6%
  coach: 0,      // aucun tier payant → masque la mention d'économie ET le bascule
  athlete: 0,    // idem
};

export function getTiersForPersona(persona: Persona): Tier[] {
  return persona === "recruteur" ? RECRUITER_TIERS
    : persona === "coach" ? COACH_TIERS
    : ATHLETE_TIERS;
}
