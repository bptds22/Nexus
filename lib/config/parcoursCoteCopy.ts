/* ═══════════════════════════════════════════════════════════════
   parcoursCoteCopy.ts — single source of truth for the Mon Parcours
   mobile "Ta Cote" + "Langue commune" carousel screens (B-3b).

   Audience = the ATHLETE (tutoiement, motivational register). This
   is INTENTIONALLY separate from lib/i18n/dictionaries.ts stars.*
   (the public /comment-ca-marche page) — that surface is coach-
   facing canon definitions ; this one is athlete-facing progression
   copy. The two diverge by design and must NOT be unified.

   Consumed by :
     - components/shared/MonParcoursMobile.tsx (B-3b carousel screens
       2 + 3 — Ta Cote + Langue commune).

   Shape :
     - rating[0..5] : per-star-count copy block for the Ta Cote hero
       card. The 0 key handles "not yet evaluated" (cote null on
       the athlete row).
     - rungs[]      : 5 strings ordered index 0 = 5★ → index 4 = 1★
       (same ordering canon as stars.definitions). Consumed by the
       Langue commune screen ; the athlete's current rung is
       computed as `5 - coteGlobale`.
     - langueIntro  : the lede sentence above the rungs list on the
       Langue commune card.
═══════════════════════════════════════════════════════════════ */

export interface CoteRatingCopy {
  /** Big bold line — the verdict. */
  hero: string;
  /** Short supporting line right under the hero. */
  sub: string;
  /** Longer body paragraph — fills the screen's empty space with
   *  motivational/contextual detail (B-3b-2a addition). */
  detail: string;
  /** CTA block primary line (non-clickable per founder). */
  cta: string;
}

export const MON_PARCOURS_COTE_COPY = {
  rating: {
    5: {
      hero: "Tu es un prospect D1.",
      sub: "Le plus haut niveau collégial est à ta portée. Continue de performer.",
      detail:
        "Ton coach voit en toi un des meilleurs profils de ta catégorie. C'est rare, et c'est mérité. Mais le talent ouvre la porte — c'est le travail qui te garde dedans. Continue de soigner ton conditionnement, ton académique et ta constance : les recruteurs D1 regardent autant la personne que l'athlète. Tu es exactement là où il faut. Garde le cap.",
      cta: "Parle à ton coach pour viser encore plus haut",
    },
    4: {
      hero: "Potentiel partant D2, et le D1 à portée.",
      sub: "Le développement d'un athlète, ça se construit. Avec les bons entraîneurs et du travail, ça bouge.",
      detail:
        "Ton coach te voit comme un solide partant au collégial, avec une vraie marge pour viser plus haut. Ce qui fait la différence à partir d'ici, c'est les détails : la vidéo qui montre tes meilleurs jeux, un académique sans faille, et de la constance d'un match à l'autre. Parle à ton coach des points précis à travailler — chaque cran compte.",
      cta: "Parle à ton coach pour progresser",
    },
    3: {
      hero: "Potentiel partant D3, le D2 dans ta mire.",
      sub: "Le développement d'un athlète, ça se construit. Avec les bons entraîneurs et du travail, ça bouge.",
      detail:
        "Tu as déjà ta place au collégial, et le D2 est un objectif réaliste si tu continues de progresser. C'est souvent ici que le travail paie le plus vite : un été d'entraînement sérieux, plus de minutes de jeu, et une cote qui grimpe. Demande à ton coach sur quoi concentrer tes efforts — tu es dans une phase où tout peut bouger.",
      cta: "Parle à ton coach pour progresser",
    },
    2: {
      hero: "Le D3 est à ta portée.",
      sub: "Une étoile, c'est un point de départ — pas une étiquette. Avec les bons entraîneurs et du travail, ça bouge.",
      detail:
        "Tu es au début de ton parcours, et c'est une position normale — la majorité des athlètes passent par là. Une cote, ce n'est pas une étiquette, c'est une photo du moment. Avec un bon plan d'entraînement et l'appui de ton coach, ça change vite. Concentre-toi sur les bases, sois assidu, et reviens voir ta progression dans quelques mois.",
      cta: "Parle à ton coach pour progresser",
    },
    1: {
      hero: "Tu commences — déjà à la bonne place.",
      sub: "Une étoile, c'est un point de départ — pas une étiquette. Avec les bons entraîneurs et du travail, ça bouge.",
      detail:
        "Le simple fait d'être sur Nexus, avec un profil structuré, te met déjà en avant. Tout le monde commence quelque part, et le développement d'un athlète, ça se construit une étape à la fois. Ton coach et Nexus sont là pour t'aider à progresser — pas pour te juger. Fixe-toi un objectif concret avec ton coach, mets-y le travail, et laisse ta cote raconter ta progression.",
      cta: "Parle à ton coach pour progresser",
    },
    0: {
      hero: "Pas encore évalué.",
      sub: "Ton coach n'a pas encore déposé ta cote. C'est la prochaine étape.",
      detail:
        "Ton coach n'a pas encore déposé ta cote. C'est la prochaine étape de ton parcours — une fois évalué, tu verras ici exactement où tu te situes et comment progresser. Parle-en à ton coach.",
      cta: "Parle à ton coach pour démarrer",
    },
  } as Record<0 | 1 | 2 | 3 | 4 | 5, CoteRatingCopy>,

  rungs: [
    "Potentiel partant D1 dès ton entrée au CÉGEP.",   // 5★ — index 0
    "Potentiel partant D2, et le D1 à portée.",         // 4★ — index 1
    "Potentiel partant D3, le D2 dans ta mire.",        // 3★ — index 2
    "Le D3 est à ta portée avec du travail.",           // 2★ — index 3
    "Tu commences — déjà à la bonne place.",            // 1★ — index 4
  ] as const,

  langueIntro:
    "Une étoile sur Nexus = la même étoile partout. Un 5★ de Sherbrooke vaut un 5★ de Gatineau. C'est ça, la langue commune.",

  /** Short closing line rendered under the rungs on the Langue commune
   *  screen (B-3b-2a addition). Reinforces "même étoile partout". */
  langueClosing:
    "Peu importe où tu joues, ta cote raconte la même histoire.",
} as const;
