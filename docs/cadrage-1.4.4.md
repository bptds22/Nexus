# Cadrage 1.4.4 — tout ce que le web a reçu depuis la 1.4.3

Relevé du 2026-10-01. Plage : `0ab5fc8` (publication 1.4.3) → `origin/main`
`0b1a73b7`, soit 175 commits (150 hors fusions, 25 fusions), 259 fichiers.
Plus la branche `feat/flux-agenda` (flux d'agenda, non fusionnée au moment du
relevé). Lecture git seule ; les sections « pour le lot mobile » du registre
(`docs/fast-follow-1.4.2.md`) sont citées par numéro.

**Migrations** : les 25 du lot sont en prod. Une seule dérive de nom :
`20260922171500_cibles_rpc_recruteur_et_index` est appliquée en prod sous la
version **`20260923022857`** (vérifié en lecture le 2026-10-01) ; le fichier du
dépôt n'a jamais été renommé. À renommer, rien à appliquer.

## A. Fonctionnalités web et état mobile

| # | Fonctionnalité | État mobile | Registre |
|---|---|---|---|
| 1 | Tableau blanc par unité (cégep × sport) : processus, favoris, listes, notes signées (fil par joueur), historique signé, retrait de favori pour l'unité | **Absent** — l'app lit/écrit ses propres lignes ; compatible (rien ne fuit), juste « moins partagé » | §38–§41 |
| 2 | Mon processus en vue tableau (cellules éditables, tri, colonnes Promotion/Division/Note de suivi) | Web seulement par nature ; pastille de relance déjà sur mobile | — |
| 3 | Règle de visite (`regleVisite`) : la date survit jusqu'à Lettre signée | **Partiel** — la fiche mobile l'a (code partagé) ; le kanban mobile (`useUpdatePipelineStage`) efface encore `visit_at` hors VISITE, ce qui l'efface pour toute l'unité | §38 |
| 4 | Panneau Actions / Infos / Historique dans Mon processus | **Absent** — la feuille mobile n'a qu'« Actions » | — |
| 5 | Export de Mon processus (.xlsx, journalisé) | **Absent** — bouton « Bientôt » désactivé | décision |
| 6 | Nouveau tableau de bord : entonnoir, 4 tuiles « Mon activité », indicateurs messagerie, entonnoir et fil d'unité | **Partiel** — entonnoir personnel + 3 KPI + Relances du jour ; manquent les tuiles, « Te ciblent », l'unité | — |
| 7 | « Te ciblent » : tuile, filtre de recherche, pastille de fiche ; phrase de divulgation côté athlète | **Absent** — y compris la phrase de divulgation dans `MonParcoursMobile` (écart de divulgation, pas du poli) | — |
| 8 | Calendrier à trois types (matchs, visites, relances) + filtres mémorisés + liste chronologique, par unité | **Partiel** — matchs seulement, cibles personnelles | §42 |
| 9 | Calendrier réservé au Pro | **Déjà sur mobile** | — |
| 10 | Cartes prospect (lot C) : création, notes signées, journal, invitation automatique, purge 12 mois | **Absent** — compatible 1.4.3 (prouvé) | §44 |
| 11 | Carte rattachée à l'établissement sans équipe | **Absent** | §58 |
| 12 | États d'invitation + rappel (1/7 j, max 3) | **Absent** | §59 |
| 13 | Parent sur la carte | **Absent** | §60 |
| 14 | Propositions carte ↔ profil (lot D) | **Absent** | §56 |
| 15 | Fusion carte → profil + annulation 7 j (lot E) | **Absent** | §57 |
| 16 | Verrou cégep/sport recruteur + Mon profil / Paramètres (Loi 25, sauvegarde par section, export réel) | **Absent — risque vivant** : `RecruteurProfilMobile` renvoie cégep et sport (tout l'enregistrement tombe en 42501 s'ils changent) ; `RecruteurParametresMobile` reconstruit `privacy_preferences` et fabrique des dates | §61, §62 |
| 17 | Sport recruteur = `users.sport_id` (liste `SPORTS_PROPOSES`) | **Partiel / risque** — 27 sports codés en dur dont 6 hors base ; « Autre » à l'onboarding | §37 |
| 18 | Retouches de la fiche recruteur (statut en place, verrous gratuits Médias / Parcours) | **Partiel** — vérifier le verrou gratuit de `TeamHistoryBlock` | — |
| 19 | Écriture de favori partagée | Déjà dans le code mobile (part avec le build) | — |
| 20 | Non-lus recruteur : une seule définition | **Partiel** — `MobileTabBar` compte encore les archivées | §43 |
| 21 | Auto-évaluation = proposition (D6 volet 6) | Déjà sur mobile (petit écart : refus machine affiché « en attente ») | — |
| 22 | Visibilité partenaires = consentement distinct | **Absent / cassé** — `AthleteParametresMobile` écrit en direct, refusé depuis le 2026-09-09 ; consentement adulte perdu à l'onboarding mobile | §49, §50 |
| 23 | Relance parents (consentement partenaires) | Web seulement par nature | — |
| 24 | Rôles figés (PARENT/PARTNER/ADMIN) | Couvert côté serveur | — |
| 25 | Page démo `/12octobre` + admin | Web seulement par nature | — |
| 26 | Admin : comptes, `admin_operations` | Web seulement par nature | — |
| 27 | Barre latérale = vrai profil ; purge à la déconnexion | Partagé, part avec le build | — |
| 28 | Portes de forfait « Chargement… » | Partagé, part avec le build | — |
| 29 | Correctifs mobiles déjà commités après la 1.4.3 (mot de passe oublié, calendrier RSEQ .xlsx Android, marge de la barre d'onglets, lien relances, programmes canoniques) | Dans le code — **test appareil** requis | — |
| 30 | **Flux d'agenda** (« S'abonner à mon agenda ») — branche `feat/flux-agenda` | Le flux marche sans rien faire (servi par le web) ; exposer le panneau dans l'app | §63 |

## B. « Changer l'année de naissance » — à préciser par BP

Aucun champ « année de naissance » n'existe : seulement `athletes.date_naissance`
(date complète). Aucun commit de la plage n'y touche. Elle est **verrouillée pour
l'athlète après l'onboarding depuis avant la 1.4.3** (migration
`20260921173234`), en lecture seule sur le web ET déjà sur le mobile 1.4.3 —
le §30 est périmé sur ce point. Coach et admin la modifient sur le web.

Sens possibles :
- (a) ajouter sur mobile la phrase « écris à info@ » (S) ;
- (b) rendre la date (ou l'année) modifiable par l'athlète — contraire à la
  décision Loi 25 du 2026-09-21, migration + décision ;
- (c) donner au coach un moyen mobile de la corriger (nouvel écran, risque §31.1) ;
- (d) construire l'option B du §31 (signalement + consentement parental après
  onboarding, M/L) ;
- (e) il s'agit en fait de la **Promotion** (`annee_diplomation`), un autre champ.

## C. Découpage en lots (ordre)

Aucun lot n'exige de nouvelle migration : tout ce qu'ils lisent est en prod.

| Lot | Contenu | Dépend de | Taille | Décision / note |
|---|---|---|---|---|
| **0. Compatibilité + Loi 25** (d'abord) | §61/§62 (Mon profil + Paramètres mobile, réutiliser `lib/recruteur/parametres.ts`) ; §37 `SPORTS_PROPOSES` ; §50 RPC `set_my_partner_visibility` ; §49 consentement adulte ; §43 barre d'onglets ; phrase de divulgation « Te ciblent » ; verrou gratuit Parcours d'équipes ; test appareil des correctifs déjà commités | — | M | corrige des refus que vivent les utilisateurs 1.4.3 aujourd'hui |
| **1. Tableau blanc mobile** | lectures par unité, écritures `unite_*`, retraits avec confirmation nommant les collègues, notes signées (`FilNotesSuivi`), retrait de l'onglet Notes de liste, `regleVisite` au kanban, signatures dans Activités | 0 | L | comment montrer « Suivi par » et les confirmations dans une feuille |
| **2. Feuille Actions / Infos / Historique** | onglets dans la feuille du processus | 1 | M | adapter les sections de la fiche mobile |
| **3. Tableau de bord + Te ciblent** | 4 tuiles, « Mon activité », entonnoir d'unité, filtre et pastille | 1 | M | — |
| **4. Calendrier à trois types + agenda** | visites et relances d'unité, puces de type, liste chronologique ; panneau « S'abonner à mon agenda » | 1 | M | palette §42 |
| **5. Cartes prospect — lecture et suivi** | cartes dans processus/listes/calendrier, panneau, notes, relance, étape, rappel | 1, 2 | L | **création de carte sur mobile maintenant ou plus tard ?** |
| **6. Propositions + fusion** | `rapprochements_unite()`, bandeau, côte à côte, refus, fusion, annulation 7 j | 5 | M | gérer chaque `critere` avec un cas par défaut |
| Hors périmètre / à décider | vue tableau (web), export xlsx (retirer « Bientôt » ou construire), Mon CÉGEP admin (bureau), admin/démo/relance parents (web), année de naissance (§B) | — | — | — |
