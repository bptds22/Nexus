# Lots W4b + W4c — écrans des cartes prospects partenaire (web)

Branche `feat/partenaires-w4bc`, **local seulement**, à pousser ensemble (jamais de lien
partenaire en ligne sans la page du jeune). Base W4a en prod (`20261014200739`), **non touchée,
aucune migration**.

## W4b — partenaire : `/partenaire/prospects` « Mes prospects »

- Entrée de menu visible seulement pour un partenaire évaluateur (`media_partners.peut_evaluer`) ;
  la page et la base revérifient (organisation approuvée, au moins un sport permis).
- Liste : statut **tel que le rend le serveur** (À envoyer / Lien envoyé / Correspondance
  possible), échéance (en ambre à 7 jours ou moins), cote, nombre de badges, compteur
  « x / 50 cartes actives ».
- Créer / modifier (`components/partenaire/prospects/FormulaireCarte.tsx`) : prénom, nom, sport
  (seulement les sports permis), position, école ou club (Scolaire / Civil, recherche sans
  accents comme la carte recruteur), équipe facultative du sport de la carte, promotion, case
  obligatoire « Ce jeune a 14 ans ou plus » ; évaluation facultative avec **le même éditeur que
  W2** (`EditeurEvaluationPartenaire`, sorti d'`EvaluerAthleteModal`, comportement inchangé) ;
  badges facultatifs : badges propres (W3) et badges Nexus admissibles pour le sport de la carte
  (W3b).
- « Envoyer par texto » (`EnvoyerLien.tsx`) : génère le lien, affiché **une seule fois** ;
  message court signé de l'organisation, sans nom ni évaluation ; bouton `sms:` sur appareil
  tactile, partage natif s'il existe, copie partout. Lien déjà envoyé : « Nouveau lien » avec
  confirmation (l'ancien meurt). Révoquer, supprimer (confirmation en deux temps, pas de boîte
  native).
- « Terminées » : les issues sans nom ; une carte réclamée donne « Voir sa fiche ».

## W4c — jeune

- `/p/[jeton]` : sans connexion, seulement « <partenaire> t'invite sur Nexus » + S'inscrire /
  Se connecter. Robots d'aperçu : aucun appel, page générique (prouvé : ni le nom du partenaire
  ni celui du jeune dans le HTML servi à un robot). Web seulement (masquée au build mobile,
  `notFound()` sous Capacitor), jamais l'App Store.
- Le jeton est mémorisé dans le navigateur (60 jours) et survit à l'inscription et à
  l'onboarding : à la fin, le layout athlète ramène à `/p/[jeton]`, qui l'oublie aussitôt ouvert.
- Connecté : la carte (`prospect_partenaire_ouvrir`), « C'est moi » / « Ce n'est pas moi »
  (confirmation), activation de la visibilité partenaire dans le même écran, par la même RPC que
  les paramètres (`set_my_partner_visibility`). Pour un 14-17 ans, c'est le parcours existant :
  il consent lui-même et son parent est avisé (`aviser_parent_partenaires`) ; l'écran le dit.
- Bandeau de rappel dans l'espace athlète (web) : carte confirmée qui attend l'opt-in (avec
  l'échéance), ou carte qui attend une réponse.
- `/athlete/cartes-partenaires` : les cartes en attente ; cible de la notification
  `PARTENAIRE_EVALUATION` (ajoutée à la page Notifications : type, couleur, icône, onglet
  Profil ; une notification caduque ne mène plus nulle part).

## Preuves (local, 2026-10-14)

- `npm run build` (dans un worktree, `next build --webpack`) : OK. `tsc` : aucune erreur dans
  les fichiers du lot (176 erreurs avant comme après, toutes préexistantes).
- Parcours complet, navigateur **sans interface** : `outils/parcours-w4bc.mjs`, journal
  `parcours-resultats-local.txt`, 23 captures dans `captures/` (partenaire et jeune, bureau et
  mobile). Création par le vrai formulaire → lien → jeune sans compte → **inscription réelle**
  par `/auth` (19 ans) → onboarding **simulé par la base** (fiche athlète + `onboarding_complete`,
  l'assistant complet n'est pas l'objet du lot) → retour automatique au lien → « C'est moi »
  sans opt-in → attente → bandeau → activation → transfert : évaluation 4,0 et 2 badges visibles
  sur `/athlete/profil`. « Ce n'est pas moi » par le lien (carte supprimée, issue « refusée »
  chez le partenaire). Proposition de Nexus : notification → page de réponse. Partenaire : la
  carte proposée reste « À envoyer » (statut masqué). Aucune erreur JavaScript. Tout ce que le
  script crée est retiré à la fin (compte, fiche, cartes, journal, notifications, réglages du
  partenaire de test).

## À savoir

- La notification `PARTENAIRE_EVALUATION` est rendue par une page partagée avec l'appli : au
  prochain build mobile, elle y aura son icône et sa pastille, **sans lien** (la page de réponse
  est web seulement, registre §85). Son texte (base W4a) dit « Réponds depuis nexussports.ca »,
  ce qui se lit aussi sur le web.
- Défaut **préexistant** relevé, non corrigé : sur mobile web, `/athlete/notifications` fait
  624 px de large pour 390 px d'écran (la colonne `flex-1` du layout athlète n'a pas `min-w-0`).
