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
/* Les textes des tiers vivent ici et non dans pricing.ts : ils doivent
   exister en FR et en EN. pricing.ts n'y garde que le non-traduisible
   (montants, couleurs, identifiants). Import de TYPE uniquement — aucun
   coût à l'exécution, et pricing.ts n'importe rien d'ici : pas de cycle. */
import { TIER_COPY_FR, type TierCopy } from "@/lib/config/pricing";

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
    /** Accueil v2 (BP 2026-10-20) : les sections sous le héros et la bannière partenaires. */
    sections: {
      quoi: { eyebrow: string; title1: string; title2: string; intro: string; points: { title: string; body: string }[] };
      recus: {
        eyebrow: string; title1: string; title2: string; receiptNo: string; total: string;
        avant: { label: string; items: string[]; total: string };
        avec: { label: string; items: string[]; total: string };
      };
      personas: { eyebrow: string; title1: string; title2: string; iAm: string; items: { role: string; title: string; points: string[]; cta: string; more: string }[] };
      etapes: { eyebrow: string; title: string; items: { title: string; body: string }[] };
      recruteurs: { eyebrow: string; title1: string; title2: string; cta: string };
      final: { eyebrow: string; title1: string; title2: string; appStoreSmall: string; playSmall: string; codeLead: string; code: string };
    };
  };
  nav: {
    discover: string;
    forCoaches: string;
    forRecruiters: string;
    forAthletes: string;
    forParents: string;
    howItWorks: string;
    pricing: string;
    help: string;
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
  /** /comment-ca-marche v2 (BP 2026-10-20). `stars.definitions` est AUSSI lu par la
      modale de changement de cote du coach (CoteChangeConfirmContent) : ne pas déplacer. */
  howItWorks: {
    hero: { eyebrow: string; title1: string; title2: string; lede: string; cta: string; ctaSecondary: string };
    why: { eyebrow: string; title1: string; title2: string; paragraphs: string[] };
    etapes: { eyebrow: string; title1: string; title2: string; items: { kicker: string; title: string; body: string }[] };
    verification: {
      eyebrow: string; title1: string; title2: string; lede: string;
      grayTitle: string; grayBody: string; blueTitle: string; blueBody: string;
      perishableTitle: string; perishableBody: string;
    };
    stars: {
      eyebrow: string; title1: string; title2: string; lede: string;
      definitions: string[];
      detail: string;
      question: { title: string; body: string };
    };
    distinctions: { eyebrow: string; title1: string; title2: string; lede: string; labels: string[] };
    communication: { eyebrow: string; title1: string; title2: string; paragraphs: string[] };
    engagement: { eyebrow: string; title1: string; title2: string; items: { title: string; body: string }[] };
    conviction: { eyebrow: string; title1: string; title2: string; paragraphs: string[]; closing: string };
    personas: { eyebrow: string; title1: string; title2: string; items: { question: string; line: string; label: string }[] };
  };
  /** Page coach v2 (BP 2026-10-20). Tutoiement, comme avant. */
  coachLanding: {
    hero: { eyebrow: string; title1: string; title2: string; lede: string; ledeSmall: string; cta: string; ctaSecondary: string; imageAlt: string };
    /** « La discussion qui revient » : les questions de chaque recruteur, répondues une fois par le profil. */
    discussion: { eyebrow: string; title1: string; title2: string; lede: string; items: { q: string; a: string }[]; note: string; imageAlt: string };
    etapes: { eyebrow: string; title1: string; title2: string; items: { title: string; body: string }[] };
    evaluation: { eyebrow: string; title1: string; title2: string; points: string[] };
    outils: { eyebrow: string; title1: string; title2: string; items: { title: string; body: string; note?: string }[] };
    contact: { eyebrow: string; title1: string; title2: string; body: string };
    cta: { eyebrow: string; title1: string; title2: string; body: string; button: string; trustFree: string; noPlayersPrefix: string; noPlayersLink: string };
  };
  recruiterLanding: {
    /** Page recruteur v2 (BP 2026-10-20) : héros + une section par fonction, avec capture. */
    v2: {
      hero: { eyebrow: string; title1: string; title2: string; lede: string; cta: string; ctaSecondary: string };
      fonctions: { eyebrow: string; title1: string; title2: string; items: { kicker: string; title: string; points: string[]; alt: string }[] };
    };
    hero: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      titleLine3: string;
      lede: string;
      ledeSmall: string;
      cta: string;
      ctaSubtitle: string;
      videoBadge: string;
      videoCaption: string;
      videoComing: string;
      videoAriaLabel: string;
    };
    stats: { value: string; desc: string }[];
    problem: {
      eyebrow: string;
      title: string;
      lede: string;
      statusQuoEyebrow: string;
      statusQuoTitle: string;
      reinventedEyebrow: string;
      reinventedTitlePrefix: string;
      reinventedTitleBrand: string;
      pains: string[];
      solutions: string[];
    };
    pillars: {
      eyebrow: string;
      title: string;
      items: { title: string; body: string }[];
    };
    verification: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      p3: string;
      verifiedPill: string;
      verifiedByLabel: string;
      verifiedByName: string;
      verifiedBySchool: string;
      quote: string;
      badgeCaptain: string;
      badgeAllstar: string;
      badgeLeader: string;
    };
    reliability: {
      eyebrow: string;
      title: string;
      lede: string;
      subTitle: string;
      p1: string;
      p2: string;
      p3: string;
      coachName: string;
      coachSchool: string;
      reliabilityCaption: string;
      precisionLabel: string;
      placedLabel: string;
      responseLabel: string;
      pillRecommended: string;
      pillFastResponse: string;
      pillPlacer: string;
      lastEvaluated: string;
    };
    intelligence: {
      eyebrow: string;
      title: string;
      p1: string;
      p2Pre: string;
      p2YourStatus: string;
      p2Mid: string;
      p2GlobalStatus: string;
      p2Post: string;
      p3: string;
      cardCategory: string;
      viewsLabel: string;
      favoritesLabel: string;
      myStatusLabel: string;
      myStatusValue: string;
      recruitmentLabel: string;
      recruitmentValue: string;
      annotationLead: string;
      annotationBody: string;
      cardAlt: string;
    };
    pricing: {
      eyebrow: string;
      title: string;
      lede: string;
      tiers: {
        name: string;
        price: string;
        priceSuffix?: string;
        subtitle: string;
        subheader?: string;
        bullets: string[];
        badge?: string;
        buttonLabel: string;
      }[];
    };
    faq: {
      eyebrow: string;
      title: string;
      items: { q: string; a: string }[];
    };
    cta: {
      title1: string;
      title2: string;
      title3: string;
      body: string;
      button: string;
      footer: string;
    };
  };
  /* Page vitrine « Pour les parents ». Vouvoiement en FR — écart ASSUMÉ
     avec le tutoiement des pages coach/athlète : c'est le registre juste
     pour cette audience. En EN, « you » est neutre, rien à trancher. */
  parentLanding: {
    hero: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      lede: string;
      ledeSmall: string;
      cta: string;
      mockup: {
        label: string;
        activityTitle: string;
        activityCaption: string;
        consentTitle: string;
        consentValue: string;
        notificationTitle: string;
        notificationBody: string;
      };
    };
    howItWorks: {
      eyebrow: string;
      title: string;
      steps: { num: string; role: string; title: string; body: string }[];
    };
    whatYouSee: {
      eyebrow: string;
      title: string;
      tag: string;
      items: { title: string; body: string }[];
    };
    whoDecides: {
      eyebrow: string;
      title: string;
      checks: string[];
      calloutTitle: string;
      calloutBody: string;
    };
    faq: {
      eyebrow: string;
      title: string;
      items: { q: string; a: string }[];
    };
    finalCta: {
      title: string;
      line: string;
      cta: string;
      bullets: string[];
    };
  };
  /** Page athlète v2 (BP 2026-10-20) : héros + une section par fonction avec capture (données fictives). Tutoiement. */
  athleteLanding: {
    hero: { eyebrow: string; title1: string; title2: string; lede: string; cta: string; ctaSecondary: string; imageAlt: string };
    fonctions: { eyebrow: string; title1: string; title2: string; items: { kicker: string; title: string; points: string[]; alt: string }[] };
    etapes: { eyebrow: string; title: string; items: { title: string; body: string }[] };
    gratuit: { eyebrow: string; title1: string; title2: string; body: string; parentsLead: string; parentsLink: string };
    final: { eyebrow: string; title1: string; title2: string; appStoreSmall: string; playSmall: string; web: string; codeLead: string; code: string };
  };
  pricing: {
    hero: {
      eyebrow: string;
      title1: string;
      title2: string;
      lede: string;
    };
    personaToggle: {
      recruiter: string;
      coach: string;
      athlete: string;
    };
    billingToggle: {
      monthly: string;
      annual: string;
      saveLabel: string;
    };
    card: {
      forever: string;
      fromPrefix: string;
      fromSuffixAnnual: string;
      orPrefix: string;
      orSuffixMonthly: string;
      perYear: string;
      perMonth: string;
    };
    cegepBanner: {
      title: string;
      body: string;
      cta: string;
    };
    whyPro: {
      eyebrow: string;
      title: string;
      lede: string;
    };
    /* Personas sans aucun tier payant (athlète, coach). Remplace les
       cartes par un encadré mission + la liste de ce qui est inclus.
       Le jour où une adhésion revient, il suffit de repeupler le tableau
       de tiers dans lib/config/pricing.ts : le rendu rebascule seul. */
    freePersona: {
      missionEyebrow: string;
      missionTitle: string;
      /* Une mission par persona : le coach lit un texte écrit de SON point de
         vue (vouvoiement), l'athlète le sien (tutoiement). Un texte unique
         forçait l'entraîneur à lire un propos qui ne s'adressait pas à lui. */
      athleteMissionBody: string;
      coachMissionBody: string;
      checklistTitle: string;
      athleteItems: string[];
      coachItems: string[];
    };
    trust: {
      quebecHost: string;
      loi25: string;
      verifiedProfiles: string;
    };
    /* Textes des cartes de tiers, indexés par `Tier.id`. Un tier dont
       l'identifiant est absent d'ici n'est simplement pas rendu. */
    tiers: Record<string, TierCopy>;
  };
  roadmap: {
    hero: {
      eyebrow: string;
      title: string;
      lede: string;
    };
    phases: { code: string; label: string; items: { title: string; body: string }[] }[];
    bottom: {
      title: string;
      body: string;
      cta: string;
    };
  };
  about: {
    hero: {
      eyebrow: string;
      title1: string;
      title2: string;
      lede: string;
    };
    founders: {
      eyebrow: string;
      title1: string;
      title2: string;
      bp: {
        name: string;
        role: string;
        bio: string;
        photoAlt: string;
      };
      chuck: {
        name: string;
        role: string;
        bio: string;
        photoAlt: string;
      };
    };
    /** Faits vérifiés : hébergement (content/legal/confidentialite.ts), RPRP, 14 ans et volet parental (content/aide/sections.ts). */
    engagements: {
      eyebrow: string;
      title1: string;
      title2: string;
      lede: string;
      items: { title: string; body: string }[];
      privacyLink: string;
    };
    contact: {
      eyebrow: string;
      title1: string;
      title2: string;
      lede: string;
      labelName: string;
      placeholderName: string;
      labelEmail: string;
      placeholderEmail: string;
      labelSubject: string;
      labelMessage: string;
      placeholderMessage: string;
      submit: string;
      subjects: {
        general: string;
        partnership: string;
        support: string;
        media: string;
        other: string;
      };
      submitting: string;
      toast: string;
      toastError: string;
    };
  };
  auth: {
    eyebrow: string;
    titleLogin: string;
    titleSignup: string;
    subtitleLogin: string;
    subtitleSignup: string;
    tabs: { login: string; signup: string };
    google: string;
    orEmail: string;
    referralBanner: string;
    toasts: { socialPhase2: string; forgotPhase2: string };
    signup: {
      choice: {
        title: string;
        lede: string;
        cta: string;
        notAthlete: string;
        coach: { title: string; sub: string };
        civilLeague: { title: string; sub: string };
        recruiter: { title: string; sub: string };
      };
      form: {
        back: string;
        heading: string;
        headingSub: string;
        labels: {
          firstName: string;
          lastName: string;
          email: string;
          password: string;
          confirm: string;
          context: string;
          sport: string;
        };
        placeholders: {
          firstName: string;
          lastName: string;
          email: string;
          password: string;
        };
        passwordHint: string;
        passwordMismatch: string;
        context: {
          scolaire: { title: string; sub: string };
          civile: { title: string; sub: string };
        };
        consent: {
          policy: { before: string; privacy: string; and: string; terms: string; after: string };
          data: { before: string; link: string; after: string };
          marketing: { before: string; link: string; after: string; optional: string };
          error: string;
        };
        submit: string;
      };
      switchToLogin: { prompt: string; cta: string };
    };
    login: {
      forgot: string;
      loading: string;
      submit: string;
      switchToSignup: { prompt: string; cta: string };
      placeholderEmail: string;
      placeholderPassword: string;
    };
  };
}

export const dictionaries: Record<Lang, Dictionary> = {
  fr: {
    home: {
      hero: {
        eyebrow: "Plateforme officielle · Québec 2026",
        titleLine1: "Nexus te met dans la game.",
        titleLine2: "À toi de jouer",
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
      sections: {
        quoi: {
          eyebrow: "C'est quoi Nexus ?",
          title1: "Ta carte. Ton profil.",
          title2: "Tous les cégeps.",
          intro: "Nexus réunit ta carte d'athlète et ton profil complet au même endroit, pour que les recruteurs des cégeps te trouvent, peu importe ton école.",
          points: [
            { title: "Fais-toi voir", body: "Ta carte, tes étoiles, tes badges." },
            { title: "Tout au même endroit", body: "Pour les recruteurs : faits saillants, tests physiques, historique d'équipes, scolaire." },
            { title: "Ton prochain niveau", body: "Le depth chart (postes à combler), les pages des cégeps, le choix du programme." },
            { title: "En quelques étapes", body: "Apple ou Google, ton code d'équipe, et tout se remplit." },
            { title: "Et plus", body: "Carte des cégeps, liste des écoles, ambassadeurs, transferts." },
          ],
        },
        recus: {
          eyebrow: "Les reçus",
          title1: "Avant.",
          title2: "Avec Nexus.",
          receiptNo: "Reçu nº",
          total: "Total",
          avant: {
            label: "Avant",
            items: ["Courriels aux recruteurs, un par un", "Un CV en PDF que personne n'ouvre", "Des liens vidéo éparpillés", "Des stats dans un texto", "Les petites écoles, invisibles"],
            total: "« On verra »",
          },
          avec: {
            label: "Avec Nexus",
            items: ["Une carte de joueur", "Un profil standard, toujours le même", "Vidéos, tests et scolaire au même endroit", "Évalué par ton coach", "Visible pour tous les cégeps"],
            total: "Un seul lien",
          },
        },
        personas: {
          eyebrow: "Choisis ton rôle",
          title1: "Nexus pour toi.",
          title2: "Choisis ton côté.",
          iAm: "Je suis",
          items: [
            { role: "Athlète", title: "Fais-toi voir.", points: ["Ta carte de joueur et ton profil complet", "Ton coach vérifie ton profil et t'évalue", "Les recruteurs de tous les cégeps te trouvent"], cta: "Crée ton profil", more: "En savoir plus" },
            { role: "Coach", title: "Mets tes joueurs en vitrine.", points: ["Crée ton équipe et invite tes joueurs par courriel", "Vérifie et évalue leurs profils", "Tu restes le point de contact des recruteurs"], cta: "Inscris ton équipe", more: "En savoir plus" },
            { role: "Recruteur", title: "Tout ton recrutement, au même endroit.", points: ["Recherche et filtres sur tous les athlètes", "Ton processus, tes notes, tes listes", "En direct pendant le match, même sans réseau"], cta: "Demander une démo", more: "En savoir plus" },
          ],
        },
        etapes: {
          eyebrow: "Comment ça marche",
          title: "3 étapes.",
          items: [
            { title: "Inscris-toi en quelques minutes", body: "Stats, position, vidéo, parcours : remplis ce que tu peux, peaufine plus tard." },
            { title: "Ton coach te vérifie", body: "Il valide tes infos et ajoute son évaluation. Le crochet bleu fait monter ton profil." },
            { title: "Les recruteurs te trouvent", body: "Ton profil apparaît dans leurs recherches. Ils peuvent te contacter, ou contacter ton coach." },
          ],
        },
        recruteurs: {
          eyebrow: "Pour les recruteurs et les écoles",
          title1: "Tout ton recrutement,",
          title2: "au même endroit.",
          cta: "Voir la page recruteur",
        },
        final: {
          eyebrow: "Sois le nex",
          title1: "Télécharge Nexus.",
          title2: "À toi de jouer.",
          appStoreSmall: "Télécharger dans",
          playSmall: "Disponible sur",
          codeLead: "Pas encore de code d'équipe ?",
          code: "Demande ton code à ton coach.",
        },
      },
    },
    nav: {
      discover: "Découvrir Nexus",
      forCoaches: "Pour les coachs",
      forRecruiters: "Pour les recruteurs",
      forAthletes: "Pour les étudiants-athlètes",
      forParents: "Pour les parents",
      howItWorks: "Comment ça marche",
      pricing: "Tarifs",
      help: "Aide",
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
    howItWorks: {
      hero: {
        eyebrow: "Notre mission",
        title1: "Le talent n'a pas",
        title2: "de code postal.",
        lede: "Quand j'étais au secondaire, chaque joueur de football de mon école allait au même CÉGEP. C'était juste comme ça. Si je n'avais pas fait des camps et rencontré d'autres personnes, je n'aurais jamais vécu les trois meilleures années de ma vie ailleurs. Nexus existe pour que ce genre de rencontre ne dépende pas de la chance.",
        cta: "Crée ton profil",
        ctaSecondary: "Voir comment ça marche",
      },
      why: {
        eyebrow: "Pourquoi Nexus existe",
        title1: "Le recrutement",
        title2: "roule sur les réseaux.",
        paragraphs: [
          "Les recruteurs des cégeps connaissent les entraîneurs des grosses écoles. Ils vont aux gros matchs. Ils appellent les mêmes numéros, année après année. Ça marche — pour les athlètes qui sont dans le bon cercle.",
          "Les petites écoles se font oublier. Les jeunes en région aussi. Ce n'est pas une question de talent, c'est une question de réseau. Et tu ne choisis pas ton école secondaire en fonction de qui elle connaît.",
          "Nexus donne à chaque athlète la même vitrine, peu importe son école, sa région ou le carnet d'adresses de son coach.",
        ],
      },
      etapes: {
        eyebrow: "Comment ça marche",
        title1: "Trois rôles.",
        title2: "Un seul profil.",
        items: [
          { kicker: "L'athlète", title: "Tu crées ton profil", body: "Position, mesures, vidéos, parcours scolaire : tu remplis ce que tu peux, tu peaufines plus tard. Si ton coach a déjà créé ta fiche, tu la récupères en t'inscrivant." },
          { kicker: "Le coach", title: "Il vérifie et il évalue", body: "Ton coach confirme tes infos (c'est le crochet bleu), te donne sa cote et peut t'attribuer des distinctions." },
          { kicker: "Le recruteur", title: "Il te trouve", body: "Les recruteurs des cégeps cherchent par sport, position, région et promotion. Ils écrivent à ton coach, ou à toi quand les règles le permettent." },
        ],
      },
      verification: {
        eyebrow: "La vérification",
        title1: "Gris ou bleu.",
        title2: "Ça change tout.",
        lede: "Tout athlète peut créer son profil. Mais aux yeux d'un recruteur, un profil confirmé par un coach ne pèse pas le même poids.",
        grayTitle: "Crochet gris — non vérifié",
        grayBody: "L'athlète a rempli son profil lui-même. Les infos sont là, mais personne ne les a confirmées. Le recruteur les lit avec un grain de sel — et c'est normal.",
        blueTitle: "Crochet bleu — vérifié par le coach",
        blueBody: "L'entraîneur a passé le profil en revue et confirme que c'est vrai. Le crochet bleu, c'est la crédibilité du coach transférée à l'athlète.",
        perishableTitle: "Une vérification, ça se renouvelle.",
        perishableBody: "Au début de chaque mois, l'athlète confirme que ses infos sont toujours à jour. Sans confirmation à la mi-mois, le crochet redevient gris — et le coach peut re-vérifier en tout temps. Pas de profil vérifié il y a deux ans qui dort sur son crochet.",
      },
      stars: {
        eyebrow: "L'évaluation du coach",
        title1: "Une étoile,",
        title2: "partout la même.",
        lede: "La cote globale va de 1 à 5 étoiles. Chaque niveau a une définition, la même pour tous les coachs — c'est celle qu'ils ont sous les yeux quand ils donnent une cote. Un 5 étoiles à Sherbrooke veut dire la même chose qu'un 5 étoiles à Gatineau.",
        definitions: [
          "Prospect D1, prêt à partir dès le CÉGEP.",
          "Potentiel D2, et le D1 à portée.",
          "Partant en D3, potentiel D2 avec de la progression.",
          "Le D3 est à ta portée avec du travail.",
          "Un point de départ — la progression est devant toi.",
        ],
        detail: "Les stats ne racontent pas toute l'histoire : 50 plaqués dans une ligue faible, ce n'est pas 30 plaqués dans une ligue forte. En évaluation détaillée, le coach note aussi le physique, les habiletés propres à la position et le caractère — leadership, discipline, coachabilité, intelligence de jeu. Ce qu'un coach peut dire d'un joueur, un tableur ne le dit pas.",
        question: {
          title: "Et si un coach donne 5 étoiles à tout le monde ?",
          body: "Son nom est sur chaque évaluation qu'il signe. Les recruteurs peuvent aussi évaluer les coachs avec qui ils échangent, et ces avis bâtissent sa réputation. Un coach qui gonfle ses joueurs le paie en crédibilité.",
        },
      },
      distinctions: {
        eyebrow: "Les distinctions",
        title1: "Des badges",
        title2: "qui veulent dire quelque chose.",
        lede: "Le coach attribue des distinctions à ses athlètes : capitaine, joueur par excellence, meneur de la ligue, équipe d'étoiles, et des badges propres à chaque sport. Pas un autocollant sur un CV : une reconnaissance signée par celui qui te voit jouer.",
        labels: ["Capitaine", "Joueur par excellence", "Meneur de la ligue", "Équipe d'étoiles", "Clutch", "Nexus X"],
      },
      communication: {
        eyebrow: "Le contact",
        title1: "Le coach",
        title2: "reste dans la boucle.",
        paragraphs: [
          "Les athlètes en voie de recrutement sont souvent mineurs. Sur Nexus, un recruteur peut écrire à l'entraîneur, et à l'athlète quand les règles le permettent.",
          "Pendant les périodes sans contact du RSEQ, Nexus bloque automatiquement les messages des recruteurs aux athlètes du sport visé. Le canal avec l'entraîneur, lui, reste ouvert.",
          "Le coach voit l'activité des recruteurs sur ses joueurs. Il sait qui s'intéresse à qui, et il peut accompagner la suite.",
        ],
      },
      engagement: {
        eyebrow: "L'engagement",
        title1: "La visibilité",
        title2: "n'est pas à vendre.",
        items: [
          { title: "L'athlète ne paie jamais", body: "Profil, vidéos, vérification, statut de recrutement : tout est gratuit pour l'athlète." },
          { title: "Le coach non plus", body: "Créer son équipe, vérifier, évaluer, échanger avec les recruteurs : le compte coach est gratuit." },
          { title: "Tous les athlètes, pour tous les recruteurs", body: "Un recruteur gratuit voit tous les athlètes dans sa recherche. L'abonnement paie des outils — identité, vidéos, messagerie, suivi. Personne ne paie pour faire monter un athlète." },
        ],
      },
      conviction: {
        eyebrow: "Notre conviction",
        title1: "Le sport garde",
        title2: "les jeunes à l'école.",
        paragraphs: [
          "On croit au sport étudiant. C'est ce qui bâtit le caractère d'un jeune. C'est ce qui crée les amitiés qui durent toute la vie. C'est ce qui te pousse à te dépasser quand personne ne regarde. Ton environnement, quand tu grandis, c'est ce qui te définit — et pour beaucoup, cet environnement, c'est une équipe.",
          "Nexus ne réinvente pas le processus de recrutement. Les écoles connues vont continuer à produire des athlètes recrutés. Les grandes équipes vont continuer à exister. Ce qu'on fait, c'est élargir la porte. Donner une chance aux diamants bruts. Ouvrir les possibilités pour ceux qui ne sont pas dans le bon cercle.",
          "Parce que quelqu'un a eu la chance — ou la persévérance — de faire des camps, de rencontrer les bonnes personnes, et de finir dans le bon programme. Et cette personne-là a vécu les trois meilleures années de sa vie.",
        ],
        closing: "On veut ça pour tous les athlètes du Québec.",
      },
      personas: {
        eyebrow: "À toi de jouer",
        title1: "Choisis",
        title2: "ton côté.",
        items: [
          { question: "Tu es un athlète ?", line: "Crée ton profil et fais-toi voir par les recruteurs des cégeps.", label: "Pour les athlètes" },
          { question: "Tu es un entraîneur ?", line: "Vérifie tes joueurs, évalue-les, mets-les en vitrine.", label: "Pour les coachs" },
          { question: "Vous recrutez pour un cégep ?", line: "Trouvez et suivez les athlètes du secondaire, partout au Québec.", label: "Pour les recruteurs" },
        ],
      },
    },
    coachLanding: {
      hero: {
        eyebrow: "Pour les entraîneurs",
        title1: "Nexus te fait",
        title2: "gagner du temps.",
        lede: "Chaque recruteur te pose les mêmes questions, sur chacun de tes joueurs. Sur Nexus, les réponses sont déjà dans son profil : la discussion, tu l'as une fois.",
        ledeSmall: "Gratuit, pour toi comme pour tes joueurs.",
        cta: "Inscris ton équipe",
        ctaSecondary: "La discussion qui revient",
        imageAlt: "Profil d'athlète vu par un recruteur : moyenne, programme visé, ouvert à déménager, au privé, à l'anglais, puis le rapport et la cote du coach (données fictives)",
      },
      discussion: {
        eyebrow: "La discussion qui revient",
        title1: "La même discussion,",
        title2: "avec chaque recruteur.",
        lede: "Pour chaque joueur, les mêmes questions. Maintenant, c'est son profil qui répond.",
        items: [
          { q: "Est-il prêt à changer de région\u00a0?", a: "« Ouvert à déménager », et ses régions de cégep préférées." },
          { q: "Quel est son potentiel\u00a0?", a: "Ta cote, ton rapport et tes distinctions, signés de ton nom." },
          { q: "Est-il ouvert aux cégeps anglophones\u00a0?", a: "« Ouvert anglophone » : oui ou non, sur son profil." },
          { q: "Et aux cégeps privés\u00a0?", a: "« Ouvert au privé » : même chose." },
          { q: "Quel programme vise-t-il\u00a0?", a: "Son programme de cégep visé." },
          { q: "Comment vont ses notes\u00a0?", a: "Sa moyenne générale, ses matières fortes et ses mentions." },
        ],
        note: "Ton joueur remplit ces réponses une fois (ou toi, dans sa fiche). Ensuite, le recruteur les lit sur son profil — sans t'appeler pour les demander.",
        imageAlt: "Détails académiques sur un profil d'athlète : programme visé, matières fortes, mentions et régions de cégep préférées (données fictives)",
      },
      etapes: {
        eyebrow: "Comment ça marche",
        title1: "4 étapes.",
        title2: "Zéro paperasse.",
        items: [
          { title: "Inscris-toi", body: "Crée ton compte et associe-toi à ton école ou à ton club. C'est gratuit." },
          { title: "Monte ton équipe", body: "Invite tes joueurs par courriel. Ils remplissent leur profil eux-mêmes — ou tu crées leur fiche." },
          { title: "Vérifie et évalue", body: "Tu confirmes leurs infos (crochet bleu), tu donnes ta cote et tes distinctions." },
          { title: "Reste dans la boucle", body: "Les recruteurs t'écrivent par la messagerie, et tu vois leur activité sur tes joueurs." },
        ],
      },
      evaluation: {
        eyebrow: "Ton évaluation",
        title1: "C'est ce qui",
        title2: "fait la différence.",
        points: [
          "N'importe quel athlète peut dire qu'il est bon. Ton crochet bleu dit que c'est vrai.",
          "Évaluation simple (une cote) ou détaillée : physique, habiletés propres à la position, caractère.",
          "Une échelle d'étoiles définie, la même pour tous les coachs.",
          "Des distinctions : capitaine, joueur par excellence, meneur de la ligue, et les badges de ton sport.",
          "Ton nom et ton rapport accompagnent le profil que lit le recruteur.",
        ],
      },
      outils: {
        eyebrow: "Tes outils",
        title1: "Tout pour gérer",
        title2: "tes athlètes.",
        items: [
          { title: "Mes athlètes", body: "Ton alignement au même endroit : qui est vérifié, qui a un profil complet, qui est en processus de recrutement." },
          { title: "À traiter", body: "Les demandes de tes athlètes arrivent dans une seule boîte. Tu approuves ou tu refuses." },
          { title: "Messagerie", body: "Les recruteurs t'écrivent. Toi, tu écris à ton équipe, à tes entraîneurs et à ta direction." },
          { title: "Ma réputation", body: "Les recruteurs peuvent évaluer les coachs avec qui ils échangent. Leurs avis et tes badges — Évalué, Recommandé, Coach Élite, Placeur — vivent sur ta page." },
          { title: "Mon école", body: "Tableau de bord, stats, placements et gestion des entraîneurs de ton école.", note: "Responsable d'école" },
          { title: "Écoles et clubs", body: "Équipe scolaire ou ligue civile : ton équipe a sa place, avec son sport, sa catégorie et sa division." },
        ],
      },
      contact: {
        eyebrow: "Le contact",
        title1: "Tu restes",
        title2: "dans la boucle.",
        body: "Un recruteur peut t'écrire en tout temps. Pendant les périodes sans contact, Nexus bloque ses messages aux athlètes : il passe par toi.",
      },
      cta: {
        eyebrow: "Sois le nex",
        title1: "Réponds une fois.",
        title2: "Le profil fait le reste.",
        body: "Inscris-toi gratuitement. Monte ton équipe. Vérifie tes athlètes.",
        button: "Inscris ton équipe",
        trustFree: "100 % gratuit",
        noPlayersPrefix: "Tes joueurs ne sont pas encore inscrits\u00a0? ",
        noPlayersLink: "Envoie-leur ce lien",
      },
    },
    recruiterLanding: {
      v2: {
        hero: {
          eyebrow: "Pour les recruteurs et les écoles",
          title1: "Tout votre recrutement,",
          title2: "au même endroit.",
          lede: "Trouvez, évaluez et suivez vos athlètes, du premier match à la signature.",
          cta: "Demander une démo",
          ctaSecondary: "Voir les fonctions",
        },
        fonctions: {
          eyebrow: "Les fonctions",
          title1: "Ce que Nexus fait",
          title2: "pour vous.",
          items: [
            { kicker: "Recherche", title: "Recherche et filtres", points: ["Sport, position, promotion, ligue, division", "Moyenne, mentions, préférences de cégep", "Profils vérifiés par le coach, avec vidéo, avec distinction"], alt: "Recherche d'athlètes avec ses filtres" },
            { kicker: "Mon processus", title: "Votre processus, étape par étape", points: ["Les étapes, d'« Identifié » à « Lettre signée »", "Votre grade, de A+ à E, et vos notes", "« Retiré », avec sa raison : l'historique reste"], alt: "Mon processus : colonnes par étape, grades et notes" },
            { kicker: "En direct", title: "Dépistez pendant le match", points: ["Une note par numéro de chandail", "Hors ligne : ça fonctionne même sans réseau", "Partagé avec votre unité, trié après le match"], alt: "En direct : notes par numéro de chandail pendant un match" },
            { kicker: "Matchs", title: "Carte des matchs et calendrier", points: ["Les matchs près de vous, sur une carte", "Votre calendrier de visites", "Une visite s'envoie à Google Agenda ou Outlook"], alt: "Calendrier des matchs et des visites" },
            { kicker: "Prospects", title: "Des cartes pour les joueurs pas encore inscrits", points: ["Créez une carte pour un joueur repéré, modifiez-la", "Quand il s'inscrit, Nexus vous propose de la rapprocher de son vrai profil"], alt: "Rapprochement d'une carte de prospect avec un profil Nexus" },
            { kicker: "Listes", title: "Vos listes, avec vos notes", points: ["Regroupez vos athlètes comme vous voulez", "Une note privée sur chacun"], alt: "Une liste d'athlètes avec ses notes" },
            { kicker: "Règles", title: "Les périodes sans contact, respectées", points: ["Pendant une période sans contact, Nexus vous le signale sur le profil", "Vous pouvez toujours écrire à l'entraîneur"], alt: "Avis de période sans contact sur un profil d'athlète" },
          ],
        },
      },
      hero: {
        eyebrow: "Pour les recruteurs CÉGEP",
        titleLine1: "Trouvez les athlètes",
        titleLine2: "que votre réseau",
        titleLine3: "ne verra jamais.",
        lede: "Nexus donne aux recruteurs CÉGEP accès à tous les athlètes vérifiés du Québec — filtrés par sport, position, région, et année de diplomation. Peu importe l'école. Peu importe le réseau.",
        ledeSmall: "Plateforme 100% québécoise. Conforme Loi 25. Hébergée au Québec.",
        cta: "Voir la plateforme en action",
        ctaSubtitle: "Découvrez Nexus en 2 minutes 30.",
        videoBadge: "Démo · 2 min 30",
        videoCaption: "Comment un recruteur CÉGEP utilise Nexus au quotidien",
        videoComing: "La vidéo sera disponible sous peu.",
        videoAriaLabel: "Lancer la vidéo de démo",
      },
      stats: [
        { value: "70+ CÉGEPs", desc: "membres du RSEQ couverts" },
        { value: "16 sports", desc: "supportés par Nexus" },
        { value: "ROI", desc: "plus de signatures, moins de temps perdu" },
        { value: "Loi 25", desc: "hébergement au Québec" },
      ],
      problem: {
        eyebrow: "Le problème",
        title: "Le recrutement CÉGEP roule sur 10-15 contacts personnels.",
        lede: "Vous connaissez les entraîneurs-chefs des grosses écoles de votre région. Vous assistez à leurs gros matchs. Vous appelez les mêmes numéros chaque année. Ce système fonctionne — mais il vous rend invisible aux talents hors de votre cercle.",
        statusQuoEyebrow: "Le statu quo",
        statusQuoTitle: "Sans Nexus",
        reinventedEyebrow: "Le recrutement réinventé",
        reinventedTitlePrefix: "Avec ",
        reinventedTitleBrand: "Nexus",
        pains: [
          "Vous ne voyez que les athlètes de votre réseau de coachs",
          "Vos conversations sont dispersées — courriel, texto, Facebook, téléphone",
          "Aucune façon de savoir quels athlètes intéressent la concurrence",
          "Suivi des prospects dans un tableur Excel — ou simplement de mémoire",
          "Impossible d'évaluer un athlète du Saguenay depuis Montréal sans y passer la journée",
          "Les infos des athlètes varient selon le coach — stats, vidéos, évaluations",
        ],
        solutions: [
          "Base de données de tous les athlètes vérifiés du Québec, filtrable en 10 secondes",
          "Messagerie intégrée par athlète — historique complet, zéro message perdu",
          "Visibilité complète sur le processus de chaque athlète — combien de recruteurs le suivent, quels CÉGEPs sont déjà en discussion, et à quelle étape chacun en est",
          "Gérez votre processus de recrutement pour chaque athlète — du moment où vous le repérez jusqu'à sa signature de lettre d'engagement",
          "Évaluez les athlètes de partout au Québec depuis votre bureau — peu importe l'heure, peu importe la région",
          "Chaque profil a la même structure, les mêmes critères, le même standard",
        ],
      },
      pillars: {
        eyebrow: "Ce que vous pouvez faire",
        title: "Tout ce qu'il faut pour recruter efficacement.",
        items: [
          { title: "Recherche avancée", body: "Filtrez les athlètes par sport, position, région, année de diplomation, vérification, distinctions, et présence vidéo. Trouvez un QB de Sec. 5 en Mauricie en 10 secondes." },
          { title: "Profils 30 secondes", body: "Chaque athlète a la même structure — physique, stats saison, vidéo, académique, évaluation coach. Décidez en 30 secondes si vous voulez contacter le coach." },
          { title: "Suivi visuel", body: "Tableau Kanban: Découvert → Contacté → Visite → Lettre signée. Voyez votre entonnoir de recrutement d'un coup d'œil. Aucun prospect oublié." },
          { title: "Check bleu", body: "Chaque profil doit être validé par un entraîneur du secondaire. Le coach met sa réputation en jeu pour confirmer les informations — identité, stats, position, école. Ce qui signifie que tout ce que vous voyez a été vérifié par un adulte nommé et responsable." },
        ],
      },
      verification: {
        eyebrow: "Le badge de vérification",
        title: "Chaque profil vérifié est appuyé par un coach nommé.",
        p1: "Sur Nexus, un athlète avec un badge de vérification n'est pas juste un profil en ligne. C'est un athlète dont un entraîneur du secondaire a révisé chaque champ — identité, stats, école, position — et a mis sa propre réputation en jeu pour confirmer que tout est vrai.",
        p2: "La vérification est mensuelle. Les athlètes inactifs ou dont les infos ne sont plus à jour perdent leur badge de vérification. Vous n'évaluez jamais un profil zombie.",
        p3: "Quand vous voyez un badge de vérification, vous voyez la crédibilité du coach transférée à l'athlète. C'est du temps économisé et du risque réduit.",
        verifiedPill: "Vérifié",
        verifiedByLabel: "Vérifié par",
        verifiedByName: "Coach Pelletier",
        verifiedBySchool: "É.S. De Mortagne",
        quote: "« Joueur complet, très intelligent au jeu. Lit les défenses avant le snap. Leader naturel dans le vestiaire. Prêt pour le niveau CÉGEP division 1. »",
        badgeCaptain: "Capitaine",
        badgeAllstar: "Équipe d'étoiles",
        badgeLeader: "Leader",
      },
      reliability: {
        eyebrow: "La fiabilité des coachs",
        title: "Un problème vieux comme le recrutement — et notre solution.",
        lede: "On vous le dit honnêtement : le recrutement sportif a toujours eu un défi de fiabilité. Comment savoir si un coach gonfle ses joueurs pour les aider à se placer? Comment évaluer la crédibilité de ce qu'on vous raconte? Ce problème existait avant Nexus et continuera d'exister hors de Nexus. La différence, c'est qu'ici, vous avez les outils pour le gérer.",
        subTitle: "La réputation des coachs, construite par les recruteurs.",
        p1: "Sur Nexus, chaque coach a une réputation publique — visible à tous les recruteurs avant qu'ils ne lisent une seule évaluation. Cette réputation est construite par vous et vos collègues recruteurs.",
        p2: "Après chaque interaction avec un coach — message, visite, recrutement — vous pouvez évaluer la qualité et la fiabilité de ses observations. Ces évaluations s'accumulent au fil du temps. Un coach qui gonfle systématiquement ses joueurs verra sa réputation refléter cette tendance. Un coach qui évalue avec justesse devient une référence dans son réseau.",
        p3: "Le système se corrige lui-même. Pas par Nexus, mais par la communauté de recruteurs CÉGEP.",
        coachName: "Coach Pelletier",
        coachSchool: "É.S. De Mortagne",
        reliabilityCaption: "Note de fiabilité — basée sur 14 évaluations de recruteurs",
        precisionLabel: "Précision des évaluations",
        placedLabel: "Athlètes placés en CÉGEP",
        responseLabel: "Délai moyen de réponse",
        pillRecommended: "Recommandé",
        pillFastResponse: "Réponse rapide",
        pillPlacer: "Placeur",
        lastEvaluated: "Évalué pour la dernière fois il y a 3 jours par un recruteur de Vanier",
      },
      intelligence: {
        eyebrow: "Intelligence concurrentielle",
        title: "Sachez où vous en êtes — par rapport au reste.",
        p1: "Un recruteur sans Nexus apprend par la rumeur qu'un athlète discute avec un autre CÉGEP. Sur Nexus, l'information est sur le profil : le statut de recrutement de l'athlète change dès qu'il avance dans son processus.",
        p2Pre: "Sur chaque profil, deux indicateurs côte à côte : ",
        p2YourStatus: "votre propre statut",
        p2Mid: " avec cet athlète, et le ",
        p2GlobalStatus: "statut de recrutement global",
        p2Post: " qu'il porte (Ouvert, En processus, Recruté). Si le statut global passe à « En processus » alors que vous êtes encore à « Identifié », l'écart est visible.",
        p3: "Le nombre de recruteurs qui l'ont mis en favori complète le portrait — combien de CÉGEPs s'intéressent à lui en ce moment. Pas de noms par CÉGEP, pas d'étapes par concurrent : juste les signaux qui comptent pour décider si vous devez accélérer.",
        cardCategory: "Football · POS LB · Promotion 2027",
        viewsLabel: "Vues",
        favoritesLabel: "Favoris",
        myStatusLabel: "Mon statut",
        myStatusValue: "Visite planifiée",
        recruitmentLabel: "Recrutement",
        recruitmentValue: "En processus",
        annotationLead: "Le recrutement global avance.",
        annotationBody: "L'athlète est en processus avec un CÉGEP — comparez à votre propre statut pour savoir si vous devez accélérer.",
        cardAlt: "Carte joueur Alexandre Tremblay",
      },
      pricing: {
        eyebrow: "Tarification",
        title: "Un prix selon votre niveau de recrutement.",
        lede: "Recrutement 100% québécois. Paiement en dollars canadiens. TPS/TVQ incluses dans les tarifs affichés.",
        tiers: [
          {
            name: "Gratuit",
            price: "$0",
            subtitle: "Pour explorer la plateforme",
            bullets: [
              "Recherche d'athlètes (filtres de base)",
              "Profils complets des athlètes vérifiés",
              "5 messages/mois vers les coachs",
              "Favoris (max 25 athlètes)",
            ],
            buttonLabel: "Créer un compte",
          },
          {
            name: "Pro",
            price: "$19.99",
            priceSuffix: "/mois",
            subtitle: "Pour les recruteurs actifs",
            subheader: "Tout ce qui est gratuit, plus :",
            bullets: [
              "Recherche avancée (tous les filtres, badges, vidéo)",
              "Messages illimités aux coachs",
              "Favoris illimités + listes nommées",
              "Tableau de bord recruteur complet",
              "Notifications temps réel",
              "Historique des vues par athlète",
            ],
            badge: "Populaire",
            buttonLabel: "Choisir Pro",
          },
          {
            name: "All Star",
            price: "$29.99",
            priceSuffix: "/mois",
            subtitle: "Pour les programmes compétitifs",
            subheader: "Tout ce qui est Pro, plus :",
            bullets: [
              "Tableau Kanban avec drag-and-drop",
              "Besoins de roster publiables (Roster Needs)",
              "Analytique de recrutement (conversion, temps moyen, etc.)",
              "Export CSV/Excel pour intégration CRM",
              "Multi-utilisateurs (entraîneur-chef + adjoints)",
              "Support prioritaire",
            ],
            buttonLabel: "Choisir All Star",
          },
        ],
      },
      faq: {
        eyebrow: "Questions fréquentes",
        title: "Les réponses aux questions que vous vous posez.",
        items: [
          { q: "Comment Nexus respecte-t-elle la Loi 25?", a: "Toutes les données sont hébergées au Québec. Le consentement parental est documenté pour chaque athlète mineur avant la mise en ligne du profil. Les recruteurs signent une entente de confidentialité à l'inscription. Le droit à l'effacement et à la portabilité est respecté selon les délais légaux." },
          { q: "Comment Nexus respecte-t-elle le calendrier RSEQ?", a: "Nexus ne s'insère pas dans le processus de recrutement officiel du RSEQ — c'est votre responsabilité de connaître et respecter les périodes de recrutement de votre sport. Ce que Nexus fait : la communication avec un athlète mineur passe obligatoirement par son entraîneur du secondaire, conforme à l'esprit des règles RSEQ. L'entraîneur décide quand et comment impliquer l'athlète. Vous restez maître de votre démarche; Nexus ne vous bloque ni ne vous dicte quoi que ce soit côté calendrier." },
          { q: "Est-ce que je peux contacter directement un athlète?", a: "Non. Pour les athlètes mineurs, toutes les communications passent par leur entraîneur du secondaire. C'est la règle RSEQ et c'est aussi une protection pour vous — l'entraîneur sert de filtre et de contexte. Vous évitez les malentendus et les situations inconfortables." },
          { q: "Mes concurrents CÉGEP peuvent-ils voir qui je scoute?", a: "Par défaut, les coachs voient quels CÉGEPs ont consulté leurs athlètes (pour créer un signal d'intérêt utile). Vos concurrents directs ne voient PAS vos listes de favoris — seulement les coachs des athlètes concernés. Vous pouvez ajuster votre visibilité dans les paramètres." },
          { q: "Comment Nexus différencie-t-elle un vrai recruteur d'un imposteur?", a: "Chaque recruteur doit compléter son profil avec son CÉGEP, son sport, sa division et son rôle. L'équipe Nexus est notifiée de chaque nouvelle inscription et valide l'affiliation déclarée. Les coachs du secondaire voient l'identité complète du recruteur — son nom, son CÉGEP, son sport — avant de répondre à tout message. En cas de profil suspect, l'équipe Nexus peut désactiver un compte à tout moment." },
          { q: "Est-ce qu'il faut un engagement annuel?", a: "Les abonnements mensuels sont flexibles et peuvent être annulés en tout temps. Les abonnements annuels offrent une économie significative (~20-40% selon le tier) pour les recruteurs engagés sur la saison. Aucune pénalité d'annulation sur un plan mensuel." },
        ],
      },
      cta: {
        title1: "Prêt à voir tous les ",
        title2: "talents",
        title3: " du Québec?",
        body: "Créez votre compte gratuit. Explorez la plateforme. Mettez Pro à l'épreuve pendant 14 jours sans frais.",
        button: "Créer un compte gratuit",
        footer: "Aucune carte de crédit requise. Configurez votre profil en 2 minutes.",
      },
    },
    parentLanding: {
      hero: {
        eyebrow: "Pour les parents",
        titleLine1: "Votre enfant se fait recruter.",
        titleLine2: "Vous voyez tout.",
        lede: "Le recrutement, c'est une décision de famille. Le portail parent Nexus vous donne une vue complète — gratuitement.",
        ledeSmall: "Aucune démarche : votre invitation arrive par courriel dès que votre enfant s'inscrit.",
        cta: "Inscrire mon enfant",
        mockup: {
          label: "Portail parent",
          activityTitle: "Activité du profil",
          activityCaption: "12 dernières semaines",
          consentTitle: "Consentements",
          consentValue: "2 autorisations actives",
          notificationTitle: "Nouveau contact",
          notificationBody: "Un recruteur a contacté votre enfant.",
        },
      },
      howItWorks: {
        eyebrow: "Comment ça fonctionne",
        title: "3 étapes. Aucune démarche compliquée.",
        steps: [
          { num: "01", role: "Inscription", title: "Votre enfant s'inscrit", body: "Il crée son profil d'athlète et fournit votre adresse courriel." },
          { num: "02", role: "Invitation", title: "Vous recevez une invitation", body: "Elle arrive automatiquement dans votre boîte courriel. C'est le seul chemin d'entrée : personne ne peut créer un compte parent sans elle." },
          { num: "03", role: "Accès", title: "Vous accédez à son tableau de bord", body: "Vous créez votre compte gratuit et suivez son parcours." },
        ],
      },
      whatYouSee: {
        eyebrow: "Ce que vous voyez",
        title: "L'essentiel, sans jargon.",
        tag: "Inclus",
        items: [
          { title: "Son activité, semaine par semaine", body: "Vues de profil, intérêt des recruteurs, progression — en un coup d'œil." },
          { title: "L'intérêt des recruteurs pour son profil", body: "Combien de recruteurs ont consulté et suivi son profil. Leur identité reste confidentielle — c'est voulu." },
          { title: "Une notification quand un recruteur le contacte", body: "Vous êtes informé de chaque premier contact." },
          { title: "Un canal direct avec son école", body: "Écrivez aux entraîneurs et directeurs de l'école de votre enfant." },
        ],
      },
      whoDecides: {
        eyebrow: "Vos autorisations",
        title: "Qui décide ? Vous.",
        checks: [
          "Vous autorisez la création de son profil.",
          "Vous autorisez sa visibilité auprès des recruteurs CÉGEP vérifiés.",
          "Vous autorisez — ou non — l'utilisation de son image chez nos partenaires.",
          "Vous pouvez retirer une autorisation à tout moment, depuis votre portail.",
        ],
        calloutTitle: "Encadré par la loi québécoise",
        calloutBody: "Nexus applique la Loi 25 : les données de votre enfant sont hébergées au Québec, et toute autorisation donnée peut être retirée. Chaque changement est journalisé.",
      },
      faq: {
        eyebrow: "Questions fréquentes",
        title: "Ce que les parents nous demandent.",
        items: [
          { q: "Puis-je créer mon compte sans invitation ?", a: "Non — et c'est une protection. L'invitation est envoyée uniquement au courriel fourni par votre enfant à son inscription." },
          { q: "Le compte parent est-il payant ?", a: "Non. Le portail parent est entièrement gratuit, sans limite de durée." },
          { q: "Y a-t-il une application à installer ?", a: "Non. Le portail parent s'utilise depuis votre navigateur, sur ordinateur comme sur téléphone." },
          { q: "Puis-je retirer une autorisation ?", a: "Oui, à tout moment et sans justification, depuis la section Consentements de votre portail. Le retrait prend effet immédiatement." },
          { q: "Et si mon enfant a moins de 14 ans ?", a: "Nexus n'accepte pas les athlètes de moins de 14 ans. Entre 14 et 17 ans, votre autorisation est requise et vous recevez l'avis parental automatiquement." },
        ],
      },
      finalCta: {
        title: "Prêt à suivre son parcours ?",
        line: "Tout commence par l'inscription de votre enfant. Votre invitation suit automatiquement.",
        cta: "Inscrire mon enfant",
        bullets: ["100 % gratuit", "Invitation automatique par courriel", "Accessible sur le web"],
      },
    },
    athleteLanding: {
      hero: {
        eyebrow: "Pour les étudiants-athlètes",
        title1: "Fais-toi voir",
        title2: "par les cégeps.",
        lede: "Ta carte de joueur et ton profil complet, au même endroit. Les recruteurs des cégeps te trouvent, peu importe ton école ou ta région.",
        cta: "Crée ton profil",
        ctaSecondary: "Comment ça marche",
        imageAlt: "Carte de joueur Nexus vérifiée (données fictives)",
      },
      fonctions: {
        eyebrow: "Ce que tu as",
        title1: "Ton profil.",
        title2: "Ta chance.",
        items: [
          {
            kicker: "Ton profil",
            title: "Tout ce qu'un recruteur veut voir",
            points: ["Ta carte : sport, position, numéro, école, promotion", "Le rapport et la cote de ton coach", "Tes faits saillants, tes mesures, ton parcours d'équipes", "Ton parcours scolaire et le programme que tu vises"],
            alt: "Rapport du coach sur un profil d'athlète vu par un recruteur : citation, cote globale, critères et distinctions (données fictives)",
          },
          {
            kicker: "Les cégeps",
            title: "Trouve ton cégep",
            points: ["Cherche les cégeps par programme, sport et région", "Les pages d'équipe montrent les postes à combler", "« Match parfait » quand ta position est recherchée", "Garde tes cégeps favoris"],
            alt: "Page d'équipe d'un cégep : postes à combler par position, et « Match parfait » pour un quart-arrière (données fictives)",
          },
          {
            kicker: "Ambassadeur",
            title: "Amène ton équipe",
            points: ["Invite tes coéquipiers avec ton lien personnel", "Chaque ami qui s'inscrit compte dans tes recrues", "Débloque le badge Ambassadeur"],
            alt: "Programme ambassadeur : recrues, paliers et bouton « Inviter mes coéquipiers » (données fictives)",
          },
        ],
      },
      etapes: {
        eyebrow: "Comment ça marche",
        title: "3 étapes.",
        items: [
          { title: "Inscris-toi en quelques minutes", body: "Apple ou Google, ton code d'équipe, puis tes infos. Remplis ce que tu peux, peaufine plus tard." },
          { title: "Ton coach te vérifie", body: "Il valide tes infos et ajoute son évaluation. Le crochet bleu donne du poids à ton profil." },
          { title: "Les recruteurs te trouvent", body: "Ton profil apparaît dans leurs recherches. Ils écrivent à ton coach, ou à toi quand les règles le permettent." },
        ],
      },
      gratuit: {
        eyebrow: "Gratuit",
        title1: "Zéro dollar.",
        title2: "Pour les athlètes.",
        body: "Ton profil, tes vidéos, ta vérification, ta messagerie : tout est gratuit. Personne ne paie pour être vu.",
        parentsLead: "Tu as moins de 18 ans ? Tes parents ont leur propre page.",
        parentsLink: "Pour les parents",
      },
      final: {
        eyebrow: "Sois le nex",
        title1: "Télécharge Nexus.",
        title2: "À toi de jouer.",
        appStoreSmall: "Télécharger dans",
        playSmall: "Disponible sur",
        web: "ou inscris-toi sur le web",
        codeLead: "Pas encore de code d'équipe ?",
        code: "Demande-le à ton coach.",
      },
    },
    pricing: {
      hero: {
        eyebrow: "Tarifs",
        title1: "Gratuit pour les athlètes",
        title2: "et les coachs.",
        lede: "Seuls les recruteurs ont des forfaits payants. Personne ne paie pour être vu.",
      },
      personaToggle: {
        recruiter: "Recruteur",
        coach: "Coach",
        athlete: "Athlète",
      },
      billingToggle: {
        monthly: "Mensuel",
        annual: "Annuel",
        saveLabel: "économise",
      },
      card: {
        forever: "pour toujours",
        fromPrefix: "À partir de ",
        fromSuffixAnnual: " facturé annuellement",
        orPrefix: "ou ",
        orSuffixMonthly: " facturé mensuellement",
        perYear: "/an",
        perMonth: "/mois",
      },
      cegepBanner: {
        title: "Forfait CÉGEP — plusieurs recruteurs?",
        body: "Votre programme a plus d'un recruteur? Contactez l'équipe Nexus pour un forfait organisationnel adapté à votre CÉGEP avec tarification de groupe et gestion centralisée.",
        cta: "Contacter l'équipe Nexus →",
      },
      whyPro: {
        eyebrow: "Pourquoi Pro?",
        title: "Tu sais que tu es regardé. Maintenant, sache par qui.",
        lede: "Chaque mois, ton profil est consulté par des recruteurs de partout au Québec. Avec Pro, tu vois leurs noms, leurs CÉGEPs, et combien de fois ils reviennent.",
      },
      freePersona: {
        missionEyebrow: "Gratuit",
        missionTitle: "Notre mission",
        athleteMissionBody: "Chaque athlète mérite de poursuivre son parcours au prochain niveau. Nexus n'est pas une simple banque de joueurs : nous offrons aux recruteurs et aux étudiants-athlètes des outils concrets qui simplifient chaque étape du recrutement. Et tout cela, gratuitement pour les athlètes.",
        coachMissionBody: "Chaque athlète mérite de poursuivre son parcours au prochain niveau — et personne n'est mieux placé que son entraîneur pour l'y aider. Nexus n'est pas une simple banque de joueurs : nous vous donnons des outils concrets pour faire voir vos joueurs, gérer votre équipe et suivre chaque étape du recrutement. Gratuitement, pour vous comme pour eux.",
        checklistTitle: "Ce qui est inclus",
        athleteItems: [
          "Profil complet : photo, bio, parcours, vidéos, stats et mesures",
          "Badge vérifié et cote globale de l'entraîneur",
          "Ma visibilité : vues, favoris, graphique hebdomadaire, régions",
          "Messagerie avec les recruteurs, ton entraîneur et la direction de ton école, dans le respect des périodes de silence RSEQ",
          "Recherche complète des CÉGEPs : programmes, équipes et informations de chaque établissement",
          "Transfer portal",
          "Consentement parental documenté",
          "Statut de recrutement",
        ],
        coachItems: [
          "Créer et gérer les profils de vos athlètes",
          "Évaluations simplifiées et détaillées",
          "Vérifier vos athlètes",
          "Messagerie avec les recruteurs",
          "Messagerie interne avec votre équipe, vos entraîneurs et votre direction",
          "Gérer les demandes de vos athlètes",
          "Mon école : tableau de bord, stats, placements, analytique (responsable d'école)",
          "Gestion des entraîneurs de votre école (responsable d'école)",
          "Ma réputation",
        ],
      },
      trust: {
        quebecHost: "Hébergé au Québec",
        loi25: "Conforme Loi 25",
        verifiedProfiles: "Profils vérifiés",
      },
      /* Le francais est defini UNE fois dans pricing.ts (TIER_COPY_FR) :
         les surfaces applicatives (SubscriptionManager, UpgradeModal) le
         lisent aussi, sans embarquer tout ce dictionnaire marketing. */
      tiers: TIER_COPY_FR,

    },
    roadmap: {
      hero: {
        eyebrow: "Roadmap",
        title: "Ce qui s'en vient.",
        lede: "On construit Nexus en continu. Pas de dates promises — juste la direction et les priorités.",
      },
      phases: [
        {
          code: "Release 2",
          label: "Croissance commerciale",
          items: [
            { title: "Page CÉGEP détaillée", body: "Chaque CÉGEP a sa propre page — sports offerts, programmes d'études, contacts, et présentation." },
            { title: "Recherche d'écoles interactive", body: "Trouve les CÉGEPs par localisation, sport, programme d'études. Carte interactive incluse." },
            { title: "Comparaison d'athlètes", body: "Compare deux athlètes côte à côte — stats, évaluations, distinctions, profil académique." },
            { title: "Historique des évaluations", body: "Voir les évaluations passées d'un athlète pour montrer sa progression d'une saison à l'autre." },
            { title: "Blog Nexus", body: "Articles, conseils, et analyses sur le recrutement sportif au Québec." },
            { title: "Webinaires CÉGEP", body: "Les CÉGEPs présentent leurs programmes sport-études directement aux coachs du secondaire." },
            { title: "Guide de recrutement avancé", body: "Version interactive et personnalisée du guide — timeline adaptée à ta situation et ton sport." },
            { title: "Calendrier de showcases et événements", body: "Camps, showcases, portes ouvertes, combines — tous les événements de recrutement au Québec au même endroit." },
            { title: "Tableau d'engagements public", body: "Qui a signé où? Un tableau en temps réel des lettres d'intention et des engagements confirmés par sport et par année." },
          ],
        },
        {
          code: "Release 3",
          label: "Valeur CÉGEP",
          items: [
            { title: "Gestion des effectifs CÉGEP", body: "Tableau des besoins par sport et position vs joueurs actuels. Le directeur voit les trous dans son roster." },
            { title: "Blog CÉGEP", body: "Chaque CÉGEP publie sur sa page — résultats, témoignages, journées portes ouvertes. Visibilité et contenu." },
            { title: "Suivi des anciens (Alumni)", body: "Suivre où sont les athlètes recrutés après 1, 2, 3 ans. Preuve sociale pour le CÉGEP et le coach." },
            { title: "Portail de transfert", body: "Athlètes qui changent de CÉGEP en cours de parcours. Visibilité pour les programmes qui ont des places à combler." },
          ],
        },
        {
          code: "Release 4",
          label: "Intelligence",
          items: [
            { title: "Analyse des besoins par IA", body: "Analyse du roster actuel, des finissants, et des gaps de position. Suggestions automatiques de prospects." },
            { title: "Optimisation de tournée de recrutement", body: "Planification intelligente : quels prospects visiter, dans quel ordre, optimisé par distance et priorité." },
            { title: "Score de préparation au recrutement", body: "Le coach voit quels athlètes sont « prêts à être présentés » aux recruteurs — basé sur la complétion, la vidéo et les évaluations." },
            { title: "Notifications intelligentes", body: "« 3 nouveaux athlètes correspondent à tes critères cette semaine » — « Ce QB est consulté par 5 CÉGEPs, agis vite »." },
            { title: "Carte thermique régionale", body: "Carte du Québec montrant la densité d'athlètes par région et par sport. Outil stratégique pour recruteurs." },
          ],
        },
        {
          code: "Release 5",
          label: "Expansion",
          items: [
            { title: "Passerelle universités → CÉGEP", body: "Les universités canadiennes recrutent depuis les CÉGEPs. Même modèle, un niveau au-dessus. Nouveau segment payant." },
            { title: "Expansion pan-canadienne", body: "Adapter Nexus pour les provinces anglophones : high school → college/university. Traduction bilingue. Marché 10x plus grand." },
            { title: "Application native (iOS/Android)", body: "Réécriture mobile complète pour une expérience optimale sur téléphone." },
            { title: "API publique", body: "Permettre aux écoles et CÉGEPs d'intégrer les données Nexus dans leurs systèmes (Clara, Omnivox)." },
          ],
        },
      ],
      bottom: {
        title: "Une idée?",
        body: "On construit Nexus pour toi. Si une fonctionnalité te manque, on veut le savoir.",
        cta: "Nous écrire →",
      },
    },
    about: {
      hero: {
        eyebrow: "À propos",
        title1: "Nexus, c'est nous",
        title2: "avant d'être un produit.",
        lede: "Un ancien athlète qui voulait être vu. Un ancien coach qui voulait donner une chance à ses joueurs. Deux professionnels en technologie qui savent bâtir des plateformes sécurisées. Voilà qui on est.",
      },
      founders: {
        eyebrow: "Les fondateurs",
        title1: "Un athlète.",
        title2: "Un coach.",
        bp: {
          name: "Bruno-Philippe Desfosses Simard",
          role: "Fondateur · Ancien athlète",
          bio: "Ancien joueur de football collégial. J'ai vécu le processus de recrutement de l'intérieur — j'ai vu des coéquipiers plus talentueux que moi passer inaperçus parce que leur coach ne connaissait pas les bonnes personnes. En parallèle, je travaille en technologie — infrastructure, applications, cybersécurité. Nexus combine ces deux mondes.",
          photoAlt: "Bruno-Philippe Desfosses Simard",
        },
        chuck: {
          name: "Chuck",
          role: "Co-fondateur · Ancien coach",
          bio: "Ancien entraîneur au secondaire. J'ai vu de près ce qui fait la différence entre un joueur qui se fait recruter et un joueur qui se fait oublier — et souvent, ça n'a rien à voir avec le talent. Comme Bruno, je viens de la cybersécurité et de l'infrastructure. On a construit Nexus avec la conviction que les données des jeunes athlètes méritent le même niveau de protection qu'un système bancaire.",
          photoAlt: "Chuck",
        },
      },
      engagements: {
        eyebrow: "Nos engagements",
        title1: "Les données des jeunes,",
        title2: "on les protège.",
        lede: "Nexus est bâti par des professionnels en cybersécurité. Des profils de mineurs, ça se traite avec sérieux.",
        items: [
          { title: "Hébergé à Montréal", body: "Les renseignements personnels sont hébergés au Canada, dans la région de Montréal (Amazon Web Services, Canada Central)." },
          { title: "Conforme à la Loi 25", body: "Un responsable de la protection des renseignements personnels est désigné. Accès, correction ou plainte : il répond." },
          { title: "14 ans et plus", body: "Il faut avoir 14 ans pour créer son compte. Entre 14 et 17 ans, le jeune nomme son parent ou tuteur, qui reçoit une invitation." },
          { title: "Un portail parent", body: "Le parent a son propre accès pour suivre le profil de son enfant et gérer ses consentements." },
        ],
        privacyLink: "Politique de confidentialité",
      },
      contact: {
        eyebrow: "Nous écrire",
        title1: "Une question",
        title2: "pour l'équipe ?",
        lede: "On répond dans les 48 heures.",
        labelName: "Nom complet",
        placeholderName: "Jean Tremblay",
        labelEmail: "Courriel",
        placeholderEmail: "jean@ecole.qc.ca",
        labelSubject: "Sujet",
        labelMessage: "Message",
        placeholderMessage: "Comment pouvons-nous t'aider?",
        submit: "Envoyer le message",
        subjects: {
          general: "Question générale",
          partnership: "Partenariat",
          support: "Support technique",
          media: "Médias",
          other: "Autre",
        },
        submitting: "Envoi…",
        toast: "Message envoyé! On vous revient dans les 48 heures.",
        toastError: "Envoi impossible pour le moment. Réessayez ou écrivez à bpdesfosses@nexussports.ca.",
      },
    },
    auth: {
      eyebrow: "Plateforme de recrutement",
      titleLogin: "Connexion",
      titleSignup: "Inscription",
      subtitleLogin: "Accède à ton espace et connecte-toi avec ton réseau.",
      subtitleSignup: "Rejoins la plateforme #1 de recrutement sportif au Québec.",
      tabs: { login: "Connexion", signup: "Inscription" },
      google: "Continuer avec Google",
      orEmail: "ou par courriel",
      referralBanner: "Tu as été invité par un ambassadeur Nexus!",
      toasts: {
        socialPhase2: "Connexion sociale — disponible en Phase 2",
        forgotPhase2: "Disponible en Phase 2",
      },
      signup: {
        choice: {
          title: "Es-tu le prochain à être recruté?",
          lede: "Crée ton profil en 2 minutes. Sois visible par tous les recruteurs CÉGEP du Québec.",
          // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
          cta: "Je suis le NEX →",
          notAthlete: "Tu n'es pas un athlète?",
          coach: { title: "Entraîneur", sub: "École secondaire" },
          civilLeague: { title: "Ligue civile", sub: "Coach ou coord." },
          recruiter: { title: "Recruteur", sub: "CÉGEP" },
        },
        form: {
          back: "Retour",
          heading: "Crée ton profil",
          headingSub: "— Es-tu le prochain à être recruté?",
          labels: {
            firstName: "Prénom",
            lastName: "Nom",
            email: "Courriel",
            password: "Mot de passe",
            confirm: "Confirmer",
            context: "Tu joues pour...",
            sport: "Ton sport principal",
          },
          placeholders: {
            firstName: "Marc-Antoine",
            lastName: "Tremblay",
            email: "marc-antoine@gmail.com",
            password: "Mot de passe",
          },
          passwordHint: "Minimum 8 caractères",
          passwordMismatch: "Les mots de passe ne correspondent pas",
          context: {
            scolaire: { title: "École secondaire", sub: "RSEQ, équipe scolaire" },
            civile: { title: "Ligue civile ou club", sub: "Hors RSEQ, équipe communautaire" },
          },
          consent: {
            policy: {
              before: "J'ai lu et j'accepte la ",
              privacy: "Politique de confidentialité",
              and: " et les ",
              terms: "Conditions d'utilisation",
              after: " de Nexus.",
            },
            data: {
              before: "J'accepte la ",
              link: "collecte et le traitement de mes données",
              after: " par Nexus aux fins décrites.",
            },
            marketing: {
              before: "J'accepte de recevoir des ",
              link: "communications marketing",
              after: " de Nexus (nouvelles fonctionnalités, conseils, promotions). Maximum 2 courriels par mois.",
              optional: "(optionnel)",
            },
            error: "Tu dois accepter les deux premiers consentements pour continuer.",
          },
          submit: "Créer mon profil athlète →",
        },
        switchToLogin: { prompt: "Déjà un compte?", cta: "Se connecter" },
      },
      login: {
        forgot: "Mot de passe oublié?",
        loading: "Connexion...",
        submit: "Se connecter →",
        switchToSignup: {
          prompt: "Pas encore de compte?",
          cta: "Crée ton profil athlète en 2 minutes →",
        },
        placeholderEmail: "coach@ecole.qc.ca",
        placeholderPassword: "Mot de passe",
      },
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
      sections: {
        quoi: {
          eyebrow: "What is Nexus?",
          title1: "Your card. Your profile.",
          title2: "Every CÉGEP.",
          intro: "Nexus brings your athlete card and your full profile together, so CÉGEP recruiters can find you, whatever your school.",
          points: [
            { title: "Get seen", body: "Your card, your stars, your badges." },
            { title: "All in one place", body: "For recruiters: highlights, physical tests, team history, academics." },
            { title: "Your next level", body: "The depth chart (open positions), CÉGEP pages, choosing your program." },
            { title: "A few steps", body: "Apple or Google, your team code, and everything fills in." },
            { title: "And more", body: "CÉGEP map, school list, ambassadors, transfers." },
          ],
        },
        recus: {
          eyebrow: "The receipts",
          title1: "Before.",
          title2: "With Nexus.",
          receiptNo: "Receipt no.",
          total: "Total",
          avant: {
            label: "Before",
            items: ["Emails to recruiters, one by one", "A PDF résumé nobody opens", "Scattered video links", "Stats in a text message", "Small schools, invisible"],
            total: "\"We'll see\"",
          },
          avec: {
            label: "With Nexus",
            items: ["One player card", "A standard profile, always the same", "Videos, tests and academics in one place", "Rated by your coach", "Visible to every CÉGEP"],
            total: "One link",
          },
        },
        personas: {
          eyebrow: "Pick your role",
          title1: "Nexus for you.",
          title2: "Pick your side.",
          iAm: "I'm a",
          items: [
            { role: "Athlete", title: "Get seen.", points: ["Your player card and full profile", "Your coach verifies and rates you", "Recruiters from every CÉGEP find you"], cta: "Create your profile", more: "Learn more" },
            { role: "Coach", title: "Showcase your players.", points: ["Create your team and invite players by email", "Verify and rate their profiles", "You stay the recruiters' point of contact"], cta: "Sign up your team", more: "Learn more" },
            { role: "Recruiter", title: "All your recruiting, in one place.", points: ["Search and filters across every athlete", "Your process, your notes, your lists", "Live during the game, even offline"], cta: "Request a demo", more: "Learn more" },
          ],
        },
        etapes: {
          eyebrow: "How it works",
          title: "3 steps.",
          items: [
            { title: "Sign up in minutes", body: "Stats, position, video, background: fill in what you can, polish later." },
            { title: "Your coach verifies you", body: "They confirm your info and add their evaluation. The blue check lifts your profile." },
            { title: "Recruiters find you", body: "Your profile shows up in their searches. They can reach you, or your coach." },
          ],
        },
        recruteurs: {
          eyebrow: "For recruiters and schools",
          title1: "All your recruiting,",
          title2: "in one place.",
          cta: "See the recruiter page",
        },
        final: {
          eyebrow: "Be the nex",
          title1: "Get Nexus.",
          title2: "Your move.",
          appStoreSmall: "Download on the",
          playSmall: "Get it on",
          codeLead: "No team code yet?",
          code: "Ask your coach for yours.",
        },
      },
    },
    nav: {
      discover: "Discover Nexus",
      forCoaches: "For coaches",
      forRecruiters: "For recruiters",
      forAthletes: "For student-athletes",
      forParents: "For parents",
      howItWorks: "How it works",
      pricing: "Pricing",
      help: "Help",
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
    howItWorks: {
      hero: {
        eyebrow: "Our mission",
        title1: "Talent doesn't have",
        title2: "a postal code.",
        lede: "When I was in high school, every football player at my school went to the same CÉGEP. That's just how it was. If I hadn't gone to camps and met other people, I never would have lived the three best years of my life somewhere else. Nexus exists so that kind of encounter doesn't depend on luck.",
        cta: "Create your profile",
        ctaSecondary: "See how it works",
      },
      why: {
        eyebrow: "Why Nexus exists",
        title1: "Recruiting",
        title2: "runs on networks.",
        paragraphs: [
          "CÉGEP recruiters know the coaches at the big schools. They go to the big games. They call the same numbers, year after year. It works — for athletes inside the right circle.",
          "Small schools get forgotten. So do kids in the regions. It's not a question of talent, it's a question of network. And you don't pick your high school based on who it knows.",
          "Nexus gives every athlete the same showcase, no matter the school, the region, or the coach's contact list.",
        ],
      },
      etapes: {
        eyebrow: "How it works",
        title1: "Three roles.",
        title2: "One profile.",
        items: [
          { kicker: "The athlete", title: "You create your profile", body: "Position, measurements, videos, academics: fill in what you can, polish it later. If your coach already created your file, you claim it when you sign up." },
          { kicker: "The coach", title: "They verify and evaluate", body: "Your coach confirms your info (that's the blue check), gives you a rating and can award you distinctions." },
          { kicker: "The recruiter", title: "They find you", body: "CÉGEP recruiters search by sport, position, region and graduating class. They message your coach, or you when the rules allow it." },
        ],
      },
      verification: {
        eyebrow: "Verification",
        title1: "Gray or blue.",
        title2: "It changes everything.",
        lede: "Any athlete can create a profile. But in a recruiter's eyes, a profile confirmed by a coach doesn't carry the same weight.",
        grayTitle: "Gray check — unverified",
        grayBody: "The athlete filled in the profile themselves. The info is there, but no one has confirmed it. The recruiter reads it with a grain of salt — and that's normal.",
        blueTitle: "Blue check — verified by the coach",
        blueBody: "The coach reviewed the profile and confirms it's true. The blue check is the coach's credibility transferred to the athlete.",
        perishableTitle: "Verification has to be renewed.",
        perishableBody: "At the start of every month, the athlete confirms their info is still up to date. No confirmation by mid-month and the check turns gray again — and the coach can re-verify at any time. No profile verified two years ago coasting on its check.",
      },
      stars: {
        eyebrow: "The coach's evaluation",
        title1: "One star,",
        title2: "the same everywhere.",
        lede: "The overall rating goes from 1 to 5 stars. Each level has a definition, the same for every coach — it's the one they see when they give a rating. A 5-star in Sherbrooke means the same thing as a 5-star in Gatineau.",
        definitions: [
          "D1 prospect. Can start as a Division 1 player from the moment they enter CÉGEP.",
          "Could eventually start in D1. Certain D2 starter in their first season.",
          "D3 starter. Could reach the D2 level with significant progression.",
          "Could eventually become a D3 starter, but needs work and progression.",
          "Open to continuing at CÉGEP, but will need significant progression before being able to start even in D3.",
        ],
        detail: "Stats don't tell the whole story: 50 tackles in a weak league isn't 30 tackles in a strong one. In a detailed evaluation, the coach also rates physical tools, position-specific skills and character — leadership, discipline, coachability, game IQ. What a coach can say about a player, a spreadsheet can't.",
        question: {
          title: "What if a coach gives 5 stars to everyone?",
          body: "Their name is on every evaluation they sign. Recruiters can also rate the coaches they deal with, and those reviews build the coach's reputation. A coach who inflates their players pays for it in credibility.",
        },
      },
      distinctions: {
        eyebrow: "Distinctions",
        title1: "Badges",
        title2: "that mean something.",
        lede: "Coaches award distinctions to their athletes: captain, most valuable player, league leader, all-star team, plus badges specific to each sport. Not a sticker on a résumé: recognition signed by the person who watches you play.",
        labels: ["Captain", "Most valuable player", "League leader", "All-star team", "Clutch", "Nexus X"],
      },
      communication: {
        eyebrow: "Contact",
        title1: "The coach",
        title2: "stays in the loop.",
        paragraphs: [
          "Athletes being recruited are often minors. On Nexus, a recruiter can message the coach, and the athlete when the rules allow it.",
          "During RSEQ no-contact periods, Nexus automatically blocks recruiter messages to athletes in the sport concerned. The channel with the coach stays open.",
          "The coach sees recruiter activity on their players. They know who's interested in whom, and can guide what comes next.",
        ],
      },
      engagement: {
        eyebrow: "Our commitment",
        title1: "Visibility",
        title2: "is not for sale.",
        items: [
          { title: "Athletes never pay", body: "Profile, videos, verification, recruitment status: everything is free for the athlete." },
          { title: "Neither do coaches", body: "Building a team, verifying, evaluating, talking with recruiters: the coach account is free." },
          { title: "Every athlete, for every recruiter", body: "A free recruiter sees every athlete in their search. A subscription pays for tools — identity, videos, messaging, tracking. Nobody pays to push an athlete up." },
        ],
      },
      conviction: {
        eyebrow: "Our conviction",
        title1: "Sport keeps",
        title2: "kids in school.",
        paragraphs: [
          "We believe in student sport. It's what builds a young person's character. It's what creates friendships that last a lifetime. It's what pushes you to give more when no one's watching. Your environment, growing up, is what defines you — and for many, that environment is a team.",
          "Nexus doesn't reinvent the recruitment process. Well-known schools will keep producing recruited athletes. Big teams will keep existing. What we do is widen the door. Give a chance to the diamonds in the rough. Open possibilities for those who aren't in the right circle.",
          "Because somebody had the chance — or the persistence — to do the camps, meet the right people, and end up in the right program. And that person lived the three best years of their life.",
        ],
        closing: "We want that for every athlete in Québec.",
      },
      personas: {
        eyebrow: "Your move",
        title1: "Pick",
        title2: "your side.",
        items: [
          { question: "Are you an athlete?", line: "Create your profile and get seen by CÉGEP recruiters.", label: "For athletes" },
          { question: "Are you a coach?", line: "Verify your players, evaluate them, put them in the spotlight.", label: "For coaches" },
          { question: "Recruiting for a CÉGEP?", line: "Find and track high school athletes across Québec.", label: "For recruiters" },
        ],
      },
    },
    coachLanding: {
      hero: {
        eyebrow: "For coaches",
        title1: "Nexus saves",
        title2: "you time.",
        lede: "Every recruiter asks you the same questions about every one of your players. On Nexus, the answers are already in the player's profile: you have that conversation once.",
        ledeSmall: "Free, for you and for your players.",
        cta: "Sign up your team",
        ctaSecondary: "The conversation that keeps coming back",
        imageAlt: "Athlete profile seen by a recruiter: GPA, target program, open to relocating, to private and to English CÉGEPs, then the coach's report and rating (fictional data)",
      },
      discussion: {
        eyebrow: "The conversation that keeps coming back",
        title1: "The same conversation,",
        title2: "with every recruiter.",
        lede: "For every player, the same questions. Now the profile answers them.",
        items: [
          { q: "Is he ready to move to another region?", a: "“Open to relocating”, plus his preferred CÉGEP regions." },
          { q: "What's his potential?", a: "Your rating, your report and your distinctions, signed with your name." },
          { q: "Is he open to English CÉGEPs?", a: "“Open to English”: yes or no, on his profile." },
          { q: "And private CÉGEPs?", a: "“Open to private”: same thing." },
          { q: "Which program is he aiming for?", a: "His target CÉGEP program." },
          { q: "How are his grades?", a: "His overall average, strong subjects and academic honours." },
        ],
        note: "Your player fills in these answers once (or you do, in his file). After that, recruiters read them on his profile — without calling you to ask.",
        imageAlt: "Academic details on an athlete profile: target program, strong subjects, honours and preferred CÉGEP regions (fictional data)",
      },
      etapes: {
        eyebrow: "How it works",
        title1: "4 steps.",
        title2: "Zero paperwork.",
        items: [
          { title: "Sign up", body: "Create your account and link it to your school or club. It's free." },
          { title: "Build your team", body: "Invite your players by email. They fill in their own profile — or you create their file." },
          { title: "Verify and evaluate", body: "You confirm their info (blue check), give your rating and your distinctions." },
          { title: "Stay in the loop", body: "Recruiters message you, and you see their activity on your players." },
        ],
      },
      evaluation: {
        eyebrow: "Your evaluation",
        title1: "It's what",
        title2: "makes the difference.",
        points: [
          "Any athlete can say they're good. Your blue check says it's true.",
          "Simple evaluation (one rating) or detailed: physical tools, position-specific skills, character.",
          "A defined star scale, the same for every coach.",
          "Distinctions: captain, most valuable player, league leader, plus your sport's badges.",
          "Your name and your report come with the profile the recruiter reads.",
        ],
      },
      outils: {
        eyebrow: "Your tools",
        title1: "Everything to manage",
        title2: "your athletes.",
        items: [
          { title: "My athletes", body: "Your roster in one place: who's verified, who has a complete profile, who's being recruited." },
          { title: "To review", body: "Your athletes' requests land in a single inbox. You approve or decline." },
          { title: "Messaging", body: "Recruiters message you. You message your team, your fellow coaches and your administration." },
          { title: "My reputation", body: "Recruiters can rate the coaches they deal with. Their reviews and your badges — Evaluated, Recommended, Elite Coach, Placer — live on your page." },
          { title: "My school", body: "Dashboard, stats, placements and management of your school's coaches.", note: "School lead" },
          { title: "Schools and clubs", body: "School team or civil league: your team has its place, with its sport, category and division." },
        ],
      },
      contact: {
        eyebrow: "Contact",
        title1: "You stay",
        title2: "in the loop.",
        body: "A recruiter can message you at any time. During no-contact periods, Nexus blocks their messages to athletes: they go through you.",
      },
      cta: {
        eyebrow: "Be the nex",
        title1: "Ready to put",
        title2: "your players in the spotlight?",
        body: "Sign up for free. Build your team. Verify your athletes.",
        button: "Sign up your team",
        trustFree: "100% free",
        noPlayersPrefix: "Your players aren't signed up yet? ",
        noPlayersLink: "Send them this link",
      },
    },
    recruiterLanding: {
      v2: {
        hero: {
          eyebrow: "For recruiters and schools",
          title1: "All your recruiting,",
          title2: "in one place.",
          lede: "Find, evaluate and follow your athletes, from the first game to the signature.",
          cta: "Request a demo",
          ctaSecondary: "See the features",
        },
        fonctions: {
          eyebrow: "Features",
          title1: "What Nexus does",
          title2: "for you.",
          items: [
            { kicker: "Search", title: "Search and filters", points: ["Sport, position, class, league, division", "GPA, honours, CÉGEP preferences", "Coach-verified profiles, with video, with distinctions"], alt: "Athlete search with its filters" },
            { kicker: "My process", title: "Your process, step by step", points: ["Stages, from \"Identified\" to \"Letter signed\"", "Your grade, from A+ to E, and your notes", "\"Withdrawn\", with its reason: the history stays"], alt: "My process: columns by stage, grades and notes" },
            { kicker: "Live", title: "Scout during the game", points: ["One note per jersey number", "Offline: works without a signal", "Shared with your staff, sorted after the game"], alt: "Live: notes by jersey number during a game" },
            { kicker: "Games", title: "Game map and calendar", points: ["Games near you, on a map", "Your visit calendar", "Send a visit to Google Calendar or Outlook"], alt: "Game and visit calendar" },
            { kicker: "Prospects", title: "Cards for players not signed up yet", points: ["Create a card for a player you spotted, edit it", "When they sign up, Nexus offers to match it to their real profile"], alt: "Matching a prospect card with a Nexus profile" },
            { kicker: "Lists", title: "Your lists, with your notes", points: ["Group your athletes any way you like", "A private note on each one"], alt: "A list of athletes with its notes" },
            { kicker: "Rules", title: "No-contact periods, respected", points: ["During a no-contact period, Nexus flags it on the profile", "You can always write to the coach"], alt: "No-contact period notice on an athlete profile" },
          ],
        },
      },
      hero: {
        eyebrow: "For CÉGEP recruiters",
        titleLine1: "Find the athletes", // TODO-EN
        titleLine2: "your network", // TODO-EN
        titleLine3: "will never see.", // TODO-EN
        lede: "Nexus gives CÉGEP recruiters access to every verified athlete in Québec — filtered by sport, position, region, and graduation year. No matter the school. No matter the network.",
        ledeSmall: "100% Québec platform. Loi 25 compliant. Hosted in Québec.",
        cta: "See the platform in action",
        ctaSubtitle: "Discover Nexus in 2 minutes 30.",
        videoBadge: "Demo · 2 min 30",
        videoCaption: "How a CÉGEP recruiter uses Nexus day-to-day",
        videoComing: "Video coming soon.",
        videoAriaLabel: "Play demo video",
      },
      stats: [
        { value: "70+ CÉGEPs", desc: "RSEQ members covered" },
        { value: "16 sports", desc: "supported by Nexus" },
        { value: "ROI", desc: "more signings, less time wasted" },
        { value: "Loi 25", desc: "hosted in Québec" },
      ],
      problem: {
        eyebrow: "The problem",
        title: "CÉGEP recruiting runs on 10–15 personal contacts.", // TODO-EN
        lede: "You know the head coaches at the big schools in your region. You attend their big games. You call the same numbers every year. The system works — but it makes you invisible to talent outside your circle.",
        statusQuoEyebrow: "The status quo",
        statusQuoTitle: "Without Nexus",
        reinventedEyebrow: "Recruitment reinvented",
        reinventedTitlePrefix: "With ",
        reinventedTitleBrand: "Nexus",
        pains: [
          "You only see athletes inside your coach network",
          "Your conversations are scattered — email, text, Facebook, phone",
          "No way to know which athletes interest your competition",
          "Prospect tracking in an Excel sheet — or just from memory",
          "Impossible to evaluate an athlete from Saguenay from Montréal without spending the day there",
          "Athlete info varies by coach — stats, videos, evaluations",
        ],
        solutions: [
          "Database of every verified athlete in Québec, filterable in 10 seconds",
          "Integrated messaging per athlete — full history, zero lost messages",
          "Full visibility on each athlete's process — how many recruiters are following them, which CÉGEPs are already in discussion, and at what stage each one is",
          "Manage your recruitment process for every athlete — from the moment you spot them to the signing of their commitment letter",
          "Evaluate athletes from across Québec from your desk — any time, any region",
          "Every profile has the same structure, the same criteria, the same standard",
        ],
      },
      pillars: {
        eyebrow: "What you can do",
        title: "Everything you need to recruit effectively.", // TODO-EN
        items: [
          { title: "Advanced search", body: "Filter athletes by sport, position, region, graduation year, verification, distinctions, and video presence. Find a Sec. 5 QB in Mauricie in 10 seconds." },
          { title: "30-second profiles", body: "Every athlete has the same structure — physical, season stats, video, academic, coach evaluation. Decide in 30 seconds whether you want to contact the coach." },
          { title: "Visual tracking", body: "Kanban board: Discovered → Contacted → Visit → Signed letter. See your recruitment funnel at a glance. No prospect forgotten." },
          { title: "Blue check", body: "Every profile must be validated by a high school coach. The coach puts their reputation on the line to confirm the information — identity, stats, position, school. Which means everything you see has been verified by a named, accountable adult." },
        ],
      },
      verification: {
        eyebrow: "The verification badge",
        title: "Every verified profile is backed by a named coach.", // TODO-EN
        p1: "On Nexus, an athlete with a verification badge isn't just an online profile. It's an athlete whose high school coach has reviewed every field — identity, stats, school, position — and put their own reputation on the line to confirm it's all true.",
        p2: "Verification is monthly. Inactive athletes or those whose info is no longer current lose their verification badge. You never evaluate a zombie profile.",
        p3: "When you see a verification badge, you see the coach's credibility transferred to the athlete. That's saved time and reduced risk.",
        verifiedPill: "Verified",
        verifiedByLabel: "Verified by",
        verifiedByName: "Coach Pelletier",
        verifiedBySchool: "É.S. De Mortagne",
        quote: "\"Complete player, very smart on the field. Reads defenses before the snap. Natural leader in the locker room. Ready for CÉGEP Division 1.\"",
        badgeCaptain: "Captain",
        badgeAllstar: "All-star team",
        badgeLeader: "Leader",
      },
      reliability: {
        eyebrow: "Coach reliability",
        title: "A problem as old as recruiting — and our solution.", // TODO-EN
        lede: "We'll tell you honestly: sports recruiting has always had a reliability challenge. How do you know if a coach is inflating their players to help them get placed? How do you assess the credibility of what's being told to you? This problem existed before Nexus and will continue to exist outside of Nexus. The difference is that here, you have the tools to manage it.",
        subTitle: "Coach reputation, built by recruiters.", // TODO-EN
        p1: "On Nexus, every coach has a public reputation — visible to all recruiters before they read a single evaluation. That reputation is built by you and your fellow recruiters.",
        p2: "After each interaction with a coach — message, visit, recruitment — you can evaluate the quality and reliability of their observations. Those evaluations accumulate over time. A coach who systematically inflates their players will see their reputation reflect that tendency. A coach who evaluates accurately becomes a reference in their network.",
        p3: "The system corrects itself. Not by Nexus, but by the community of CÉGEP recruiters.",
        coachName: "Coach Pelletier",
        coachSchool: "É.S. De Mortagne",
        reliabilityCaption: "Reliability score — based on 14 recruiter evaluations",
        precisionLabel: "Evaluation accuracy",
        placedLabel: "Athletes placed in CÉGEP",
        responseLabel: "Average response time",
        pillRecommended: "Recommended",
        pillFastResponse: "Fast response",
        pillPlacer: "Placer",
        lastEvaluated: "Last evaluated 3 days ago by a recruiter from Vanier",
      },
      intelligence: {
        eyebrow: "Competitive intelligence",
        title: "Know where you stand — relative to the rest.", // TODO-EN
        p1: "A recruiter without Nexus learns through rumor that an athlete is talking with another CÉGEP. On Nexus, the information is on the profile: the athlete's recruitment status changes as soon as they advance in their process.",
        p2Pre: "On every profile, two indicators side by side: ",
        p2YourStatus: "your own status",
        p2Mid: " with that athlete, and the ",
        p2GlobalStatus: "global recruitment status",
        p2Post: " they carry (Open, In process, Recruited). If the global status moves to \"In process\" while you're still at \"Identified,\" the gap is visible.",
        p3: "The number of recruiters who have favorited them completes the picture — how many CÉGEPs are interested in them right now. No names per CÉGEP, no stages per competitor: just the signals that matter to decide if you need to speed up.",
        cardCategory: "Football · POS LB · Class of 2027",
        viewsLabel: "Views",
        favoritesLabel: "Favorites",
        myStatusLabel: "My status",
        myStatusValue: "Visit planned",
        recruitmentLabel: "Recruitment",
        recruitmentValue: "In process",
        annotationLead: "Global recruitment is moving.",
        annotationBody: "The athlete is in process with a CÉGEP — compare it to your own status to know if you need to speed up.",
        cardAlt: "Player card — Alexandre Tremblay",
      },
      pricing: {
        eyebrow: "Pricing",
        title: "A price for your level of recruitment.", // TODO-EN
        lede: "100% Québec recruitment. Payment in Canadian dollars. GST/QST included in displayed prices.",
        tiers: [
          {
            name: "Free",
            price: "$0",
            subtitle: "To explore the platform",
            bullets: [
              "Athlete search (basic filters)",
              "Full profiles of verified athletes",
              "5 messages/month to coaches",
              "Favorites (max 25 athletes)",
            ],
            buttonLabel: "Create an account",
          },
          {
            name: "Pro",
            price: "$19.99",
            priceSuffix: "/mo",
            subtitle: "For active recruiters",
            subheader: "Everything free, plus:",
            bullets: [
              "Advanced search (all filters, badges, video)",
              "Unlimited messages to coaches",
              "Unlimited favorites + named lists",
              "Full recruiter dashboard",
              "Real-time notifications",
              "View history per athlete",
            ],
            badge: "Popular",
            buttonLabel: "Choose Pro",
          },
          {
            name: "All Star",
            price: "$29.99",
            priceSuffix: "/mo",
            subtitle: "For competitive programs",
            subheader: "Everything Pro, plus:",
            bullets: [
              "Kanban board with drag-and-drop",
              "Publishable roster needs (Roster Needs)",
              "Recruiting analytics (conversion, average time, etc.)",
              "CSV/Excel export for CRM integration",
              "Multi-user (head coach + assistants)",
              "Priority support",
            ],
            buttonLabel: "Choose All Star",
          },
        ],
      },
      faq: {
        eyebrow: "Frequently asked questions",
        title: "Answers to the questions you're asking.", // TODO-EN
        items: [
          { q: "How does Nexus comply with Loi 25?", a: "All data is hosted in Québec. Parental consent is documented for every minor athlete before the profile goes live. Recruiters sign a confidentiality agreement at signup. Right to deletion and portability are respected within the legal deadlines." },
          { q: "How does Nexus respect the RSEQ calendar?", a: "Nexus doesn't insert itself into the RSEQ's official recruitment process — it's your responsibility to know and respect the recruitment periods for your sport. What Nexus does: communication with a minor athlete must go through their high school coach, consistent with the spirit of RSEQ rules. The coach decides when and how to involve the athlete. You remain in charge of your process; Nexus doesn't block you or dictate anything on the calendar side." },
          { q: "Can I contact an athlete directly?", a: "No. For minor athletes, all communication goes through their high school coach. It's the RSEQ rule and it's also a protection for you — the coach acts as a filter and context. You avoid misunderstandings and uncomfortable situations." },
          { q: "Can my CÉGEP competitors see who I'm scouting?", a: "By default, coaches see which CÉGEPs have viewed their athletes (to create a useful interest signal). Your direct competitors do NOT see your favorites lists — only the coaches of the athletes involved. You can adjust your visibility in settings." },
          { q: "How does Nexus distinguish a real recruiter from an impostor?", a: "Every recruiter must complete their profile with their CÉGEP, sport, division, and role. The Nexus team is notified of each new signup and validates the declared affiliation. High school coaches see the recruiter's full identity — name, CÉGEP, sport — before responding to any message. In case of a suspicious profile, the Nexus team can disable an account at any time." },
          { q: "Is there an annual commitment?", a: "Monthly subscriptions are flexible and can be cancelled at any time. Annual subscriptions offer significant savings (~20–40% depending on tier) for recruiters committed to the season. No cancellation penalty on a monthly plan." },
        ],
      },
      cta: {
        title1: "Ready to see every ", // TODO-EN
        title2: "talent", // TODO-EN
        title3: " in Québec?", // TODO-EN
        body: "Create your free account. Explore the platform. Put Pro to the test for 14 days at no cost.",
        button: "Create a free account",
        footer: "No credit card required. Set up your profile in 2 minutes.",
      },
    },
    parentLanding: {
      hero: {
        eyebrow: "For parents",
        titleLine1: "Your child is being recruited.",
        titleLine2: "You see everything.",
        lede: "Recruiting is a family decision. The Nexus parent portal gives you the full picture — free of charge.",
        ledeSmall: "Nothing to do on your end: your invitation arrives by email as soon as your child signs up.",
        cta: "Sign my child up",
        mockup: {
          label: "Parent portal",
          activityTitle: "Profile activity",
          activityCaption: "Last 12 weeks",
          consentTitle: "Permissions",
          consentValue: "2 active permissions",
          notificationTitle: "New contact",
          notificationBody: "A recruiter reached out to your child.",
        },
      },
      howItWorks: {
        eyebrow: "How it works",
        title: "3 steps. Nothing complicated.",
        steps: [
          { num: "01", role: "Sign-up", title: "Your child signs up", body: "They create their athlete profile and provide your email address." },
          { num: "02", role: "Invitation", title: "You receive an invitation", body: "It lands in your inbox automatically. It is the only way in: no one can create a parent account without it." },
          { num: "03", role: "Access", title: "You open their dashboard", body: "You create your free account and follow their journey." },
        ],
      },
      whatYouSee: {
        eyebrow: "What you see",
        title: "What matters, without the jargon.",
        tag: "Included",
        items: [
          { title: "Their activity, week by week", body: "Profile views, recruiter interest, progress — at a glance." },
          { title: "Recruiter interest in their profile", body: "How many recruiters viewed and followed their profile. Their identity stays confidential — by design." },
          { title: "A notification when a recruiter reaches out", body: "You are told about every first contact." },
          { title: "A direct channel with their school", body: "Message the coaches and athletic directors at your child's school." },
        ],
      },
      whoDecides: {
        eyebrow: "Your permissions",
        title: "Who decides? You do.",
        checks: [
          "You authorize the creation of their profile.",
          "You authorize their visibility to verified CÉGEP recruiters.",
          "You authorize — or refuse — the use of their image by our partners.",
          "You can withdraw any permission at any time, from your portal.",
        ],
        calloutTitle: "Governed by Quebec law",
        calloutBody: "Nexus complies with Law 25: your child's data is hosted in Quebec, and any permission you grant can be withdrawn. Every change is logged.",
      },
      faq: {
        eyebrow: "Frequently asked",
        title: "What parents ask us.",
        items: [
          { q: "Can I create my account without an invitation?", a: "No — and that is a safeguard. The invitation is sent only to the email address your child provided at sign-up." },
          { q: "Is the parent account paid?", a: "No. The parent portal is entirely free, with no time limit." },
          { q: "Is there an app to install?", a: "No. The parent portal runs in your browser, on computer and phone alike." },
          { q: "Can I withdraw a permission?", a: "Yes, at any time and without justification, from the Permissions section of your portal. Withdrawal takes effect immediately." },
          { q: "What if my child is under 14?", a: "Nexus does not accept athletes under 14. Between 14 and 17, your authorization is required and you receive the parental notice automatically." },
        ],
      },
      finalCta: {
        title: "Ready to follow their journey?",
        line: "It all starts with your child signing up. Your invitation follows automatically.",
        cta: "Sign my child up",
        bullets: ["100% free", "Automatic email invitation", "Available on the web"],
      },
    },
    athleteLanding: {
      hero: {
        eyebrow: "For student-athletes",
        title1: "Get seen",
        title2: "by CÉGEPs.",
        lede: "Your player card and your full profile, in one place. CÉGEP recruiters find you, no matter your school or your region.",
        cta: "Create your profile",
        ctaSecondary: "How it works",
        imageAlt: "Verified Nexus player card (fictional data)",
      },
      fonctions: {
        eyebrow: "What you get",
        title1: "Your profile.",
        title2: "Your shot.",
        items: [
          {
            kicker: "Your profile",
            title: "Everything a recruiter wants to see",
            points: ["Your card: sport, position, number, school, graduating class", "Your coach's report and rating", "Your highlights, measurements and team history", "Your academics and the program you're aiming for"],
            alt: "Coach report on an athlete profile seen by a recruiter: quote, overall rating, criteria and distinctions (fictional data)",
          },
          {
            kicker: "CÉGEPs",
            title: "Find your CÉGEP",
            points: ["Search CÉGEPs by program, sport and region", "Team pages show the positions they need to fill", "“Perfect match” when your position is wanted", "Save your favorite CÉGEPs"],
            alt: "CÉGEP team page: positions to fill, and a “Perfect match” for a quarterback (fictional data)",
          },
          {
            kicker: "Ambassador",
            title: "Bring your team",
            points: ["Invite your teammates with your personal link", "Every friend who signs up counts toward your recruits", "Unlock the Ambassador badge"],
            alt: "Ambassador program: recruits, tiers and the invite-teammates button (fictional data)",
          },
        ],
      },
      etapes: {
        eyebrow: "How it works",
        title: "3 steps.",
        items: [
          { title: "Sign up in a few minutes", body: "Apple or Google, your team code, then your info. Fill in what you can, polish it later." },
          { title: "Your coach verifies you", body: "They confirm your info and add their evaluation. The blue check gives your profile weight." },
          { title: "Recruiters find you", body: "Your profile shows up in their searches. They message your coach, or you when the rules allow it." },
        ],
      },
      gratuit: {
        eyebrow: "Free",
        title1: "Zero dollars.",
        title2: "For athletes.",
        body: "Your profile, your videos, your verification, your messages: all free. Nobody pays to be seen.",
        parentsLead: "Under 18? Your parents have their own page.",
        parentsLink: "For parents",
      },
      final: {
        eyebrow: "Be the nex",
        title1: "Download Nexus.",
        title2: "Your move.",
        appStoreSmall: "Download on the",
        playSmall: "Get it on",
        web: "or sign up on the web",
        codeLead: "No team code yet?",
        code: "Ask your coach for it.",
      },
    },
    pricing: {
      hero: {
        eyebrow: "Pricing",
        title1: "Free for athletes",
        title2: "and coaches.",
        lede: "Only recruiters have paid plans. Nobody pays to be seen.",
      },
      personaToggle: {
        recruiter: "Recruiter",
        coach: "Coach",
        athlete: "Athlete",
      },
      billingToggle: {
        monthly: "Monthly",
        annual: "Annual",
        saveLabel: "save",
      },
      card: {
        forever: "forever",
        fromPrefix: "From ",
        fromSuffixAnnual: " billed annually",
        orPrefix: "or ",
        orSuffixMonthly: " billed monthly",
        perYear: "/yr",
        perMonth: "/mo",
      },
      cegepBanner: {
        title: "CÉGEP plan — multiple recruiters?",
        body: "Does your program have more than one recruiter? Contact the Nexus team for an organizational plan tailored to your CÉGEP with group pricing and centralized management.",
        cta: "Contact the Nexus team →",
      },
      whyPro: {
        eyebrow: "Why Pro?",
        title: "You know you're being watched. Now know by whom.", // TODO-EN
        lede: "Every month, your profile is viewed by recruiters from across Québec. With Pro, you see their names, their CÉGEPs, and how often they come back.",
      },
      freePersona: {
        missionEyebrow: "Free",
        missionTitle: "Our mission",
        athleteMissionBody: "Every athlete deserves to take their journey to the next level. Nexus isn't just a player database: we give recruiters and student-athletes concrete tools that simplify every step of recruitment. And all of it, free for athletes.",
        coachMissionBody: "Every athlete deserves a shot at the next level — and no one is better placed than their coach to help them get there. Nexus isn't just a player database: we give you concrete tools to showcase your players, manage your team, and follow every step of the recruiting process. Free, for you and for them.",
        checklistTitle: "What's included",
        athleteItems: [
          "Complete profile: photo, bio, background, videos, stats and measurements",
          "Verified badge and overall coach rating",
          "My visibility: views, favorites, weekly chart, regions",
          "Messaging with recruiters, your coach and your school's administration, within RSEQ quiet periods",
          "Full CÉGEP search: programs, teams and details for every institution",
          "Transfer portal",
          "Documented parental consent",
          "Recruitment status",
        ],
        coachItems: [
          "Create and manage your athletes' profiles",
          "Simplified and detailed evaluations",
          "Verify your athletes",
          "Messaging with recruiters",
          "Internal messaging with your team, your coaches and your administration",
          "Handle your athletes' requests",
          "My school: dashboard, stats, placements, analytics (school lead)",
          "Manage your school's coaches (school lead)",
          "My reputation",
        ],
      },
      trust: {
        quebecHost: "Hosted in Québec",
        loi25: "Loi 25 compliant",
        verifiedProfiles: "Verified profiles",
      },
      tiers: {
        rec_free: {
          name: "Free",
          ctaLabel: "Start for free →",
          features: [
            { kind: "item", label: "Search by sport, region, graduation year, school, position", included: true },
            { kind: "item", label: "Stars, overall rating, verified badge", included: true },
            { kind: "item", label: "School, sport, graduation year, GPA", included: true },
            { kind: "item", label: "Height / weight", included: true },
            { kind: "item", label: "Athlete profiles + overall rating", included: true },
            { kind: "item", label: "Your CÉGEP page: a customizable page to showcase your program to athletes", included: true },
            { kind: "item", label: "Your team page: one page per team, visible to every athlete", included: true },
            { kind: "item", label: "Athlete identity (name, photo, number)", included: false },
            { kind: "item", label: "Videos and academic background", included: false },
            { kind: "item", label: "Messaging", included: false },
            { kind: "item", label: "Recruiting pipeline", included: false },
          ],
        },
        rec_pro: {
          name: "Pro",
          badgeLabel: "Popular",
          featuresHeader: "Everything in Free, plus:",
          ctaLabel: "Upgrade to Pro →",
          features: [
            { kind: "section", label: "Search and profiles" },
            { kind: "item", label: "Name, photo and jersey number revealed", included: true },
            { kind: "item", label: "Highlight videos", included: true },
            { kind: "item", label: "Full academic background", included: true },
            { kind: "item", label: "Coach's comments", included: true },
            { kind: "item", label: "Detailed coach report", included: true },
            { kind: "section", label: "Communication" },
            { kind: "item", label: "Coach's contact information", included: true },
            { kind: "item", label: "Messaging with the coach and the athlete, without limits, automatically respecting RSEQ quiet periods", included: true },
            { kind: "item", label: "Coach replies", included: true },
            { kind: "item", label: "Auto-intro and message templates", included: true },
            { kind: "section", label: "Tracking and pipeline" },
            { kind: "item", label: "Unlimited favorites", included: true },
            { kind: "item", label: "Recruiting pipeline", included: true },
            { kind: "item", label: "Global recruitment status", included: true },
            { kind: "item", label: "Pipeline analytics", included: true },
            { kind: "item", label: "Custom prospect lists", included: true },
            { kind: "item", label: "Activity feed", included: true },
            { kind: "section", label: "Planning" },
            { kind: "item", label: "Optimized calendar: RSEQ and civil league schedules combined, cross-referenced with your recruiting targets — see at a glance the games where several of the athletes you follow play at the same time", included: true },
          ],
        },
        rec_allstar: {
          name: "All Star",
          featuresHeader: "Everything in Pro — for institutions managing a recruiting team:",
          ctaLabel: "Go All Star →",
          features: [
            { kind: "item", label: "Institution dashboard: pipeline by sport, where recruits come from, your recruiting team's activity", included: true },
            { kind: "item", label: "Recruiting statistics: funnel by stage, results by sport, performance by recruiter, most-targeted athletes", included: true },
            { kind: "item", label: "Confirmed recruits: commitments and signed letters, with the source school and assigned recruiter", included: true },
            { kind: "item", label: "Manage your recruiters: activity, favorites, messages sent, confirmed recruits per person", included: true },
            { kind: "item", label: "Reassign athletes between recruiters without losing pipeline statuses", included: true },
          ],
        },
      },
    },
    roadmap: {
      hero: {
        eyebrow: "Roadmap",
        title: "What's coming.", // TODO-EN
        lede: "We're building Nexus continuously. No promised dates — just direction and priorities.",
      },
      phases: [
        {
          code: "Release 2",
          label: "Commercial growth",
          items: [
            { title: "Detailed CÉGEP page", body: "Every CÉGEP has its own page — sports offered, programs of study, contacts, and presentation." },
            { title: "Interactive school search", body: "Find CÉGEPs by location, sport, program of study. Interactive map included." },
            { title: "Athlete comparison", body: "Compare two athletes side by side — stats, evaluations, distinctions, academic profile." },
            { title: "Evaluation history", body: "See an athlete's past evaluations to show their progression from one season to the next." },
            { title: "Nexus blog", body: "Articles, tips, and analysis on sports recruitment in Québec." },
            { title: "CÉGEP webinars", body: "CÉGEPs present their sport-études programs directly to high school coaches." },
            { title: "Advanced recruitment guide", body: "Interactive and personalized version of the guide — timeline adapted to your situation and sport." },
            { title: "Showcase and event calendar", body: "Camps, showcases, open houses, combines — every recruitment event in Québec in one place." },
            { title: "Public commitments board", body: "Who signed where? A real-time board of letters of intent and confirmed commitments by sport and year." },
          ],
        },
        {
          code: "Release 3",
          label: "CÉGEP value",
          items: [
            { title: "CÉGEP roster management", body: "Board of needs by sport and position vs current players. The director sees the holes in their roster." },
            { title: "CÉGEP blog", body: "Every CÉGEP publishes on its page — results, testimonials, open-house days. Visibility and content." },
            { title: "Alumni tracking", body: "Track where recruited athletes are after 1, 2, 3 years. Social proof for the CÉGEP and the coach." },
            { title: "Transfer portal", body: "Athletes who change CÉGEPs mid-journey. Visibility for programs with spots to fill." },
          ],
        },
        {
          code: "Release 4",
          label: "Intelligence",
          items: [
            { title: "AI needs analysis", body: "Analysis of current roster, graduating players, and position gaps. Automatic prospect suggestions." },
            { title: "Recruitment tour optimization", body: "Smart planning: which prospects to visit, in what order, optimized by distance and priority." },
            { title: "Recruitment-readiness score", body: "The coach sees which athletes are \"ready to be presented\" to recruiters — based on completion, video, and evaluations." },
            { title: "Smart notifications", body: "\"3 new athletes match your criteria this week\" — \"This QB is being viewed by 5 CÉGEPs, act quickly.\"" },
            { title: "Regional heatmap", body: "Map of Québec showing athlete density by region and by sport. Strategic tool for recruiters." },
          ],
        },
        {
          code: "Release 5",
          label: "Expansion",
          items: [
            { title: "University → CÉGEP bridge", body: "Canadian universities recruit from CÉGEPs. Same model, one level up. New paying segment." },
            { title: "Pan-Canadian expansion", body: "Adapt Nexus for English-speaking provinces: high school → college/university. Bilingual translation. 10x larger market." },
            { title: "Native app (iOS/Android)", body: "Full mobile rewrite for an optimal phone experience." },
            { title: "Public API", body: "Allow schools and CÉGEPs to integrate Nexus data into their systems (Clara, Omnivox)." },
          ],
        },
      ],
      bottom: {
        title: "Got an idea?", // TODO-EN
        body: "We're building Nexus for you. If a feature is missing, we want to know.",
        cta: "Write to us →",
      },
    },
    about: {
      hero: {
        eyebrow: "About",
        title1: "Nexus is people",
        title2: "before it's a product.",
        lede: "A former athlete who wanted to be seen. A former coach who wanted to give his players a chance. Two tech professionals who know how to build secure platforms. That's who we are.",
      },
      founders: {
        eyebrow: "The founders",
        title1: "An athlete.",
        title2: "A coach.",
        bp: {
          name: "Bruno-Philippe Desfosses Simard",
          role: "Founder · Former athlete",
          bio: "Former college football player. I lived the recruitment process from the inside — I saw teammates more talented than me go unnoticed because their coach didn't know the right people. In parallel, I work in technology — infrastructure, applications, cybersecurity. Nexus combines these two worlds.",
          photoAlt: "Bruno-Philippe Desfosses Simard",
        },
        chuck: {
          name: "Chuck",
          role: "Co-founder · Former coach",
          bio: "Former high school coach. I saw up close what makes the difference between a player who gets recruited and a player who gets forgotten — and often, it has nothing to do with talent. Like Bruno, I come from cybersecurity and infrastructure. We built Nexus with the conviction that young athletes' data deserves the same level of protection as a banking system.",
          photoAlt: "Chuck",
        },
      },
      engagements: {
        eyebrow: "Our commitments",
        title1: "Young athletes' data,",
        title2: "we protect it.",
        lede: "Nexus is built by cybersecurity professionals. Profiles of minors deserve to be handled seriously.",
        items: [
          { title: "Hosted in Montréal", body: "Personal information is hosted in Canada, in the Montréal region (Amazon Web Services, Canada Central)." },
          { title: "Loi 25 compliant", body: "A person in charge of the protection of personal information is designated. Access, correction or complaint: they answer." },
          { title: "14 and older", body: "You must be 14 to create your own account. Between 14 and 17, the athlete names a parent or guardian, who receives an invitation." },
          { title: "A parent portal", body: "Parents have their own access to follow their child's profile and manage consents." },
        ],
        privacyLink: "Privacy policy",
      },
      contact: {
        eyebrow: "Write to us",
        title1: "A question",
        title2: "for the team?",
        lede: "We respond within 48 hours.",
        labelName: "Full name",
        placeholderName: "Jean Tremblay",
        labelEmail: "Email",
        placeholderEmail: "jean@ecole.qc.ca",
        labelSubject: "Subject",
        labelMessage: "Message",
        placeholderMessage: "How can we help you?",
        submit: "Send message",
        subjects: {
          general: "General question",
          partnership: "Partnership",
          support: "Technical support",
          media: "Media",
          other: "Other",
        },
        submitting: "Sending…",
        toast: "Message sent! We'll get back to you within 48 hours.",
        toastError: "Couldn't send right now. Try again or email bpdesfosses@nexussports.ca.",
      },
    },
    auth: {
      eyebrow: "Recruitment platform",
      titleLogin: "Log in",
      titleSignup: "Sign up",
      subtitleLogin: "Access your space and connect with your network.",
      subtitleSignup: "Join Québec's #1 sports recruitment platform.", // TODO-EN
      tabs: { login: "Log in", signup: "Sign up" },
      google: "Continue with Google",
      orEmail: "or with email",
      referralBanner: "You've been invited by a Nexus ambassador!", // TODO-EN
      toasts: {
        socialPhase2: "Social login — available in Phase 2",
        forgotPhase2: "Available in Phase 2",
      },
      signup: {
        choice: {
          title: "Are you next to be recruited?", // TODO-EN
          lede: "Build your profile in 2 minutes. Get seen by every CÉGEP recruiter in Québec.", // TODO-EN
          // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
          cta: "Be the nex",
          notAthlete: "Not an athlete?",
          coach: { title: "Coach", sub: "High school" },
          civilLeague: { title: "Civil league", sub: "Coach or coord." },
          recruiter: { title: "Recruiter", sub: "CÉGEP" },
        },
        form: {
          back: "Back",
          heading: "Build your profile",
          headingSub: "— Are you next to be recruited?", // TODO-EN
          labels: {
            firstName: "First name",
            lastName: "Last name",
            email: "Email",
            password: "Password",
            confirm: "Confirm",
            context: "You play for...",
            sport: "Your main sport",
          },
          placeholders: {
            firstName: "Marc-Antoine",
            lastName: "Tremblay",
            email: "marc-antoine@gmail.com",
            password: "Password",
          },
          passwordHint: "Minimum 8 characters",
          passwordMismatch: "Passwords don't match",
          context: {
            scolaire: { title: "High school", sub: "RSEQ, school team" },
            civile: { title: "Civil league or club", sub: "Outside RSEQ, community team" },
          },
          consent: {
            policy: {
              before: "I have read and accept Nexus's ",
              privacy: "Privacy policy",
              and: " and ",
              terms: "Terms of use",
              after: ".",
            },
            data: {
              before: "I accept Nexus's ",
              link: "collection and processing of my data",
              after: " for the stated purposes.",
            },
            marketing: {
              before: "I accept to receive ",
              link: "marketing communications",
              after: " from Nexus (new features, tips, promotions). Maximum 2 emails per month.",
              optional: "(optional)",
            },
            error: "You must accept the first two consents to continue.",
          },
          submit: "Create my athlete profile →", // TODO-EN
        },
        switchToLogin: { prompt: "Already have an account?", cta: "Log in" },
      },
      login: {
        forgot: "Forgot password?",
        loading: "Logging in...",
        submit: "Log in →",
        switchToSignup: {
          prompt: "Don't have an account yet?",
          cta: "Build your athlete profile in 2 minutes →", // TODO-EN
        },
        placeholderEmail: "coach@ecole.qc.ca",
        placeholderPassword: "Password",
      },
    },
  },
};
