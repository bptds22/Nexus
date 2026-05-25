/**
 * Marketing dictionaries — single source of truth for FR/EN
 * strings on the public-facing pages. Same shape as the other
 * lib/config/ singletons (pricing.ts, civilVocab.ts) : a
 * Dictionary interface + per-language objects typed against it
 * so TypeScript flags any key added on one side but missing on
 * the other.
 *
 * Seeded with the strings extracted from app/page.tsx (the root
 * marketing homepage — first translated surface). Other marketing
 * pages will land here as they're migrated, one PR at a time.
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
    footer: {
      tagline: string;
      privacy: string;
      terms: string;
      contact: string;
      copyright: string;
    };
  };
}

export const dictionaries: Record<Lang, Dictionary> = {
  fr: {
    home: {
      hero: {
        eyebrow: "Plateforme officielle · Québec 2026",
        titleLine1: "Fais-toi voir.",
        titleLine2: "Fais-toi recruter.",
        ledeStrong: "La plateforme #1 de recrutement d'athlètes au Québec.",
        lede: "Connecte les athlètes du secondaire aux programmes sport-études des CÉGEP.",
        ctaPrimary: "Sois le next",
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
      footer: {
        tagline: "Construit pour les étudiants-athlètes québécois",
        privacy: "Confidentialité",
        terms: "Conditions",
        contact: "Contact",
        copyright: "© 2026 Nexus — Propulsé par",
      },
    },
  },
  en: {
    home: {
      hero: {
        eyebrow: "Official platform · Québec 2026",
        titleLine1: "Get seen.",
        titleLine2: "Get recruited.",
        ledeStrong: "Québec's #1 athlete recruitment platform.",
        lede: "Connecting high-school athletes with sport-études programs at CÉGEPs.",
        // Per CLAUDE.md the brand tagline is "Be the Next" (NEXT embedded in NEXUS).
        ctaPrimary: "Be the next",
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
      footer: {
        tagline: "Built for Québec's student-athletes",
        privacy: "Privacy",
        terms: "Terms",
        contact: "Contact",
        copyright: "© 2026 Nexus — Powered by",
      },
    },
  },
};
