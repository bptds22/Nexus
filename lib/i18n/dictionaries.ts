/**
 * Marketing dictionaries — single source of truth for FR/EN
 * strings on the public-facing pages. Same shape as the other
 * lib/config/ singletons (pricing.ts, civilVocab.ts) : a
 * Dictionary interface + per-language objects typed against it
 * so TypeScript flags any key added on one side but missing on
 * the other.
 *
 * Top-level keys are scoped: `home` (homepage only),
 * `nav` (MarketingNav — global chrome), `footer` (marketing
 * footer — global chrome). Anything global is hoisted out of
 * `home` so future marketing pages can consume the same keys
 * without going through the homepage namespace.
 *
 * Translation discipline : any EN string where the translation
 * isn't confident is left as the FR value with a trailing
 * `// TODO-EN` comment so it's grep-findable.
 *
 * Note on `as const` : we deliberately do NOT use `as const`
 * here. With literal typing, FR and EN become two unrelated
 * types (each leaf is its own narrow string literal), and
 * dictionaries[lang] can't be unified into a single `Dictionary`
 * type for the consumer. The Dictionary interface preserves
 * autocomplete + drift detection without the literal narrowing.
 */

import type { Lang } from "./LanguageContext";

export interface Dictionary {
  home: {
    hero: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      ledeStrong: string;
      lede: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    card: {
      sportLabel: string;
      positionLabel: string;
      numberLabel: string;
      schoolName: string;
      location: string;
      promotion: string;
    };
  };
  nav: {
    discover: string;
    forCoaches: string;
    forRecruiters: string;
    forAthletes: string;
    howItWorks: string;
    pricing: string;
    roadmap: string;
    about: string;
    login: string;
    signup: string;
    openMenu: string;
    closeMenu: string;
  };
  footer: {
    tagline: string;
    privacy: string;
    terms: string;
    contact: string;
    copyright: string;
  };
}

export const dictionaries: Record<Lang, Dictionary> = {
  fr: {
    home: {
      hero: {
        eyebrow: "Plateforme officielle · Québec 2026",
        titleLine1: "Fais-toi voir.",
        titleLine2: "Fais-toi recruter.",
        ledeStrong: "Les recruteurs des CÉGEP cherchent des athlètes comme toi.",
        lede: "Assure-toi qu'ils te trouvent.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next' (FR + EN)
        ctaPrimary: "Sois le nex",
        ctaSecondary: "Voir comment ça marche",
      },
      card: {
        sportLabel: "Sport",
        positionLabel: "Pos",
        numberLabel: "No.",
        schoolName: "École secondaire Saint-Jean-Eudes",
        location: "Québec, QC",
        promotion: "Promotion 2026",
      },
    },
    nav: {
      discover: "Découvrir Nexus",
      forCoaches: "Pour les coachs",
      forRecruiters: "Pour les recruteurs",
      forAthletes: "Pour les étudiants-athlètes",
      howItWorks: "Comment ça marche",
      pricing: "Tarifs",
      roadmap: "Roadmap",
      about: "À propos",
      login: "Connexion",
      signup: "S'inscrire",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu",
    },
    footer: {
      tagline: "Construit pour les étudiants-athlètes québécois",
      privacy: "Confidentialité",
      terms: "Conditions",
      contact: "Contact",
      copyright: "© 2026 Nexus",
    },
  },
  en: {
    home: {
      hero: {
        eyebrow: "Official platform · Québec 2026",
        titleLine1: "Get seen.",
        titleLine2: "Get recruited.",
        ledeStrong: "CÉGEP recruiters are looking for athletes like you.",
        lede: "Make sure they find you.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next' (FR + EN)
        ctaPrimary: "Be the nex",
        ctaSecondary: "See how it works",
      },
      card: {
        sportLabel: "Sport",
        positionLabel: "Pos",
        numberLabel: "No.",
        // Proper noun — Québec school's French name kept as-is in EN marketing.
        schoolName: "École secondaire Saint-Jean-Eudes", // TODO-EN — confirm whether marketing wants this anglicized
        location: "Québec, QC",
        promotion: "Class of 2026",
      },
    },
    nav: {
      discover: "Discover Nexus",
      forCoaches: "For coaches",
      forRecruiters: "For recruiters",
      forAthletes: "For student-athletes",
      howItWorks: "How it works",
      pricing: "Pricing",
      roadmap: "Roadmap",
      about: "About",
      login: "Log in",
      signup: "Sign up",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },
    footer: {
      tagline: "Built for Québec's student-athletes",
      privacy: "Privacy",
      terms: "Terms",
      contact: "Contact",
      copyright: "© 2026 Nexus",
    },
  },
};
