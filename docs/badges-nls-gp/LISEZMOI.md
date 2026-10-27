# Badges NLS + GP au catalogue du partenaire « Nexus »

Décision BP du 27 oct. 2026 : pas de nouveau partenaire, pas de migration. Les 10 badges
(5 NLS, 5 GP) entrent au catalogue du partenaire existant **« Nexus »** (compte
`bpdesfosses@gmail.com`, prod `f3751302-cdce-44a6-ac0d-bf4802968637`). Ce sont des
**données** : 10 PNG dans `partner-badges/<id Nexus>/` + 10 lignes `partner_badges` + 1 trace
`admin_operations` (`BADGES_NLS_GP_NEXUS`).

| Libellé | Fichier | Ordre | Source |
|---|---|---|---|
| NLS · Prospect / Top 50 / Top 25 / Top 10 / MVP | `nls-*.png` | 101 → 105 | Téléchargements, « Système de badges de distinction (5) » `export-nls-v2` |
| GP · Prospect / Top 50 / Top 25 / Top 10 / MVP | `gp-*.png` | 201 → 205 | Téléchargements, « Système de badges de distinction (8) » `export-gp` |

- PNG 512×512 transparents, copiés tels quels (md5 dans `preuves/local-apply.txt` et la sortie du
  script). Pas de SVG : le bucket n'accepte que PNG/WebP (un SVG servi peut porter du script).
- Logos NLS et GP **non utilisés** : un badge du catalogue Nexus n'a pas de logo d'organisation
  à lui ; le logo servira quand NLS aura sa fiche partenaire (`media_partners.logo_url`).
- Mobile : **aucune release**. L'app lit le catalogue et les icônes à l'exécution (RPC + URL
  publique du stockage), comme le web.

## Fichiers

| Fichier | Rôle |
|---|---|
| `images/` | les 10 PNG, noms stables |
| `televerser-icones.mjs` | étape 1 : dépose les PNG (jamais d'écrasement), relit chaque URL publique et compare le md5. Cible TOUJOURS donnée à la main (`NEXUS_URL`, `NEXUS_SERVICE_KEY`), jamais `.env.local` |
| `operation.sql` | étape 2, le cœur : vérifie partenaire + icônes (taille, image/png) + libellés libres, insère, écrit la trace |
| `retrait.sql` | l'inverse : SUPPRESSION si aucun des 10 n'a jamais été posé, sinon DÉSACTIVATION (`actif = false`, poses gardées) |
| `prod/rejeu-blanc.sql` | AVANT → ajout → contrôles → sondes de compte → retrait → contrôles → **ROLLBACK** |
| `prod/apply.sql` | AVANT → ajout → contrôles → **COMMIT** |
| `prod/rollback.sql` | AVANT → retrait → contrôles → **COMMIT** |
| `prod/controles-apres-ajout.sql` | contrôles communs (rien d'autre n'a bougé : catalogue, poses, partenaires, fichiers, admin_operations +1) |
| `parcours-local.mjs` | parcours navigateur local (refuse toute autre pile) |
| `preuves/` | sorties locales et captures |

Les trois fichiers `prod/` exigent `-v nexus_attendu=<uuid>` et s'arrêtent si le partenaire de
bpdesfosses n'est pas celui-là (mauvaise base). Ils commencent par `\encoding UTF8` ; les
libellés sont écrits en `U&'NLS \00B7 …'`, donc le « · » ne dépend pas de la console.

## Preuves locales (27 oct.)

Pile jetable **NexusBadges** (`C:\tmp\nexus-badges-pile`, API :56321, base :56322), copie
`pg_dump` de la base locale :54322, lue sans y écrire. Les 5 fonctions de badges partenaire y
ont le **même md5 qu'en prod** (sans les `\r`). bpdesfosses et « Nexus » y ont été créés comme
en prod (Football permis, badge « Test Nexus Partenaire »).

- `preuves/local-rejeu-blanc.txt` : REJEU OK. bpdesfosses voit 5 NLS + 5 GP (11 au total),
  un autre partenaire 0. Retrait en SUPPRESSION, état identique à AVANT, ROLLBACK.
- `preuves/local-gardes.txt` : arrêts prouvés : mauvaise cible, `-v` manquant, une icône
  absente, ajout rejoué deux fois.
- `preuves/local-apply.txt` : COMMIT local, 10 lignes, trace écrite.
- `preuves/local-rollback-annule.txt` : `prod/rollback.sql` joué avec son COMMIT remplacé par
  ROLLBACK (la ligne « COMMIT fait » affichée vient du `\echo` final, rien n'a été gardé) : mode
  DÉSACTIVATION (2 poses retirées existaient), contrôles passés. Le mode SUPPRESSION est prouvé
  dans le rejeu à blanc.
- `preuves/1-choix-mes-badges.png`, `2-fiche-nls-et-gp.png` : bpdesfosses coche NLS · Top 10
  et GP · MVP dans « Évaluer » → la fiche montre les deux. Poses retirées ensuite.

## Ton test local (5 minutes)

Le serveur tourne sur **http://localhost:3110** (worktree `C:\tmp\nexus-badges`, `.env.local`
de ce worktree = pile locale NexusBadges, jamais la prod). S'il est arrêté :
`cd C:\tmp\nexus-badges` puis `npx next dev --port 3110`.

1. Va sur http://localhost:3110/auth et connecte-toi : `bpdesfosses@gmail.com` / `Badges-Local-2026`
   (mot de passe de la pile locale seulement).
2. Ouvre http://localhost:3110/partenaire/athletes/47f8dced-6338-4727-bafe-75affac53067
   (« Alex Démo-Partenaire », profil fictif).
3. Clique **Évaluer**. Sous « Mes badges », coche **NLS · Top 10** et **GP · MVP**.
4. Clique **Enregistrer les badges**. La fiche montre les deux badges à côté de la carte.
5. (Facultatif) « Retirer le badge » sous chacun pour remettre à zéro.

## Prod — sur ton GO seulement (la session cégep C1 doit avoir fini)

Depuis `C:\tmp\nexus-badges` :

1. **Icônes** (constat d'abord, puis envoi) :
   ```
   $env:NEXUS_URL = "https://nrloizyemulbhujrqhgx.supabase.co"; $env:NEXUS_SERVICE_KEY = "<clé service_role prod>"
   node docs/badges-nls-gp/televerser-icones.mjs --partenaire f3751302-cdce-44a6-ac0d-bf4802968637
   node docs/badges-nls-gp/televerser-icones.mjs --partenaire f3751302-cdce-44a6-ac0d-bf4802968637 --envoyer
   ```
   Attendu : 10 lignes « déposé … = dépôt » puis « OK ». Tant que l'étape 2 n'est pas faite,
   ces fichiers ne s'affichent nulle part (aucune ligne ne les cite).
2. **Rejeu à blanc** :
   `psql "<connexion prod>" -X -v nexus_attendu=f3751302-cdce-44a6-ac0d-bf4802968637 -f docs/badges-nls-gp/prod/rejeu-blanc.sql`
   Attendu : `bp_voit_nls 5 | bp_voit_gp 5 | bp_total 11 | autre_partenaire_voit 0`, « REJEU OK », ROLLBACK.
3. **Apply** (même commande, `prod/apply.sql`). Attendu : 11 lignes listées, COMMIT.
4. **Test prod** : même parcours qu'en local, sur un profil de TEST en **Football ou Flag
   football** (les sports permis à Nexus en prod), ACTIF, avec l'opt-in partenaire.
   Rappel : poser un badge envoie une notification push à l'athlète du profil.

**Rollback** (sur GO) : `prod/rollback.sql` avec le même `-v`. Si aucun des 10 n'a été posé :
les lignes sont supprimées, puis `televerser-icones.mjs … --retirer` enlève les fichiers. Sinon :
les 10 sont désactivés (invisibles partout) et les fichiers restent, parce que des poses les citent.

## Plus tard : déplacer les 5 badges NLS vers le partenaire NLS (NE PAS FAIRE MAINTENANT)

Quand NLS aura son compte et sa ligne `media_partners` (APPROUVÉE, sports permis posés) :

1. **Fichiers** : copier les 5 `nls-*.png` de `<id Nexus>/` vers `<id NLS>/`
   (`storage.from('partner-badges').copy(...)`, ou `televerser-icones.mjs` adapté). Le dossier
   doit être celui du partenaire : `admin_enregistrer_badge_partenaire` l'exige.
2. **Une transaction SQL** (rejeu à blanc → apply, même modèle que ce dossier) :
   - les 5 ids NLS = `admin_operations` `BADGES_NLS_GP_NEXUS` → `details.badge_ids`, filtrés sur
     `libelle like 'NLS · %'` ;
   - `update partner_badges set partner_id = <NLS>, icone_path = '<NLS>/' || fichier` sur ces 5
     (libellé à garder ou à raccourcir en « Top 10 »… : à décider ; unique par partenaire) ;
   - **et** `update partner_athlete_badges set partner_id = <NLS> where partner_badge_id in (ces 5)`,
     poses retirées comprises. Cette colonne est indispensable : la lecture
     (`badges_partenaires_athlete`), le retrait (`retirer_badge_partenaire`) et « Mes athlètes »
     lisent le partenaire de la **pose** (`x.partner_id`), pas celui du badge. Si on l'oublie, la
     fiche afficherait encore « Nexus » et NLS ne pourrait pas retirer ses propres poses ;
   - gardes : NLS APPROUVÉ, 5 lignes exactement de chaque côté, rien d'autre ne bouge ; trace
     `BADGES_NLS_DEMENAGES` (ids, ancien et nouveau partenaire, nombre de poses).
   - Aucune notification : le push ne part qu'à l'INSERT d'une pose, pas à l'UPDATE.
   - `attribue_par` reste bpdesfosses sur les poses existantes (c'est l'historique vrai).
3. Après vérification sur la fiche : retirer les 5 anciens fichiers du dossier Nexus.

## À part — points relevés, hors de cette tâche (décision BP)

1. **GP sur un profil de test = visible par tous ceux qui ouvrent ce profil.** Il n'y a plus de
   restriction « moi seulement » : un recruteur, le coach ou l'athlète de ce profil voient le
   badge GP. Un profil de test ACTIF avec l'opt-in partenaire peut aussi sortir dans la recherche
   recruteur. À garder sur des profils qu'aucun vrai compte ne consulte.
2. **Notification push à la pose** (`push_sur_badge_partenaire`) : l'athlète du profil reçoit
   « nouveau badge » au nom de Nexus. Sans conséquence sur un profil de test sans appareil.
3. **Bucket `partner-badges` listable sans connexion** : la règle « partner badges read »
   (SELECT pour `public`) permet de lister le bucket via l'API. Les fichiers GP y seront donc
   trouvables par quelqu'un qui cherche. Une URL publique fonctionne sans cette règle ; la
   réserver à l'admin fermerait la liste sans casser l'affichage (migration, à part).
4. **« Déjà par »** (`partenaire_badges_nexus_admissibles`) : ne concerne que les badges du
   catalogue Nexus posés par un partenaire (W3b), pas les badges NLS/GP. Rien à faire ici.
