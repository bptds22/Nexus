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

/**
 * PRÉSENTATION ET PRIX — aucun texte visible.
 *
 * Tous les libellés (nom du tier, pastille, en-tête, features, CTA) vivent
 * dans lib/i18n/dictionaries.ts sous `pricing.tiers[id]`, parce qu'ils
 * doivent exister en FR et en EN. Ce qui reste ici est ce qui ne se traduit
 * pas : identifiant, montants, couleurs, bordures, destination du CTA.
 *
 * Un tier sans entrée de traduction correspondante n'est pas rendu — voir
 * la garde dans app/tarifs/page.tsx.
 */
export interface Tier {
  id: string;
  nameColor: string;
  monthly: number;
  annual: number;
  annualMonthlyEq: number | null;
  border: string;
  glow: string;
  /** Couleurs de la pastille ; son libellé est dans l'i18n. */
  badgeStyle: { bg: string; fg: string } | null;
  ctaClass: string;
  ctaHref: string;
  /** Tier visible mais pas encore achetable : prix masqué, paiement inactif. */
  comingSoon?: boolean;
}

/** Textes d'un tier, une occurrence par langue dans le dictionnaire. */
export interface TierCopy {
  name: string;
  badgeLabel?: string;
  featuresHeader?: string;
  features: FeatureRow[];
  ctaLabel: string;
}

/* ── RECRUITER ──────────────────────────────────────────────── */

export const RECRUITER_TIERS: Tier[] = [
  {
    id: "rec_free",
    nameColor: "text-[#9CA3AF]",
    monthly: 0,
    annual: 0,
    annualMonthlyEq: null,
    border: "border border-white/10",
    glow: "",
    badgeStyle: null,
    ctaClass: "border border-white/30 text-white hover:bg-white/5",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_pro",
    nameColor: "text-[#F59E0B]",
    monthly: 19.99,
    annual: 159,
    annualMonthlyEq: 13.25,
    border: "border-2 border-[#F59E0B]",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.15)]",
    badgeStyle: { bg: "bg-[#F59E0B]", fg: "text-black" },
    ctaClass: "bg-[#F59E0B] text-black hover:bg-[#FBBF24]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
  {
    id: "rec_allstar",
    nameColor: "text-[#E63946]",
    monthly: 29.99,
    annual: 239,
    annualMonthlyEq: 19.92,
    border: "border-2 border-[#E63946]",
    glow: "shadow-[0_0_24px_rgba(230,57,70,0.1)]",
    badgeStyle: null,
    ctaClass: "bg-[#E63946] text-white hover:bg-[#D42B22]",
    ctaHref: "/inscription?role=RECRUTEUR",
  },
];

/* ── Textes FR des tiers ─────────────────────────────────────
   Source UNIQUE du francais. Trois consommateurs :
     - lib/i18n/dictionaries.ts  -> bloc FR de pricing.tiers
     - components/subscription/SubscriptionManager.tsx
     - components/ui/UpgradeModal.tsx
   Les deux derniers sont des surfaces applicatives, en francais
   seulement : elles lisent cette constante plutot que le dictionnaire,
   pour ne pas embarquer tout le contenu marketing dans les portails.
   L'anglais vit dans dictionaries.ts. ── */
export const TIER_COPY_FR: Record<string, TierCopy> = {
  rec_free: {
    name: "Gratuit",
    ctaLabel: "Commencer gratuitement →",
    features: [
      { kind: "item", label: "Recherche par sport, région, année, école, position", included: true },
      { kind: "item", label: "Étoiles, cote globale, badge vérifié", included: true },
      { kind: "item", label: "École, sport, promotion, moyenne", included: true },
      { kind: "item", label: "Taille / poids", included: true },
      { kind: "item", label: "Évaluations simplifiées (3 groupes)", included: true },
      { kind: "item", label: "Votre page CÉGEP : une page personnalisable pour présenter votre programme aux athlètes", included: true },
      { kind: "item", label: "Votre page d'équipe : une page par équipe, visible de tous les athlètes", included: true },
      { kind: "item", label: "Filtres avancés", included: false },
      { kind: "item", label: "Identité de l'athlète (nom, photo, numéro)", included: false },
      { kind: "item", label: "Vidéos et parcours académique", included: false },
      { kind: "item", label: "Messagerie", included: false },
      { kind: "item", label: "Pipeline de recrutement", included: false },
    ],
  },
  rec_pro: {
    name: "Pro",
    badgeLabel: "Populaire",
    featuresHeader: "Tout du plan Gratuit, plus :",
    ctaLabel: "Passer à Pro →",
    features: [
      { kind: "section", label: "Recherche et profils" },
      { kind: "item", label: "Filtres avancés (taille, poids, cote globale)", included: true },
      { kind: "item", label: "Résultats de recherche illimités", included: true },
      { kind: "item", label: "Nom, photo et numéro de chandail révélés", included: true },
      { kind: "item", label: "Vidéos faits saillants", included: true },
      { kind: "item", label: "Parcours académique complet", included: true },
      { kind: "item", label: "Commentaires de l'entraîneur", included: true },
      { kind: "item", label: "Évaluations détaillées — 11 critères", included: true },
      { kind: "section", label: "Communication" },
      { kind: "item", label: "Coordonnées de l'entraîneur", included: true },
      { kind: "item", label: "Messagerie avec l'entraîneur et l'athlète, sans limite, dans le respect automatique des périodes de silence RSEQ", included: true },
      { kind: "item", label: "Réponses des entraîneurs", included: true },
      { kind: "item", label: "Auto-intro et modèles de message", included: true },
      { kind: "section", label: "Suivi et pipeline" },
      { kind: "item", label: "Favoris illimités", included: true },
      { kind: "item", label: "Pipeline de recrutement", included: true },
      { kind: "item", label: "Statut de recrutement global", included: true },
      { kind: "item", label: "Analytique du pipeline", included: true },
      { kind: "item", label: "Listes de prospects personnalisées", included: true },
      { kind: "item", label: "Fil d'activité", included: true },
      { kind: "section", label: "Planification" },
      { kind: "item", label: "Calendrier optimisé : les calendriers RSEQ et des ligues civiles réunis, croisés avec vos cibles de recrutement — voyez d'un coup d'œil les matchs où plusieurs de vos athlètes suivis jouent en même temps", included: true },
    ],
  },
  rec_allstar: {
    name: "All Star",
    featuresHeader: "Tout du plan Pro — pour les établissements qui gèrent une équipe de recrutement :",
    ctaLabel: "Devenir All Star →",
    features: [
      { kind: "item", label: "Tableau de bord de l'établissement : pipeline par sport, provenance des recrues, activité de votre équipe de recrutement", included: true },
      { kind: "item", label: "Statistiques de recrutement : entonnoir par étape, résultats par sport, rendement par recruteur, athlètes les plus ciblés", included: true },
      { kind: "item", label: "Recrues confirmées : engagements et lettres signées, avec l'école d'origine et le recruteur assigné", included: true },
      { kind: "item", label: "Gestion de vos recruteurs : activité, favoris, messages envoyés, recrues confirmées par personne", included: true },
      { kind: "item", label: "Réassignation d'athlètes entre recruteurs, sans perte des statuts de pipeline", included: true },
    ],
  }
};

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
