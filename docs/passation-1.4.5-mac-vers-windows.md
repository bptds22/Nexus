# Passation 1.4.5 — Mac vers Windows

Branche : `fix/1.4.5-recruteur` (depuis `main` 6153eca3). Travail fait sur le Mac dans le worktree
`~/dev/nexus-145`. **Rien n'a été appliqué en prod. Aucune migration n'a été exécutée.**

Règles toujours en vigueur : pas de `git stash` (commit WIP local à la place), carte cégep
(« Trouve ton cégep », `components/cegep-search/*`) intouchée, migration écrite puis montrée avant
d'avancer, `.agents/`, `.claude/skills/` et `skills-lock.json` jamais commités.

## 1. État de chaque point

### Lot recruteur

| Point | État | Commit | Notes |
|---|---|---|---|
| **R1** Fausse carte modifiable | **Fait** | `f64fc182` | Bouton « Modifier la carte » dans Infos, web et appli (même composant `ModifierCarte`). Champs : prénom, nom, école/club, équipe, position, numéro, promotion, taille, poids, vidéo. `VERS_COLONNE` étendue. Une carte n'écrit jamais dans `athletes`. Une carte FUSIONNÉE est masquée et non écrivable pour tous (`cartes_non_fusionnees`, lot E). **Dépend de la migration `carte_etablissement_modifiable` pour changer l'école hors équipe** (sans elle, le formulaire détecte à la relecture que l'école n'a pas bougé et le dit). |
| **R2** Grades sur une ligne | **Fait** | `90cc2241` | `GradePicker` : une rangée défilante, centrée sur le grade choisi. |
| **R3** Badges, 5 au total | **Fait** | `8f446c70`, `e8dc2c53` | `CarteBadges` (`MAX_BADGES_CARTE = 5`), priorité badge personnalisé du partenaire, autres badges du partenaire, puis coach. Lecture par paquets d'environ 50 au fil du défilement (`PartenaireCartesProvider`). Badges coach ajoutés au processus pour les cartes liées à un vrai athlète. Les deux évaluations (coach et partenaire) côte à côte. **Dépend de la migration `badges_partenaires_athletes_lot`.** Sur la fiche, « +N » déplie le reste. |
| **R4** « Pas encore évalué » | **Fait** | `c4581e10` | `CotesEvaluations` : fiche mobile (bloc Cote Globale), cartes du pipeline web et appli. |
| **R5** Notes dans Mes listes | **Fait** | `919b258f` | Commits qui avaient retiré la note de liste : `8f108751` (web) et `e131d05d` (appli). Note générale de la liste rétablie (zone web, onglet appli) ; le fil par joueur reçoit les mêmes options que Mon processus. Aucune migration. |
| **R6** Notes sur le terrain | **Option C faite**, option B au registre | `68ae65d6` | `ChampNote` : champ plus grand, brouillon automatique (local à l'appareil), bouton Dicter, gabarits. Branché sur la fiche, la liste, le processus, la note de liste, web et appli. **Dictée dans l'appli iOS : la WebView n'expose pas `SpeechRecognition` ; le bouton met le curseur dans le champ et indique le micro du clavier.** Mode match (option B) : `docs/registre-1.4.6.md`, aucun code. |

### Lot partenaire (P1 à P6) — diagnostic fait, **aucun code**

| Point | État | Décision de BP |
|---|---|---|
| **P1** « Athlètes » devient « Recherche » (web et appli) | À faire | Refaire sur le modèle de la recherche recruteur (filtres en feuille, cartes natives, fiche au toucher), via un adaptateur sur `top_athletes_view`. Aucune donnée nouvelle ouverte. |
| **P2** « Mes athlètes » devient « Mes évaluations » | À faire | Cartes compactes, fiche au toucher, filtre Distinctions, badges (règle R3). « Suggestion » : voir ci-dessous. |
| **P3** « Prospects » devient « Mes athlètes » | À faire | Maquette validée dans le principe ; **pas de puce « Ouverte »**. |
| **P4** « Envoyer par texto » | À faire | Option (a). |
| **P5** Non-contact | À faire | Voir décisions. Migration à écrire (non écrite). |
| **P6** Rendu premium des 12 pages | À faire | Même thème que le recruteur. |

Pages partenaire (web et appli, même code) : tableau de bord, bienvenue, newsroom, tendances,
classements, athlètes (+ fiche `athletes/[id]`), mes-athletes, prospects, carte-matchs,
telechargements, profil. Barre d'onglets mobile : `PARTENAIRE_TABS` dans
`app/_components/mobile/MobileTabBar.tsx` (4 entrées) ; menu web : `NAV_ITEMS` dans
`app/partenaire/_components/PartnerSidebar.tsx`.

### Lot 3 (C1 à C5) — **à faire**, diagnostic non commencé

| Point | État |
|---|---|
| C1 Création d'athlète coach (mobile) : champs obligatoires visibles, validation par étape | À faire |
| C2 Recruteur et partenaire : aucun compte de joueurs (retirer tous les totaux, lister chaque compteur retiré) | À faire |
| C3 Pastilles de notification qui ne se mettent pas à jour (tous les rôles, plus la pastille de l'icône iOS/Android) | À faire |
| C4 Page d'équipe (coach) : expliquer chaque section, proposer une version simplifiée, **montrer avant de coder** | À faire |
| C5 Onboarding athlète : visibilité partenaire non sautable, **montrer l'écran avant de coder** | À faire |

### Fin de parcours (non fait)

Une fois les TROIS lots terminés seulement : `npm run build`, `npm run build:mobile`, `npx cap sync ios`,
`versionCode` 22 et `CURRENT_PROJECT_VERSION` 24 (version 1.4.5), AAB générable sur le PC. Rapport final :
écrans web touchés, migrations à appliquer, `git log origin/main..HEAD`.

## 2. Migrations écrites et NON appliquées

**Aucune n'a jamais été testée : ni Docker ni psql sur le Mac.** À essayer sur le PC (branche Supabase ou
base locale) avant la prod. Chacune a son rollback dans `supabase/rollback/`.

| Fichier | Rôle | Garde-fous |
|---|---|---|
| `supabase/migrations/20261017120000_badges_partenaires_athletes_lot.sql` | `badges_partenaires_athletes(uuid[])` : lecture par lot des badges partenaire. SECURITY INVOKER, délègue athlète par athlète à `badges_partenaires_athlete()` (seule source des règles : Loi 25, masquage). Appelée par paquets d'environ 50, jamais pour tous les résultats. | Vérifie qu'elle n'est pas déjà appliquée ; ACL complète comparée (`authenticated`, `postgres`, `service_role`). |
| `supabase/migrations/20261017130000_carte_etablissement_modifiable.sql` | Redéfinit le trigger `cartes_prospect_avant_update` : l'établissement d'une carte SANS équipe peut changer (mêmes gardes qu'à la création) ; avec équipe, il suit l'équipe. | Empreinte md5 du corps relevé (`177e99f1…`) vérifiée avant de remplacer ; ACL avant/après identique ; rollback à l'identique (`38b55d11…`). |
| **À venir** : retrait du blocage partenaire | **Pas écrite.** Retirer `non_contact_carte(uuid,integer)` et son contrôle dans `partenaire_prospect_lien` (migration `20261017010000_complements_1_4_5.sql`, lignes 36-63, 89-94, 243, 256-257), mettre à jour son rollback et les lots `docs/complements-1.4.5/`. Client : `lib/partenaires/prospects.ts`, `app/partenaire/prospects/page.tsx`, `components/partenaire/prospects/EnvoyerLien.tsx`, test `lib/partenaires/__tests__/nonContactCartes.test.ts`. | Gate d'ACL par liste complète triée (CLAUDE.MD). **La montrer à BP avant de continuer.** |

Notes de test à faire sur le PC :
- `badges_partenaires_athletes` : un athlète sans opt-in partenaire actif ne doit rendre aucune ligne ; un
  badge masqué ne doit pas apparaître pour un recruteur.
- `carte_etablissement_modifiable` : avec équipe, changer `school_id` seul doit lever « l'établissement suit
  l'équipe » ; sans équipe, changer pour un établissement ayant une équipe du sport doit lever « choisis-la ».
- Performance de la recherche : le serveur appelle la fonction une fois par athlète d'un paquet.

## 3. Décisions de BP (recopiées telles quelles)

Décisions pour le lot partenaire :
- P6 : même thème que le recruteur (sombre, navy #1A1D24, accent rouge).
- P2/P3 « suggestion » : c'est quand une FAUSSE CARTE correspond à un VRAI athlète inscrit sur Nexus. On montre « Correspondance possible » avec le même traitement rouge que chez le recruteur, et le partenaire accepte ou refuse le rapprochement.
- P4 : option (a). Messages s'ouvre avec le texte et le lien préremplis, sans numéro. Rien n'est saisi ni stocké.
- P5 : oui. On retire le blocage du partenaire, ET on ajoute le blocage du texto recruteur côté client (bouton grisé, « Période de non-contact jusqu'au [date] »).
- P3 : pas de puce « Ouverte ».
- R6 : option C (notes plus faciles) en 1.4.5. Le mode match va au registre 1.4.6.

Décisions antérieures du même chantier :
- Migration badges : version LÉGÈRE. Garder la délégation à `badges_partenaires_athlete()` ; l'appeler seulement pour les cartes affichées, par paquets (environ 50), au fil du défilement ; le fichier reste NON appliqué, à tester sur le PC.
- Badges coach sur le processus : dans la même lecture groupée, pour les cartes liées à un vrai athlète ; règle de 5 au total, badge personnalisé du partenaire d'abord, puis « +N ». Une carte non liée n'a pas de badges.
- Migration école/club : OK ; reste NON appliquée, testée sur le PC avant la prod.
- Plus de `git stash`, jamais. Si on doit mettre de côté : commit WIP local.

## 4. Points d'attention pour la suite

- **P4** : le texto du recruteur ouvre Messages par `sms:<numéro>&body=` (iOS) ou `?body=` (Android), via
  `window.location.href`, seulement dans l'appli au chemin « Créer et inviter » avec téléphone
  (`components/shared/CreerProspectMobile.tsx:299-303`, `lib/cartes/renvoiInvitation.ts:46-48`). Sur le web, il copie
  seulement. Son lien est `https://nexussports.ca/auth?mode=signup`. Le partenaire garde son lien
  `https://nexussports.ca/p/<jeton>` et son texte « t'invite » ; sans numéro : `sms:&body=` (iOS) et
  `sms:?body=` (Android). Tests à mettre à jour : `lib/partenaires/__tests__/prospectsMobile.test.ts:25-34`.
- **P5** : la période de non-contact (`blackout_periods`, admin `app/admin/blackouts`) bloque aujourd'hui côté
  serveur seulement la messagerie recruteur↔athlète (`enforce_messaging_blackout`). Le texto recruteur n'est
  bloqué nulle part. Le `sms:` part de l'appareil : seul le bouton se grise (côté client) ; le message est
  « Période de non-contact jusqu'au [date] ». Réutiliser `get_active_blackout` / `is_messaging_blacked_out`.
- **P2/P3** : le rapprochement existe déjà côté recruteur (`FournisseurRapprochements`,
  `rapprochement_candidats`, « Correspondance possible » en rouge). À réutiliser pour le partenaire, sans
  ouvrir de donnée nouvelle ; accepter/refuser doit passer par les fonctions existantes.
- **Loi 25** : rien du partenaire sans consentement actif ; la lecture serveur le garantit athlète par athlète.
- **Tests** : `npm test` = 697 réussis / 0 échec (1 ignoré). `tsc` garde ses erreurs préexistantes (stripe, `RecruteurProfilMobile`,
  `AthleteRecruiterProfileBodyMobile` ligne ~897, etc.) : aucune nouvelle dans les fichiers touchés. Aucune vérification
  visuelle dans un navigateur n'a été faite : à passer à l'émulateur ou au navigateur avant le build.
- **Mac** : le dépôt principal `~/dev/Nexus` est sur `main` et a un fichier non suivi
  (`ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`), sauvegardé dans `~/nexus-backup/`. Le travail
  est dans le worktree `~/dev/nexus-145` ; le `.env.local` y a été copié (non commité).
