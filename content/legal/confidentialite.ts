/* ═══════════════════════════════════════════════════════════════
   content/legal/confidentialite.ts — iter 7.50-a-bis (legal-1)

   Politique de confidentialité (Loi 25, version 2026-07-v1).
   Source unique rendue par app/confidentialite/page.tsx.

   Section 7.5 « Communication à des partenaires média » ajoutée sur
   instruction BP (mise en cohérence légale — juillet 2026).

   ⚠️ Contenu juridique : ne PAS modifier sans accord BP + counsel.
═══════════════════════════════════════════════════════════════ */

import type { Section } from "./types";
import { RPRP_CONTACT_ROWS_FULL as RPRP_CONTACT_ROWS } from "./rprp-contact";

export const SECTIONS_CONFIDENTIALITE: Section[] = [
  {
    id: "introduction",
    title: "Introduction",
    blocks: [
      { type: "p", text: "Nexus (ci-après « la Plateforme », « nous », « notre » ou « nos ») est une plateforme numérique de recrutement sportif opérée au Québec, mise à la disposition des écoles secondaires et des CÉGEPs du réseau du sport étudiant du Québec (RSEQ). La Plateforme facilite la mise en relation entre les athlètes-étudiants et les programmes sportifs des CÉGEPs." },
      { type: "p", text: "Nexus s'engage à protéger les renseignements personnels de l'ensemble de ses utilisateurs, et particulièrement ceux des athlètes mineurs qui utilisent la Plateforme. La présente politique est rédigée conformément aux exigences de la Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (Loi 25 du Québec), de la Loi sur la protection des renseignements personnels dans le secteur privé du Québec, et de la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE/PIPEDA)." },
      {
        type: "callout",
        tone: "red",
        title: "IMPORTANT — MINEURS",
        text: "La Plateforme traite des renseignements personnels d'athlètes dont la majorité sont âgés de 14 à 17 ans. Des mesures de protection renforcées sont appliquées conformément à la Loi 25 et au Code civil du Québec. Le consentement parental est requis pour tout athlète mineur.",
      },
      {
        type: "subsection",
        id: "definitions",
        title: "1.1 — Définitions",
        blocks: [
          {
            type: "definitions",
            items: [
              { term: "« Renseignement personnel »", def: "toute information qui concerne une personne physique et qui permet de l'identifier directement ou indirectement." },
              { term: "« Renseignement personnel sensible »", def: "tout renseignement personnel qui, de par sa nature (notamment médical, biométrique ou autrement intime) ou en raison du contexte de son utilisation, suscite un haut degré d'attente raisonnable en matière de vie privée. Dans le contexte de Nexus, les renseignements d'athlètes mineurs (évaluations sportives, données physiques, résultats scolaires) sont considérés comme sensibles en raison de l'âge des personnes concernées." },
              { term: "« Incident de confidentialité »", def: "tout accès, utilisation ou communication non autorisé par la loi d'un renseignement personnel, ainsi que toute perte ou autre atteinte à la protection de ce renseignement." },
              { term: "« Évaluation des facteurs relatifs à la vie privée » ou « ÉFVP »", def: "démarche préventive visant à mieux protéger les renseignements personnels et à respecter la vie privée des individus." },
              { term: "« Cycle de vie »", def: "l'ensemble des étapes de traitement d'un renseignement personnel : collecte, utilisation, communication, conservation et destruction." },
              { term: "« Profilage »", def: "collecte et utilisation de renseignements personnels afin d'évaluer certaines caractéristiques d'une personne physique. Dans le contexte de Nexus, les évaluations sportives (11 critères) et le pipeline de recrutement (8 statuts) constituent des formes de profilage assisté par des personnes humaines, et non des décisions automatisées." },
              { term: "« RPRP »", def: "Responsable de la Protection des Renseignements Personnels." },
              { term: "« CAI »", def: "Commission d'accès à l'information du Québec." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "responsable",
    title: "Responsable (RPRP)",
    blocks: [
      { type: "p", text: "Conformément à la Loi 25, Nexus a désigné un Responsable de la Protection des Renseignements Personnels (RPRP). Toute question, demande d'accès, de rectification, de portabilité ou plainte peut être adressée à :" },
      { type: "contact-card", rows: RPRP_CONTACT_ROWS },
      { type: "p", text: "Vous avez également le droit de déposer une plainte auprès de la Commission d'accès à l'information du Québec (CAI) à tout moment. Nous vous invitons cependant à nous contacter d'abord afin que nous puissions tenter de résoudre votre préoccupation." },
    ],
  },
  {
    id: "roles",
    title: "Rôles et responsabilités",
    blocks: [
      { type: "p", text: "Nexus opère dans un écosystème multi-organisationnel. Chaque partie a des responsabilités distinctes :" },
      {
        type: "table",
        headers: ["Partie", "Rôle", "Responsabilités"],
        rows: [
          ["Nexus (la plateforme)", "Sous-traitant", "Hébergement sécurisé, architecture de protection par défaut, outils de conformité"],
          ["Écoles secondaires", "Responsable du traitement", "Collecte initiale des données, obtention du consentement parental, désignation de leur propre RPRP"],
          ["CÉGEPs", "Responsable du traitement", "Utilisation des données pour le recrutement, encadrement de leurs recruteurs, désignation de leur propre RPRP"],
          ["Parents / tuteurs", "Autorité parentale", "Consentement à la présence de leur enfant mineur sur la Plateforme"],
          ["Athlètes", "Personnes concernées", "Propriétaires de leurs renseignements personnels; droits d'accès, de rectification et de portabilité"],
        ],
      },
      { type: "p", text: "Chaque école secondaire et chaque CÉGEP utilisant Nexus est tenu de désigner son propre RPRP et de signer une entente de sous-traitance avec Nexus avant que ses utilisateurs puissent accéder aux données d'athlètes." },
      {
        type: "subsection",
        id: "roles-saisie",
        title: "3.1 — Saisie au nom d'autrui",
        blocks: [
          { type: "p", text: "Les entraîneurs et directeurs qui saisissent des renseignements personnels d'athlètes agissent au nom de leur école secondaire. En saisissant ces renseignements, ils confirment que : (a) le consentement parental valide a été obtenu; (b) les renseignements fournis sont exacts et proviennent de sources fiables (registres scolaires); (c) ils sont autorisés par leur établissement à effectuer cette saisie. L'entraîneur ne peut activer un profil d'athlète mineur sans avoir préalablement confirmé l'obtention du consentement parental dans la Plateforme." },
        ],
      },
      {
        type: "subsection",
        id: "roles-chaine",
        title: "3.2 — Chaîne de responsabilité",
        blocks: [
          { type: "p", text: "La responsabilité en matière de protection des renseignements personnels est partagée :" },
          { type: "p", text: "L'école secondaire est responsable de la collecte initiale, de l'obtention du consentement parental et de l'exactitude des données saisies. Elle demeure le responsable du traitement au sens de la loi." },
          { type: "p", text: "Nexus agit à titre de sous-traitant. Nexus est responsable de la sécurité de l'hébergement, de l'intégrité des données, de l'application des contrôles d'accès (isolation par établissement, chiffrement, journalisation) et de la mise à disposition des outils de conformité." },
          { type: "p", text: "Le CÉGEP accède aux renseignements des athlètes aux fins de recrutement sportif. Il est responsable de l'encadrement de ses recruteurs, du respect des limites d'accès et de la confidentialité des informations consultées." },
          { type: "p", text: "En cas d'incident de confidentialité, la responsabilité est déterminée selon l'origine de l'incident : si l'incident résulte d'une faille de la Plateforme, Nexus en assume la responsabilité; si l'incident résulte d'une action d'un utilisateur, l'établissement d'attache de cet utilisateur en est responsable." },
        ],
      },
      {
        type: "subsection",
        id: "roles-finalite",
        title: "3.3 — Finalité unique et déclarée",
        blocks: [
          { type: "p", text: "La communication des renseignements personnels des athlètes aux recruteurs des CÉGEPs constitue la finalité principale et déclarée de la Plateforme, et non une utilisation secondaire ou dérivée. Cette finalité est explicitement indiquée dans le formulaire de consentement parental et dans l'entente de sous-traitance. Aucun renseignement personnel n'est utilisé à des fins incompatibles avec cette finalité sans l'obtention d'un nouveau consentement." },
        ],
      },
    ],
  },
  {
    id: "collecte",
    title: "Renseignements collectés",
    blocks: [
      {
        type: "subsection",
        id: "collecte-athletes",
        title: "4.1 — Athlètes (mineurs 14-17 ans)",
        blocks: [
          {
            type: "table",
            headers: ["Renseignement", "Type", "Obligatoire?", "Finalité"],
            rows: [
              ["Nom et prénom", "Identifiant direct", "Oui", "Identification pour le recrutement"],
              ["Date de naissance", "Identifiant direct", "Oui", "Vérification de l'âge, catégorie sportive"],
              ["Sexe", "Identifiant indirect", "Oui", "Catégories sportives"],
              ["École secondaire", "Identifiant indirect", "Oui", "Rattachement organisationnel"],
              ["Sport(s) et position", "Donnée sportive", "Oui", "Critères de recherche pour les recruteurs"],
              ["Taille et poids", "Donnée physique", "Oui", "Critères physiques de recrutement"],
              ["Évaluations sportives (11 critères)", "Donnée d'appréciation", "Oui", "Cote globale pour le recrutement"],
              ["Résultats scolaires", "Donnée académique", "Oui", "Admissibilité au CÉGEP"],
              ["Photo de profil", "Identifiant direct", "Non", "Identification visuelle (optionnel)"],
              ["Vidéos de performance", "Contenu multimédia", "Non", "Démonstration des habiletés (optionnel)"],
              ["Coordonnées (courriel, téléphone)", "Identifiant direct", "Non", "Communication directe (avec consentement spécifique additionnel)"],
            ],
          },
          {
            type: "callout",
            tone: "yellow",
            title: "Note importante",
            text: "Les coordonnées personnelles de l'athlète ne sont JAMAIS communiquées aux recruteurs sans un consentement spécifique additionnel du parent ou tuteur. Le premier contact entre un recruteur et un athlète mineur se fait toujours par l'intermédiaire de l'entraîneur.",
          },
        ],
      },
      {
        type: "subsection",
        id: "collecte-entraineurs",
        title: "4.2 — Entraîneurs",
        blocks: [
          { type: "p", text: "Nom et prénom, courriel professionnel, école d'attache, sport(s) entraîné(s), évaluations de réputation reçues (anonymisées)." },
        ],
      },
      {
        type: "subsection",
        id: "collecte-recruteurs",
        title: "4.3 — Recruteurs",
        blocks: [
          { type: "p", text: "Nom et prénom, courriel professionnel, CÉGEP d'attache, activité sur la Plateforme (consultations, favoris, pipeline de recrutement)." },
        ],
      },
      {
        type: "subsection",
        id: "collecte-directeurs",
        title: "4.4 — Directeurs",
        blocks: [
          { type: "p", text: "Nom et prénom, courriel professionnel, établissement d'attache, activité de supervision." },
        ],
      },
      {
        type: "subsection",
        id: "collecte-techniques",
        title: "4.5 — Données techniques",
        blocks: [
          {
            type: "bullets",
            items: [
              "Adresse IP",
              "Type de navigateur et système d'exploitation",
              "Pages visitées et durée des visites",
              "Données de cookies (voir section 12)",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "finalites",
    title: "Finalités de la collecte",
    blocks: [
      {
        type: "table",
        headers: ["Finalité", "Description", "Base légale"],
        rows: [
          ["Recrutement sportif", "Permettre aux recruteurs des CÉGEPs de consulter les profils d'athlètes", "Consentement parental (mineurs) / Consentement de l'utilisateur (majeurs)"],
          ["Évaluation sportive", "Permettre aux entraîneurs d'évaluer les compétences de leurs athlètes", "Consentement parental"],
          ["Communication", "Faciliter les échanges entre entraîneurs et recruteurs", "Consentement parental + consentement de l'entraîneur"],
          ["Gestion des comptes", "Création et gestion des comptes utilisateurs", "Exécution du contrat de service"],
          ["Amélioration du service", "Analyse de l'utilisation de la Plateforme", "Consentement (cookies analytiques)"],
          ["Conformité légale", "Tenue du registre d'incidents, réponse aux demandes de portabilité", "Obligation légale (Loi 25)"],
          ["Sécurité", "Détection des accès non autorisés, protection contre les cyberattaques", "Intérêt légitime / Obligation légale"],
        ],
      },
      { type: "p", text: "Nous ne collectons et n'utilisons vos renseignements personnels qu'aux fins pour lesquelles ils ont été recueillis." },
    ],
  },
  {
    id: "consentement",
    title: "Consentement parental",
    emphasized: true,
    blocks: [
      {
        type: "subsection",
        id: "consentement-exigence",
        title: "6.1 — Exigence de consentement",
        blocks: [
          {
            type: "table",
            headers: ["Âge de l'athlète", "Exigence"],
            rows: [
              ["Moins de 14 ans", "Consentement parental OBLIGATOIRE. Inscription uniquement via le parent ou tuteur légal."],
              ["14 à 17 ans", "Consentement parental fortement recommandé et requis par Nexus. L'athlète ET le parent doivent consentir."],
              ["18 ans et plus", "Consentement de l'athlète seul."],
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "consentement-processus",
        title: "6.2 — Processus de consentement",
        blocks: [
          {
            type: "bullets",
            items: [
              "L'entraîneur crée le profil en mode BROUILLON (invisible aux recruteurs)",
              "Un formulaire de consentement personnalisé est généré",
              "Le parent signe (électroniquement ou sur papier)",
              "Le profil est activé uniquement après réception du consentement valide",
              "Le consentement doit être renouvelé chaque année scolaire",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "consentement-granularite",
        title: "6.3 — Granularité du consentement",
        blocks: [
          { type: "p", text: "Le parent peut consentir au profil de base tout en refusant le partage de coordonnées directes ou de contenu multimédia." },
        ],
      },
      {
        type: "subsection",
        id: "consentement-retrait",
        title: "6.4 — Retrait du consentement",
        blocks: [
          { type: "p", text: "Le parent peut retirer son consentement à tout moment, sans pénalité. Le retrait entraîne la désactivation immédiate du profil de l'athlète." },
        ],
      },
      {
        type: "subsection",
        id: "consentement-age",
        title: "6.5 — Vérification de l'âge",
        blocks: [
          { type: "p", text: "L'âge de l'athlète est déterminé à partir de sa date de naissance, fournie par l'entraîneur au nom de l'école secondaire. Nexus s'appuie sur les registres scolaires comme source institutionnelle fiable. L'athlète ne s'inscrit pas lui-même; son profil est créé par un adulte autorisé rattaché à un établissement ayant signé une entente avec Nexus." },
        ],
      },
      {
        type: "subsection",
        id: "consentement-invalide",
        title: "6.6 — Collecte sans consentement valide",
        blocks: [
          { type: "p", text: "Si Nexus découvre qu'un profil a été activé sans consentement parental valide, ou que des renseignements d'un mineur ont été recueillis par inadvertance sans autorisation : (1) le profil sera désactivé immédiatement; (2) l'entraîneur et le directeur seront avisés; (3) le parent sera contacté pour l'informer et lui offrir la possibilité de consentir ou de demander la suppression. Si aucun consentement n'est obtenu dans un délai de 30 jours, les renseignements seront détruits." },
        ],
      },
      {
        type: "subsection",
        id: "consentement-mecanisme",
        title: "6.7 — Mécanisme de consentement",
        blocks: [
          { type: "p", text: "Le consentement peut être obtenu par : (a) signature électronique via un lien sécurisé; (b) signature manuscrite sur le formulaire imprimé, numérisé et téléversé; (c) consentement en personne, documenté par un formulaire signé. Un registre horodaté de chaque consentement est conservé." },
        ],
      },
    ],
  },
  {
    id: "communication",
    title: "Communication des renseignements",
    blocks: [
      {
        type: "subsection",
        id: "communication-tiers",
        title: "7.1 — Tiers ayant accès",
        blocks: [
          { type: "p", text: "Les renseignements personnels des athlètes sont accessibles uniquement aux recruteurs vérifiés rattachés à un CÉGEP ayant signé une entente de sous-traitance avec Nexus, aux entraîneurs et directeurs de l'école secondaire d'attache de l'athlète, ainsi qu'au personnel autorisé de Nexus aux seules fins de support technique et de conformité." },
        ],
      },
      {
        type: "subsection",
        id: "communication-vente",
        title: "7.2 — Aucune vente de données",
        blocks: [
          { type: "p", text: "Nexus ne vend, ne loue, ni ne monnaie d'aucune façon les renseignements personnels des utilisateurs. Aucune publicité ciblée n'est diffusée sur la Plateforme à partir des renseignements collectés." },
        ],
      },
      {
        type: "subsection",
        id: "communication-fournisseurs",
        title: "7.3 — Fournisseurs de services",
        blocks: [
          { type: "p", text: "Nexus a recours au fournisseur de services suivant pour le fonctionnement de la Plateforme :" },
          {
            type: "bullets",
            items: [
              "OVHcloud (Beauharnois, Québec) : Hébergement de l'infrastructure (serveurs, base de données, stockage de fichiers).",
            ],
          },
          { type: "p", text: "Ce fournisseur est lié à Nexus par une entente écrite l'obligeant à respecter des standards de sécurité équivalents à ceux de Nexus et à n'utiliser les données qu'aux seules fins de la prestation de services." },
        ],
      },
      {
        type: "subsection",
        id: "communication-loi",
        title: "7.4 — Communication requise par la loi",
        blocks: [
          { type: "p", text: "Nexus peut être tenu de communiquer des renseignements personnels en réponse à une ordonnance judiciaire, une assignation, une demande d'une autorité compétente ou pour se conformer à une obligation légale. Dans la mesure permise par la loi, la personne concernée sera informée d'une telle communication." },
        ],
      },
      {
        type: "subsection",
        id: "communication-partenaires",
        title: "7.5 — Communication à des partenaires média",
        blocks: [
          { type: "p", text: "Sur le fondement d'un consentement explicite et facultatif, Nexus peut communiquer la carte officielle de l'athlète — soit son nom, sa position, son établissement et sa photo — à ses partenaires média approuvés (par exemple journalistes sportifs, pages de contenu sportif, balados ou camps spécialisés). Ces partenaires utilisent la carte dans leurs publications, à des fins éditoriales et promotionnelles. Aucun partenaire ne peut contacter l'athlète directement." },
          { type: "p", text: "Cette communication repose sur une responsabilité partagée : chaque partenaire média est responsable de la protection des renseignements qu'il reçoit et de l'usage qu'il en fait dans ses publications, tandis que Nexus demeure responsable de la communication elle-même et de l'obtention du consentement préalable." },
          { type: "p", text: "Ce consentement est facultatif et peut être retiré en tout temps, soit par l'athlète depuis les paramètres de son profil, soit par son parent ou tuteur depuis l'espace parent. Le retrait met fin à toute nouvelle communication de la carte aux partenaires." },
        ],
      },
    ],
  },
  {
    id: "securite",
    title: "Hébergement et sécurité",
    blocks: [
      {
        type: "subsection",
        id: "securite-localisation",
        title: "8.1 — Localisation des données",
        blocks: [
          {
            type: "callout",
            tone: "blue",
            title: "Hébergement 100 % Québec",
            text: "Tous les renseignements personnels traités par Nexus sont hébergés exclusivement au Québec, dans le centre de données d'OVHcloud situé à Beauharnois. Aucune donnée personnelle n'est transférée à l'extérieur du Québec ou du Canada.",
          },
        ],
      },
      {
        type: "subsection",
        id: "securite-mesures",
        title: "8.2 — Mesures de sécurité",
        blocks: [
          { type: "p", text: "Nexus met en place des mesures techniques et organisationnelles appropriées pour protéger les renseignements personnels :" },
          {
            type: "bullets",
            items: [
              "Chiffrement des données en transit (HTTPS/TLS 1.3) et au repos",
              "Authentification sécurisée avec hachage des mots de passe (bcrypt)",
              "Contrôle d'accès basé sur les rôles (RBAC) et isolation des données par établissement",
              "Journaux d'audit horodatés pour chaque accès aux profils d'athlètes",
              "Surveillance continue, sauvegardes régulières et plan de reprise après incident",
              "Mises à jour de sécurité appliquées en continu",
            ],
          },
          { type: "p", text: "Aucune méthode de transmission ou de stockage électronique n'est totalement sécurisée. Bien que nous nous efforcions de protéger vos données, nous ne pouvons garantir une sécurité absolue." },
        ],
      },
      {
        type: "subsection",
        id: "securite-defaut",
        title: "8.3 — Confidentialité par défaut",
        blocks: [
          { type: "p", text: "Conformément au principe de confidentialité par défaut prévu à la Loi 25, les paramètres les plus restrictifs sont appliqués au moment de la création d'un compte. L'utilisateur doit explicitement choisir d'élargir la visibilité de ses renseignements." },
        ],
      },
    ],
  },
  {
    id: "conservation",
    title: "Conservation et destruction",
    blocks: [
      {
        type: "subsection",
        id: "conservation-durees",
        title: "9.1 — Durées de conservation",
        blocks: [
          {
            type: "table",
            headers: ["Type de donnée", "Durée"],
            rows: [
              ["Profil d'athlète actif", "Pendant toute la durée d'utilisation de la Plateforme par l'athlète"],
              ["Profil d'athlète archivé", "Maximum 3 ans après archivage, puis destruction"],
              ["Comptes entraîneur / recruteur / directeur", "Pendant toute la durée d'utilisation, puis 12 mois après désactivation"],
              ["Journaux d'audit", "5 ans (obligation légale)"],
              ["Registre des consentements", "5 ans après la fin du consentement"],
              ["Registre des incidents", "5 ans après la clôture de l'incident"],
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "conservation-destruction",
        title: "9.2 — Destruction",
        blocks: [
          { type: "p", text: "À l'expiration de la durée de conservation, les renseignements personnels sont détruits de façon sécurisée et irréversible (suppression cryptographique des sauvegardes incluses)." },
        ],
      },
      {
        type: "subsection",
        id: "conservation-anonymisation",
        title: "9.3 — Anonymisation",
        blocks: [
          { type: "p", text: "Certaines données peuvent être conservées au-delà des durées prévues à des fins statistiques ou de recherche, à condition d'être anonymisées de manière irréversible. Une fois anonymisées, ces données ne constituent plus des renseignements personnels au sens de la loi." },
        ],
      },
    ],
  },
  {
    id: "droits",
    title: "Vos droits",
    blocks: [
      { type: "p", text: "Conformément à la Loi 25 et aux lois canadiennes applicables, vous disposez des droits suivants à l'égard de vos renseignements personnels :" },
      {
        type: "subsection",
        id: "droits-acces",
        title: "10.1 — Droit d'accès",
        blocks: [
          { type: "p", text: "Vous pouvez demander une copie de tous les renseignements personnels que Nexus détient à votre sujet." },
        ],
      },
      {
        type: "subsection",
        id: "droits-rectification",
        title: "10.2 — Droit de rectification",
        blocks: [
          { type: "p", text: "Vous pouvez demander la correction de renseignements inexacts, incomplets ou périmés." },
          { type: "contact-card", rows: RPRP_CONTACT_ROWS },
        ],
      },
      {
        type: "subsection",
        id: "droits-portabilite",
        title: "10.3 — Droit à la portabilité",
        blocks: [
          { type: "p", text: "Vous pouvez obtenir une copie des renseignements que vous avez fournis dans un format structuré, couramment utilisé et lisible par machine, ou en demander la transmission directe à un tiers de votre choix." },
        ],
      },
      {
        type: "subsection",
        id: "droits-desindexation",
        title: "10.4 — Droit à la désindexation",
        blocks: [
          { type: "p", text: "Vous pouvez exiger que cesse la diffusion d'un renseignement personnel vous concernant ou demander la désindexation de tout lien permettant d'y accéder lorsque sa diffusion vous cause préjudice." },
        ],
      },
      {
        type: "subsection",
        id: "droits-retrait",
        title: "10.5 — Droit de retrait du consentement",
        blocks: [
          { type: "p", text: "Vous pouvez retirer votre consentement à tout moment, sans motif et sans pénalité. Le retrait du consentement parental entraîne la désactivation immédiate du profil de l'athlète mineur." },
        ],
      },
      {
        type: "subsection",
        id: "droits-automatise",
        title: "10.6 — Droit relatif aux décisions automatisées",
        blocks: [
          { type: "p", text: "Nexus n'utilise pas de prise de décision exclusivement automatisée produisant un effet juridique ou vous affectant de manière similaire. Les évaluations sportives et le pipeline de recrutement sont effectués par des personnes humaines (entraîneurs, recruteurs). Vous pouvez néanmoins demander de l'information sur les facteurs ayant mené à une décision vous concernant." },
        ],
      },
      {
        type: "subsection",
        id: "droits-exercer",
        title: "10.7 — Comment exercer vos droits",
        blocks: [
          { type: "p", text: "Pour exercer un de vos droits, écrivez au RPRP de Nexus à confidentialite@nexussports.ca en précisant la nature de votre demande. Une preuve d'identité pourra être demandée afin de protéger vos renseignements. Nexus répond à toute demande dans un délai de 30 jours." },
        ],
      },
    ],
  },
  {
    id: "incidents",
    title: "Gestion des incidents",
    blocks: [
      { type: "p", text: "Conformément à la Loi 25, Nexus tient un registre des incidents de confidentialité. En cas d'incident présentant un risque de préjudice sérieux, Nexus avise sans délai la Commission d'accès à l'information du Québec ainsi que les personnes concernées." },
      { type: "p", text: "Les utilisateurs sont tenus de signaler tout incident ou soupçon d'incident au RPRP de Nexus dans les plus brefs délais à confidentialite@nexussports.ca." },
      {
        type: "callout",
        tone: "red",
        title: "Signalement immédiat",
        text: "Si vous soupçonnez un accès non autorisé à votre compte ou une fuite de données, contactez immédiatement le RPRP afin que les mesures de confinement et d'évaluation du risque soient déclenchées.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    blocks: [
      { type: "p", text: "La Plateforme utilise des témoins de connexion (cookies) et des technologies similaires pour assurer son bon fonctionnement et améliorer votre expérience." },
      {
        type: "subsection",
        id: "cookies-types",
        title: "12.1 — Types de témoins utilisés",
        blocks: [
          {
            type: "table",
            headers: ["Catégorie", "Finalité", "Consentement"],
            rows: [
              ["Essentiels", "Maintien de la session, sécurité, fonctionnement de base", "Non requis (nécessaire au service)"],
              ["Préférences", "Mémorisation de vos paramètres (thème, langue, filtres)", "Implicite par l'utilisation"],
              ["Mesure d'audience", "Statistiques agrégées sur l'utilisation de la Plateforme", "Requis (peut être refusé)"],
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "cookies-preferences",
        title: "12.2 — Gestion de vos préférences",
        blocks: [
          { type: "p", text: "Vous pouvez configurer votre navigateur pour refuser les témoins. Certaines fonctionnalités de la Plateforme pourraient toutefois ne plus fonctionner correctement." },
        ],
      },
    ],
  },
  {
    id: "gouvernance",
    title: "Gouvernance interne",
    blocks: [
      {
        type: "subsection",
        id: "gouvernance-rprp",
        title: "13.1 — Mandat opérationnel du RPRP",
        blocks: [
          { type: "p", text: "Le RPRP de Nexus est désigné par écrit par la personne exerçant la plus haute autorité au sein de Nexus. Il est chargé de :" },
          {
            type: "bullets",
            items: [
              "Être consulté dès le début de tout projet impliquant des renseignements personnels",
              "Superviser la réalisation des ÉFVP",
              "Superviser la tenue du registre des incidents et du registre des communications",
              "Participer à l'évaluation du risque de préjudice sérieux lié à un incident",
              "Vérifier la conformité des fournisseurs et sous-traitants",
              "Recevoir et traiter les demandes d'exercice de droits dans les délais prescrits",
              "Produire un rapport annuel sur la conformité de Nexus",
            ],
          },
        ],
      },
      {
        type: "subsection",
        id: "gouvernance-utilisateurs",
        title: "13.2 — Obligations des utilisateurs de la Plateforme",
        blocks: [
          { type: "p", text: "Toute personne qui traite des renseignements personnels via Nexus s'engage à :" },
          {
            type: "bullets",
            items: [
              "N'accéder qu'aux renseignements nécessaires à l'exercice de ses fonctions",
              "Ne pas communiquer de renseignements personnels à des personnes non autorisées, y compris par capture d'écran",
              "Protéger l'accès à son compte par un mot de passe sécurisé et ne jamais partager ses identifiants",
              "Signaler immédiatement tout incident ou faille de sécurité",
              "S'assurer que le consentement parental a été obtenu avant de saisir ou d'activer le profil d'un athlète mineur (entraîneurs et directeurs)",
              "Ne pas télécharger ou exporter en masse les données d'athlètes à des fins non autorisées (recruteurs)",
              "Ne pas conserver de renseignements personnels après la cessation de ses fonctions ou la désactivation de son compte",
              "Participer aux activités de formation et de sensibilisation",
            ],
          },
          { type: "p", text: "Tout manquement peut entraîner la désactivation du compte et le signalement à l'établissement d'attache. L'activité de chaque utilisateur est journalisée à des fins de traçabilité." },
        ],
      },
    ],
  },
  {
    id: "plaintes",
    title: "Traitement des plaintes",
    blocks: [
      { type: "p", text: "Toute personne qui croit que ses droits en matière de protection des renseignements personnels n'ont pas été respectés peut adresser une plainte au RPRP de Nexus. La plainte doit décrire la situation, les démarches déjà entreprises et le résultat souhaité." },
      { type: "p", text: "Le RPRP accuse réception de la plainte dans un délai de 10 jours ouvrables et fournit une réponse motivée dans un délai maximal de 30 jours. À défaut d'une réponse satisfaisante, le plaignant peut s'adresser à la Commission d'accès à l'information du Québec (CAI)." },
      { type: "contact-card", rows: RPRP_CONTACT_ROWS },
    ],
  },
  {
    id: "modifications",
    title: "Modifications",
    blocks: [
      { type: "p", text: "Nexus peut mettre à jour la présente politique de confidentialité afin de refléter l'évolution de ses pratiques, de la législation ou des technologies." },
      { type: "p", text: "En cas de modification substantielle, vous serez informé par courriel ou par un avis visible sur la Plateforme au moins 30 jours avant l'entrée en vigueur des modifications. La date de dernière mise à jour figure en haut de cette page." },
      { type: "p", text: "Votre utilisation continue de la Plateforme après l'entrée en vigueur des modifications constitue votre acceptation de la version mise à jour." },
    ],
  },
];

