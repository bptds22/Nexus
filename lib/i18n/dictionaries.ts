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
  howItWorks: {
    hero: {
      eyebrow: string;
      title: string;
      lede: string;
      discoverHint: string;
    };
    why: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      p3: string;
    };
    verification: {
      eyebrow: string;
      title: string;
      lede: string;
      grayTitle: string;
      grayBody: string;
      blueTitle: string;
      blueBody: string;
      perishableTitle: string;
      perishableBody: string;
    };
    stars: {
      eyebrow: string;
      title: string;
      lede: string;
      closing: string;
      definitions: string[];
    };
    philosophy: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      p3: string;
      badgesTitle: string;
      badgesLede: string;
      badgesClosing: string;
      badgeNames: {
        captain: string;
        allstar: string;
        progression: string;
        team_leader: string;
        league_leader: string;
        mvp: string;
        custom: string;
      };
      badgeDescs: {
        captain: string;
        allstar: string;
        progression: string;
        team_leader: string;
        league_leader: string;
        mvp: string;
        custom: string;
      };
      badgeDetails: {
        team_leader: string;
        league_leader: string;
        custom: string;
      };
    };
    reputation: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      closing: string;
      badges: { name: string; threshold: string }[];
    };
    communication: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      p3: string;
    };
    engagement: {
      eyebrow: string;
      title: string;
      lede: string;
      principleAthleteTitle: string;
      principleAthleteBody: string;
      principleVisibilityTitle: string;
      principleVisibilityBody: string;
      principleCoachTitle: string;
      principleCoachBody: string;
      closing: string;
    };
    conviction: {
      eyebrow: string;
      title: string;
      p1: string;
      p2: string;
      p3: string;
      p4: string;
    };
    personas: { question: string; line: string; label: string }[];
  };
  coachLanding: {
    hero: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      lede: string;
      ledeSmall: string;
      cta: string;
      mockupAlt: string;
    };
    howItWorks: {
      eyebrow: string;
      title: string;
      steps: { role: string; title: string; body: string }[];
    };
    evaluation: {
      eyebrow: string;
      title: string;
      body: string;
      cta: string;
      mockupAlt: string;
    };
    reputation: {
      eyebrow: string;
      title: string;
      lede: string;
      badges: { name: string; threshold: string }[];
      stats: { label: string; value: string }[];
      progressTitle: string;
      progressFooter: string;
    };
    myAthletes: {
      eyebrow: string;
      title: string;
      body: string;
      mockupAlt: string;
    };
    messaging: {
      eyebrow: string;
      title: string;
      body: string;
      mockupLabel: string;
      items: { name: string; org: string; preview: string; time: string }[];
    };
    features: {
      eyebrow: string;
      title: string;
      lede: string;
      tierFree: string;
      tierPro: string;
      items: { title: string; body: string }[];
    };
    pricing: {
      eyebrow: string;
      title: string;
      cta: string;
      tiers: {
        name: string;
        price: string;
        priceSuffix?: string;
        subtitle: string;
        subheader?: string;
        bullets: string[];
        badge?: string;
      }[];
    };
    cta: {
      title1: string;
      title2: string;
      title3: string;
      body: string;
      button: string;
      trustFree: string;
      trustQuick: string;
      noPlayersPrefix: string;
      noPlayersLink: string;
    };
  };
  recruiterLanding: {
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
  athleteLanding: {
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    problem: {
      title: string;
      items: { title: string; description: string }[];
    };
    solution: {
      title: string;
      items: { title: string; description: string }[];
    };
    steps: {
      items: { number: string; title: string; description: string }[];
    };
    features: {
      title: string;
      items: { title: string; description: string }[];
    };
    cta: {
      title: string;
      button: string;
      subtext: string;
    };
  };
  pricing: {
    hero: {
      eyebrow: string;
      title: string;
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
    trust: {
      quebecHost: string;
      loi25: string;
      verifiedProfiles: string;
    };
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
      title: string;
      lede: string;
    };
    founders: {
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
    security: {
      eyebrow: string;
      title: string;
      body: string;
    };
    contact: {
      eyebrow: string;
      title: string;
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
    },
    nav: {
      discover: "Découvrir Nexus",
      forCoaches: "Pour les coachs",
      forRecruiters: "Pour les recruteurs",
      forAthletes: "Pour les étudiants-athlètes",
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
        title: "Le talent n'a pas de code postal.",
        lede: "Quand j'étais au secondaire, chaque joueur de football de mon école allait au même CÉGEP. C'était juste comme ça. Si je n'avais pas fait des camps et rencontré d'autres personnes, je n'aurais jamais vécu les trois meilleures années de ma vie ailleurs. Nexus existe pour que ce genre de rencontre ne dépende pas de la chance.",
        discoverHint: "Découvre comment ↓",
      },
      why: {
        eyebrow: "Pourquoi",
        title: "Le recrutement sportif au Québec roule sur les réseaux.",
        p1: "Les recruteurs CÉGEP connaissent les entraîneurs des grosses écoles secondaires. Ils assistent aux gros matchs. Ils appellent les mêmes numéros année après année. Ce système fonctionne — mais seulement pour les athlètes qui sont dans le bon cercle.",
        p2: "Les écoles connues envoient leurs joueurs aux mêmes CÉGEPs. Les petites écoles se font oublier. Les jeunes en région se font oublier. Ce n'est pas une question de talent — c'est une question de réseau. Et tu ne choisis pas ton école secondaire en fonction de qui elle connaît.",
        p3: "Nexus donne à chaque athlète la même visibilité structurée, peu importe son école, sa région ou le cercle d'influence de son entraîneur. Le talent ne change pas de valeur selon le code postal. Nexus non plus.",
      },
      verification: {
        eyebrow: "La vérification",
        title: "Pourquoi un profil bleu vaut plus qu'un profil gris.",
        lede: "Sur Nexus, tout athlète peut créer son profil. Mais pas tous les profils portent le même poids aux yeux des recruteurs. La différence, c'est la vérification.",
        grayTitle: "Check gris — Profil non vérifié",
        grayBody: "L'athlète a créé son propre profil. Les infos sont là, mais personne ne les a confirmées. Le recruteur les prend avec un grain de sel — et c'est normal.",
        blueTitle: "Check bleu — Profil vérifié par un coach",
        blueBody: "L'entraîneur a passé en revue chaque champ du profil — identité, stats, école, position. Il met sa propre réputation en jeu en certifiant que tout est vrai. Le check bleu, c'est la crédibilité du coach transférée à l'athlète.",
        perishableTitle: "La vérification est périssable.",
        perishableBody: "Le premier de chaque mois, l'athlète reçoit 14 jours pour confirmer que ses infos sont toujours à jour. Pas de confirmation dans les temps = retour au check gris. Le coach peut toujours re-vérifier après. On empêche les profils zombies — un athlète vérifié il y a 2 ans ne peut pas glisser sur un check périmé.",
      },
      stars: {
        eyebrow: "La cote",
        title: "Ce que veut vraiment dire chaque étoile.",
        lede: "Sur Nexus, la cote globale d'un athlète va de 1 à 5 étoiles. Mais une étoile, ça veut dire quoi exactement? On a défini une échelle claire pour que tous les coachs parlent la même langue.",
        closing: "Une étoile sur Nexus = la même étoile partout. Un 5 étoiles donné par un coach de Sherbrooke veut dire la même chose qu'un 5 étoiles donné par un coach de Gatineau. C'est ça, la langue commune.",
        definitions: [
          "Prospect D1, prêt à partir dès le CÉGEP.",
          "Potentiel D2, et le D1 à portée.",
          "Partant en D3, potentiel D2 avec de la progression.",
          "Le D3 est à ta portée avec du travail.",
          "Un point de départ — la progression est devant toi.",
        ],
      },
      philosophy: {
        eyebrow: "La philosophie",
        title: "Pourquoi les stats brutes ne suffisent pas.",
        p1: "Après avoir parlé avec plusieurs recruteurs CÉGEP, on a compris une chose: les stats ne racontent pas toute l'histoire. 50 plaqués dans une ligue faible, ce n'est pas 30 plaqués dans une ligue forte. Un joueur peut avoir des chiffres gonflés ou sous-évalués — et le recruteur n'a aucun moyen de calibrer.",
        p2: "Ce que les recruteurs veulent, c'est comprendre ce qu'un joueur apporte. Son caractère. Sa façon de lire le jeu. Sa capacité à progresser. C'est pour ça qu'on évalue sur 8 critères standardisés: leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d'équipe, résilience, attitude.",
        p3: "Les stats physiques — taille, poids, 40 verges, vertical — restent sur le profil. Mais ce qui fait la différence à l'évaluation finale, c'est ce qu'un coach peut dire du joueur. Pas un tableur.",
        badgesTitle: "Les distinctions Nexus — le langage commun des coachs.",
        badgesLede: "Les coachs attribuent des badges aux athlètes selon leurs accomplissements et leurs qualités sur le terrain. Chaque badge représente une réalité mesurable — pas une opinion vague. Les recruteurs savent exactement ce qu'ils regardent quand ils voient ces distinctions.",
        badgesClosing: "Un badge sur Nexus, c'est un accomplissement vérifié par un coach. Pas un autocollant qu'on met sur un CV. C'est ce qui permet à un recruteur d'évaluer un athlète en 30 secondes — et de savoir que ce qu'il voit est réel.",
        badgeNames: {
          captain: "Capitaine",
          allstar: "Étoile provinciale",
          progression: "Progression marquée",
          team_leader: "Meneur d'équipe",
          league_leader: "Meneur de la ligue",
          mvp: "Joueur par excellence",
          custom: "Distinction personnalisée",
        },
        badgeDescs: {
          captain: "Désigné capitaine de son équipe. Leadership officiel reconnu par le coach.",
          allstar: "Sélectionné parmi les meilleurs de sa catégorie au niveau provincial.",
          progression: "A démontré une évolution significative sur une ou plusieurs saisons.",
          team_leader: "Chef de file statistique de son équipe. Le coach choisit la catégorie qui s'applique au sport (points, plaqués, buts, passes, interceptions, etc.).",
          league_leader: "Chef de file statistique dans sa ligue. Le coach choisit la catégorie dominante — toute stat mesurable de son sport.",
          mvp: "Reconnu comme joueur clé par son entraîneur pour sa saison ou sa carrière.",
          custom: "Accomplissement spécifique reconnu par le coach — le texte est libre et reflète la réalité de l'athlète (ex. titre régional, record d'équipe, distinction du tournoi).",
        },
        badgeDetails: {
          team_leader: "Catégorie au choix",
          league_leader: "Catégorie au choix",
          custom: "Texte personnalisé",
        },
      },
      reputation: {
        eyebrow: "L'anti-triche",
        title: "Qu'est-ce qui empêche un coach de donner 5 étoiles à tout le monde?",
        p1: "Question légitime. La réponse courte: la même chose qui empêche un mauvais avocat de garder ses clients — sa réputation.",
        p2: "Sur Nexus, les coachs construisent une réputation à travers leurs actions. Chaque évaluation, chaque athlète vérifié, chaque placement confirmé compte. Les coachs accumulent des badges: Évalué, Recommandé, Coach Élite, Placeur.",
        closing: "Bientôt, les recruteurs pourront évaluer directement les coachs après avoir recruté leurs athlètes. Un coach qui gonfle ses joueurs verra ses recommandations perdre de leur valeur. Un coach qui sait évaluer correctement deviendra une référence. Le système se corrige lui-même — exactement comme dans la vraie vie.",
        badges: [
          { name: "Évalué", threshold: "3 évaluations" },
          { name: "Recommandé", threshold: "5 évaluations" },
          { name: "Coach Élite", threshold: "15 évaluations" },
          { name: "Placeur", threshold: "5 athlètes avec lettre signée" },
        ],
      },
      communication: {
        eyebrow: "La communication",
        title: "Le coach est le point de contact. Toujours.",
        p1: "Au Québec, les athlètes en voie de recrutement sont souvent mineurs. Les règles du RSEQ et le bon sens s'alignent: la communication entre un recruteur CÉGEP et un athlète mineur passe par l'entraîneur.",
        p2: "Sur Nexus, c'est intégré. Quand un recruteur s'intéresse à un athlète, il écrit au coach via la messagerie. Le coach décide quoi partager, comment répondre, et quand impliquer l'athlète. C'est pas une gatekeeping — c'est une protection.",
        p3: "Nexus suit les calendriers RSEQ par sport, mais ne les impose pas. Les recruteurs peuvent toujours contacter les coachs en dehors des périodes officielles. Ce que le coach choisit de partager, c'est sa décision. Nexus donne les outils, pas les règles.",
      },
      engagement: {
        eyebrow: "L'engagement",
        title: "La visibilité d'un athlète n'est jamais à vendre.",
        lede: "Sur Nexus, les abonnements existent — mais ils gatent des outils, jamais des athlètes.",
        principleAthleteTitle: "L'athlète ne paie jamais",
        principleAthleteBody: "Profil complet, vidéos illimitées, vérification, statut de recrutement — tout est gratuit pour l'athlète. Pour toujours.",
        principleVisibilityTitle: "La visibilité n'est pas gatée",
        principleVisibilityBody: "Un recruteur gratuit voit le même profil qu'un recruteur payant. Un talent ne peut pas être ignoré parce qu'un recruteur n'a pas payé.",
        principleCoachTitle: "Le coach a toujours l'essentiel gratuit",
        principleCoachBody: "Créer des profils, évaluer, vérifier, recevoir des messages — c'est gratuit. Les outils d'analyse avancée sont Pro. Jamais l'inverse.",
        closing: "On facture les outils — pipeline avancé, analytique recruteur, stats d'école. Pas le droit d'être vu. Un jeune athlète qui mérite d'être recruté le sera, peu importe qui paie quoi autour de lui.",
      },
      conviction: {
        eyebrow: "Notre conviction",
        title: "Le sport, c'est ce qui garde les jeunes à l'école.",
        p1: "On croit au sport étudiant. C'est ce qui bâtit le caractère d'un jeune. C'est ce qui crée les amitiés qui durent toute la vie. C'est ce qui te pousse à te dépasser quand personne ne regarde. Ton environnement, quand tu grandis, c'est ce qui te définit — et pour beaucoup, cet environnement, c'est une équipe.",
        p2: "Nexus ne réinvente pas le processus de recrutement. Les écoles connues vont continuer à produire des athlètes recrutés. Les grandes équipes vont continuer à exister. Ce qu'on fait, c'est élargir la porte. Donner une chance aux diamants bruts. Ouvrir les possibilités pour ceux qui ne sont pas dans le bon cercle.",
        p3: "Parce que quelqu'un a eu la chance — ou la persévérance — de faire des camps, de rencontrer les bonnes personnes, et de finir dans le bon programme. Et cette personne-là a vécu les trois meilleures années de sa vie.",
        p4: "On veut ça pour tous les athlètes du Québec.",
      },
      personas: [
        { question: "Tu es un athlète?", line: "Crée ton profil et fais-toi repérer par les recruteurs CÉGEP.", label: "Découvrir →" },
        { question: "Tu es un entraîneur?", line: "Vérifie tes joueurs, ajoute ton évaluation, bâtis ta réputation.", label: "Découvrir →" },
        { question: "Tu es un recruteur CÉGEP?", line: "Trouve les meilleurs prospects du secondaire à travers le Québec.", label: "Découvrir →" },
      ],
    },
    coachLanding: {
      hero: {
        eyebrow: "Pour les entraîneurs du secondaire",
        titleLine1: "Tes joueurs méritent d'être vus.",
        titleLine2: "Ta réputation aussi.",
        lede: "Vérifie tes athlètes, ajoute ton évaluation, et bâtis ta réputation comme entraîneur. Les recruteurs CÉGEP font confiance aux coachs qui connaissent leurs joueurs.",
        ledeSmall: "Tes joueurs s'inscrivent. Tu les vérifies. Tout le monde y gagne.",
        cta: "Sois le Nex",
        mockupAlt: "Tableau de bord entraîneur — Mes athlètes",
      },
      howItWorks: {
        eyebrow: "Comment ça marche",
        title: "4 étapes. Un impact réel.",
        steps: [
          { role: "Inscription", title: "Inscris-toi", body: "Crée ton compte en 2 minutes et associe-toi à ton école. C'est gratuit." },
          { role: "Vérification", title: "Vérifie tes athlètes", body: "Tes joueurs remplissent leur profil eux-mêmes. Tu confirmes leurs infos et tu ajoutes ton évaluation. Leur profil passe de visible à crédible." },
          { role: "Réputation", title: "Bâtis ta réputation", body: "Chaque vérification et chaque placement comptent. Tes badges Coach Élite et Placeur disent aux recruteurs que tu connais tes joueurs." },
          { role: "Contact", title: "Deviens le point de contact", body: "Selon les règles du RSEQ, les recruteurs CÉGEP communiquent d'abord avec l'entraîneur — pas directement avec l'athlète mineur. Sur Nexus, tu gères cette communication via la messagerie intégrée. Tu facilites le lien entre tes joueurs et les programmes CÉGEP, dans le respect des règles." },
        ],
      },
      evaluation: {
        eyebrow: "Ton évaluation",
        title: "Ton évaluation, c'est ce qui fait la différence.",
        body: "N'importe quel athlète peut dire qu'il est bon. Quand tu le vérifies et que tu l'évalues sur 8 critères — leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d'équipe, résilience, attitude — les recruteurs savent que c'est vrai. Ton rapport est lu par chaque recruteur qui consulte le profil.",
        cta: "Sois le Nex →",
        mockupAlt: "Profil athlète vérifié avec évaluation du coach",
      },
      reputation: {
        eyebrow: "Ma réputation",
        title: "Ta réputation te précède.",
        lede: "Chaque vérification et chaque placement comptent. Quand un recruteur clique sur ton nom, il voit ta page de réputation — ton historique, tes évaluations, tes badges. C'est ce qui te distingue.",
        badges: [
          { name: "Évalué", threshold: "3 évaluations" },
          { name: "Recommandé", threshold: "5 évaluations" },
          { name: "Coach Élite", threshold: "15 évaluations" },
          { name: "Placeur", threshold: "5 athlètes avec lettre signée" },
        ],
        stats: [
          { label: "Temps de réponse moyen", value: "2h" },
          { label: "Athlètes placés", value: "8" },
          { label: "Profils complétés", value: "87%" },
        ],
        progressTitle: "Prochain badge — Coach Élite",
        progressFooter: "Coach Élite dans 3 évaluations.",
      },
      myAthletes: {
        eyebrow: "Mes athlètes",
        title: "Tous tes joueurs. Un seul endroit.",
        body: "Vois d'un coup d'œil qui est vérifié, qui a un profil complet, qui est en processus de recrutement. Gère ton équipe sans tableur et sans papier.",
        mockupAlt: "Tableau de bord entraîneur — gestion des athlètes",
      },
      messaging: {
        eyebrow: "Messagerie",
        title: "Tu es le premier point de contact.",
        body: "Quand un recruteur s'intéresse à un de tes joueurs, il te contacte via Nexus — pas le parent, pas l'athlète. Tu contrôles la communication. Tu facilites le processus. C'est ton rôle.",
        mockupLabel: "Messagerie",
        items: [
          { name: "Jean-François L.", org: "Collège André-Grasset", preview: "Bonjour coach, j'aimerais discuter du profil d'Alexandre…", time: "2h" },
          { name: "Caroline M.", org: "CÉGEP de Sherbrooke", preview: "Merci pour l'évaluation. On planifie une visite…", time: "1j" },
          { name: "Philippe D.", org: "Campus Notre-Dame-de-Foy", preview: "Est-ce qu'Émilie serait disponible pour…", time: "3j" },
        ],
      },
      features: {
        eyebrow: "Fonctionnalités",
        title: "Tout ce qu'il te faut pour gérer tes athlètes.",
        lede: "Crée des profils et vérifie tes athlètes gratuitement. Débloque l'intelligence avec Pro.",
        tierFree: "Gratuit",
        tierPro: "Pro · 9,99$/mois",
        items: [
          { title: "Compte entraîneur", body: "Crée ton compte, associe-toi à ton école." },
          { title: "Gestion des athlètes", body: "Crée et gère les profils. Ajout illimité." },
          { title: "Vérification", body: "Vérifie les profils. Badge bleu = crédibilité." },
          { title: "Évaluation simplifiée", body: "Évalue sur les critères essentiels. Visible par les recruteurs." },
          { title: "Messagerie entrante", body: "Reçois les messages des recruteurs intéressés par tes joueurs." },
          { title: "Notifications", body: "Sois alerté quand un recruteur consulte un de tes athlètes." },
          { title: "Mon école", body: "Page complète de ton école — tous les sports, tous les athlètes, tous les coachs." },
          { title: "Stats école", body: "Vues, profils consultés, tendances par sport." },
          { title: "Placement", body: "Suis tes athlètes — qui est recruté, par quel CÉGEP." },
          { title: "Ma réputation", body: "Tes badges, ton historique, ta crédibilité." },
          { title: "Analytics", body: "Tendances, activité recruteurs, performance pipeline." },
        ],
      },
      pricing: {
        eyebrow: "Prix",
        title: "Un seul objectif — tes joueurs.",
        cta: "Sois le Nex",
        tiers: [
          {
            name: "Gratuit",
            price: "0$",
            subtitle: "Pour commencer",
            bullets: [
              "Créer un compte et rejoindre une école",
              "Créer et gérer les profils athlètes",
              "Évaluations simplifiées (5 critères)",
              "Vérifier les profils (badge bleu)",
              "Recevoir les messages de recruteurs",
              "Notifications d'activité",
            ],
          },
          {
            name: "Pro",
            price: "9,99$",
            priceSuffix: "/mois",
            subtitle: "ou 79$/an — économise 34%",
            subheader: "Tout ce qui est gratuit, plus :",
            bullets: [
              "Accès à Mon école (page complète de ton école)",
              "Stats école (vues, tendances, activité)",
              "Placement (suivi de tes athlètes recrutés)",
              "Ma réputation (badges et historique)",
              "Analytics avancé (tendances et performance)",
            ],
            badge: "Populaire",
          },
          {
            name: "All Star",
            price: "19,99$",
            priceSuffix: "/mois",
            subtitle: "ou 159$/an — économise 34%",
            subheader: "Tout du plan Pro, plus :",
            bullets: [
              "Gestion complète de l'école (ajout et gestion des coachs)",
              "Analytique avancée par athlète et par équipe",
              "Suivi détaillé des placements en CÉGEP",
              "Statistiques d'école complètes",
              "Outils d'invitation pour les entraîneurs",
            ],
          },
        ],
      },
      cta: {
        title1: "Prêt à faire la ",
        title2: "différence",
        title3: " pour tes joueurs?",
        body: "Inscris-toi gratuitement. Vérifie tes athlètes. Bâtis ta réputation.",
        button: "Sois le Nex",
        trustFree: "100% gratuit",
        trustQuick: "Inscription en 2 min",
        noPlayersPrefix: "Pas de joueurs inscrits? ",
        noPlayersLink: "Envoie-leur ce lien →",
      },
    },
    recruiterLanding: {
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
          { q: "Comment Nexus respecte-t-elle la Loi 25?", a: "Toutes les données sont hébergées au Québec (OVHcloud Beauharnois). Le consentement parental est documenté pour chaque athlète mineur avant la mise en ligne du profil. Les recruteurs signent une entente de confidentialité à l'inscription. Le droit à l'effacement et à la portabilité est respecté selon les délais légaux." },
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
    athleteLanding: {
      hero: {
        eyebrow: "POUR LES ÉTUDIANTS-ATHLÈTES",
        title: "FAIS-TOI REPÉRER PAR LES CÉGEPS",
        subtitle: "Ton coach crée ton profil sur Nexus. Les recruteurs CÉGEP de tout le Québec peuvent te découvrir, voir tes stats, ta vidéo et ton parcours académique.",
        ctaPrimary: "SOIS LE NEX →",
        ctaSecondary: "COMMENT ÇA MARCHE",
      },
      problem: {
        title: "T'ES PRÊT. MAIS QUI LE SAIT ?",
        items: [
          { title: "Invisible", description: "T'es peut-être le meilleur QB de ta ligue, mais les CÉGEPs hors de ta région ne le savent pas." },
          { title: "Pas de vitrine", description: "Ton highlight reel est sur TikTok entre des vidéos de chats. Aucun endroit professionnel pour te présenter." },
          { title: "Le sport ET l'école", description: "Les recruteurs veulent voir tes stats ET ta moyenne générale. Aucun outil ne combine les deux." },
        ],
      },
      solution: {
        title: "TON PROFIL. TA CHANCE.",
        items: [
          { title: "Profil étudiant-athlète complet", description: "Stats, position, highlight vidéo, parcours académique, moyenne générale — tout sur une page." },
          { title: "Vu par 54 CÉGEPs", description: "Les recruteurs de tous les CÉGEPs RSEQ peuvent te découvrir et contacter ton coach." },
          { title: "Évaluation de ton coach", description: "Ton coach te note sur 11 critères reconnus. C'est ta lettre de recommandation intégrée." },
          { title: "Badge vérifié", description: "Un profil complet = un badge bleu qui te démarque des profils incomplets." },
        ],
      },
      steps: {
        items: [
          { number: "01", title: "Inscris-toi en quelques minutes", description: "Crée ton profil tout de suite — pas besoin d'attendre. Stats, position, vidéo, parcours : tu remplis ce que tu peux et tu peaufines plus tard." },
          { number: "02", title: "Ton coach te vérifie (recommandé)", description: "Demande-lui d'ajouter son évaluation et de valider tes stats. Le badge bleu fait monter ton profil dans les recherches des recruteurs." },
          { number: "03", title: "Les recruteurs te trouvent", description: "Ton profil apparaît dans les recherches des recruteurs CÉGEP. Ils peuvent te contacter (ou contacter ton coach) s'ils sont intéressés." },
        ],
      },
      features: {
        title: "TON AVANTAGE COMPÉTITIF",
        items: [
          { title: "Vidéo highlights", description: "Ton meilleur highlight reel, intégré directement dans ton profil. Les recruteurs le voient en premier." },
          { title: "Stats complètes", description: "Toutes tes stats de saison — triées, formatées, comparables. Pas de PDF flou." },
          { title: "Moyenne générale visible", description: "Les recruteurs voient ta moyenne générale. Ça ouvre les portes des programmes contingentés." },
          { title: "Évaluation 11 critères", description: "Force, vitesse, QI sportif, leadership — ton coach te note sur une grille que tous les recruteurs comprennent." },
          { title: "Notifications à ton coach", description: "Quand un recruteur consulte ton profil, ton coach le sait. Plus de silence radio." },
          { title: "Multi-sport", description: "Tu joues football ET basketball ? Ton profil supporte plusieurs sports." },
        ],
      },
      cta: {
        title: "TON FUTUR CÉGEP TE CHERCHE PEUT-ÊTRE EN CE MOMENT",
        button: "SOIS LE NEX →",
        subtext: "Demande à ton entraîneur de te créer un profil Nexus.",
      },
    },
    pricing: {
      hero: {
        eyebrow: "Tarifs",
        title: "Choisis ton plan",
        lede: "Commence gratuitement. Passe à Pro quand tu es prêt.",
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
      trust: {
        quebecHost: "Hébergé au Québec",
        loi25: "Conforme Loi 25",
        verifiedProfiles: "Profils vérifiés",
      },
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
        title: "Nexus, c'est nous avant d'être un produit.",
        lede: "Un ancien athlète qui voulait être vu. Un ancien coach qui voulait donner une chance à ses joueurs. Deux professionnels en technologie qui savent bâtir des plateformes sécurisées. Voilà qui on est.",
      },
      founders: {
        bp: {
          name: "Bruno-Philippe Simard",
          role: "Fondateur · Ancien athlète",
          bio: "Ancien joueur de football collégial. J'ai vécu le processus de recrutement de l'intérieur — j'ai vu des coéquipiers plus talentueux que moi passer inaperçus parce que leur coach ne connaissait pas les bonnes personnes. En parallèle, je travaille en technologie — infrastructure, applications, cybersécurité. Nexus combine ces deux mondes.",
          photoAlt: "Bruno-Philippe Simard",
        },
        chuck: {
          name: "Chuck",
          role: "Co-fondateur · Ancien coach",
          bio: "Ancien entraîneur au secondaire. J'ai vu de près ce qui fait la différence entre un joueur qui se fait recruter et un joueur qui se fait oublier — et souvent, ça n'a rien à voir avec le talent. Comme Bruno, je viens de la cybersécurité et de l'infrastructure. On a construit Nexus avec la conviction que les données des jeunes athlètes méritent le même niveau de protection qu'un système bancaire.",
          photoAlt: "Chuck",
        },
      },
      security: {
        eyebrow: "Sécurité",
        title: "Bâti par des professionnels en cybersécurité.",
        body: "Nexus est hébergé au Québec (OVHcloud Beauharnois). Conforme à la Loi 25 sur la protection des renseignements personnels. Consentement parental documenté pour chaque athlète mineur. Vos données ne quittent jamais la province.",
      },
      contact: {
        eyebrow: "Nous écrire",
        title: "Une question pour l'équipe?",
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
    },
    nav: {
      discover: "Discover Nexus",
      forCoaches: "For coaches",
      forRecruiters: "For recruiters",
      forAthletes: "For student-athletes",
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
        title: "Talent doesn't have a postal code.", // TODO-EN
        lede: "When I was in high school, every football player at my school went to the same CÉGEP. That's just how it was. If I hadn't gone to camps and met other people, I never would have lived the three best years of my life somewhere else. Nexus exists so that kind of encounter doesn't depend on luck.",
        discoverHint: "Discover how ↓",
      },
      why: {
        eyebrow: "Why",
        title: "Sports recruitment in Québec runs on networks.",
        p1: "CÉGEP recruiters know the coaches at the big high schools. They show up at the big games. They call the same numbers year after year. That system works — but only for athletes inside the right circle.",
        p2: "Well-known schools send their players to the same CÉGEPs. Smaller schools get forgotten. Kids in the regions get forgotten. It's not a question of talent — it's a question of network. And you don't pick your high school based on who it knows.",
        p3: "Nexus gives every athlete the same structured visibility, no matter the school, the region, or the coach's circle of influence. Talent doesn't change in value depending on the postal code. Neither does Nexus.",
      },
      verification: {
        eyebrow: "Verification",
        title: "Why a blue profile is worth more than a gray one.",
        lede: "On Nexus, any athlete can create a profile. But not every profile carries the same weight in a recruiter's eyes. The difference is verification.",
        grayTitle: "Gray check — Unverified profile",
        grayBody: "The athlete created their own profile. The info is there, but no one has confirmed it. The recruiter takes it with a grain of salt — and that's normal.",
        blueTitle: "Blue check — Coach-verified profile",
        blueBody: "The coach has reviewed every field on the profile — identity, stats, school, position. They put their own reputation on the line by certifying it's all true. The blue check is the coach's credibility transferred to the athlete.",
        perishableTitle: "Verification is perishable.",
        perishableBody: "On the first of every month, the athlete gets 14 days to confirm their info is still up to date. No confirmation in time = back to the gray check. The coach can always re-verify afterward. We prevent zombie profiles — an athlete verified 2 years ago can't coast on an expired check.",
      },
      stars: {
        eyebrow: "The rating",
        title: "What each star actually means.",
        lede: "On Nexus, an athlete's overall rating goes from 1 to 5 stars. But what does a star actually mean? We defined a clear scale so every coach speaks the same language.",
        closing: "One star on Nexus = the same star everywhere. A 5-star rating from a Sherbrooke coach means the same thing as a 5-star from a Gatineau coach. That's the common language.",
        definitions: [
          "D1 prospect. Can start as a Division 1 player from the moment they enter CÉGEP.",
          "Could eventually start in D1. Certain D2 starter in their first season.",
          "D3 starter. Could reach the D2 level with significant progression.",
          "Could eventually become a D3 starter, but needs work and progression.",
          "Open to continuing at CÉGEP, but will need significant progression before being able to start even in D3.",
        ],
      },
      philosophy: {
        eyebrow: "Philosophy",
        title: "Why raw stats aren't enough.",
        p1: "After talking with several CÉGEP recruiters, we understood one thing: stats don't tell the whole story. 50 tackles in a weak league isn't 30 tackles in a strong league. A player can have inflated or undervalued numbers — and the recruiter has no way to calibrate.",
        p2: "What recruiters want is to understand what a player brings. Their character. The way they read the game. Their ability to progress. That's why we evaluate on 8 standardized criteria: leadership, discipline, coachability, game IQ, competitiveness, team spirit, resilience, attitude.",
        p3: "Physical stats — height, weight, 40-yard dash, vertical — stay on the profile. But what makes the difference at final evaluation is what a coach can say about the player. Not a spreadsheet.",
        badgesTitle: "Nexus distinctions — the common language of coaches.", // TODO-EN
        badgesLede: "Coaches assign badges to athletes based on their accomplishments and on-field qualities. Every badge represents a measurable reality — not a vague opinion. Recruiters know exactly what they're looking at when they see these distinctions.",
        badgesClosing: "A badge on Nexus is an accomplishment verified by a coach. Not a sticker stuck on a résumé. It's what lets a recruiter assess an athlete in 30 seconds — and know that what they see is real.",
        badgeNames: {
          captain: "Captain",
          allstar: "Provincial all-star",
          progression: "Marked progression",
          team_leader: "Team leader",
          league_leader: "League leader",
          mvp: "Most valuable player",
          custom: "Custom distinction",
        },
        badgeDescs: {
          captain: "Designated team captain. Official leadership recognized by the coach.",
          allstar: "Selected among the top players in their category at the provincial level.",
          progression: "Demonstrated significant growth across one or several seasons.",
          team_leader: "Statistical leader on their team. The coach picks the category that applies to the sport (points, tackles, goals, assists, interceptions, etc.).",
          league_leader: "Statistical leader in their league. The coach picks the dominant category — any measurable stat from their sport.",
          mvp: "Recognized as a key player by their coach for the season or career.",
          custom: "Specific accomplishment recognized by the coach — the text is open and reflects the athlete's reality (e.g. regional title, team record, tournament distinction).",
        },
        badgeDetails: {
          team_leader: "Category of choice",
          league_leader: "Category of choice",
          custom: "Custom text",
        },
      },
      reputation: {
        eyebrow: "Anti-gaming", // TODO-EN
        title: "What stops a coach from giving 5 stars to everyone?", // TODO-EN
        p1: "Fair question. Short answer: the same thing that stops a bad lawyer from keeping clients — reputation.",
        p2: "On Nexus, coaches build a reputation through their actions. Every evaluation, every verified athlete, every confirmed placement counts. Coaches accumulate badges: Evaluated, Recommended, Elite Coach, Placer.",
        closing: "Soon, recruiters will be able to evaluate coaches directly after recruiting their athletes. A coach who inflates their players will see their recommendations lose value. A coach who evaluates accurately becomes a reference. The system corrects itself — exactly like in real life.",
        badges: [
          { name: "Evaluated", threshold: "3 evaluations" },
          { name: "Recommended", threshold: "5 evaluations" },
          { name: "Elite Coach", threshold: "15 evaluations" },
          { name: "Placer", threshold: "5 athletes with a signed letter" },
        ],
      },
      communication: {
        eyebrow: "Communication",
        title: "The coach is the point of contact. Always.",
        p1: "In Québec, recruitable athletes are often minors. RSEQ rules and common sense agree: communication between a CÉGEP recruiter and a minor athlete goes through the coach.",
        p2: "On Nexus, it's built in. When a recruiter is interested in an athlete, they message the coach through the platform. The coach decides what to share, how to respond, and when to involve the athlete. It's not gatekeeping — it's protection.",
        p3: "Nexus follows RSEQ schedules by sport, but doesn't enforce them. Recruiters can still reach coaches outside official periods. What the coach chooses to share is their call. Nexus provides the tools, not the rules.",
      },
      engagement: {
        eyebrow: "The commitment", // TODO-EN
        title: "An athlete's visibility is never for sale.", // TODO-EN
        lede: "On Nexus, subscriptions exist — but they gate tools, never athletes.",
        principleAthleteTitle: "Athletes never pay",
        principleAthleteBody: "Full profile, unlimited videos, verification, recruitment status — everything is free for the athlete. Forever.",
        principleVisibilityTitle: "Visibility is not gated",
        principleVisibilityBody: "A free recruiter sees the same profile as a paying recruiter. A talent can't be ignored because a recruiter didn't pay.",
        principleCoachTitle: "Coaches always get the essentials free",
        principleCoachBody: "Creating profiles, evaluating, verifying, receiving messages — it's free. Advanced analytics tools are Pro. Never the other way around.",
        closing: "We charge for the tools — advanced pipeline, recruiter analytics, school stats. Not the right to be seen. A young athlete who deserves to be recruited will be, regardless of who pays for what around them.",
      },
      conviction: {
        eyebrow: "Our conviction",
        title: "Sport is what keeps kids in school.", // TODO-EN
        p1: "We believe in student sport. It's what builds a young person's character. It's what creates friendships that last a lifetime. It's what pushes you to give more when no one's watching. Your environment, growing up, is what defines you — and for many, that environment is a team.",
        p2: "Nexus doesn't reinvent the recruitment process. Well-known schools will keep producing recruited athletes. Big teams will keep existing. What we do is widen the door. Give a chance to the diamonds in the rough. Open possibilities for those who aren't in the right circle.",
        p3: "Because somebody had the chance — or the persistence — to do the camps, meet the right people, and end up in the right program. And that person lived the three best years of their life.",
        p4: "We want that for every athlete in Québec.",
      },
      personas: [
        { question: "Are you an athlete?", line: "Create your profile and get noticed by CÉGEP recruiters.", label: "Discover →" },
        { question: "Are you a coach?", line: "Verify your players, add your evaluation, build your reputation.", label: "Discover →" },
        { question: "Are you a CÉGEP recruiter?", line: "Find the best high school prospects across Québec.", label: "Discover →" },
      ],
    },
    coachLanding: {
      hero: {
        eyebrow: "For high school coaches",
        titleLine1: "Your players deserve to be seen.", // TODO-EN
        titleLine2: "So does your reputation.", // TODO-EN
        lede: "Verify your athletes, add your evaluation, and build your reputation as a coach. CÉGEP recruiters trust coaches who know their players.",
        ledeSmall: "Your players sign up. You verify them. Everybody wins.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        cta: "Be the Nex",
        mockupAlt: "Coach dashboard — My athletes",
      },
      howItWorks: {
        eyebrow: "How it works",
        title: "4 steps. Real impact.", // TODO-EN
        steps: [
          { role: "Signup", title: "Sign up", body: "Create your account in 2 minutes and link to your school. It's free." },
          { role: "Verification", title: "Verify your athletes", body: "Your players fill out their profiles themselves. You confirm their info and add your evaluation. Their profile goes from visible to credible." },
          { role: "Reputation", title: "Build your reputation", body: "Every verification and every placement counts. Your Elite Coach and Placer badges tell recruiters you know your players." },
          { role: "Contact", title: "Become the point of contact", body: "Per RSEQ rules, CÉGEP recruiters first communicate with the coach — not directly with the minor athlete. On Nexus, you handle that communication through the built-in messaging. You facilitate the link between your players and CÉGEP programs, within the rules." },
        ],
      },
      evaluation: {
        eyebrow: "Your evaluation",
        title: "Your evaluation is what makes the difference.", // TODO-EN
        body: "Any athlete can say they're good. When you verify them and evaluate them on 8 criteria — leadership, discipline, coachability, game IQ, competitiveness, team spirit, resilience, attitude — recruiters know it's real. Your report is read by every recruiter who opens the profile.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        cta: "Be the Nex →",
        mockupAlt: "Verified athlete profile with coach evaluation",
      },
      reputation: {
        eyebrow: "My reputation",
        title: "Your reputation precedes you.", // TODO-EN
        lede: "Every verification and every placement counts. When a recruiter clicks your name, they see your reputation page — your history, your evaluations, your badges. That's what sets you apart.",
        badges: [
          { name: "Evaluated", threshold: "3 evaluations" },
          { name: "Recommended", threshold: "5 evaluations" },
          { name: "Elite Coach", threshold: "15 evaluations" },
          { name: "Placer", threshold: "5 athletes with a signed letter" },
        ],
        stats: [
          { label: "Average response time", value: "2h" },
          { label: "Athletes placed", value: "8" },
          { label: "Profiles completed", value: "87%" },
        ],
        progressTitle: "Next badge — Elite Coach",
        progressFooter: "Elite Coach in 3 evaluations.",
      },
      myAthletes: {
        eyebrow: "My athletes",
        title: "All your players. One place.", // TODO-EN
        body: "See at a glance who's verified, who has a complete profile, who's in the recruitment process. Manage your team without spreadsheets and without paper.",
        mockupAlt: "Coach dashboard — athlete management",
      },
      messaging: {
        eyebrow: "Messaging",
        title: "You're the first point of contact.", // TODO-EN
        body: "When a recruiter is interested in one of your players, they contact you through Nexus — not the parent, not the athlete. You control the communication. You facilitate the process. That's your role.",
        mockupLabel: "Messaging",
        items: [
          { name: "Jean-François L.", org: "Collège André-Grasset", preview: "Hi coach, I'd like to discuss Alexandre's profile…", time: "2h" },
          { name: "Caroline M.", org: "CÉGEP de Sherbrooke", preview: "Thanks for the evaluation. We're planning a visit…", time: "1d" },
          { name: "Philippe D.", org: "Campus Notre-Dame-de-Foy", preview: "Would Émilie be available for…", time: "3d" },
        ],
      },
      features: {
        eyebrow: "Features",
        title: "Everything you need to manage your athletes.", // TODO-EN
        lede: "Create profiles and verify your athletes for free. Unlock the intelligence with Pro.",
        tierFree: "Free",
        tierPro: "Pro · $9.99/mo",
        items: [
          { title: "Coach account", body: "Create your account, link to your school." },
          { title: "Athlete management", body: "Create and manage profiles. Unlimited additions." },
          { title: "Verification", body: "Verify profiles. Blue badge = credibility." },
          { title: "Simplified evaluation", body: "Evaluate on the essential criteria. Visible to recruiters." },
          { title: "Inbox messaging", body: "Receive messages from recruiters interested in your players." },
          { title: "Notifications", body: "Get alerted when a recruiter views one of your athletes." },
          { title: "My school", body: "Full page for your school — every sport, every athlete, every coach." },
          { title: "School stats", body: "Views, profile consultations, trends by sport." },
          { title: "Placement", body: "Track your athletes — who's recruited, by which CÉGEP." },
          { title: "My reputation", body: "Your badges, your history, your credibility." },
          { title: "Analytics", body: "Trends, recruiter activity, pipeline performance." },
        ],
      },
      pricing: {
        eyebrow: "Pricing",
        title: "One goal — your players.", // TODO-EN
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        cta: "Be the Nex",
        tiers: [
          {
            name: "Free",
            price: "$0",
            subtitle: "To get started",
            bullets: [
              "Create an account and join a school",
              "Create and manage athlete profiles",
              "Simplified evaluations (5 criteria)",
              "Verify profiles (blue badge)",
              "Receive recruiter messages",
              "Activity notifications",
            ],
          },
          {
            name: "Pro",
            price: "$9.99",
            priceSuffix: "/mo",
            subtitle: "or $79/yr — save 34%",
            subheader: "Everything free, plus:",
            bullets: [
              "Access to My School (full school page)",
              "School stats (views, trends, activity)",
              "Placement (track your recruited athletes)",
              "My reputation (badges and history)",
              "Advanced analytics (trends and performance)",
            ],
            badge: "Popular",
          },
          {
            name: "All Star",
            price: "$19.99",
            priceSuffix: "/mo",
            subtitle: "or $159/yr — save 34%",
            subheader: "Everything Pro, plus:",
            bullets: [
              "Full school management (add and manage coaches)",
              "Advanced analytics by athlete and team",
              "Detailed tracking of CÉGEP placements",
              "Complete school statistics",
              "Invitation tools for coaches",
            ],
          },
        ],
      },
      cta: {
        title1: "Ready to make the ", // TODO-EN
        title2: "difference", // TODO-EN
        title3: " for your players?", // TODO-EN
        body: "Sign up for free. Verify your athletes. Build your reputation.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        button: "Be the Nex",
        trustFree: "100% free",
        trustQuick: "Sign up in 2 min",
        noPlayersPrefix: "No players signed up? ",
        noPlayersLink: "Send them this link →",
      },
    },
    recruiterLanding: {
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
          { q: "How does Nexus comply with Loi 25?", a: "All data is hosted in Québec (OVHcloud Beauharnois). Parental consent is documented for every minor athlete before the profile goes live. Recruiters sign a confidentiality agreement at signup. Right to deletion and portability are respected within the legal deadlines." },
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
    athleteLanding: {
      hero: {
        eyebrow: "FOR STUDENT-ATHLETES",
        title: "GET NOTICED BY CÉGEPS", // TODO-EN
        subtitle: "Your coach creates your profile on Nexus. CÉGEP recruiters from across Québec can discover you, see your stats, your video, and your academic record.",
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        ctaPrimary: "BE THE NEX →",
        ctaSecondary: "HOW IT WORKS",
      },
      problem: {
        title: "YOU'RE READY. BUT WHO KNOWS?", // TODO-EN
        items: [
          { title: "Invisible", description: "You might be the best QB in your league, but CÉGEPs outside your region have no idea." },
          { title: "No showcase", description: "Your highlight reel is on TikTok between cat videos. No professional place to introduce yourself." },
          { title: "Sports AND school", description: "Recruiters want to see your stats AND your GPA. No tool combines both." },
        ],
      },
      solution: {
        title: "YOUR PROFILE. YOUR SHOT.", // TODO-EN
        items: [
          { title: "Complete student-athlete profile", description: "Stats, position, highlight video, academic record, GPA — everything on one page." },
          { title: "Seen by 54 CÉGEPs", description: "Recruiters from every RSEQ CÉGEP can discover you and contact your coach." },
          { title: "Your coach's evaluation", description: "Your coach rates you on 11 recognized criteria. It's your built-in letter of recommendation." },
          { title: "Verified badge", description: "A complete profile = a blue badge that sets you apart from incomplete profiles." },
        ],
      },
      steps: {
        items: [
          { number: "01", title: "Sign up in a few minutes", description: "Create your profile right away — no need to wait. Stats, position, video, journey: fill what you can and refine later." },
          { number: "02", title: "Your coach verifies you (recommended)", description: "Ask them to add their evaluation and validate your stats. The blue badge lifts your profile in recruiter searches." },
          { number: "03", title: "Recruiters find you", description: "Your profile shows up in CÉGEP recruiter searches. They can contact you (or your coach) if interested." },
        ],
      },
      features: {
        title: "YOUR COMPETITIVE EDGE", // TODO-EN
        items: [
          { title: "Video highlights", description: "Your best highlight reel, embedded directly in your profile. Recruiters see it first." },
          { title: "Full stats", description: "All your season stats — sorted, formatted, comparable. No blurry PDF." },
          { title: "GPA visible", description: "Recruiters see your GPA. It opens doors to limited-enrollment programs." },
          { title: "11-criteria evaluation", description: "Strength, speed, sport IQ, leadership — your coach rates you on a grid every recruiter understands." },
          { title: "Notifications to your coach", description: "When a recruiter views your profile, your coach knows. No more radio silence." },
          { title: "Multi-sport", description: "Play football AND basketball? Your profile supports multiple sports." },
        ],
      },
      cta: {
        title: "YOUR FUTURE CÉGEP MIGHT BE LOOKING FOR YOU RIGHT NOW", // TODO-EN
        // Intentional brand pun on 'Nexus' — do NOT autocorrect to 'next'
        button: "BE THE NEX →",
        subtext: "Ask your coach to create a Nexus profile for you.",
      },
    },
    pricing: {
      hero: {
        eyebrow: "Pricing",
        title: "Choose your plan",
        lede: "Start free. Upgrade to Pro when you're ready.",
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
      trust: {
        quebecHost: "Hosted in Québec",
        loi25: "Loi 25 compliant",
        verifiedProfiles: "Verified profiles",
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
        title: "Nexus is us before it's a product.", // TODO-EN
        lede: "A former athlete who wanted to be seen. A former coach who wanted to give his players a chance. Two tech professionals who know how to build secure platforms. That's who we are.",
      },
      founders: {
        bp: {
          name: "Bruno-Philippe Simard",
          role: "Founder · Former athlete",
          bio: "Former college football player. I lived the recruitment process from the inside — I saw teammates more talented than me go unnoticed because their coach didn't know the right people. In parallel, I work in technology — infrastructure, applications, cybersecurity. Nexus combines these two worlds.",
          photoAlt: "Bruno-Philippe Simard",
        },
        chuck: {
          name: "Chuck",
          role: "Co-founder · Former coach",
          bio: "Former high school coach. I saw up close what makes the difference between a player who gets recruited and a player who gets forgotten — and often, it has nothing to do with talent. Like Bruno, I come from cybersecurity and infrastructure. We built Nexus with the conviction that young athletes' data deserves the same level of protection as a banking system.",
          photoAlt: "Chuck",
        },
      },
      security: {
        eyebrow: "Security",
        title: "Built by cybersecurity professionals.",
        body: "Nexus is hosted in Québec (OVHcloud Beauharnois). Compliant with Loi 25 on the protection of personal information. Parental consent documented for every minor athlete. Your data never leaves the province.",
      },
      contact: {
        eyebrow: "Write to us",
        title: "A question for the team?", // TODO-EN
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
