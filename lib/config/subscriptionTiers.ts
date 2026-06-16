/* ═══════════════════════════════════════════════════════════════
   subscriptionTiers.ts — single source of truth for the 3 roles'
   subscription tier configs (Free / Pro / All Star).

   THIS SPRINT (Tiers-A) : data-file creation only. NO surface is
   rewired here — the 6 inline consumers (athlete/coach/recruiter
   × mobile/desktop) still hold their own arrays. Tiers-B will swap
   them to consume this module.

   Source of truth = the WEB (desktop) surfaces, per the divergence
   diagnostic. CLAUDE.md pricing is obsolete. Where mobile + desktop
   shipped the same feature with different phrasing, the desktop
   wording wins ; where mobile shipped a real feature the desktop
   didn't (athlete "Intérêt mutuel des CÉGEPs", "Vidéo d'engagement
   personnalisée"), the feature is preserved.

   Rendering contract :
     - features[]    : positives. Mobile + desktop both render these.
     - freeBlocked[] : blocked items on the Free tier. Desktop renders
                       crossed-out below features[]. Mobile ignores
                       (positives-only mobile UX).
     - monthly/annual: { amount: number; display: string } so consumers
                       can both compute (annual % saved) and render the
                       canonical FR string ("9,99 $") without locale
                       formatting at the call site.
     - accentDot     : per-tier accent canonical to the existing
                       TierCard usage : Pro = gold #F59E0B, All Star =
                       red #E63946, Free = no accent (undefined).

   Coach école/ligue variant : the desktop CoachPricingSection
   parameterizes a small number of feature strings on isCivilCoach
   ("Mon École" vs "Ma Ligue"). Modeled here as a factory function
   `coachTiers(isCivil)` (not two parallel consts) so the entire tier
   shape stays single-source ; the variant is a runtime swap of two
   tokens, not a duplicated array.

   All Star tier model :
     - Athlete : no All Star (Free + Pro only).
     - Coach   : no All Star (founder dropped it this sprint).
     - Recruiter : 3 tiers (Free + Pro + All Star).
═══════════════════════════════════════════════════════════════ */

export type TierKey = "free" | "pro" | "all_star";

export interface TierPrice {
  amount: number;
  display: string;
}

export interface TierConfig {
  id: TierKey;
  name: string;
  monthly: TierPrice;
  /** Annual price ; undefined when the tier has no annual billing
   *  (Free tier). */
  annual?: TierPrice;
  /** Per-tier accent color ; undefined for Free. */
  accentDot?: string;
  /** Positive feature bullets — rendered by every surface. */
  features: string[];
  /** Blocked items shown ONLY on the Free tier ; desktop renders
   *  them crossed-out, mobile ignores them. Optional. */
  freeBlocked?: string[];
}

/* ── Accent canon ──────────────────────────────────────────────
   Mirrors the per-tier dot used on TierCard today : Pro Outfit
   gold, All Star canon red. */
const ACCENT_PRO = "#F59E0B";
const ACCENT_ALL_STAR = "#E63946";

/* ═══════════════════════════════════════════════════════════════
   ATHLETE — 2 tiers (Free, Pro). Desktop wording wins ; mobile-only
   real features ("Intérêt mutuel", "Vidéo d'engagement") preserved.
═══════════════════════════════════════════════════════════════ */

export const ATHLETE_TIERS: TierConfig[] = [
  {
    id: "free",
    name: "Gratuit",
    monthly: { amount: 0, display: "0 $" },
    features: [
      "Profil athlète + carte de joueur",
      "Évaluations + cote globale",
      "Vérification par ton coach",
    ],
    freeBlocked: [
      "CÉGEPs intéressés (anonymes seulement)",
      "Alertes temps réel",
      "Graphique de vues hebdomadaire",
      "Classement sport",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: { amount: 9.99, display: "9,99 $" },
    annual: { amount: 79, display: "79 $" },
    accentDot: ACCENT_PRO,
    features: [
      "Quels CÉGEPs consultent ton profil",
      "Intérêt mutuel des CÉGEPs",
      "Alertes temps réel",
      "Graphique vues/semaine",
      "Classement sport",
      "Badge Pro affiché aux recruteurs",
      "Vidéo d'engagement personnalisée",
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   COACH — 2 tiers (Free, Pro). No All Star per founder.
   Factory : coachTiers(isCivil) — returns the school OR civil
   variant, swapping "Mon École"/"Stats École" tokens for
   "Ma Ligue"/"Stats Ligue".
═══════════════════════════════════════════════════════════════ */

export function coachTiers(isCivil: boolean = false): TierConfig[] {
  const ecole      = isCivil ? "Ma Ligue"   : "Mon École";
  const ecoleStats = isCivil ? "Stats Ligue" : "Stats École";

  return [
    {
      id: "free",
      name: "Gratuit",
      monthly: { amount: 0, display: "0 $" },
      features: [
        "Profil coach + création d'athlètes",
        "Évaluations + vérification",
        "Messagerie avec recruteurs",
      ],
      freeBlocked: [
        ecole,
        ecoleStats,
        "Placements & suivi",
        "Ma Réputation",
        "Analytics avancés",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      monthly: { amount: 4.99, display: "4,99 $" },
      annual: { amount: 39, display: "39 $" },
      accentDot: ACCENT_PRO,
      features: [
        `${ecole} complète + ${ecoleStats} & rapports`,
        "Placements & suivi",
        "Ma Réputation + analytics de profils",
        "Alertes recruteurs en temps réel",
        "Évaluations détaillées",
      ],
    },
  ];
}

/* ═══════════════════════════════════════════════════════════════
   RECRUITER — 3 tiers (Free, Pro, All Star). Desktop authoritative.
═══════════════════════════════════════════════════════════════ */

export const RECRUITER_TIERS: TierConfig[] = [
  {
    id: "free",
    name: "Gratuit",
    monthly: { amount: 0, display: "0 $" },
    features: [
      "10 résultats par recherche",
      "Étoiles, cote globale, badge vérifié",
      "École, sport, promotion, moyenne",
    ],
    freeBlocked: [
      "Filtres avancés",
      "Identité de l'athlète (nom, photo, jersey)",
      "Messagerie coach",
      "Pipeline de recrutement",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: { amount: 19.99, display: "19,99 $" },
    annual: { amount: 159, display: "159 $" },
    accentDot: ACCENT_PRO,
    features: [
      "Filtres avancés (taille, poids, cote globale)",
      "Résultats de recherche illimités",
      "Nom, photo, numéro de jersey révélés",
      "Coordonnées du coach (email, tel)",
      "Messagerie coach (10/mois) + templates",
      "Pipeline de recrutement (50 athlètes)",
      "Coach reviews — lire et rédiger",
    ],
  },
  {
    id: "all_star",
    name: "All Star",
    monthly: { amount: 29.99, display: "29,99 $" },
    annual: { amount: 239, display: "239 $" },
    accentDot: ACCENT_ALL_STAR,
    features: [
      "Évaluations détaillées (11 critères)",
      "Statut de recrutement global",
      "Voir qui a consulté l'athlète",
      "Messagerie illimitée",
      "Pipeline illimité + analytics",
      "Listes de prospects custom",
      "Signaux de compétition",
      "Gestion CÉGEP",
    ],
  },
];
