# Contenu du centre d'aide Nexus

Ce fichier est la **source de vérité** du contenu de `/aide`.
Il se convertit en `content/aide/sections.ts`.

## Convention de balisage

- `## SECTION <code> — <titre>` ouvre une section
- `### <ID> — <question>` ouvre un article
- Les paragraphes sont du texte simple
- `- ` en début de ligne = élément de liste à puces
- `1. ` = étape numérotée
- `> **Titre :** texte` = encadré (callout)
- Un tableau markdown = bloc tableau
- `**gras**` dans un paragraphe = emphase à conserver

⚠️ **NE PAS PUBLIER `SECU-04` ET `SECU-06` SANS VALIDATION.** Voir la note en fin de fichier.

## Dépendance de publication

**`/aide` ne merge pas dans `main` avant la livraison de deux chantiers parallèles :**

1. **Table blackout RSEQ peuplée** — conditionne `COACH-06` et `SECU-06`.
2. **RLS recruteur fermé côté API directe** — conditionne `RECR-02` et `SECU-04`.

`SECU-04` et `SECU-06` sortent de brouillon **en même temps**, à la livraison des deux.

La raison de cette dépendance : le drapeau `draft` retire des **articles**, pas des **affirmations**. Les deux revendications sous réserve subsistent dans des articles publiés — `COACH-06` porte les périodes de silence RSEQ, `RECR-02` porte ce qui n'est pas transmis au recruteur. Masquer `SECU-04` et `SECU-06` ne suffit donc pas à retirer les affirmations du site : c'est la page entière qui attend.

Le même avertissement est repris en tête de `content/aide/sections.ts`, où il bloque le merge côté code.

---

## SECTION BASE — Les bases

### BASE-01 — Qu'est-ce que Nexus ?

Nexus est une plateforme québécoise de recrutement sportif. Elle met en relation les athlètes du secondaire et des ligues civiles avec les programmes qui recrutent.

Concrètement : un athlète y crée un profil sportif et scolaire. Les recruteurs peuvent le consulter, le suivre et communiquer avec son entraîneur. L'entraîneur, lui, gère son équipe et donne de la visibilité à ses joueurs.

### BASE-02 — Est-ce réservé au réseau collégial québécois ?

Non. Le réseau des CÉGEP est notre point de départ, parce que c'est là que se joue la prochaine étape de la majorité des athlètes québécois. Ce n'est pas une limite.

La plateforme est construite pour accueillir tout programme qui recrute :

- Les CÉGEP du réseau RSEQ, aujourd'hui.
- Les ligues et clubs civils — baseball, soccer, hockey, et tout sport dont la structure vit hors du réseau scolaire.
- Les universités et les programmes collégiaux hors Québec.
- Les clubs et académies à l'étranger — un club espagnol qui cherche un milieu de terrain québécois doit pouvoir le trouver ici.

> **Ce que ça veut dire pour un athlète :** votre profil n'est pas construit pour un seul débouché. Le même profil sert au CÉGEP du coin comme à un programme à l'extérieur du pays. Vous n'aurez pas à recommencer.

### BASE-03 — Est-ce que c'est gratuit ?

Pour un athlète, oui. La création du profil, sa mise à jour, son rattachement à une équipe et sa visibilité auprès des recruteurs ne coûtent rien et ne coûteront jamais rien.

Pour un entraîneur, le compte est gratuit également.

Les recruteurs sont le seul rôle payant, et seulement à partir du moment où ils veulent identifier et contacter des athlètes. Voir la section 6.

### BASE-04 — Qui peut s'inscrire ?

Quatre types de comptes se créent librement : athlète, entraîneur d'école secondaire, entraîneur de ligue ou club civil, et recruteur.

Une entité de recrutement civile — club, académie, programme hors réseau scolaire — doit d'abord écrire à info@nexussports.ca. Nous créons l'entité après vérification, puis l'inscription suit son cours normal.

Un cinquième type, le compte parent, se crée uniquement sur invitation, lorsqu'un athlète mineur s'inscrit.

### BASE-05 — Sur quels appareils Nexus fonctionne-t-il ?

Sur le web, à nexussports.ca, depuis n'importe quel navigateur — et dans l'application mobile, sur iOS et Android.

> **À savoir :** certaines fonctions plus récentes n'existent pour l'instant que sur le site web. Le portail parent, en particulier, est accessible uniquement par navigateur.

---

## SECTION INSC — L'inscription d'un athlète

### INSC-01 — Quel âge faut-il avoir ?

Il faut avoir 14 ans ou plus pour créer un compte soi-même. C'est une exigence de la Loi 25, la loi québécoise sur la protection des renseignements personnels.

Un jeune de moins de 14 ans ne peut pas s'inscrire, et son profil ne peut pas être rattaché à une équipe. Le message affiché est explicite : « L'inscription est réservée aux 14 ans et plus. »

Entre 14 et 17 ans, l'inscription est possible, mais une étape supplémentaire s'ajoute : le jeune doit indiquer le nom et le courriel de son parent ou tuteur, et confirmer que celui-ci autorise la démarche. Le parent reçoit ensuite un avis par courriel.

À 18 ans et plus, aucune étape parentale n'est demandée.

### INSC-02 — Quelles sont les étapes de l'inscription ?

L'inscription se fait en deux temps : la création du compte, puis le profil d'athlète.

| Étape | Ce qui est demandé |
|---|---|
| 1 — Le rôle | Athlète, entraîneur ou recruteur. |
| 2 — Le compte | Courriel et mot de passe (8 caractères minimum), ou connexion par Google ou Apple. |
| 3 — L'identité | Prénom, nom, date de naissance, et le contexte : école secondaire ou ligue civile. Deux consentements obligatoires : la politique de confidentialité et la collecte de renseignements. Un troisième, pour les communications, est facultatif. |
| 4 — Le volet parental | Uniquement pour les 14 à 17 ans : prénom, nom et courriel du parent ou tuteur, plus deux confirmations. |

Vient ensuite le profil d'athlète, en quatre sections : identité et équipe, parcours scolaire, données physiques, puis sport et vidéos.

Seules quelques informations sont obligatoires : le prénom, le nom, l'année de diplomation prévue, l'école ou le sport selon le contexte, et le sport principal. Tout le reste — moyenne générale, taille, poids, tests physiques, vidéos, biographie — est facultatif et peut être complété plus tard, en tout temps.

### INSC-03 — Est-ce qu'on peut s'arrêter et revenir plus tard ?

Oui. Le profil se complète progressivement. Un athlète peut créer son compte un soir et remplir le reste sur plusieurs semaines. Rien ne se perd entre deux sessions.

---

## SECTION ORPH — Sans équipe ou sans entraîneur

C'est la situation la plus courante en début de saison, et elle ne bloque personne. Un athlète peut toujours s'inscrire — même si son équipe, son club ou son entraîneur ne sont pas encore sur la plateforme.

### ORPH-01 — Je ne trouve pas mon équipe dans la liste. Que faire ?

Inscrivez-vous quand même. Choisissez votre école — ou continuez sans équipe si elle n'apparaît pas — et complétez votre profil normalement.

Vous êtes visible auprès des recruteurs dès ce moment-là, exactement comme un athlète rattaché. L'équipe n'est pas une condition d'accès.

Quand votre entraîneur s'inscrira à son tour, il vous retrouvera : son portail contient un onglet « À réclamer » qui liste les athlètes rattachés à son établissement mais pas encore à une de ses équipes. Un clic, et vous êtes dans son alignement.

### ORPH-02 — Et si mon club civil n'existe pas encore sur Nexus ?

Même réponse : inscrivez-vous, complétez votre profil, et attendez que votre entraîneur crée le club. Un entraîneur de ligue civile peut créer son club lui-même au moment de son inscription.

Si personne de votre club n'est encore sur Nexus, écrivez à info@nexussports.ca. Nous nous occupons de la mise en place.

### ORPH-03 — Entraîneur : comment je récupère mes athlètes déjà inscrits ?

Trois chemins, du plus simple au plus large.

1. L'onglet « À réclamer ». Votre portail liste automatiquement les athlètes rattachés à votre établissement qui n'ont pas encore d'entraîneur. Vous les ajoutez à votre équipe d'un clic. C'est le chemin normal.
2. L'invitation par courriel. Si l'athlète est ailleurs ou introuvable, saisissez son adresse. S'il a déjà un compte, il reçoit une invitation à rejoindre votre équipe et décide lui-même de l'accepter.
3. Le code d'équipe. Un code court que vous partagez à tout votre groupe — au vestiaire, dans un message, sur une feuille. Chaque athlète le saisit et rejoint l'équipe sans que vous ayez à le faire un par un.

> **Toute une équipe d'un coup ?** Si vous avez cinquante athlètes à inscrire, n'y allez pas un par un. Écrivez à info@nexussports.ca : nous faisons l'intégration avec vous.

### ORPH-04 — Mon athlète s'est inscrit avec une autre adresse courriel. Est-ce un problème ?

Non, mais ça change le chemin. Le rattachement automatique fonctionne quand l'adresse que vous avez saisie est exactement celle du compte de l'athlète.

Si les adresses diffèrent, utilisez l'onglet « À réclamer » ou le code d'équipe — les deux fonctionnent quelle que soit l'adresse.

---

## SECTION PAR — Les parents

### PAR-01 — Mon enfant s'est inscrit. Qu'est-ce que je reçois ?

Si votre enfant a entre 14 et 17 ans et qu'il a inscrit votre adresse courriel, vous recevez un message intitulé « Votre enfant s'est inscrit sur Nexus ».

Ce courriel ne nomme jamais votre enfant. C'est volontaire : si l'adresse a été mal saisie, aucun renseignement personnel ne se retrouve chez un inconnu.

### PAR-02 — Qu'est-ce que je peux faire avec un compte parent ?

Le courriel contient un bouton pour créer votre compte parent. L'adresse est déjà inscrite et verrouillée à l'écran : c'est celle que votre enfant a fournie. Vous n'avez qu'à choisir un mot de passe. Le lien reste valide 30 jours.

> **Une seule condition :** cette adresse ne doit pas déjà servir à un autre compte Nexus. Si vous êtes vous-même entraîneur ou recruteur sur la plateforme, utilisez une seconde adresse — un même courriel ne peut pas porter deux rôles. Votre enfant peut modifier l'adresse parentale dans son profil.

Une fois connecté, vous accédez à trois choses :

- La fiche de votre enfant : sa photo, son nom, son sport et son école.
- Ses consentements, dont deux que vous pouvez modifier vous-même en tout temps.
- Un résumé d'activité : le nombre de fois où son profil a été consulté, et l'évolution de son dossier.

> **Important :** le portail parent affiche des totaux, jamais des identités. Vous voyez que des recruteurs s'intéressent à votre enfant, pas lesquels.

### PAR-03 — Est-ce que je suis prévenu quand il se passe quelque chose ?

Oui, pour trois événements. Vous recevez une notification lorsqu'un recruteur ajoute votre enfant à ses favoris, lorsque son dossier progresse dans le processus de recrutement, et lorsqu'une visite est planifiée.

Ces notifications décrivent l'événement sans nommer le recruteur ni l'établissement.

### PAR-04 — Est-ce que je peux faire retirer le profil de mon enfant ?

La suppression du compte se fait depuis le compte de votre enfant, dans ses réglages. C'est le même endroit où il peut désactiver son profil temporairement.

Si vous n'arrivez pas à joindre votre enfant ou si la situation l'exige, écrivez à confidentialite@nexussports.ca et nous procéderons.

### PAR-05 — Et si je ne fais rien ?

Le profil de votre enfant reste actif. La création d'un compte parent est une possibilité qui vous est offerte, pas une condition à remplir. Vous pouvez y revenir plus tard, dans les 30 jours suivant l'avis.

À noter : un athlète ne peut être lié qu'à un seul compte parent. Si vous êtes deux parents, choisissez ensemble lequel crée le compte.

---

## SECTION CONS — Les consentements

Nexus est soumise à la Loi 25. Chaque consentement demandé a un objet précis, et vous trouverez ci-dessous la liste complète.

| Consentement | Quand | Obligatoire ? | Ce qu'il permet |
|---|---|---|---|
| Politique de confidentialité et conditions d'utilisation | À l'inscription | Oui | Utiliser la plateforme. |
| Collecte et traitement des renseignements | À l'inscription | Oui | Créer et héberger le profil. |
| Communications de Nexus | À l'inscription | Non | Recevoir nos infolettres et annonces. |
| Autorisation parentale — création du profil | 14 à 17 ans | Oui | Créer le profil d'un mineur. |
| Autorisation parentale — visibilité aux recruteurs | 14 à 17 ans | Oui | Rendre le profil visible aux recruteurs. |
| Visibilité auprès des partenaires média | Facultatif, en tout temps | Non | Voir la section 7. |

### CONS-01 — Comment fonctionne l'autorisation parentale ?

Au moment de l'inscription, un athlète de 14 à 17 ans doit cocher deux cases confirmant que son parent ou tuteur autorise la création du profil et sa visibilité auprès des recruteurs. Il inscrit ensuite le nom et le courriel de ce parent.

Le parent reçoit alors un avis par courriel l'informant de l'inscription, avec la possibilité de créer son propre compte pour suivre le dossier.

> **Entraîneurs, à lire :** cette étape est celle de l'athlète qui s'inscrit lui-même. Si vous créez vous-même la fiche d'un joueur mineur, l'autorisation parentale doit être obtenue par vous, hors plateforme. Prenez l'habitude de la demander avant d'ajouter un mineur.

### CONS-02 — Peut-on retirer un consentement ?

Les communications marketing et la visibilité auprès des partenaires se retirent en un clic, en tout temps, par l'athlète dans ses réglages ou par le parent dans son portail.

Pour les consentements de base — ceux qui permettent au profil d'exister — le retrait équivaut à désactiver le compte. Cette option se trouve dans les réglages de l'athlète : le profil disparaît immédiatement des recherches de recruteurs.

---

## SECTION SECU — La chaîne de confiance

Nos athlètes sont majoritairement mineurs. Leur protection n'est pas une fonctionnalité de la plateforme : c'est sa contrainte de départ. Cette section explique qui accède à quoi, et pourquoi.

Le principe est simple à énoncer : personne n'obtient l'accès à un athlète parce qu'il l'a demandé. L'accès se gagne, et il se vérifie à chaque maillon.

### SECU-01 — Premier maillon : personne ne voit rien sans compte

Aucun profil d'athlète n'est accessible à un visiteur non connecté. Pas de page publique, pas de résultat de moteur de recherche, pas d'aperçu. Un athlète de Nexus n'existe pas pour l'internet ouvert.

### SECU-02 — Deuxième maillon : l'entraîneur ne voit que les siens

Un entraîneur accède aux athlètes de son établissement — son école ou son club — et à personne d'autre. Il ne peut pas parcourir les athlètes d'une autre école, ni chercher dans l'ensemble de la plateforme.

Cette limite n'est pas un réglage d'affichage. Elle est appliquée au niveau de la base de données : un entraîneur qui tenterait de contourner l'interface n'obtiendrait aucune ligne supplémentaire.

### SECU-03 — Troisième maillon : le responsable d'établissement répond de son monde

Chaque établissement a un responsable des sports. Ce n'est pas un titre qu'on se donne : la demande est déposée sur la plateforme, puis examinée et approuvée manuellement par Nexus avant d'être accordée.

Ce responsable assume ensuite deux choses :

- Il est le répondant en matière de protection des renseignements personnels (RPRP) pour son établissement. C'est une obligation de la Loi 25, et elle est nommée à l'inscription.
- Il confirme que les entraîneurs qui s'inscrivent sous son établissement en sont réellement. C'est lui qui connaît son personnel — pas nous.

La protection des données des jeunes se joue donc au plus près d'eux : dans l'établissement qui les encadre déjà.

### SECU-04 — Quatrième maillon : un recruteur entre librement, mais ne voit personne

Nous voulons qu'un recruteur puisse créer son compte, entrer et constater la valeur de la plateforme sans obstacle. Le bassin d'athlètes, les sports couverts, la profondeur des profils : tout cela se voit gratuitement.

Ce qui ne se voit pas, c'est l'athlète lui-même.

Un recruteur non abonné ne reçoit aucune information permettant d'identifier un jeune ni de le joindre : ni nom, ni photo, ni numéro de chandail, ni lien vidéo, ni coordonnées. Il voit des profils sportifs — un poste, une cote, une année de diplomation — pas des personnes.

> **Le point qui compte :** cette restriction n'est pas une règle d'affichage. Les données ne quittent pas nos serveurs. Il ne s'agit pas d'un champ masqué dans une page qu'un outil de développeur permettrait de révéler : l'information n'est jamais transmise au navigateur du recruteur.

### SECU-05 — Cinquième maillon : l'accès s'ouvre après vérification et abonnement

Un recruteur obtient l'accès à l'identité des athlètes lorsque deux conditions sont réunies : son rattachement à un établissement a été vérifié par Nexus, et il a souscrit un abonnement.

L'abonnement n'est pas seulement un modèle d'affaires. C'est aussi un filtre : une personne qui paie sous le nom d'un établissement laisse une trace vérifiable. La curiosité anonyme s'arrête au maillon précédent.

### SECU-06 — Et le contact avec les athlètes ?

Un recruteur vérifié et abonné peut écrire à un athlète, mais jamais librement. Trois règles encadrent ce contact.

- Les échanges passent par la messagerie de la plateforme. Aucune coordonnée personnelle n'est transmise — ni courriel, ni téléphone, d'un côté comme de l'autre.
- Nexus applique des périodes de silence qui suivent le calendrier de recrutement et les règles du RSEQ. Hors des fenêtres autorisées, la messagerie est fermée : le recruteur ne peut simplement pas écrire.
- L'entraîneur est informé du premier contact. Il reste l'adulte de référence dans la relation, et il n'est jamais contourné.

Un recruteur non abonné, lui, ne peut contacter personne — il ne sait même pas qui il regarde.

> **Pourquoi c'est construit ainsi :** un athlète du secondaire n'a pas à gérer des sollicitations d'adultes inconnus sur son téléphone personnel, ni à composer avec les règles d'un calendrier de recrutement qu'il ne connaît pas. La plateforme porte cette charge à sa place.

### SECU-07 — Où sont hébergées les données ?

Au Québec. Nexus est exploitée par Gestion Welead inc., une entreprise québécoise, et les renseignements sont conservés sur des serveurs situés dans la province.

Notre répondant en matière de protection des renseignements personnels est joignable à confidentialite@nexussports.ca.

---

## SECTION MED — Les partenaires média

C'est la section que nous vous invitons à lire attentivement, parce qu'elle est souvent mal comprise.

### MED-01 — De quoi s'agit-il ?

Nexus collabore avec des partenaires approuvés : journalistes sportifs, pages de contenu, balados, camps spécialisés. Ces partenaires peuvent télécharger la carte officielle Nexus d'un athlète pour la publier dans un article, une publication ou un reportage.

La carte contient le nom de l'athlète, son école, sa cote, sa position et sa photo.

### MED-02 — Est-ce activé par défaut ?

**Non.** Cette option est désactivée à la création du compte. Elle ne s'active que si l'athlète — ou son parent — la coche explicitement.

### MED-03 — Qu'est-ce qu'un partenaire voit si l'option est désactivée ?

**Rien.** Absolument rien. L'athlète n'apparaît pas dans leur portail, ni sous une forme anonymisée, ni sous une forme partielle. Il est purement absent.

Ce n'est pas un réglage d'affichage : la restriction est appliquée au niveau de la base de données elle-même. Un partenaire qui chercherait à contourner l'interface n'obtiendrait aucune ligne.

> **En clair :** tant que vous ne cochez pas cette option, aucun média partenaire ne peut voir votre profil, ni le nommer, ni télécharger votre carte. C'est le réglage par défaut, et c'est ainsi que nous protégeons nos athlètes.

### MED-04 — Et si on l'active ?

Seuls les partenaires dont le statut a été approuvé par Nexus y ont accès. Chaque consultation et chaque téléchargement de carte est enregistré.

L'option se retire en tout temps, aussi facilement qu'elle a été donnée, sans avoir à nous écrire.

---

## SECTION EQ — Le rattachement à une équipe

### EQ-01 — Comment un athlète rejoint-il son équipe ?

Quatre chemins existent.

- Pendant l'inscription : l'athlète choisit son école, puis son équipe dans la liste. C'est le chemin le plus courant.
- Par invitation : l'entraîneur envoie une invitation, qui apparaît dans les notifications de l'athlète. Il l'accepte ou la refuse.
- Par code d'équipe : un code court à saisir, ou un lien à ouvrir.
- Par une fiche déjà créée : si l'entraîneur a créé la fiche avant l'inscription, elle se rattache automatiquement au moment où l'athlète crée son compte avec la même adresse courriel.

Si aucun de ces chemins ne s'applique, voir la section 3.

### EQ-02 — Un athlète peut-il faire partie de deux équipes ?

Non. Un athlète appartient à une seule équipe à la fois. C'est ce qui garde les alignements propres et évite les doublons.

Changer d'équipe est possible et prend quelques secondes. L'ancienne appartenance est conservée dans le parcours de l'athlète — son historique reste visible.

### EQ-03 — Que se passe-t-il si un athlète change d'équipe ?

Il doit confirmer le changement à l'écran. Une fois confirmé, son école et son entraîneur de référence sont mis à jour, et l'ancienne équipe passe dans son historique.

### EQ-04 — Faut-il absolument une équipe ?

Non. Un athlète sans équipe peut créer son profil, le compléter et être vu par les recruteurs exactement comme les autres. C'est utile pour ceux qui changent de niveau ou dont le club n'est pas encore inscrit.

---

## SECTION VOIR — Qui voit quoi

La question la plus importante, et celle qui revient le plus souvent chez les parents. Le détail du raisonnement est à la section 6.

| Qui | Ce qu'il voit |
|---|---|
| Un visiteur non connecté | Rien. Aucun profil d'athlète n'est accessible sans compte. |
| Un recruteur non abonné | Des profils sportifs sans identité : poste, cote, année de diplomation. Ni nom, ni photo, ni numéro, ni vidéo, ni coordonnées. |
| Un recruteur vérifié et abonné | Le profil sportif et scolaire complet : identité, photo, mensurations, tests, moyenne, vidéos, évaluation de l'entraîneur. |
| L'entraîneur de l'athlète | Le profil complet, plus le courriel de l'athlète, plus le nombre de fois où son profil a été consulté. |
| Un partenaire média | Rien, sauf si l'athlète a activé l'option décrite à la section 7. |
| Le parent | La fiche de son enfant, ses consentements et des totaux d'activité. |

### VOIR-01 — Les recruteurs voient-ils mon numéro de téléphone ou celui de mes parents ?

Non. Les coordonnées — courriel de l'athlète, téléphone, nom et courriel du parent — ne sont affichées à aucun recruteur, abonné ou non. Un recruteur qui souhaite entrer en contact passe par la messagerie de la plateforme, où aucune coordonnée ne circule. Voir SECU-06.

### VOIR-02 — Un recruteur d'un autre établissement peut-il voir mon profil ?

Oui, s'il est vérifié et abonné. C'est le but même de la plateforme : un athlète de Chicoutimi doit pouvoir être découvert par un programme de Montréal — ou d'ailleurs.

### VOIR-03 — Est-ce que je sais qui a consulté mon profil ?

Chaque athlète voit gratuitement le nombre de consultations de son profil, leur évolution dans le temps et les régions d'où elles proviennent. Il reçoit aussi une notification à chaque consultation, indiquant la région du recruteur.

Connaître le nom des recruteurs et des établissements fait partie du forfait Pro de l'athlète.

---

## SECTION PROF — Le profil et sa vérification

### PROF-01 — À quoi sert le pourcentage de complétion ?

C'est un indicateur pour l'athlète : il montre ce qu'il reste à remplir. Un profil complet donne plus de matière au recruteur — vidéos, tests, résultats scolaires — mais le pourcentage lui-même ne change ni la visibilité, ni le classement, ni l'accès à quoi que ce soit.

Il se calcule sur trois blocs : les informations de base, la présence d'une vidéo de faits saillants, et les données détaillées.

### PROF-02 — Qu'est-ce que le badge « vérifié » ?

C'est une attestation donnée par l'entraîneur. Il confirme que l'athlète est bien celui qu'il prétend être et que ses informations correspondent à la réalité.

Le badge apparaît sur le profil et permet aux recruteurs de filtrer les athlètes vérifiés. Un profil non vérifié reste visible normalement — la vérification est un gage de confiance, pas une condition d'accès.

Seul un entraîneur peut la donner. Elle n'est jamais automatique.

### PROF-03 — Qui peut modifier mon profil ?

L'athlète modifie lui-même la majorité de ses informations. Deux exceptions : les mensurations et les tests physiques, que l'athlète propose et que son entraîneur approuve. Il reçoit une notification dès que c'est fait.

L'évaluation de l'entraîneur — la cote et les commentaires — appartient à l'entraîneur seul.

---

## SECTION NOTIF — Courriels et notifications

### NOTIF-01 — Quels courriels Nexus envoie-t-il ?

Peu, et toujours pour une raison précise.

- À un parent, quand son enfant de 14 à 17 ans s'inscrit.
- À un athlète, quand un entraîneur l'invite à réclamer sa fiche.
- À un athlète déjà inscrit, quand un entraîneur l'invite à rejoindre son équipe.

Nous n'envoyons pas d'infolettre à un athlète qui n'a pas donné son consentement aux communications.

### NOTIF-02 — Et les notifications dans l'application ?

Un athlète reçoit une notification lorsqu'un recruteur consulte son profil, lorsqu'un recruteur l'ajoute à ses favoris, lorsque son entraîneur approuve une de ses suggestions, et lorsque son entraîneur met à jour son évaluation.

Un parent reçoit les trois notifications décrites à la section 4.

> **À savoir :** les notifications ne sont pas encore réglables une par une. Sur mobile, il reste possible de couper les notifications de l'application dans les réglages de l'appareil.

---

## SECTION VIE — Vie privée, désactivation et suppression

### VIE-01 — Quelle est la différence entre désactiver et supprimer ?

Désactiver met le profil en veille : il disparaît immédiatement des recherches de recruteurs, mais les données restent. C'est réversible.

Supprimer est définitif. Le nom, la date de naissance, les coordonnées, la photo, la biographie, les vidéos, les données scolaires et physiques, les renseignements du parent : tout est effacé. Les favoris, les notes et l'historique de consultation des recruteurs sont détruits. Les messages et les évaluations aussi. Le compte est retiré et l'adresse courriel ne peut plus servir à s'y reconnecter.

Les deux options se trouvent dans les réglages du compte de l'athlète.

### VIE-02 — Que conservez-vous après une suppression ?

Uniquement ce qui est nécessaire pour prouver que le consentement a bien existé et qu'il a été retiré, comme la loi l'exige. Aucun renseignement permettant d'identifier la personne n'est conservé.

### VIE-03 — À qui s'adresser pour une question de confidentialité ?

À confidentialite@nexussports.ca. Toute demande d'accès, de rectification ou de suppression y est traitée.

---

## SECTION COACH — Pour les entraîneurs

### COACH-01 — Comment m'inscrire ?

Choisissez « École secondaire » ou « Ligue ou club sportif » à l'inscription. Vous indiquez ensuite votre sport principal, votre établissement et votre première équipe.

Un entraîneur d'école choisit son école dans la liste. Un entraîneur de ligue civile peut créer son club s'il n'existe pas encore.

> **Si votre école n'est pas dans la liste :** écrivez-nous avant de commencer l'inscription. L'ajout se fait rapidement de notre côté, et vous éviterez d'avoir à recommencer.

### COACH-02 — Qu'est-ce que le responsable des sports ?

C'est la personne qui répond de l'établissement sur Nexus. Le premier entraîneur d'une école doit se déclarer responsable ou responsable intérimaire ; les suivants peuvent s'inscrire simplement comme entraîneurs.

Cette déclaration est examinée et approuvée par notre équipe avant d'être accordée. Le responsable devient le répondant en matière de protection des renseignements personnels pour son établissement, et il confirme l'identité des entraîneurs qui s'y inscrivent. Voir la section 6.

### COACH-03 — Comment ajouter mes athlètes ?

Quatre façons : l'onglet « À réclamer », la création de fiche, l'invitation par courriel, et le code d'équipe. Le détail est à la section 3.

Si vous saisissez le courriel d'un athlète qui a déjà un compte Nexus, l'écran vous en avertit et vous propose de l'inviter à rejoindre votre équipe plutôt que de créer une seconde fiche. C'est l'athlète qui décide d'accepter.

> **Rappel Loi 25 :** si vous créez la fiche d'un joueur de 14 à 17 ans, obtenez l'autorisation de son parent avant. La plateforme ne la demandera pas à votre place. Un joueur de moins de 14 ans ne peut pas être rattaché à une équipe.

### COACH-04 — Que vois-je de mes athlètes ?

Tous les athlètes actifs de votre école ou de votre club, quel que soit leur entraîneur. Vos onglets séparent ensuite ceux qui vous sont assignés, ceux qui n'ont pas encore d'entraîneur, et ceux dont une suggestion ou une vérification est en attente.

Vous voyez aussi combien de fois vos athlètes ont été consultés par des recruteurs.

Vous ne voyez rien des athlètes d'un autre établissement. C'est le deuxième maillon décrit à la section 6.

### COACH-05 — Plusieurs entraîneurs peuvent-ils gérer la même équipe ?

Oui. Une équipe peut compter un entraîneur-chef et des adjoints. Tous ont les mêmes droits sur l'alignement et les athlètes ; seul l'entraîneur-chef gère la composition du personnel.

### COACH-06 — Un recruteur peut-il écrire directement à mes joueurs ?

Oui, mais dans un cadre strict — et vous n'êtes jamais mis de côté.

Les échanges passent par la messagerie de Nexus, sans qu'aucune coordonnée personnelle ne circule. Les périodes de silence du calendrier de recrutement et les règles du RSEQ sont appliquées par la plateforme : hors fenêtre autorisée, un recruteur ne peut pas écrire. Et vous êtes informé du premier contact avec un de vos athlètes.

Un recruteur non abonné ne peut contacter personne. Le détail est à la section 6.

---

## SECTION RECR — Pour les recruteurs

### RECR-01 — Comment fonctionne l'accès ?

Un recruteur crée son compte, choisit son établissement et indique s'il en est le responsable. Les demandes de responsable sont vérifiées manuellement par notre équipe.

L'inscription est libre et l'accès à la plateforme est immédiat. Ce qui se gagne, c'est l'accès à l'identité des athlètes.

### RECR-02 — Que voit un compte gratuit ?

L'ensemble du bassin d'athlètes : leurs postes, leurs cotes, leurs années de diplomation, leurs mensurations. De quoi mesurer précisément ce que la plateforme contient pour votre programme.

Ce qui n'est pas transmis : le nom, la photo, le numéro de chandail, les vidéos et toute coordonnée. Un compte gratuit ne peut identifier ni joindre aucun athlète.

### RECR-03 — Qu'est-ce que l'abonnement débloque ?

L'identité complète des athlètes, la recherche par nom, l'accès aux vidéos et au rapport de l'entraîneur, l'écriture aux entraîneurs, les listes de prospects et le suivi de pipeline.

### RECR-04 — Les collègues d'un même établissement partagent-ils leur travail ?

Non. Les favoris, les notes, le pipeline et les listes sont personnels à chaque recruteur. Un responsable d'établissement dispose toutefois d'un droit de regard sur le travail de son équipe.

---

# NOTE DE PUBLICATION — à lire avant de mettre en ligne

Deux articles décrivent un état qui n'est pas encore entièrement en place. Ils sont rédigés, mais leur publication demande une validation.

**SECU-04** — l'affirmation « les données ne quittent pas nos serveurs » est vraie pour la recherche recruteur depuis le câblage des RPC projetées. Elle ne l'est pas encore pour toutes les surfaces : une requête directe à l'API peut encore rapporter davantage. À valider avant publication.

**SECU-06** — les périodes de silence RSEQ sont prévues par l'architecture, mais la table des périodes est vide et la règle d'âge n'est pas encore écrite. L'affirmation décrit l'intention, pas l'état actuel. À valider avant publication.

Les autres articles décrivent le produit tel qu'il fonctionne aujourd'hui.
