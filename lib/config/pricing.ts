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
  {
    id: "coach_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "item", label: "Créer profils athlètes", included: true },
      { kind: "item", label: "Évaluations simplifiées et détaillées", included: true },
      { kind: "item", label: "Vérifier les athlètes", included: true },
      { kind: "item", label: "Recevoir messages des recruteurs", included: true },
      { kind: "item", label: "Rejoindre une école", included: true },
      { kind: "item", label: "Mon école (dashboard)", included: false },
      { kind: "item", label: "Stats école", included: false },
      { kind: "item", label: "Placement", included: false },
      { kind: "item", label: "Ma réputation", included: false },
      { kind: "item", label: "Analytics", included: false },
    ],
    ctaLabel: "Commencer gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=COACH",
  },
  {
    id: "coach-pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 9.99,
    annual: 79,
    annualMonthlyEq: 6.58,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Populaire", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Mon école — dashboard de l'école", included: true },
      { kind: "item", label: "Stats école — vues, placements, activité", included: true },
      { kind: "item", label: "Placement — suivi des placements en CÉGEP", included: true },
      { kind: "item", label: "Ma réputation — score, avis recruteurs, badges", included: true },
      { kind: "item", label: "Analytics — tendances, recruteurs actifs", included: true },
      { kind: "item", label: "Voir quels recruteurs regardent tes athlètes", included: true },
      { kind: "item", label: "Notifications d'intérêt recruteur", included: true },
      { kind: "item", label: "Multi-équipe (gérer plusieurs sports)", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=COACH",
  },
  {
    id: "coach_allstar",
    name: "All Star",
    nameColor: "text-[#E63946]",
    monthly: 19.99,
    annual: 159,
    annualMonthlyEq: 13.25,
    border: "border-2 border-[#E63946]",
    glow: "shadow-[0_0_24px_rgba(230,57,70,0.1)]",
    badge: null,
    featuresHeader: "Tout du plan Pro, plus :",
    features: [
      { kind: "item", label: "Gestion complète de l'école (ajout et gestion des coachs)", included: true },
      { kind: "item", label: "Analytique avancée par athlète et par équipe", included: true },
      { kind: "item", label: "Suivi détaillé des placements en CÉGEP", included: true },
      { kind: "item", label: "Statistiques d'école complètes", included: true },
      { kind: "item", label: "Outils d'invitation pour les entraîneurs", included: true },
    ],
    ctaLabel: "Choisir All Star",
    ctaClass: "bg-[#E63946] text-white hover:bg-[#D42B22]",
    ctaHref: "/inscription?role=COACH",
  },
];

/* ── ATHLETE ────────────────────────────────────────────────── */

export const ATHLETE_TIERS: Tier[] = [
  {
    id: "ath_free",
    name: "Gratuit",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badge: null,
    features: [
      { kind: "section", label: "Mon profil" },
      { kind: "item", label: "Créer et gérer mon profil complet", included: true },
      { kind: "item", label: "Photo, bio, parcours académique", included: true },
      { kind: "item", label: "Vidéos faits saillants + match complet", included: true },
      { kind: "item", label: "Stats et mesures physiques", included: true },
      { kind: "item", label: "Badge vérifié par le coach", included: true },
      { kind: "item", label: "Cote globale visible aux recruteurs", included: true },
      { kind: "section", label: "Ma visibilité" },
      { kind: "item", label: "Nombre de vues ce mois / total", included: true },
      { kind: "item", label: "Nombre de recruteurs en favori", included: true },
      { kind: "item", label: "Graphique de vues par semaine", included: true },
      { kind: "item", label: "D'où viennent les recruteurs (régions)", included: true },
      { kind: "item", label: "Nom des recruteurs qui consultent", included: false },
      { kind: "item", label: "Nom des CÉGEPs qui regardent", included: false },
      { kind: "item", label: "Quels recruteurs t'ont mis en favori", included: false },
      { kind: "section", label: "Outils" },
      { kind: "item", label: "Consentement parental numérique", included: true },
      { kind: "item", label: "Statut de recrutement", included: true },
      { kind: "item", label: "Confirmation d'engagement", included: true },
    ],
    ctaLabel: "Créer mon profil gratuitement →",
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=ATHLETE",
  },
  {
    id: "ath_pro",
    name: "Pro",
    nameColor: "text-[#F59E0B]",
    monthly: 6.99,
    annual: 55,
    annualMonthlyEq: 4.58,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badge: { label: "Recommandé", bg: "bg-[#F59E0B]", fg: "text-black" },
    featuresHeader: "Tout du plan Gratuit, plus :",
    features: [
      { kind: "item", label: "Vidéo d'engagement personnalisée à l'inscription", included: true },
      { kind: "item", label: "Voir le nom des recruteurs qui consultent ton profil", included: true },
      { kind: "item", label: "Voir quels CÉGEPs s'intéressent à toi", included: true },
      { kind: "item", label: "Savoir quels recruteurs t'ont ajouté en favori (nom + CÉGEP)", included: true },
      { kind: "item", label: "Classement détaillé des vues par CÉGEP", included: true },
      { kind: "item", label: "Notifications d'intérêt avec noms", included: true },
    ],
    ctaLabel: "Passer à Pro →",
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=ATHLETE",
  },
  // Athlete All Star — coming soon, hidden for MVP.
];

/* ── Savings shown in toggle label per persona.
   All paid tiers now sit at ~33–35% off annual. Using a single flat
   percentage per persona (the component API) rounded to the tier
   average. 0 hides the caption (no paid tiers exist). ── */
export const PERSONA_SAVINGS: Record<Persona, number> = {
  recruteur: 34, // Pro 33.7%, All Star 33.6%
  coach: 34,     // Pro 34.9%, All Star 34.1%
  athlete: 33,   // Pro 33.1%
};

export function getTiersForPersona(persona: Persona): Tier[] {
  return persona === "recruteur" ? RECRUITER_TIERS
    : persona === "coach" ? COACH_TIERS
    : ATHLETE_TIERS;
}
