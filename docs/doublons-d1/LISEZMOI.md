# Lot D1 — empêcher les nouveaux doublons d'athlètes (web)

Branche `feat/doublons-d1`, **local seulement**. Migration `20261015094834_d1_doublons_athletes.sql`
appliquée en **local** ; **rien en prod** (attend le GO de BP). Les 4 doublons existants ne sont
pas touchés : la file naît vide (garde de la migration).

## Ce qui change

| Où | Quoi |
|---|---|
| Base | `doublons_probables` : file de l'admin, RLS sans politique, aucun droit pour anon/authenticated. Une ligne par paire. |
| Base | Trigger `trg_doublons_probables_noter` (AFTER INSERT/UPDATE nom, date, statut sur `athletes`) : même nom normalisé (`nexus_normaliser_nom`) + même date de naissance qu'une fiche ACTIVE → la paire est notée. **Ne bloque jamais** (erreur interne → WARNING). Couvre tous les chemins, y compris l'appli mobile déjà publiée. |
| Base | `inscription_doublon_possible(prénom, nom, date)` → `'COMPTE'`, `'FICHE_COACH'` ou rien. Réservée à un compte ATHLETE en cours d'inscription. Ne rend **rien** de l'autre fiche. **Anti-énumération** (décision BP 2026-10-15) : 3 vérifications par compte, puis toujours « aucun doublon » sans même chercher ; verrou par compte contre les appels simultanés. |
| Base | `doublons_verifications` : journal de CHAQUE appel (compte, n° d'appel, résultat : AUCUN / COMPTE / FICHE_COACH / LIMITE / HORS_INSCRIPTION, date). Ni nom ni date cherchés. Admin seulement, purge à 180 jours (pg_cron `doublons-verifications-purge`). |
| Base | `coach_athletes_meme_identite(prénom, nom, date)` en **SECURITY INVOKER** : la RLS décide. Le coach ne reçoit que des fiches qu'il pouvait déjà ouvrir. |
| `/auth` (inscription, tous rôles) | « Voulais-tu dire …@gmail.com ? » en quittant le champ ou au clic sur Continuer (`lib/auth/suggestionCourriel.ts`). « Non, elle est bonne » laisse passer. |
| `/athlete/onboarding` | Au « Suivant » de l'étape 1 : « Tu as peut-être déjà un compte. Connecte-toi avec ton autre adresse, ou continue. » — ou, si l'autre fiche vient d'un coach : « Ton entraîneur a peut-être déjà créé ta fiche. Demande-lui le lien d'invitation pour la récupérer, ou continue. » Une fois par visite ; « Continuer » enregistre normalement. Sous la grille des sports : « Tu joues dans plusieurs sports ? Ajoute une équipe à ta fiche, pas un 2e compte. » |
| `/coach/athletes/create` | Courriel exact d'un invitable tapé sans cliquer → bascule vers l'invitation. Même nom + même date d'une fiche **visible** → « Cet athlète existe déjà » + Voir sa fiche (+ invitation si compte, pas à lui). Sinon : rien n'est dit, la fiche se crée, la paire va dans la file. Erreur d'unicité du courriel traduite. |

Le second message (« ton entraîneur… ») est un ajout au texte demandé : dire « connecte-toi avec ton
autre adresse » à un jeune qui n'a jamais eu de compte serait faux.

## Preuves (local, 2026-10-15)

- `tests-d1.sql` → `tests-d1-resultats.txt` : **33/33**, transaction annulée (dont 10 pour la limite
  de 3 appels et le journal). Faux positifs (même date,
  noms différents ; même nom, autre date), Loi 25 (coach A ne voit pas le mineur d'une autre école ;
  il crée la fiche sans erreur ni message ; il ne lit pas la file ; la paire est notée), accents /
  trait d'union / casse, fiche désactivée, appelants refusés (anon, coach, athlète déjà inscrit).
- `outils/captures-d1.mjs` → `captures/` + `captures-resultats.txt` : navigateur sans interface,
  bureau et mobile, comptes et fiches jetables retirés à la fin (file vide, 11/11 fiches du coach).
  Aucune erreur JavaScript.
- `npm test` 453/453 (1 sauté, préexistant) ; `tsc` : 176 erreurs avant comme après, aucune dans
  les fichiers du lot ; `next build --webpack` OK.

## Application en prod — par le connecteur, preuve locale faite

`prod/construire-lot.mjs` fabrique `prod/lot-prod.sql`, le texte EXACT envoyé en UN appel :
relevé avant → garde « une seule transaction / D1 absente » (avant toute écriture) → le fichier
de migration octet pour octet → enregistrement de la version → gardes finales (md5 du texte
enregistré = fichier testé ; **empreinte des objets créés = celle mesurée en local** ; aucune fiche
athlète changée) → un résultat JSON avant/après.

`prod/preuve-locale.ps1` → `prod/preuve-locale.txt` (même texte, envoyé en un message par
`prod/un-message.sh`) :
1. garde finale volontairement fausse → **tout annulé** (tables, fonctions, trigger, purge, version : 0) ;
2. instructions envoyées une à une → arrêt **avant toute écriture** ;
3. lot réel → appliqué, empreinte identique, md5 enregistré = md5 du fichier ;
4. second envoi → refusé, rien ne change ;
5. tests au banc sur la base issue du lot → 33/33.

Le connecteur ne joint que le projet cloud ; ce qui ne peut pas être prouvé en local (qu'il
envoie bien un seul message) est vérifié **par le lot lui-même** en prod : sinon la garde 2 arrête
tout avant la première écriture. Une erreur de recopie du texte est arrêtée par les gardes finales.
Retrait d'urgence : `rollback-d1.sql`.

## Point 4 — les 9 fiches sans prénom ni nom (diagnostic prod, lecture seule)

- **Chemin : connexion Google + appli mobile, les 9.** Aucune Apple, aucune par courriel.
  Google ne fournit que `full_name` / `name` (pas de `given_name` / `family_name`, vérifié dans
  `auth.identities`), et `users.first_name` reste vide.
- **Pourquoi le nom manque :** `AthleteOnboardingMobile` ne demande plus le prénom ni le nom (son
  écran 1 n'exige que le sport et l'école). Il compte sur l'inscription pour les fournir : le
  courriel les donne, Apple aussi (`lib/auth/social.ts` les écrit au 1er login), **Google non**.
  Le web, lui, les exige à l'étape 1 — d'où 0 cas web.
  Créées du 2026-08-03 au 2026-10-07 ; 35 autres comptes athlètes Google ont un nom (web, ou une version de l'appli qui le demandait).
- **Correction proposée (non codée) :**
  1. Appli (lot mobile) : si prénom ou nom manque après l'inscription, afficher les deux champs à
     l'écran 1, **pré-remplis** en coupant `full_name` (premier mot / reste), obligatoires.
  2. Sans build : au rattachement Google, découper `full_name` vers `users.first_name/last_name`
     quand ils sont vides (même endroit que la persistance Apple) — ou un trigger de base qui le
     fait à la création du compte.
  3. Les 9 fiches existantes : leur proposer de compléter à la prochaine ouverture (bandeau
     « Ajoute ton nom »), ou les remplir depuis `full_name` par une opération admin sur GO — ce sont
     des mineurs, la seconde option écrit dans leur fiche sans leur geste.
  Tant que ce n'est pas fait, **ces fiches échappent au contrôle de doublons** (pas de nom à comparer).

## Point 5 — mobile

- **Déjà protégé, sans build :** la file de l'admin (trigger) reçoit aussi les créations de l'appli
  publiée — inscription et assistant coach.
- **Attend le build (registre §89)** : avertissement à l'inscription, suggestion de courriel,
  bascule du courriel exact et « cet athlète existe déjà » dans l'assistant coach, message d'erreur
  traduit. Les briques sont dans `lib/` et prêtes.
- On ne peut pas faire **avertir** l'appli publiée depuis la base : elle n'appelle pas les nouvelles
  fonctions. Bloquer côté base serait possible, mais contraire au choix « avertir, jamais bloquer ».

## À savoir

- La file n'a pas encore d'écran admin : lecture par SQL (`select * from doublons_probables`).
  Page admin + fusion = lot suivant.
- La file ne contient que des identifiants de fiches (suppression en cascade avec la fiche).
- `doublons_probables` n'est pas encore dans l'export `/admin/loi25` : à ajouter avec la page admin.
