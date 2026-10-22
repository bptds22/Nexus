// RÉSERVE DE PUBLICATION — encore en brouillon : SECU-04 et RECR-02,
// qui attendent la fermeture du RLS recruteur côté API directe.
// SECU-06 et COACH-06 sont publiés depuis le 2026-10-21 : les périodes
// de silence RSEQ sont en place, et leur texte a été réécrit sur le
// comportement réel (messagerie ouverte, fermée seulement PENDANT une
// période, et seulement du recruteur vers l'athlète).

/* ═══════════════════════════════════════════════════════════════
   content/aide/sections.ts — contenu du centre d'aide public

   SOURCE DE VÉRITÉ : CE FICHIER, depuis la mise à jour du
   2026-10-21 (16 sections). docs/aide-contenu.md est la version
   d'origine du 2026-08-17 (14 sections, 55 articles), gardée comme
   historique ; il n'est plus tenu à jour. Chaque affirmation doit
   décrire ce que fait le code aujourd'hui — l'analyse qui a servi à
   la mise à jour est dans maquettes/aide-analyse/ANALYSE.md.

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
   01 à 16 dans l'ordre de ce tableau, et plusieurs articles
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
            text: "Un cinquième type, le compte parent, se crée uniquement sur invitation, lorsqu'un athlète mineur s'inscrit. Un sixième, le compte partenaire, est créé par Nexus seulement (section 16).",
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
      {
        id: "INSC-04",
        question: "Mon école n'est pas dans la liste. Que faire ?",
        keywords: ["ecole absente", "pas listee", "introuvable", "ajouter une ecole"],
        blocks: [
          {
            type: "p",
            text: "Choisissez « Mon école n'est pas listée » et écrivez son nom. Votre inscription continue normalement : l'équipe Nexus ajoute l'école et vous y rattache.",
          },
        ],
      },
      {
        id: "INSC-05",
        question: "J'ai un code d'équipe. Où le saisir ?",
        keywords: ["code d'equipe", "code", "lien", "join", "rejoindre"],
        blocks: [
          {
            type: "p",
            text: "À l'inscription, à la question « Tu as un code d'équipe ? », entrez le code : votre école et votre sport se remplissent seuls. Votre entraîneur peut aussi vous envoyer le lien nexussports.ca/join/… à ouvrir.",
          },
          {
            type: "p",
            text: "Une fois l'équipe choisie, le nom de l'entraîneur-chef s'affiche pour une équipe du secondaire ou d'un club civil.",
          },
          {
            type: "note",
            title: "Pas de code ?",
            text: "Le code d'équipe est créé par Nexus. Demandez-le à votre entraîneur, ou écrivez à info@nexussports.ca.",
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
              "Le code d'équipe. Il est créé par Nexus : écrivez à info@nexussports.ca pour obtenir celui de votre équipe. Vous le partagez ensuite à tout votre groupe — au vestiaire, dans un message, sur une feuille. Chaque athlète le saisit à l'inscription, ou ouvre le lien nexussports.ca/join/…, et rejoint l'équipe sans que vous ayez à le faire un par un.",
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
          { type: "p", text: "Une fois connecté, vous accédez à quatre choses :" },
          {
            type: "bullets",
            items: [
              "La fiche de votre enfant : sa photo, son nom, son sport et son école.",
              "Ses consentements, dont deux que vous pouvez modifier vous-même en tout temps.",
              "Un résumé d'activité : le nombre de fois où son profil a été consulté, et l'évolution de son dossier.",
              "Les messages : vous pouvez écrire aux entraîneurs et à la direction sportive de l'école de votre enfant.",
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
        keywords: ["alerte", "favoris", "visite", "avis parent", "recruteur a contacte", "premier contact"],
        blocks: [
          {
            type: "p",
            text: "Oui, pour quatre événements. Vous recevez une notification lorsqu'un recruteur ajoute votre enfant à ses favoris, lorsque son dossier progresse dans le processus de recrutement, lorsqu'une visite est planifiée, et lorsqu'un recruteur lui écrit pour la première fois.",
          },
          {
            type: "p",
            text: "Ce premier contact vous est signalé de trois façons, tant que votre enfant est mineur : un courriel « Un recruteur a contacté votre enfant », un avis dans votre portail et, si votre compte parent est créé, une notification sur votre téléphone. Cette notification n'est jamais envoyée entre 21 h et 8 h : elle attend le matin. Vous n'êtes avisé qu'une fois par établissement recruteur.",
          },
          {
            type: "p",
            text: "Ces avis décrivent l'événement sans nommer le recruteur, l'établissement ni le contenu du message.",
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
      {
        id: "PAR-06",
        question: "Un partenaire demande à voir le profil de mon enfant. Que faire ?",
        keywords: ["partenaire", "demande", "visibilite", "moins de 14 ans", "autorisation", "desabonner"],
        blocks: [
          {
            type: "p",
            text: "Pour un enfant de moins de 14 ans, c'est vous qui décidez de sa visibilité auprès des partenaires (section 7). Quand un partenaire approuvé souhaite le voir, la demande arrive dans votre portail : vous l'acceptez ou non dans « Consentements ».",
          },
          {
            type: "p",
            text: "Vous recevez aussi un courriel « Une autorisation pour » suivi du prénom de votre enfant. Son lien fonctionne sans connexion, une seule fois, pendant 60 jours. « Ne plus recevoir ces courriels » vous désabonne.",
          },
          {
            type: "p",
            text: "Sans votre accord, rien n'apparaît.",
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
            "Visibilité auprès des partenaires",
            "À l'inscription, à 14 ans et plus ; modifiable en tout temps",
            "Le choix, oui : Oui ou Non, rien n'est coché d'avance",
            "Voir la section 7. Avant 14 ans, c'est le parent qui décide.",
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
        keywords: ["messagerie", "contacter", "rseq", "periode de silence", "message", "non-contact"],
        blocks: [
          {
            type: "p",
            text: "Un recruteur abonné peut écrire à un athlète, dans un cadre précis.",
          },
          {
            type: "bullets",
            items: [
              "Les échanges passent par la messagerie de la plateforme. Aucune coordonnée personnelle n'est transmise — ni courriel, ni téléphone, d'un côté comme de l'autre.",
              "Le recruteur doit d'abord avoir ajouté l'athlète à ses favoris.",
              "Nexus applique les périodes de silence du RSEQ, déclarées par sport et par année de diplomation. Pendant une de ces périodes, le recruteur ne peut pas écrire à l'athlète : la fiche indique « contact suspendu jusqu'au … ». Il peut toujours écrire à l'entraîneur.",
              "Au premier contact, l'entraîneur reçoit une notification dans l'application mobile Nexus. Si l'athlète est mineur, son parent est avisé aussi (section 4).",
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
    title: "Les partenaires",
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
        keywords: ["media", "journaliste", "carte", "publication", "balado", "evaluateur", "partenaire"],
        blocks: [
          {
            type: "p",
            text: "Nexus collabore avec des partenaires approuvés : journalistes sportifs, pages de contenu, balados, camps spécialisés, évaluateurs. Ces partenaires peuvent télécharger la carte officielle Nexus d'un athlète pour la publier dans un article, une publication ou un reportage.",
          },
          {
            type: "p",
            text: "La carte contient le nom de l'athlète, son école, sa cote, sa position et sa photo.",
          },
          {
            type: "p",
            text: "Certains partenaires peuvent aussi évaluer un athlète, lui décerner un badge, ou préparer une carte à son nom après l'avoir vu jouer. Rien de cela n'apparaît sur le profil sans l'accord de l'athlète.",
          },
        ],
      },
      {
        id: "MED-02",
        question: "Est-ce activé par défaut ?",
        keywords: ["par defaut", "desactive", "option", "case a cocher", "oui ou non"],
        blocks: [
          {
            type: "p",
            text: "**Non.** À l'inscription, un athlète de 14 ans et plus choisit lui-même Oui ou Non : rien n'est coché d'avance, et tant qu'il n'a pas dit Oui, l'option reste désactivée.",
          },
          {
            type: "p",
            text: "Avant 14 ans, c'est le parent qui décide, depuis son portail.",
          },
          {
            type: "p",
            text: "Le choix se modifie en tout temps dans Paramètres › Confidentialité.",
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
      {
        id: "MED-05",
        question: "Un partenaire m'a évalué alors que mon option est désactivée. Que se passe-t-il ?",
        keywords: ["evaluation partenaire", "badge partenaire", "demande", "accepter", "notification"],
        blocks: [
          {
            type: "p",
            text: "Un partenaire approuvé qui vous a vu jouer peut proposer une évaluation ou un badge. Si votre option est désactivée, rien n'est publié : vous recevez une demande dans vos notifications, avec un bouton « Accepter ».",
          },
          {
            type: "p",
            text: "Tant que vous n'acceptez pas, rien n'apparaît sur votre profil. Avant 14 ans, la demande va à votre parent.",
          },
        ],
      },
      {
        id: "MED-06",
        question: "J'ai reçu un lien d'un partenaire (nexussports.ca/p/…). Qu'est-ce que c'est ?",
        keywords: ["lien partenaire", "c'est moi", "ce n'est pas moi", "carte", "texto"],
        blocks: [
          {
            type: "p",
            text: "Un partenaire a préparé une carte à votre nom après vous avoir vu jouer. Connecté à votre compte athlète, le lien vous montre cette carte : répondez « C'est moi » ou « Ce n'est pas moi ».",
          },
          {
            type: "p",
            text: "Si votre visibilité partenaires est désactivée, la carte attend que vous l'activiez. Sans connexion, le lien n'affiche ni votre nom ni l'évaluation.",
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
              "Par code d'équipe : un code court à saisir, ou un lien à ouvrir. Ce code est créé par Nexus ; l'athlète le demande à son entraîneur, ou écrit à info@nexussports.ca.",
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
            "Un partenaire",
            "Rien, sauf si l'athlète a activé l'option décrite à la section 7. Un partenaire peut proposer une évaluation, mais rien n'est publié sans l'accord de l'athlète.",
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
        keywords: ["vues", "consultations", "statistiques", "qui m'a vu", "visibilite"],
        blocks: [
          {
            type: "p",
            text: "Non. Par choix, Nexus n'affiche pas aux athlètes le nom des recruteurs ni celui de leur établissement.",
          },
          {
            type: "p",
            text: "La page « Ma visibilité » vous montre votre activité.",
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
        keywords: ["modifier", "mensurations", "tests", "approbation", "evaluation", "proposer"],
        blocks: [
          {
            type: "p",
            text: "Vous modifiez vous-même la plupart de vos informations, y compris la taille, le poids, les tests physiques, le sport, la position et le numéro. La modification s'applique tout de suite.",
          },
          {
            type: "p",
            text: "Votre évaluation — la cote, les critères et les distinctions — se **propose** : votre entraîneur l'approuve ou la rejette, et vous êtes avisé du résultat (voir PROF-04).",
          },
          {
            type: "p",
            text: "Votre date de naissance ne se modifie plus après l'inscription (voir PROF-05).",
          },
        ],
      },
      {
        id: "PROF-04",
        question: "Puis-je proposer ma propre évaluation ?",
        keywords: ["auto-evaluation", "proposer", "suggestion", "cote", "distinctions"],
        blocks: [
          {
            type: "p",
            text: "Oui. Dans votre profil, le bouton « Proposer » des sections Évaluation et Distinctions envoie une suggestion à votre entraîneur. Elle reste en attente jusqu'à sa décision, et « Mes suggestions » vous en montre l'état.",
          },
          {
            type: "p",
            text: "Sans entraîneur rattaché, invitez-le d'abord : personne d'autre ne peut approuver votre proposition.",
          },
        ],
      },
      {
        id: "PROF-05",
        question: "Ma date de naissance est fausse. Comment la corriger ?",
        keywords: ["date de naissance", "age", "erreur", "verrouille"],
        blocks: [
          {
            type: "p",
            text: "Après l'inscription, la date de naissance est verrouillée, parce qu'elle détermine les règles de protection des mineurs. Votre entraîneur peut la corriger, ou écrivez à info@nexussports.ca.",
          },
        ],
      },
      {
        id: "PROF-06",
        question: "Sur combien de critères suis-je évalué ?",
        keywords: ["criteres", "evaluation", "cote globale", "etoiles", "position"],
        blocks: [
          {
            type: "p",
            text: "Sur 14 : 9 communs à tous les athlètes (4 physiques et 5 de caractère) et 5 propres à votre position. La cote globale est la moyenne des critères notés : un critère sans note ne compte pas.",
          },
        ],
      },
      {
        id: "PROF-07",
        question: "Comment fonctionnent les badges ?",
        keywords: ["badges", "distinction", "ambassadeur", "partenaire"],
        blocks: [
          {
            type: "p",
            text: "Un profil affiche au plus 5 badges Nexus. Ils sont décernés par votre entraîneur, par Nexus ou par un partenaire approuvé, ou gagnés par le programme Ambassadeur (voir PROF-08).",
          },
          {
            type: "p",
            text: "Les badges propres à un partenaire s'ajoutent à la suite et ne comptent pas dans les 5.",
          },
        ],
      },
      {
        id: "PROF-08",
        question: "Qu'est-ce que le programme Ambassadeur ?",
        keywords: ["ambassadeur", "inviter", "coequipiers", "parrainage", "lien"],
        blocks: [
          {
            type: "p",
            text: "Dans « Ambassadeur », « Inviter mes coéquipiers » partage votre lien personnel. Un ami compte comme recrue s'il crée un compte athlète par ce lien dans les 7 jours et franchit l'étape des consentements.",
          },
          {
            type: "bullets",
            items: [
              "3 recrues : une story à partager.",
              "5 recrues : le badge Ambassadeur, posé automatiquement si votre ligne de badges a de la place.",
              "10 recrues : Ambassadeur Élite.",
            ],
          },
          {
            type: "p",
            text: "Un ami s'est inscrit sans votre lien ? Déclarez-le avec son adresse courriel exacte.",
          },
        ],
      },
      {
        id: "PROF-09",
        question: "Comment cibler un cégep ?",
        keywords: ["cibler", "cegep", "trouver mon cegep", "coeur", "cibles"],
        blocks: [
          {
            type: "p",
            text: "Dans « Trouver mon cégep », ajoutez un cégep à vos cibles avec le cœur. Les recruteurs de ce cégep voient que vous les avez ciblés. Vous pouvez retirer une cible en tout temps.",
          },
        ],
      },
      {
        id: "PROF-10",
        question: "Comment créer une story Instagram ?",
        keywords: ["story", "instagram", "image", "partager", "ma story"],
        blocks: [
          {
            type: "p",
            text: "« Ma Story » crée une image de 1080 × 1920 à partir de 10 gabarits : jour de match, résultat, statistiques, badges et autres. Votre photo reste sur votre appareil : elle n'est jamais envoyée à Nexus.",
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
              "À un athlète qui n'est pas encore inscrit, quand un recruteur l'a ajouté comme prospect avec son courriel : une invitation à s'inscrire, puis au plus trois rappels. Elle ne nomme ni le recruteur ni son établissement.",
              "À un parent, au premier contact d'un recruteur avec son enfant mineur (section 4).",
              "À un parent, quand un partenaire demande à voir le profil de son enfant de moins de 14 ans.",
              "À un partenaire, pour activer son compte.",
            ],
          },
          {
            type: "p",
            text: "Nous n'envoyons pas d'infolettre à un athlète qui n'a pas donné son consentement aux communications. Chaque courriel contient un lien de désabonnement.",
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
            text: "Un athlète reçoit une notification lorsqu'un recruteur l'ajoute à ses favoris, lorsque son entraîneur approuve ou rejette une de ses suggestions, lorsque son entraîneur met à jour son évaluation, et lorsqu'un partenaire demande à le rendre visible.",
          },
          { type: "p", text: "Un parent reçoit les quatre notifications décrites à la section 4." },
          {
            type: "note",
            title: "À savoir",
            text: "Les notifications sur le téléphone sont regroupées et retenues entre 21 h et 8 h. Elles ne sont pas encore réglables une par une ; il reste possible de couper les notifications de l'application dans les réglages de l'appareil.",
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
      {
        id: "VIE-04",
        question: "Comment retirer mon consentement ?",
        keywords: ["retirer le consentement", "desactiver", "reactiver", "pause"],
        blocks: [
          {
            type: "p",
            text: "Dans Paramètres › Confidentialité, « Retirer le consentement » désactive votre profil immédiatement : il disparaît des recherches, et votre entraîneur et le responsable des sports de votre établissement sont avisés.",
          },
          {
            type: "p",
            text: "Pour réactiver votre profil, passez par votre entraîneur.",
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
            text: "Quatre façons : l'onglet « À réclamer », la création de fiche, l'invitation par courriel, et le code d'équipe, que Nexus vous fournit sur demande à info@nexussports.ca. Le détail est à la section 3.",
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
        keywords: ["adjoint", "entraineur-chef", "personnel", "partager", "retirer", "coordonnateur"],
        blocks: [
          {
            type: "p",
            text: "Oui. Une équipe peut compter un entraîneur-chef (ou un entraîneur-chef par intérim), des assistants et des coordonnateurs.",
          },
          {
            type: "bullets",
            items: [
              "Ajouter du personnel : l'entraîneur-chef, l'intérimaire ou le directeur sportif.",
              "Retirer du personnel : le directeur sportif seulement, ou Nexus.",
            ],
          },
        ],
      },
      {
        id: "COACH-06",
        question: "Un recruteur peut-il écrire directement à mes joueurs ?",
        keywords: ["contact direct", "messagerie", "rseq", "premier contact", "periode de silence"],
        blocks: [
          {
            type: "p",
            text: "Oui, s'il est abonné et qu'il a ajouté le joueur à ses favoris — et vous n'êtes jamais mis de côté.",
          },
          {
            type: "p",
            text: "Les échanges passent par la messagerie de Nexus, sans qu'aucune coordonnée personnelle ne circule. Pendant une période de silence du RSEQ, un recruteur ne peut pas écrire à vos joueurs ; il peut toujours vous écrire à vous.",
          },
          {
            type: "p",
            text: "Au premier contact avec un de vos athlètes, vous recevez une notification dans l'application mobile Nexus. Si l'athlète est mineur, son parent est avisé aussi.",
          },
          {
            type: "p",
            text: "Un recruteur non abonné ne peut contacter personne.",
          },
          { type: "ref", requires: "SECU-06", text: "Le détail est à la section 6." },
        ],
      },
      {
        id: "COACH-07",
        question: "Je gère un club civil mais je ne coache aucune équipe. Puis-je m'inscrire ?",
        keywords: ["responsable de club", "directeur", "sans equipe", "club civil", "ligue"],
        blocks: [
          {
            type: "p",
            text: "Oui. À l'inscription, après avoir choisi votre club, cliquez « Je ne coache aucune équipe » et déclarez-vous responsable (« C'est moi ») ou responsable intérimaire.",
          },
          {
            type: "p",
            text: "La demande est examinée par l'équipe Nexus, en général dans les 24 heures. D'ici là, votre accès est en lecture seule.",
          },
        ],
      },
      {
        id: "COACH-08",
        question: "Qu'est-ce qu'un entraîneur-chef intérimaire ?",
        keywords: ["interimaire", "interim", "entraineur-chef", "assistant"],
        blocks: [
          {
            type: "p",
            text: "Si une équipe n'a pas d'entraîneur-chef, vous pouvez « Devenir coach intérimaire ». Quand l'entraîneur-chef s'inscrit, vous redevenez assistant ; rien n'est transféré à votre place.",
          },
        ],
      },
      {
        id: "COACH-09",
        question: "Comment approuver les suggestions de mes athlètes ?",
        keywords: ["a traiter", "suggestions", "approuver", "rejeter", "auto-evaluation"],
        blocks: [
          {
            type: "p",
            text: "L'onglet « À traiter » de Mes athlètes regroupe les profils à vérifier et les suggestions en attente de vos athlètes, y compris leurs auto-évaluations (cote, critères, distinctions).",
          },
          {
            type: "p",
            text: "Vous voyez l'ancienne et la nouvelle valeur, puis vous choisissez « Approuver » ou « Rejeter », avec une raison si vous le souhaitez. L'athlète est avisé du résultat.",
          },
        ],
      },
      {
        id: "COACH-10",
        question: "« Cet athlète existe déjà » : que faire ?",
        keywords: ["doublon", "existe deja", "meme nom", "creer une fiche"],
        blocks: [
          {
            type: "p",
            text: "À la création d'une fiche, si un athlète de même nom et de même date de naissance existe déjà, l'écran le signale. Trois choix : « Voir sa fiche », « Inviter à rejoindre mon équipe », ou « Ce n'est pas lui — continuer la création ».",
          },
        ],
      },
      {
        id: "COACH-11",
        question: "Que veut dire « Nom à confirmer par l'athlète » ?",
        keywords: ["nom a confirmer", "google", "apple", "etiquette"],
        blocks: [
          {
            type: "p",
            text: "Un athlète inscrit par Google ou Apple doit confirmer son nom. D'ici là, il reste dans votre liste avec cette étiquette, mais il n'apparaît pas dans les recherches.",
          },
        ],
      },
      {
        id: "COACH-12",
        question: "J'invite un athlète par courriel : que reçoit-il ?",
        keywords: ["invitation", "courriel", "inviter", "desabonnement"],
        blocks: [
          {
            type: "p",
            text: "L'invitation par courriel vise un athlète déjà présent sur Nexus. S'il n'y est pas encore, créez d'abord sa fiche.",
          },
          {
            type: "p",
            text: "Le courriel nomme votre école ou votre club, et vous. Il indique combien de recruteurs suivent Nexus, jamais lesquels. Il contient un lien de désabonnement.",
          },
        ],
      },
      {
        id: "COACH-13",
        question: "« Cet athlète a déjà ce badge » : pourquoi ?",
        keywords: ["badge", "deja", "partenaire", "masquer"],
        blocks: [
          {
            type: "p",
            text: "Un athlète ne porte un badge qu'une fois. Si un partenaire le lui a déjà décerné, l'écran l'indique, avec le nom du partenaire. Vous pouvez masquer un badge propre à un partenaire.",
          },
        ],
      },
      {
        id: "COACH-14",
        question: "Puis-je voir l'intérêt des recruteurs pour mes athlètes ?",
        keywords: ["interet", "vues", "favoris", "recruteurs", "tableau de bord"],
        blocks: [
          {
            type: "p",
            text: "Oui, en totaux. Chaque fiche montre le nombre de vues et de favoris, et le tableau de bord signale les nouvelles prises de contact et les conversations actives.",
          },
          {
            type: "p",
            text: "Vous ne voyez ni le nom des recruteurs qui suivent un athlète, ni leurs notes, ni leurs grades.",
          },
        ],
      },
      {
        id: "COACH-15",
        question: "Qu'est-ce que « Ma réputation » ?",
        keywords: ["reputation", "avis", "score", "recruteurs"],
        blocks: [
          {
            type: "p",
            text: "Les recruteurs qui ont échangé avec vous peuvent vous évaluer. Votre score apparaît dans « Ma réputation » à partir de 3 évaluations.",
          },
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
        // Réserve de publication — voir la note en fin de fichier.
        draft: true,
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
        keywords: ["abonnement", "pro", "pipeline", "listes", "videos", "all star"],
        blocks: [
          {
            type: "p",
            text: "Avec Pro : l'identité des athlètes (voir RECR-07), la recherche par nom, les vidéos et le rapport de l'entraîneur, la messagerie avec les entraîneurs et les athlètes, et les outils de la section 15 — Mon processus, les grades, les cartes prospect, les listes, le calendrier, la carte des matchs et le mode En direct — partagés avec votre unité.",
          },
          {
            type: "p",
            text: "All Star ajoute la gestion de l'établissement (voir RECR-10). Les prix sont sur la page Tarifs.",
          },
        ],
      },
      {
        id: "RECR-04",
        question: "Les collègues d'un même établissement partagent-ils leur travail ?",
        keywords: ["equipe de recruteurs", "partage", "favoris", "notes", "collegues", "unite"],
        blocks: [
          {
            type: "p",
            text: "Oui, s'ils sont au même cégep et dans le même sport : c'est votre **unité**. Les favoris, le processus, les grades, les notes de suivi, les listes et le calendrier sont partagés au sein de l'unité, et chaque geste est signé de son auteur.",
          },
          {
            type: "p",
            text: "Vous pouvez lire la note d'un collègue, pas la modifier ni la supprimer. Le partage demande un abonnement Pro ; un compte gratuit reste sur ses propres données.",
          },
        ],
      },
      {
        id: "RECR-05",
        question: "Puis-je écrire directement à un athlète ?",
        keywords: ["contacter", "message", "ecrire", "athlete", "entraineur", "favori"],
        blocks: [
          {
            type: "p",
            text: "Oui, avec un abonnement Pro. Sur la fiche, « Contacter » propose d'écrire à l'entraîneur ou à l'athlète. Pour écrire à l'athlète, ajoutez-le d'abord à vos favoris.",
          },
          {
            type: "p",
            text: "À votre premier contact avec un athlète, son entraîneur reçoit une notification dans l'application mobile Nexus. Si l'athlète est mineur, son parent est avisé aussi, sans que ni vous ni votre cégep soyez nommés.",
          },
          {
            type: "p",
            text: "Pendant une période de silence du RSEQ, voir RECR-06.",
          },
        ],
      },
      {
        id: "RECR-06",
        question: "Que se passe-t-il pendant une période de silence du RSEQ ?",
        keywords: ["periode de silence", "non-contact", "rseq", "bloque", "suspendu"],
        blocks: [
          {
            type: "p",
            text: "Nexus applique les périodes où le RSEQ interdit le contact direct, par sport et par année de diplomation. Pendant ces périodes, la fiche de l'athlète indique « contact suspendu jusqu'au … » et vous ne pouvez pas lui écrire.",
          },
          {
            type: "p",
            text: "Vous pouvez toujours écrire à son entraîneur : les conversations avec les entraîneurs ne sont jamais bloquées.",
          },
        ],
      },
      {
        id: "RECR-07",
        question: "Pourquoi certaines identités restent masquées, même avec Pro ?",
        keywords: ["identite reservee", "masque", "mineur", "consentement", "nom cache"],
        blocks: [
          {
            type: "p",
            text: "L'identité d'un athlète mineur — nom, photo, numéro — n'est révélée que si son parent a donné son autorisation, ou une fois que l'athlète a 18 ans. Sinon, vous voyez « Identité réservée », même avec un abonnement.",
          },
          {
            type: "p",
            text: "La recherche par nom ne trouve que les athlètes dont l'identité vous est visible.",
          },
        ],
      },
      {
        id: "RECR-08",
        question: "Comment changer de cégep ou de sport ?",
        keywords: ["changer de cegep", "changer de sport", "verrouille", "unite"],
        blocks: [
          {
            type: "p",
            text: "Votre cégep et votre sport définissent votre unité : ils sont verrouillés après l'inscription. Pour les changer, écrivez à info@nexussports.ca.",
          },
        ],
      },
      {
        id: "RECR-09",
        question: "Comment gérer ou annuler mon abonnement ?",
        keywords: ["annuler", "abonnement", "facture", "carte de credit", "taxes", "rembourser"],
        blocks: [
          {
            type: "p",
            text: "Dans Paramètres › Abonnement, « Gérer mon abonnement » ouvre le portail de paiement sécurisé : forfait, carte de paiement et factures.",
          },
          {
            type: "p",
            text: "Pour annuler, ou pour toute question sur la facturation, écrivez à info@nexussports.ca.",
          },
        ],
      },
      {
        id: "RECR-10",
        question: "Que contient « Mon CÉGEP » (All Star) ?",
        keywords: ["all star", "mon cegep", "reassignation", "statistiques", "recruteurs"],
        blocks: [
          {
            type: "p",
            text: "Le forfait All Star ajoute la gestion de l'établissement : la liste des recruteurs, les statistiques de recrutement, les recrues confirmées, et la réassignation d'athlètes d'un recruteur à un autre, avec leurs étapes et leurs notes.",
          },
          {
            type: "p",
            text: "Le responsable de l'établissement y a accès sans abonnement.",
          },
        ],
      },
      {
        id: "RECR-11",
        question: "Comment présenter mon programme aux athlètes ?",
        keywords: ["ma page", "page publique", "programme", "saison en cours"],
        blocks: [
          {
            type: "p",
            text: "« Ma page » vous permet de modifier gratuitement la page publique de votre cégep et de vos équipes, vue par les athlètes. Le bloc « Saison en cours » se remplit seul à partir des résultats du RSEQ : il n'y a rien à saisir.",
          },
        ],
      },
      {
        id: "RECR-12",
        question: "Comment exporter ou supprimer mes données ?",
        keywords: ["exporter", "supprimer mon compte", "donnees", "json"],
        blocks: [
          {
            type: "p",
            text: "Dans Paramètres › Zone danger, « Exporter mes données » télécharge un fichier JSON : profil, favoris, processus, notes, listes, avis et messages.",
          },
          {
            type: "p",
            text: "« Supprimer définitivement mon compte » est immédiat et irréversible.",
          },
        ],
      },
    ],
  },

  /* ═══ 15 ══════════════════════════════════════════════════ */
  {
    id: "outil",
    title: "Les outils du recruteur",
    intro: [
      {
        type: "p",
        text: "Ces outils demandent un abonnement Pro, sauf mention contraire. Ils sont partagés avec votre unité : les recruteurs de votre cégep dans le même sport (voir RECR-04).",
      },
    ],
    articles: [
      {
        id: "OUTIL-01",
        question: "Comment fonctionne Mon processus ?",
        keywords: ["processus", "pipeline", "kanban", "tableau", "exporter", "excel"],
        blocks: [
          {
            type: "p",
            text: "Mon processus suit chaque athlète d'Identifié à Lettre signée, avec une colonne Retiré. Passez de la vue Kanban à la vue Tableau : dans le tableau, le grade, l'étape, la visite et la relance se modifient directement dans la cellule.",
          },
          {
            type: "p",
            text: "« Exporter » produit un fichier Excel (.xlsx) des athlètes affichés. Chaque export est journalisé.",
          },
          {
            type: "p",
            text: "Réservé au Pro. Un compte gratuit voit le tableau en mode démonstration, sans enregistrer.",
          },
        ],
      },
      {
        id: "OUTIL-02",
        question: "Que signifient les grades A+ à E ?",
        keywords: ["grade", "note", "a+", "appreciation", "classement"],
        blocks: [
          {
            type: "p",
            text: "Le grade est l'appréciation de votre unité sur un athlète, sur une échelle de A+, A, B+, B, C+, C, D+, D et E. Il se pose dans le panneau de l'athlète (« Grade de l'unité ») ou dans la colonne Grade du tableau.",
          },
          {
            type: "p",
            text: "Il n'est visible que de votre unité : ni l'athlète, ni son entraîneur ne le voient.",
          },
        ],
      },
      {
        id: "OUTIL-03",
        question: "Comment retirer un athlète de mon processus ?",
        keywords: ["retire", "retirer", "raison", "pas interesse", "remettre"],
        blocks: [
          {
            type: "p",
            text: "Choisir Retiré demande une raison — Pas intéressé, Pas le niveau, Erreur / pas scouté ou Autre — et une note facultative.",
          },
          {
            type: "p",
            text: "Le dossier n'est pas supprimé : il reste dans la colonne Retiré avec sa raison, et vous pouvez le remettre à n'importe quelle étape. Avec Pro, retirer un athlète de vos favoris le passe aussi en Retiré, pour toute l'unité.",
          },
        ],
      },
      {
        id: "OUTIL-04",
        question: "Qu'est-ce qu'une carte prospect ?",
        keywords: ["carte prospect", "ajouter un prospect", "pas sur nexus", "invitation", "rappels"],
        blocks: [
          {
            type: "p",
            text: "Un athlète qui n'est pas encore sur Nexus s'ajoute avec « Ajouter un prospect ». Le prénom, le nom, l'école ou le club, le sport et l'équipe sont obligatoires ; le reste est facultatif.",
          },
          {
            type: "bullets",
            items: [
              "Le téléphone et le parent ne reçoivent jamais rien.",
              "Si vous inscrivez un courriel jamais invité, l'athlète reçoit une seule invitation à s'inscrire, envoyée par Nexus, qui ne nomme ni vous ni votre cégep. Vous pouvez la renvoyer jusqu'à 3 fois, à 7 jours d'intervalle.",
              "Une carte sans activité est supprimée après 12 mois, avec un avis 30 jours avant.",
            ],
          },
        ],
      },
      {
        id: "OUTIL-05",
        question: "Ma carte prospect s'est inscrite : comment la relier à son profil ?",
        keywords: ["fusion", "fusionner", "correspondance", "rapprochement", "propositions", "annuler"],
        blocks: [
          {
            type: "p",
            text: "Quand un profil Nexus semble correspondre à une carte, le bandeau « Un profil semble correspondre → voir » apparaît. La correspondance est classée : confirmée par le courriel ou le téléphone, même nom et même équipe ou établissement, ou « Possiblement le même athlète ».",
          },
          {
            type: "p",
            text: "« Accepter » fusionne la carte dans le profil : vos notes et votre étape suivent. Vous pouvez annuler la fusion pendant 7 jours depuis l'onglet Historique ; ce qui a été modifié depuis est conservé.",
          },
          {
            type: "p",
            text: "Le bouton « Propositions » regroupe celles en attente. Une proposition refusée se retrouve dans « Propositions refusées », d'où vous pouvez la proposer de nouveau.",
          },
        ],
      },
      {
        id: "OUTIL-06",
        question: "Comment fonctionne le calendrier ?",
        keywords: ["calendrier", "matchs", "visites", "relances", "rseq"],
        blocks: [
          {
            type: "p",
            text: "Le calendrier réunit trois types d'événements de votre unité, que vous affichez ou masquez : les matchs, les visites et les relances.",
          },
          {
            type: "p",
            text: "Les matchs viennent des calendriers du RSEQ et des ligues ; chaque match indique sa source, et le calendrier officiel du RSEQ se télécharge en Excel. Réservé au Pro.",
          },
        ],
      },
      {
        id: "OUTIL-07",
        question: "Comment voir mes relances et mes visites dans Google Agenda ou Outlook ?",
        keywords: ["agenda", "google agenda", "outlook", "ics", "abonner", "apple"],
        blocks: [
          {
            type: "p",
            text: "Dans le calendrier, « S'abonner à mon agenda » crée une adresse privée à ajouter dans Google Agenda, Outlook ou Apple Calendar. Elle contient les relances et les visites de votre unité, et les matchs que vous avez ajoutés avec « + ». Elle se met à jour automatiquement, à l'heure de Montréal.",
          },
          {
            type: "p",
            text: "L'adresse n'est affichée qu'une fois ; vous pouvez la remplacer ou la révoquer en tout temps. Si votre abonnement Pro prend fin, l'agenda se vide.",
          },
          {
            type: "p",
            text: "Une visite seule s'exporte aussi depuis le panneau de l'athlète : « Google Agenda » ou « Télécharger (.ics) ».",
          },
        ],
      },
      {
        id: "OUTIL-08",
        question: "Comment utiliser la carte des matchs ?",
        keywords: ["carte des matchs", "terrain", "itineraire", "matchs a venir", "filtres"],
        blocks: [
          {
            type: "p",
            text: "La carte des matchs montre les matchs à venir, sur 31 jours au plus, filtrés par sport, type (secondaire, collégial, civil), catégorie et division. Si vous cherchez une équipe ou un terrain, la recherche couvre toute la saison.",
          },
          {
            type: "p",
            text: "Chaque match affiche sa source, les profils Nexus des équipes, l'itinéraire et les autres matchs au même terrain. Le « + » l'ajoute au calendrier partagé de votre unité. Réservé au Pro.",
          },
        ],
      },
      {
        id: "OUTIL-09",
        question: "Qu'est-ce que le mode En direct ?",
        keywords: ["en direct", "game on", "notes de match", "numero", "hors ligne", "depistage"],
        blocks: [
          {
            type: "p",
            text: "En direct sert à prendre des notes pendant un match. Choisissez le match (ou « + Autre match »), indiquez la couleur des chandails, puis notez par numéro de joueur. Ça fonctionne même sans connexion : les notes partent dès que le réseau revient.",
          },
          {
            type: "p",
            text: "À la fin, « Terminer et trier » vous propose de relier chaque note à un athlète Nexus ou à une carte prospect, d'en créer une, ou de garder la note sans lien. Un joueur déjà connu est reconnu par son numéro ; « Pas lui » corrige une erreur. Réservé au Pro.",
          },
        ],
      },
      {
        id: "OUTIL-10",
        question: "Comment planifier une visite ?",
        keywords: ["visite", "planifier", "zoom", "responsable", "adresse"],
        blocks: [
          {
            type: "p",
            text: "Passer un athlète à l'étape Visite planifiée vous permet d'en fixer la date et de l'ajouter à votre agenda (Google Agenda ou fichier .ics) depuis le panneau ou la fiche.",
          },
          {
            type: "p",
            text: "Dans le calendrier, le bouton « Détails » précise le responsable (un collègue ou une personne hors Nexus), le format (en personne, Zoom ou téléphone), l'adresse ou le lien, et une note.",
          },
        ],
      },
      {
        id: "OUTIL-11",
        question: "Comment ne pas oublier une relance ?",
        keywords: ["relance", "rappel", "a relancer", "suivi"],
        blocks: [
          {
            type: "p",
            text: "Dans le panneau d'un athlète, fixez une date de relance et une courte note. La tuile « Relances à faire » du tableau de bord et la pastille « À relancer » de Mon processus listent celles qui sont dues aujourd'hui ou en retard.",
          },
        ],
      },
      {
        id: "OUTIL-12",
        question: "Que sont les « Athlètes qui te ciblent » ?",
        keywords: ["ciblent", "cibles", "interesse", "mon cegep"],
        blocks: [
          {
            type: "p",
            text: "Un athlète peut ajouter des cégeps à ses cibles ; il est prévenu que le cégep le verra. La tuile du tableau de bord et la pastille de la recherche vous montrent les athlètes qui ont ciblé votre cégep. Leur identité suit les mêmes règles que le reste de la recherche (voir RECR-07).",
          },
        ],
      },
      {
        id: "OUTIL-13",
        question: "Comment fonctionnent les listes ?",
        keywords: ["listes", "creer une liste", "regrouper", "prospects"],
        blocks: [
          {
            type: "p",
            text: "« Créer une liste » regroupe des athlètes et des cartes prospect pris dans les favoris de votre unité. Chaque liste a sa propre note, et chaque joueur son fil de notes.",
          },
          {
            type: "p",
            text: "Les listes sont partagées avec votre unité : en supprimer une la retire pour tous. Réservé au Pro.",
          },
        ],
      },
    ],
  },

  /* ═══ 16 ══════════════════════════════════════════════════ */
  {
    id: "part",
    title: "Pour les partenaires",
    articles: [
      {
        id: "PART-01",
        question: "Comment activer mon compte partenaire ?",
        keywords: ["activer", "partenaire", "bienvenue", "mot de passe", "statut"],
        blocks: [
          {
            type: "p",
            text: "Les comptes partenaires sont créés par Nexus. Le lien d'activation reçu par courriel mène à « Bienvenue sur Nexus » : choisissez un mot de passe et acceptez les conditions.",
          },
          {
            type: "p",
            text: "Votre statut — En attente, Approuvé, Suspendu ou Révoqué — s'affiche dans le menu.",
          },
        ],
      },
      {
        id: "PART-02",
        question: "Quels athlètes puis-je voir ?",
        keywords: ["visibilite", "athletes visibles", "consentement", "14 ans"],
        blocks: [
          {
            type: "p",
            text: "Seulement ceux qui ont activé la visibilité auprès des partenaires : à 14 ans et plus avec leur propre accord, avant 14 ans avec celui de leur parent. Les autres n'apparaissent pas (section 7).",
          },
        ],
      },
      {
        id: "PART-03",
        question: "Comment évaluer un athlète et lui décerner des badges ?",
        keywords: ["evaluer", "badges", "evaluation", "retirer mon evaluation"],
        blocks: [
          {
            type: "p",
            text: "Si votre compte peut évaluer, le bouton « Évaluer » de la fiche ouvre une seule fenêtre : la cote globale, en mode simple ou détaillé, et les badges à cocher — les vôtres et les badges Nexus permis.",
          },
          {
            type: "p",
            text: "Décocher un badge puis enregistrer le retire ; « Retirer mon évaluation » efface l'évaluation. Si l'athlète n'a pas activé la visibilité, il reçoit une demande, et rien ne s'affiche avant son accord.",
          },
        ],
      },
      {
        id: "PART-04",
        question: "Comment préparer une carte et envoyer le lien à un jeune ?",
        keywords: ["carte", "en attente", "envoyer le lien", "texto", "correspondance"],
        blocks: [
          {
            type: "p",
            text: "Dans « Mes athlètes › En attente », « + Nouvelle carte » prépare la carte d'un jeune que vous avez évalué. « Envoyer le lien » permet de le copier, de le partager ou, sur téléphone, de l'envoyer par texto.",
          },
          {
            type: "p",
            text: "Le jeune ouvre le lien, se connecte et répond « C'est moi » ou « Ce n'est pas moi ». Quand un profil Nexus semble correspondre à une de vos cartes, vous pouvez accepter ou refuser la correspondance.",
          },
        ],
      },
      {
        id: "PART-05",
        question: "Ai-je accès au mode En direct et à la carte des matchs ?",
        keywords: ["en direct", "carte des matchs", "depistage", "notes de match"],
        blocks: [
          {
            type: "p",
            text: "Oui, si votre compte peut évaluer. Le fonctionnement est le même que pour les recruteurs (voir OUTIL-08 et OUTIL-09) : vous notez par numéro pendant le match, puis vous triez. « Créer une carte » prépare une carte en attente déjà remplie.",
          },
          {
            type: "p",
            text: "Pour activer l'évaluation sur votre compte, écrivez à info@nexussports.ca.",
          },
        ],
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   NOTE DE PUBLICATION

   Deux articles restent en brouillon (`draft: true`) : SECU-04 et
   RECR-02. Ils affirment que les données d'identité ne quittent pas
   nos serveurs pour un compte gratuit. C'est vrai pour la recherche
   recruteur ; ce ne l'est pas encore pour toutes les surfaces (une
   requête directe à l'API peut rapporter davantage). À valider avant
   publication.

   SECU-06 et COACH-06 sont publiés depuis le 2026-10-21, réécrits
   sur le comportement réel. Les renvois `ref` vers SECU-06
   (VOIR-01, COACH-06) s'affichent donc.
═══════════════════════════════════════════════════════════════ */
