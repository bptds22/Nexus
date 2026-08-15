// DÉPENDANCE DE PUBLICATION — ne pas merger dans main avant :
//   1. table blackout RSEQ peuplée (COACH-06 + SECU-06)
//   2. RLS recruteur fermé côté API directe (RECR-02 + SECU-04)
// SECU-04 et SECU-06 sortent de draft en même temps.

/* ═══════════════════════════════════════════════════════════════
   content/aide/sections.ts — contenu du centre d'aide public

   SOURCE DE VÉRITÉ : docs/aide-contenu.md (14 sections, 55
   articles). Ce fichier en est la transcription — le texte est
   repris VERBATIM, rien n'est reformulé.

   COMMENT ÉDITER SANS ÊTRE DÉVELOPPEUR
   Chaque article est une question et une liste de blocs. Les blocs
   correspondent un pour un au balisage du document source :

     paragraphe          { type: "p", text: "..." }
     liste à puces       { type: "bullets", items: ["...", "..."] }
     liste numérotée     { type: "steps", items: ["...", "..."] }
     encadré             { type: "note", title: "...", text: "..." }
     tableau             { type: "table", headers: [...], rows: [[...]] }

   Le gras s'écrit **entre deux paires d'astérisques**, dans le
   texte, exactement comme en markdown.

   L'IDENTIFIANT EST L'ANCRE. « SECU-04 » donne /aide#secu-04.
   Ne jamais le renommer : des liens envoyés par courriel pointent
   dessus.

   L'ORDRE DES SECTIONS EST SIGNIFIANT. Le sommaire les numérote de
   01 à 14 dans l'ordre de ce tableau, et plusieurs articles
   renvoient à « la section 6 » ou « la section 3 ». Réordonner les
   sections casse ces renvois.

   BROUILLONS. `draft: true` retire l'article de la page, de la
   recherche, du JSON-LD et du compteur en production. En
   développement il reste visible, coiffé d'un bandeau
   « BROUILLON ». Voir la note de publication en fin de fichier.
═══════════════════════════════════════════════════════════════ */

import type { AideSection } from "./types";

export const SECTIONS_AIDE: AideSection[] = [
  /* ═══ 01 ═══════════════════════════════════════════════════ */
  {
    id: "base",
    title: "Les bases",
    articles: [
      {
        id: "BASE-01",
        question: "Qu'est-ce que Nexus ?",
        keywords: ["c'est quoi", "presentation", "plateforme", "definition"],
        blocks: [
          {
            type: "p",
            text: "Nexus est une plateforme québécoise de recrutement sportif. Elle met en relation les athlètes du secondaire et des ligues civiles avec les programmes qui recrutent.",
          },
          {
            type: "p",
            text: "Concrètement : un athlète y crée un profil sportif et scolaire. Les recruteurs peuvent le consulter, le suivre et communiquer avec son entraîneur. L'entraîneur, lui, gère son équipe et donne de la visibilité à ses joueurs.",
          },
        ],
      },
      {
        id: "BASE-02",
        question: "Est-ce réservé au réseau collégial québécois ?",
        keywords: ["cegep", "universite", "etranger", "hors quebec", "international"],
        blocks: [
          {
            type: "p",
            text: "Non. Le réseau des CÉGEP est notre point de départ, parce que c'est là que se joue la prochaine étape de la majorité des athlètes québécois. Ce n'est pas une limite.",
          },
          { type: "p", text: "La plateforme est construite pour accueillir tout programme qui recrute :" },
          {
            type: "bullets",
            items: [
              "Les CÉGEP du réseau RSEQ, aujourd'hui.",
              "Les ligues et clubs civils — baseball, soccer, hockey, et tout sport dont la structure vit hors du réseau scolaire.",
              "Les universités et les programmes collégiaux hors Québec.",
              "Les clubs et académies à l'étranger — un club espagnol qui cherche un milieu de terrain québécois doit pouvoir le trouver ici.",
            ],
          },
          {
            type: "note",
            title: "Ce que ça veut dire pour un athlète",
            text: "Votre profil n'est pas construit pour un seul débouché. Le même profil sert au CÉGEP du coin comme à un programme à l'extérieur du pays. Vous n'aurez pas à recommencer.",
          },
        ],
      },
      {
        id: "BASE-03",
        question: "Est-ce que c'est gratuit ?",
        keywords: ["prix", "tarif", "cout", "payer", "abonnement", "forfait"],
        blocks: [
          {
            type: "p",
            text: "Pour un athlète, oui. La création du profil, sa mise à jour, son rattachement à une équipe et sa visibilité auprès des recruteurs ne coûtent rien et ne coûteront jamais rien.",
          },
          { type: "p", text: "Pour un entraîneur, le compte est gratuit également." },
          {
            type: "p",
            text: "Les recruteurs sont le seul rôle payant, et seulement à partir du moment où ils veulent identifier et contacter des athlètes. Voir la section 6.",
          },
        ],
      },
      {
        id: "BASE-04",
        question: "Qui peut s'inscrire ?",
        keywords: ["compte", "role", "club", "academie", "parent"],
        blocks: [
          {
            type: "p",
            text: "Quatre types de comptes se créent librement : athlète, entraîneur d'école secondaire, entraîneur de ligue ou club civil, et recruteur.",
          },
          {
            type: "p",
            text: "Une entité de recrutement civile — club, académie, programme hors réseau scolaire — doit d'abord écrire à info@nexussports.ca. Nous créons l'entité après vérification, puis l'inscription suit son cours normal.",
          },
          {
            type: "p",
            text: "Un cinquième type, le compte parent, se crée uniquement sur invitation, lorsqu'un athlète mineur s'inscrit.",
          },
        ],
      },
      {
        id: "BASE-05",
        question: "Sur quels appareils Nexus fonctionne-t-il ?",
        keywords: ["mobile", "application", "ios", "android", "telephone", "web", "navigateur"],
        blocks: [
          {
            type: "p",
            text: "Sur le web, à nexussports.ca, depuis n'importe quel navigateur — et dans l'application mobile, sur iOS et Android.",
          },
          {
            type: "note",
            title: "À savoir",
            text: "Certaines fonctions plus récentes n'existent pour l'instant que sur le site web. Le portail parent, en particulier, est accessible uniquement par navigateur.",
          },
        ],
      },
    ],
  },

  /* ═══ 02 ═══════════════════════════════════════════════════ */
  {
    id: "insc",
    title: "L'inscription d'un athlète",
    articles: [
      {
        id: "INSC-01",
        question: "Quel âge faut-il avoir ?",
        keywords: ["14 ans", "mineur", "majeur", "18 ans", "loi 25", "age minimum"],
        blocks: [
          {
            type: "p",
            text: "Il faut avoir 14 ans ou plus pour créer un compte soi-même. C'est une exigence de la Loi 25, la loi québécoise sur la protection des renseignements personnels.",
          },
          {
            type: "p",
            text: "Un jeune de moins de 14 ans ne peut pas s'inscrire, et son profil ne peut pas être rattaché à une équipe. Le message affiché est explicite : « L'inscription est réservée aux 14 ans et plus. »",
          },
          {
            type: "p",
            text: "Entre 14 et 17 ans, l'inscription est possible, mais une étape supplémentaire s'ajoute : le jeune doit indiquer le nom et le courriel de son parent ou tuteur, et confirmer que celui-ci autorise la démarche. Le parent reçoit ensuite un avis par courriel.",
          },
          { type: "p", text: "À 18 ans et plus, aucune étape parentale n'est demandée." },
        ],
      },
      {
        id: "INSC-02",
        question: "Quelles sont les étapes de l'inscription ?",
        keywords: ["creer un compte", "mot de passe", "google", "apple", "formulaire", "etapes"],
        blocks: [
          {
            type: "p",
            text: "L'inscription se fait en deux temps : la création du compte, puis le profil d'athlète.",
          },
          {
            type: "table",
            headers: ["Étape", "Ce qui est demandé"],
            rows: [
              ["1 — Le rôle", "Athlète, entraîneur ou recruteur."],
              [
                "2 — Le compte",
                "Courriel et mot de passe (8 caractères minimum), ou connexion par Google ou Apple.",
              ],
              [
                "3 — L'identité",
                "Prénom, nom, date de naissance, et le contexte : école secondaire ou ligue civile. Deux consentements obligatoires : la politique de confidentialité et la collecte de renseignements. Un troisième, pour les communications, est facultatif.",
              ],
              [
                "4 — Le volet parental",
                "Uniquement pour les 14 à 17 ans : prénom, nom et courriel du parent ou tuteur, plus deux confirmations.",
              ],
            ],
          },
          {
            type: "p",
            text: "Vient ensuite le profil d'athlète, en quatre sections : identité et équipe, parcours scolaire, données physiques, puis sport et vidéos.",
          },
          {
            type: "p",
            text: "Seules quelques informations sont obligatoires : le prénom, le nom, l'année de diplomation prévue, l'école ou le sport selon le contexte, et le sport principal. Tout le reste — moyenne générale, taille, poids, tests physiques, vidéos, biographie — est facultatif et peut être complété plus tard, en tout temps.",
          },
        ],
      },
      {
        id: "INSC-03",
        question: "Est-ce qu'on peut s'arrêter et revenir plus tard ?",
        keywords: ["sauvegarde", "reprendre", "plus tard", "incomplet"],
        blocks: [
          {
            type: "p",
            text: "Oui. Le profil se complète progressivement. Un athlète peut créer son compte un soir et remplir le reste sur plusieurs semaines. Rien ne se perd entre deux sessions.",
          },
        ],
      },
    ],
  },

  /* ═══ 03 ═══════════════════════════════════════════════════ */
  {
    id: "orph",
    title: "Sans équipe ou sans entraîneur",
    intro: [
      {
        type: "p",
        text: "C'est la situation la plus courante en début de saison, et elle ne bloque personne. Un athlète peut toujours s'inscrire — même si son équipe, son club ou son entraîneur ne sont pas encore sur la plateforme.",
      },
    ],
    articles: [
      {
        id: "ORPH-01",
        question: "Je ne trouve pas mon équipe dans la liste. Que faire ?",
        keywords: ["equipe absente", "introuvable", "sans equipe", "a reclamer"],
        blocks: [
          {
            type: "p",
            text: "Inscrivez-vous quand même. Choisissez votre école — ou continuez sans équipe si elle n'apparaît pas — et complétez votre profil normalement.",
          },
          {
            type: "p",
            text: "Vous êtes visible auprès des recruteurs dès ce moment-là, exactement comme un athlète rattaché. L'équipe n'est pas une condition d'accès.",
          },
          {
            type: "p",
            text: "Quand votre entraîneur s'inscrira à son tour, il vous retrouvera : son portail contient un onglet « À réclamer » qui liste les athlètes rattachés à son établissement mais pas encore à une de ses équipes. Un clic, et vous êtes dans son alignement.",
          },
        ],
      },
      {
        id: "ORPH-02",
        question: "Et si mon club civil n'existe pas encore sur Nexus ?",
        keywords: ["club civil", "ligue civile", "creer un club", "absent"],
        blocks: [
          {
            type: "p",
            text: "Même réponse : inscrivez-vous, complétez votre profil, et attendez que votre entraîneur crée le club. Un entraîneur de ligue civile peut créer son club lui-même au moment de son inscription.",
          },
          {
            type: "p",
            text: "Si personne de votre club n'est encore sur Nexus, écrivez à info@nexussports.ca. Nous nous occupons de la mise en place.",
          },
        ],
      },
      {
        id: "ORPH-03",
        question: "Entraîneur : comment je récupère mes athlètes déjà inscrits ?",
        keywords: ["recuperer", "code d'equipe", "invitation", "a reclamer", "importer"],
        blocks: [
          { type: "p", text: "Trois chemins, du plus simple au plus large." },
          {
            type: "steps",
            items: [
              "L'onglet « À réclamer ». Votre portail liste automatiquement les athlètes rattachés à votre établissement qui n'ont pas encore d'entraîneur. Vous les ajoutez à votre équipe d'un clic. C'est le chemin normal.",
              "L'invitation par courriel. Si l'athlète est ailleurs ou introuvable, saisissez son adresse. S'il a déjà un compte, il reçoit une invitation à rejoindre votre équipe et décide lui-même de l'accepter.",
              "Le code d'équipe. Un code court que vous partagez à tout votre groupe — au vestiaire, dans un message, sur une feuille. Chaque athlète le saisit et rejoint l'équipe sans que vous ayez à le faire un par un.",
            ],
          },
          {
            type: "note",
            title: "Toute une équipe d'un coup ?",
            text: "Si vous avez cinquante athlètes à inscrire, n'y allez pas un par un. Écrivez à info@nexussports.ca : nous faisons l'intégration avec vous.",
          },
        ],
      },
      {
        id: "ORPH-04",
        question: "Mon athlète s'est inscrit avec une autre adresse courriel. Est-ce un problème ?",
        keywords: ["courriel different", "adresse", "rattachement", "doublon"],
        blocks: [
          {
            type: "p",
            text: "Non, mais ça change le chemin. Le rattachement automatique fonctionne quand l'adresse que vous avez saisie est exactement celle du compte de l'athlète.",
          },
          {
            type: "p",
            text: "Si les adresses diffèrent, utilisez l'onglet « À réclamer » ou le code d'équipe — les deux fonctionnent quelle que soit l'adresse.",
          },
        ],
      },
    ],
  },

  /* ═══ 04 ═══════════════════════════════════════════════════ */
  {
    id: "par",
    title: "Les parents",
    articles: [
      {
        id: "PAR-01",
        question: "Mon enfant s'est inscrit. Qu'est-ce que je reçois ?",
        keywords: ["courriel parent", "avis", "notification", "mon enfant"],
        blocks: [
          {
            type: "p",
            text: "Si votre enfant a entre 14 et 17 ans et qu'il a inscrit votre adresse courriel, vous recevez un message intitulé « Votre enfant s'est inscrit sur Nexus ».",
          },
          {
            type: "p",
            text: "Ce courriel ne nomme jamais votre enfant. C'est volontaire : si l'adresse a été mal saisie, aucun renseignement personnel ne se retrouve chez un inconnu.",
          },
        ],
      },
      {
        id: "PAR-02",
        question: "Qu'est-ce que je peux faire avec un compte parent ?",
        keywords: ["portail parent", "creer mon compte", "mot de passe", "30 jours", "suivre"],
        blocks: [
          {
            type: "p",
            text: "Le courriel contient un bouton pour créer votre compte parent. L'adresse est déjà inscrite et verrouillée à l'écran : c'est celle que votre enfant a fournie. Vous n'avez qu'à choisir un mot de passe. Le lien reste valide 30 jours.",
          },
          {
            type: "note",
            tone: "yellow",
            title: "Une seule condition",
            text: "Cette adresse ne doit pas déjà servir à un autre compte Nexus. Si vous êtes vous-même entraîneur ou recruteur sur la plateforme, utilisez une seconde adresse — un même courriel ne peut pas porter deux rôles. Votre enfant peut modifier l'adresse parentale dans son profil.",
          },
          { type: "p", text: "Une fois connecté, vous accédez à trois choses :" },
          {
            type: "bullets",
            items: [
              "La fiche de votre enfant : sa photo, son nom, son sport et son école.",
              "Ses consentements, dont deux que vous pouvez modifier vous-même en tout temps.",
              "Un résumé d'activité : le nombre de fois où son profil a été consulté, et l'évolution de son dossier.",
            ],
          },
          {
            type: "note",
            title: "Important",
            text: "Le portail parent affiche des totaux, jamais des identités. Vous voyez que des recruteurs s'intéressent à votre enfant, pas lesquels.",
          },
        ],
      },
      {
        id: "PAR-03",
        question: "Est-ce que je suis prévenu quand il se passe quelque chose ?",
        keywords: ["alerte", "favoris", "visite", "avis parent"],
        blocks: [
          {
            type: "p",
            text: "Oui, pour trois événements. Vous recevez une notification lorsqu'un recruteur ajoute votre enfant à ses favoris, lorsque son dossier progresse dans le processus de recrutement, et lorsqu'une visite est planifiée.",
          },
          {
            type: "p",
            text: "Ces notifications décrivent l'événement sans nommer le recruteur ni l'établissement.",
          },
        ],
      },
      {
        id: "PAR-04",
        question: "Est-ce que je peux faire retirer le profil de mon enfant ?",
        keywords: ["supprimer", "effacer", "retirer", "desactiver", "fermer le compte"],
        blocks: [
          {
            type: "p",
            text: "La suppression du compte se fait depuis le compte de votre enfant, dans ses réglages. C'est le même endroit où il peut désactiver son profil temporairement.",
          },
          {
            type: "p",
            text: "Si vous n'arrivez pas à joindre votre enfant ou si la situation l'exige, écrivez à confidentialite@nexussports.ca et nous procéderons.",
          },
        ],
      },
      {
        id: "PAR-05",
        question: "Et si je ne fais rien ?",
        keywords: ["ignorer", "ne rien faire", "deux parents", "obligatoire"],
        blocks: [
          {
            type: "p",
            text: "Le profil de votre enfant reste actif. La création d'un compte parent est une possibilité qui vous est offerte, pas une condition à remplir. Vous pouvez y revenir plus tard, dans les 30 jours suivant l'avis.",
          },
          {
            type: "p",
            text: "À noter : un athlète ne peut être lié qu'à un seul compte parent. Si vous êtes deux parents, choisissez ensemble lequel crée le compte.",
          },
        ],
      },
    ],
  },

  /* ═══ 05 ═══════════════════════════════════════════════════ */
  {
    id: "cons",
    title: "Les consentements",
    intro: [
      {
        type: "p",
        text: "Nexus est soumise à la Loi 25. Chaque consentement demandé a un objet précis, et vous trouverez ci-dessous la liste complète.",
      },
      {
        type: "table",
        headers: ["Consentement", "Quand", "Obligatoire ?", "Ce qu'il permet"],
        rows: [
          [
            "Politique de confidentialité et conditions d'utilisation",
            "À l'inscription",
            "Oui",
            "Utiliser la plateforme.",
          ],
          [
            "Collecte et traitement des renseignements",
            "À l'inscription",
            "Oui",
            "Créer et héberger le profil.",
          ],
          [
            "Communications de Nexus",
            "À l'inscription",
            "Non",
            "Recevoir nos infolettres et annonces.",
          ],
          [
            "Autorisation parentale — création du profil",
            "14 à 17 ans",
            "Oui",
            "Créer le profil d'un mineur.",
          ],
          [
            "Autorisation parentale — visibilité aux recruteurs",
            "14 à 17 ans",
            "Oui",
            "Rendre le profil visible aux recruteurs.",
          ],
          [
            "Visibilité auprès des partenaires média",
            "Facultatif, en tout temps",
            "Non",
            "Voir la section 7.",
          ],
        ],
      },
    ],
    articles: [
      {
        id: "CONS-01",
        question: "Comment fonctionne l'autorisation parentale ?",
        keywords: ["autorisation", "parent", "mineur", "cases a cocher", "loi 25"],
        blocks: [
          {
            type: "p",
            text: "Au moment de l'inscription, un athlète de 14 à 17 ans doit cocher deux cases confirmant que son parent ou tuteur autorise la création du profil et sa visibilité auprès des recruteurs. Il inscrit ensuite le nom et le courriel de ce parent.",
          },
          {
            type: "p",
            text: "Le parent reçoit alors un avis par courriel l'informant de l'inscription, avec la possibilité de créer son propre compte pour suivre le dossier.",
          },
          {
            type: "note",
            tone: "yellow",
            title: "Entraîneurs, à lire",
            text: "Cette étape est celle de l'athlète qui s'inscrit lui-même. Si vous créez vous-même la fiche d'un joueur mineur, l'autorisation parentale doit être obtenue par vous, hors plateforme. Prenez l'habitude de la demander avant d'ajouter un mineur.",
          },
        ],
      },
      {
        id: "CONS-02",
        question: "Peut-on retirer un consentement ?",
        keywords: ["retirer", "annuler", "desabonner", "revoquer", "desactiver"],
        blocks: [
          {
            type: "p",
            text: "Les communications marketing et la visibilité auprès des partenaires se retirent en un clic, en tout temps, par l'athlète dans ses réglages ou par le parent dans son portail.",
          },
          {
            type: "p",
            text: "Pour les consentements de base — ceux qui permettent au profil d'exister — le retrait équivaut à désactiver le compte. Cette option se trouve dans les réglages de l'athlète : le profil disparaît immédiatement des recherches de recruteurs.",
          },
        ],
      },
    ],
  },

  /* ═══ 06 ═══════════════════════════════════════════════════ */
  {
    id: "secu",
    title: "La chaîne de confiance",
    intro: [
      {
        type: "p",
        text: "Nos athlètes sont majoritairement mineurs. Leur protection n'est pas une fonctionnalité de la plateforme : c'est sa contrainte de départ. Cette section explique qui accède à quoi, et pourquoi.",
      },
      {
        type: "p",
        text: "Le principe est simple à énoncer : personne n'obtient l'accès à un athlète parce qu'il l'a demandé. L'accès se gagne, et il se vérifie à chaque maillon.",
      },
    ],
    articles: [
      {
        id: "SECU-01",
        question: "Premier maillon : personne ne voit rien sans compte",
        keywords: ["public", "google", "moteur de recherche", "visiteur", "anonyme"],
        blocks: [
          {
            type: "p",
            text: "Aucun profil d'athlète n'est accessible à un visiteur non connecté. Pas de page publique, pas de résultat de moteur de recherche, pas d'aperçu. Un athlète de Nexus n'existe pas pour l'internet ouvert.",
          },
        ],
      },
      {
        id: "SECU-02",
        question: "Deuxième maillon : l'entraîneur ne voit que les siens",
        keywords: ["autre ecole", "cloisonnement", "acces entraineur", "base de donnees"],
        blocks: [
          {
            type: "p",
            text: "Un entraîneur accède aux athlètes de son établissement — son école ou son club — et à personne d'autre. Il ne peut pas parcourir les athlètes d'une autre école, ni chercher dans l'ensemble de la plateforme.",
          },
          {
            type: "p",
            text: "Cette limite n'est pas un réglage d'affichage. Elle est appliquée au niveau de la base de données : un entraîneur qui tenterait de contourner l'interface n'obtiendrait aucune ligne supplémentaire.",
          },
        ],
      },
      {
        id: "SECU-03",
        question: "Troisième maillon : le responsable d'établissement répond de son monde",
        keywords: ["rprp", "responsable des sports", "approbation", "directeur"],
        blocks: [
          {
            type: "p",
            text: "Chaque établissement a un responsable des sports. Ce n'est pas un titre qu'on se donne : la demande est déposée sur la plateforme, puis examinée et approuvée manuellement par Nexus avant d'être accordée.",
          },
          { type: "p", text: "Ce responsable assume ensuite deux choses :" },
          {
            type: "bullets",
            items: [
              "Il est le répondant en matière de protection des renseignements personnels (RPRP) pour son établissement. C'est une obligation de la Loi 25, et elle est nommée à l'inscription.",
              "Il confirme que les entraîneurs qui s'inscrivent sous son établissement en sont réellement. C'est lui qui connaît son personnel — pas nous.",
            ],
          },
          {
            type: "p",
            text: "La protection des données des jeunes se joue donc au plus près d'eux : dans l'établissement qui les encadre déjà.",
          },
        ],
      },
      {
        id: "SECU-04",
        question: "Quatrième maillon : un recruteur entre librement, mais ne voit personne",
        keywords: ["anonymise", "gratuit", "recruteur non abonne", "identite masquee"],
        // Réserve de publication — voir la note en fin de fichier.
        draft: true,
        blocks: [
          {
            type: "p",
            text: "Nous voulons qu'un recruteur puisse créer son compte, entrer et constater la valeur de la plateforme sans obstacle. Le bassin d'athlètes, les sports couverts, la profondeur des profils : tout cela se voit gratuitement.",
          },
          { type: "p", text: "Ce qui ne se voit pas, c'est l'athlète lui-même." },
          {
            type: "p",
            text: "Un recruteur non abonné ne reçoit aucune information permettant d'identifier un jeune ni de le joindre : ni nom, ni photo, ni numéro de chandail, ni lien vidéo, ni coordonnées. Il voit des profils sportifs — un poste, une cote, une année de diplomation — pas des personnes.",
          },
          {
            type: "note",
            title: "Le point qui compte",
            text: "Cette restriction n'est pas une règle d'affichage. Les données ne quittent pas nos serveurs. Il ne s'agit pas d'un champ masqué dans une page qu'un outil de développeur permettrait de révéler : l'information n'est jamais transmise au navigateur du recruteur.",
          },
        ],
      },
      {
        id: "SECU-05",
        question: "Cinquième maillon : l'accès s'ouvre après vérification et abonnement",
        keywords: ["abonnement", "verification", "payant", "acces complet"],
        blocks: [
          {
            type: "p",
            text: "Un recruteur obtient l'accès à l'identité des athlètes lorsque deux conditions sont réunies : son rattachement à un établissement a été vérifié par Nexus, et il a souscrit un abonnement.",
          },
          {
            type: "p",
            text: "L'abonnement n'est pas seulement un modèle d'affaires. C'est aussi un filtre : une personne qui paie sous le nom d'un établissement laisse une trace vérifiable. La curiosité anonyme s'arrête au maillon précédent.",
          },
        ],
      },
      {
        id: "SECU-06",
        question: "Et le contact avec les athlètes ?",
        keywords: ["messagerie", "contacter", "rseq", "periode de silence", "message"],
        // Réserve de publication — voir la note en fin de fichier.
        draft: true,
        blocks: [
          {
            type: "p",
            text: "Un recruteur vérifié et abonné peut écrire à un athlète, mais jamais librement. Trois règles encadrent ce contact.",
          },
          {
            type: "bullets",
            items: [
              "Les échanges passent par la messagerie de la plateforme. Aucune coordonnée personnelle n'est transmise — ni courriel, ni téléphone, d'un côté comme de l'autre.",
              "Nexus applique des périodes de silence qui suivent le calendrier de recrutement et les règles du RSEQ. Hors des fenêtres autorisées, la messagerie est fermée : le recruteur ne peut simplement pas écrire.",
              "L'entraîneur est informé du premier contact. Il reste l'adulte de référence dans la relation, et il n'est jamais contourné.",
            ],
          },
          {
            type: "p",
            text: "Un recruteur non abonné, lui, ne peut contacter personne — il ne sait même pas qui il regarde.",
          },
          {
            type: "note",
            title: "Pourquoi c'est construit ainsi",
            text: "Un athlète du secondaire n'a pas à gérer des sollicitations d'adultes inconnus sur son téléphone personnel, ni à composer avec les règles d'un calendrier de recrutement qu'il ne connaît pas. La plateforme porte cette charge à sa place.",
          },
        ],
      },
      {
        id: "SECU-07",
        question: "Où sont hébergées les données ?",
        keywords: ["hebergement", "serveur", "quebec", "welead", "confidentialite"],
        blocks: [
          {
            type: "p",
            text: "Au Québec. Nexus est exploitée par Gestion Welead inc., une entreprise québécoise, et les renseignements sont conservés sur des serveurs situés dans la province.",
          },
          {
            type: "p",
            text: "Notre répondant en matière de protection des renseignements personnels est joignable à confidentialite@nexussports.ca.",
          },
        ],
      },
    ],
  },

  /* ═══ 07 ═══════════════════════════════════════════════════ */
  {
    id: "med",
    title: "Les partenaires média",
    intro: [
      {
        type: "p",
        text: "C'est la section que nous vous invitons à lire attentivement, parce qu'elle est souvent mal comprise.",
      },
    ],
    articles: [
      {
        id: "MED-01",
        question: "De quoi s'agit-il ?",
        keywords: ["media", "journaliste", "carte", "publication", "balado"],
        blocks: [
          {
            type: "p",
            text: "Nexus collabore avec des partenaires approuvés : journalistes sportifs, pages de contenu, balados, camps spécialisés. Ces partenaires peuvent télécharger la carte officielle Nexus d'un athlète pour la publier dans un article, une publication ou un reportage.",
          },
          {
            type: "p",
            text: "La carte contient le nom de l'athlète, son école, sa cote, sa position et sa photo.",
          },
        ],
      },
      {
        id: "MED-02",
        question: "Est-ce activé par défaut ?",
        keywords: ["par defaut", "desactive", "option", "case a cocher"],
        blocks: [
          {
            type: "p",
            text: "**Non.** Cette option est désactivée à la création du compte. Elle ne s'active que si l'athlète — ou son parent — la coche explicitement.",
          },
        ],
      },
      {
        id: "MED-03",
        question: "Qu'est-ce qu'un partenaire voit si l'option est désactivée ?",
        keywords: ["rien", "invisible", "anonymise", "absent"],
        blocks: [
          {
            type: "p",
            text: "**Rien.** Absolument rien. L'athlète n'apparaît pas dans leur portail, ni sous une forme anonymisée, ni sous une forme partielle. Il est purement absent.",
          },
          {
            type: "p",
            text: "Ce n'est pas un réglage d'affichage : la restriction est appliquée au niveau de la base de données elle-même. Un partenaire qui chercherait à contourner l'interface n'obtiendrait aucune ligne.",
          },
          {
            type: "note",
            tone: "green",
            title: "En clair",
            text: "Tant que vous ne cochez pas cette option, aucun média partenaire ne peut voir votre profil, ni le nommer, ni télécharger votre carte. C'est le réglage par défaut, et c'est ainsi que nous protégeons nos athlètes.",
          },
        ],
      },
      {
        id: "MED-04",
        question: "Et si on l'active ?",
        keywords: ["activer", "retirer", "journal", "trace"],
        blocks: [
          {
            type: "p",
            text: "Seuls les partenaires dont le statut a été approuvé par Nexus y ont accès. Chaque consultation et chaque téléchargement de carte est enregistré.",
          },
          {
            type: "p",
            text: "L'option se retire en tout temps, aussi facilement qu'elle a été donnée, sans avoir à nous écrire.",
          },
        ],
      },
    ],
  },

  /* ═══ 08 ═══════════════════════════════════════════════════ */
  {
    id: "eq",
    title: "Le rattachement à une équipe",
    articles: [
      {
        id: "EQ-01",
        question: "Comment un athlète rejoint-il son équipe ?",
        keywords: ["rejoindre", "code d'equipe", "invitation", "alignement"],
        blocks: [
          { type: "p", text: "Quatre chemins existent." },
          {
            type: "bullets",
            items: [
              "Pendant l'inscription : l'athlète choisit son école, puis son équipe dans la liste. C'est le chemin le plus courant.",
              "Par invitation : l'entraîneur envoie une invitation, qui apparaît dans les notifications de l'athlète. Il l'accepte ou la refuse.",
              "Par code d'équipe : un code court à saisir, ou un lien à ouvrir.",
              "Par une fiche déjà créée : si l'entraîneur a créé la fiche avant l'inscription, elle se rattache automatiquement au moment où l'athlète crée son compte avec la même adresse courriel.",
            ],
          },
          { type: "p", text: "Si aucun de ces chemins ne s'applique, voir la section 3." },
        ],
      },
      {
        id: "EQ-02",
        question: "Un athlète peut-il faire partie de deux équipes ?",
        keywords: ["deux equipes", "plusieurs", "double", "historique"],
        blocks: [
          {
            type: "p",
            text: "Non. Un athlète appartient à une seule équipe à la fois. C'est ce qui garde les alignements propres et évite les doublons.",
          },
          {
            type: "p",
            text: "Changer d'équipe est possible et prend quelques secondes. L'ancienne appartenance est conservée dans le parcours de l'athlète — son historique reste visible.",
          },
        ],
      },
      {
        id: "EQ-03",
        question: "Que se passe-t-il si un athlète change d'équipe ?",
        keywords: ["changer", "transfert", "quitter", "nouvelle equipe"],
        blocks: [
          {
            type: "p",
            text: "Il doit confirmer le changement à l'écran. Une fois confirmé, son école et son entraîneur de référence sont mis à jour, et l'ancienne équipe passe dans son historique.",
          },
        ],
      },
      {
        id: "EQ-04",
        question: "Faut-il absolument une équipe ?",
        keywords: ["sans equipe", "obligatoire", "seul"],
        blocks: [
          {
            type: "p",
            text: "Non. Un athlète sans équipe peut créer son profil, le compléter et être vu par les recruteurs exactement comme les autres. C'est utile pour ceux qui changent de niveau ou dont le club n'est pas encore inscrit.",
          },
        ],
      },
    ],
  },

  /* ═══ 09 ═══════════════════════════════════════════════════ */
  {
    id: "voir",
    title: "Qui voit quoi",
    intro: [
      {
        type: "p",
        text: "La question la plus importante, et celle qui revient le plus souvent chez les parents. Le détail du raisonnement est à la section 6.",
      },
      {
        type: "table",
        headers: ["Qui", "Ce qu'il voit"],
        rows: [
          ["Un visiteur non connecté", "Rien. Aucun profil d'athlète n'est accessible sans compte."],
          [
            "Un recruteur non abonné",
            "Des profils sportifs sans identité : poste, cote, année de diplomation. Ni nom, ni photo, ni numéro, ni vidéo, ni coordonnées.",
          ],
          [
            "Un recruteur vérifié et abonné",
            "Le profil sportif et scolaire complet : identité, photo, mensurations, tests, moyenne, vidéos, évaluation de l'entraîneur.",
          ],
          [
            "L'entraîneur de l'athlète",
            "Le profil complet, plus le courriel de l'athlète, plus le nombre de fois où son profil a été consulté.",
          ],
          [
            "Un partenaire média",
            "Rien, sauf si l'athlète a activé l'option décrite à la section 7.",
          ],
          ["Le parent", "La fiche de son enfant, ses consentements et des totaux d'activité."],
        ],
      },
    ],
    articles: [
      {
        id: "VOIR-01",
        question: "Les recruteurs voient-ils mon numéro de téléphone ou celui de mes parents ?",
        keywords: ["telephone", "coordonnees", "courriel", "vie privee", "contact"],
        blocks: [
          {
            type: "p",
            text: "Non. Les coordonnées — courriel de l'athlète, téléphone, nom et courriel du parent — ne sont affichées à aucun recruteur, abonné ou non. Un recruteur qui souhaite entrer en contact passe par la messagerie de la plateforme, où aucune coordonnée ne circule.",
          },
          // Renvoi conditionnel : masqué tant que SECU-06 est en
          // brouillon, réapparaît seul à la levée du drapeau.
          { type: "ref", requires: "SECU-06", text: "Voir SECU-06." },
        ],
      },
      {
        id: "VOIR-02",
        question: "Un recruteur d'un autre établissement peut-il voir mon profil ?",
        keywords: ["autre cegep", "autre region", "montreal", "decouvrir"],
        blocks: [
          {
            type: "p",
            text: "Oui, s'il est vérifié et abonné. C'est le but même de la plateforme : un athlète de Chicoutimi doit pouvoir être découvert par un programme de Montréal — ou d'ailleurs.",
          },
        ],
      },
      {
        id: "VOIR-03",
        question: "Est-ce que je sais qui a consulté mon profil ?",
        keywords: ["vues", "consultations", "statistiques", "qui m'a vu", "pro"],
        blocks: [
          {
            type: "p",
            text: "Chaque athlète voit gratuitement le nombre de consultations de son profil, leur évolution dans le temps et les régions d'où elles proviennent. Il reçoit aussi une notification à chaque consultation, indiquant la région du recruteur.",
          },
          {
            type: "p",
            text: "Connaître le nom des recruteurs et des établissements fait partie du forfait Pro de l'athlète.",
          },
        ],
      },
    ],
  },

  /* ═══ 10 ══════════════════════════════════════════════════ */
  {
    id: "prof",
    title: "Le profil et sa vérification",
    articles: [
      {
        id: "PROF-01",
        question: "À quoi sert le pourcentage de complétion ?",
        keywords: ["completion", "pourcentage", "profil complet", "classement"],
        blocks: [
          {
            type: "p",
            text: "C'est un indicateur pour l'athlète : il montre ce qu'il reste à remplir. Un profil complet donne plus de matière au recruteur — vidéos, tests, résultats scolaires — mais le pourcentage lui-même ne change ni la visibilité, ni le classement, ni l'accès à quoi que ce soit.",
          },
          {
            type: "p",
            text: "Il se calcule sur trois blocs : les informations de base, la présence d'une vidéo de faits saillants, et les données détaillées.",
          },
        ],
      },
      {
        id: "PROF-02",
        question: "Qu'est-ce que le badge « vérifié » ?",
        keywords: ["verifie", "badge", "crochet bleu", "attestation", "confiance"],
        blocks: [
          {
            type: "p",
            text: "C'est une attestation donnée par l'entraîneur. Il confirme que l'athlète est bien celui qu'il prétend être et que ses informations correspondent à la réalité.",
          },
          {
            type: "p",
            text: "Le badge apparaît sur le profil et permet aux recruteurs de filtrer les athlètes vérifiés. Un profil non vérifié reste visible normalement — la vérification est un gage de confiance, pas une condition d'accès.",
          },
          { type: "p", text: "Seul un entraîneur peut la donner. Elle n'est jamais automatique." },
        ],
      },
      {
        id: "PROF-03",
        question: "Qui peut modifier mon profil ?",
        keywords: ["modifier", "mensurations", "tests", "approbation", "evaluation"],
        blocks: [
          {
            type: "p",
            text: "L'athlète modifie lui-même la majorité de ses informations. Deux exceptions : les mensurations et les tests physiques, que l'athlète propose et que son entraîneur approuve. Il reçoit une notification dès que c'est fait.",
          },
          {
            type: "p",
            text: "L'évaluation de l'entraîneur — la cote et les commentaires — appartient à l'entraîneur seul.",
          },
        ],
      },
    ],
  },

  /* ═══ 11 ══════════════════════════════════════════════════ */
  {
    id: "notif",
    title: "Courriels et notifications",
    articles: [
      {
        id: "NOTIF-01",
        question: "Quels courriels Nexus envoie-t-il ?",
        keywords: ["courriel", "infolettre", "pourriel", "spam", "envoi"],
        blocks: [
          { type: "p", text: "Peu, et toujours pour une raison précise." },
          {
            type: "bullets",
            items: [
              "À un parent, quand son enfant de 14 à 17 ans s'inscrit.",
              "À un athlète, quand un entraîneur l'invite à réclamer sa fiche.",
              "À un athlète déjà inscrit, quand un entraîneur l'invite à rejoindre son équipe.",
            ],
          },
          {
            type: "p",
            text: "Nous n'envoyons pas d'infolettre à un athlète qui n'a pas donné son consentement aux communications.",
          },
        ],
      },
      {
        id: "NOTIF-02",
        question: "Et les notifications dans l'application ?",
        keywords: ["notifications", "alertes", "couper", "reglages", "push"],
        blocks: [
          {
            type: "p",
            text: "Un athlète reçoit une notification lorsqu'un recruteur consulte son profil, lorsqu'un recruteur l'ajoute à ses favoris, lorsque son entraîneur approuve une de ses suggestions, et lorsque son entraîneur met à jour son évaluation.",
          },
          { type: "p", text: "Un parent reçoit les trois notifications décrites à la section 4." },
          {
            type: "note",
            title: "À savoir",
            text: "Les notifications ne sont pas encore réglables une par une. Sur mobile, il reste possible de couper les notifications de l'application dans les réglages de l'appareil.",
          },
        ],
      },
    ],
  },

  /* ═══ 12 ══════════════════════════════════════════════════ */
  {
    id: "vie",
    title: "Vie privée, désactivation et suppression",
    articles: [
      {
        id: "VIE-01",
        question: "Quelle est la différence entre désactiver et supprimer ?",
        keywords: ["desactiver", "supprimer", "effacer", "pause", "fermer"],
        blocks: [
          {
            type: "p",
            text: "Désactiver met le profil en veille : il disparaît immédiatement des recherches de recruteurs, mais les données restent. C'est réversible.",
          },
          {
            type: "p",
            text: "Supprimer est définitif. Le nom, la date de naissance, les coordonnées, la photo, la biographie, les vidéos, les données scolaires et physiques, les renseignements du parent : tout est effacé. Les favoris, les notes et l'historique de consultation des recruteurs sont détruits. Les messages et les évaluations aussi. Le compte est retiré et l'adresse courriel ne peut plus servir à s'y reconnecter.",
          },
          { type: "p", text: "Les deux options se trouvent dans les réglages du compte de l'athlète." },
        ],
      },
      {
        id: "VIE-02",
        question: "Que conservez-vous après une suppression ?",
        keywords: ["conservation", "archives", "preuve", "loi"],
        blocks: [
          {
            type: "p",
            text: "Uniquement ce qui est nécessaire pour prouver que le consentement a bien existé et qu'il a été retiré, comme la loi l'exige. Aucun renseignement permettant d'identifier la personne n'est conservé.",
          },
        ],
      },
      {
        id: "VIE-03",
        question: "À qui s'adresser pour une question de confidentialité ?",
        keywords: ["rprp", "plainte", "acces", "rectification", "contact"],
        blocks: [
          {
            type: "p",
            text: "À confidentialite@nexussports.ca. Toute demande d'accès, de rectification ou de suppression y est traitée.",
          },
        ],
      },
    ],
  },

  /* ═══ 13 ══════════════════════════════════════════════════ */
  {
    id: "coach",
    title: "Pour les entraîneurs",
    articles: [
      {
        id: "COACH-01",
        question: "Comment m'inscrire ?",
        keywords: ["entraineur", "inscription", "ecole absente", "club", "sport principal"],
        blocks: [
          {
            type: "p",
            text: "Choisissez « École secondaire » ou « Ligue ou club sportif » à l'inscription. Vous indiquez ensuite votre sport principal, votre établissement et votre première équipe.",
          },
          {
            type: "p",
            text: "Un entraîneur d'école choisit son école dans la liste. Un entraîneur de ligue civile peut créer son club s'il n'existe pas encore.",
          },
          {
            type: "note",
            tone: "yellow",
            title: "Si votre école n'est pas dans la liste",
            text: "Écrivez-nous avant de commencer l'inscription. L'ajout se fait rapidement de notre côté, et vous éviterez d'avoir à recommencer.",
          },
        ],
      },
      {
        id: "COACH-02",
        question: "Qu'est-ce que le responsable des sports ?",
        keywords: ["responsable", "interimaire", "rprp", "approbation", "directeur"],
        blocks: [
          {
            type: "p",
            text: "C'est la personne qui répond de l'établissement sur Nexus. Le premier entraîneur d'une école doit se déclarer responsable ou responsable intérimaire ; les suivants peuvent s'inscrire simplement comme entraîneurs.",
          },
          {
            type: "p",
            text: "Cette déclaration est examinée et approuvée par notre équipe avant d'être accordée. Le responsable devient le répondant en matière de protection des renseignements personnels pour son établissement, et il confirme l'identité des entraîneurs qui s'y inscrivent. Voir la section 6.",
          },
        ],
      },
      {
        id: "COACH-03",
        question: "Comment ajouter mes athlètes ?",
        keywords: ["ajouter", "creer une fiche", "inviter", "code", "doublon"],
        blocks: [
          {
            type: "p",
            text: "Quatre façons : l'onglet « À réclamer », la création de fiche, l'invitation par courriel, et le code d'équipe. Le détail est à la section 3.",
          },
          {
            type: "p",
            text: "Si vous saisissez le courriel d'un athlète qui a déjà un compte Nexus, l'écran vous en avertit et vous propose de l'inviter à rejoindre votre équipe plutôt que de créer une seconde fiche. C'est l'athlète qui décide d'accepter.",
          },
          {
            type: "note",
            tone: "yellow",
            title: "Rappel Loi 25",
            text: "Si vous créez la fiche d'un joueur de 14 à 17 ans, obtenez l'autorisation de son parent avant. La plateforme ne la demandera pas à votre place. Un joueur de moins de 14 ans ne peut pas être rattaché à une équipe.",
          },
        ],
      },
      {
        id: "COACH-04",
        question: "Que vois-je de mes athlètes ?",
        keywords: ["roster", "alignement", "onglets", "consultations", "autre ecole"],
        blocks: [
          {
            type: "p",
            text: "Tous les athlètes actifs de votre école ou de votre club, quel que soit leur entraîneur. Vos onglets séparent ensuite ceux qui vous sont assignés, ceux qui n'ont pas encore d'entraîneur, et ceux dont une suggestion ou une vérification est en attente.",
          },
          {
            type: "p",
            text: "Vous voyez aussi combien de fois vos athlètes ont été consultés par des recruteurs.",
          },
          {
            type: "p",
            text: "Vous ne voyez rien des athlètes d'un autre établissement. C'est le deuxième maillon décrit à la section 6.",
          },
        ],
      },
      {
        id: "COACH-05",
        question: "Plusieurs entraîneurs peuvent-ils gérer la même équipe ?",
        keywords: ["adjoint", "entraineur-chef", "personnel", "partager"],
        blocks: [
          {
            type: "p",
            text: "Oui. Une équipe peut compter un entraîneur-chef et des adjoints. Tous ont les mêmes droits sur l'alignement et les athlètes ; seul l'entraîneur-chef gère la composition du personnel.",
          },
        ],
      },
      {
        id: "COACH-06",
        question: "Un recruteur peut-il écrire directement à mes joueurs ?",
        keywords: ["contact direct", "messagerie", "rseq", "premier contact"],
        blocks: [
          { type: "p", text: "Oui, mais dans un cadre strict — et vous n'êtes jamais mis de côté." },
          {
            type: "p",
            text: "Les échanges passent par la messagerie de Nexus, sans qu'aucune coordonnée personnelle ne circule. Les périodes de silence du calendrier de recrutement et les règles du RSEQ sont appliquées par la plateforme : hors fenêtre autorisée, un recruteur ne peut pas écrire. Et vous êtes informé du premier contact avec un de vos athlètes.",
          },
          { type: "p", text: "Un recruteur non abonné ne peut contacter personne." },
          // Renvoi conditionnel : le « détail » visé est SECU-06, en
          // brouillon. Réapparaît seul à la levée du drapeau.
          { type: "ref", requires: "SECU-06", text: "Le détail est à la section 6." },
        ],
      },
    ],
  },

  /* ═══ 14 ══════════════════════════════════════════════════ */
  {
    id: "recr",
    title: "Pour les recruteurs",
    articles: [
      {
        id: "RECR-01",
        question: "Comment fonctionne l'accès ?",
        keywords: ["recruteur", "inscription", "verification", "responsable"],
        blocks: [
          {
            type: "p",
            text: "Un recruteur crée son compte, choisit son établissement et indique s'il en est le responsable. Les demandes de responsable sont vérifiées manuellement par notre équipe.",
          },
          {
            type: "p",
            text: "L'inscription est libre et l'accès à la plateforme est immédiat. Ce qui se gagne, c'est l'accès à l'identité des athlètes.",
          },
        ],
      },
      {
        id: "RECR-02",
        question: "Que voit un compte gratuit ?",
        keywords: ["gratuit", "essai", "anonymise", "sans abonnement"],
        blocks: [
          {
            type: "p",
            text: "L'ensemble du bassin d'athlètes : leurs postes, leurs cotes, leurs années de diplomation, leurs mensurations. De quoi mesurer précisément ce que la plateforme contient pour votre programme.",
          },
          {
            type: "p",
            text: "Ce qui n'est pas transmis : le nom, la photo, le numéro de chandail, les vidéos et toute coordonnée. Un compte gratuit ne peut identifier ni joindre aucun athlète.",
          },
        ],
      },
      {
        id: "RECR-03",
        question: "Qu'est-ce que l'abonnement débloque ?",
        keywords: ["abonnement", "pro", "pipeline", "listes", "videos"],
        blocks: [
          {
            type: "p",
            text: "L'identité complète des athlètes, la recherche par nom, l'accès aux vidéos et au rapport de l'entraîneur, l'écriture aux entraîneurs, les listes de prospects et le suivi de pipeline.",
          },
        ],
      },
      {
        id: "RECR-04",
        question: "Les collègues d'un même établissement partagent-ils leur travail ?",
        keywords: ["equipe de recruteurs", "partage", "favoris", "notes", "collegues"],
        blocks: [
          {
            type: "p",
            text: "Non. Les favoris, les notes, le pipeline et les listes sont personnels à chaque recruteur. Un responsable d'établissement dispose toutefois d'un droit de regard sur le travail de son équipe.",
          },
        ],
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   NOTE DE PUBLICATION — reprise de la fin du document source

   Deux articles décrivent un état qui n'est pas encore entièrement
   en place. Ils sont rédigés, portent `draft: true`, et ne sont donc
   PAS publiés. Retirer le drapeau les met en ligne.

   SECU-04 — l'affirmation « les données ne quittent pas nos
   serveurs » est vraie pour la recherche recruteur depuis le
   câblage des RPC projetées. Elle ne l'est pas encore pour toutes
   les surfaces : une requête directe à l'API peut encore rapporter
   davantage. À valider avant publication.

   SECU-06 — les périodes de silence RSEQ sont prévues par
   l'architecture, mais la table des périodes est vide et la règle
   d'âge n'est pas encore écrite. L'affirmation décrit l'intention,
   pas l'état actuel. À valider avant publication.

   RENVOIS ORPHELINS — RÉGLÉS, RIEN À FAIRE À LA MAIN. Deux
   articles publiés pointaient vers SECU-06 : VOIR-01 (« Voir
   SECU-06. ») et COACH-06 (« Le détail est à la section 6. »).
   Ces deux phrases sont désormais des blocs `ref` conditionnés à
   la publication de SECU-06 : masquées tant qu'il est en
   brouillon, rétablies automatiquement à la levée du drapeau.

   CE QUI RESTE VRAI MALGRÉ LE DRAPEAU. Le drapeau `draft` retire
   des ARTICLES, pas des AFFIRMATIONS. Les deux revendications sous
   réserve subsistent dans des articles publiés — COACH-06 pour les
   périodes de silence RSEQ, RECR-02 pour ce qui n'est pas transmis
   au recruteur. C'est assumé : voir la dépendance de publication
   en tête de fichier, la page entière attend ces deux chantiers.
═══════════════════════════════════════════════════════════════ */
