# Notifications d'intérêt recruteur — lots A et B (2026-10-29)

Branche `feat/notif-interet-recruteur` (depuis origin/main `d4c36982`), worktree `C:\tmp\nexus-notif-interet`.
Migration `supabase/migrations/20261029170000_notif_interet_recruteur.sql`,
rollback `supabase/rollback/20261029170000_rollback_notif_interet_recruteur.sql`.
**Rien en prod, aucun commit sans GO de BP.**

## Ce qui part

| Événement | Push / cloche | Clé (groupe) |
|---|---|---|
| Favori, ajout à une liste, entrée au processus (recruteur ACTIF) | « Ton profil a été ajouté à une liste » — cloche `ADDED_TO_FAVORITES` | `ajout:<athlète>:<txid>:<instruction>` — un geste = un push |
| 1re vue du jour d'un recruteur ACTIF | « Ton profil a été consulté » ; 2+ avant l'envoi : « … consulté N fois » — cloche `PROFILE_VIEWED` | `vue:<athlète>:<jour d'envoi>` — un push par jour ; une vue de 22 h ou plus compte pour le lendemain |

- **Texte unique**, aucune source : jamais de nom de recruteur, de cégep ni de région (`push_textes` ignore la source).
  Titre du **push** : « Nexus » (approuvé par BP) ; la **cloche** garde la phrase pour titre.
- **Un geste = un push** : favori + processus (`fav_insert_to_pipeline`), ou processus + listes d'une fusion de carte,
  sont une même instruction. Retirer puis remettre un favori renotifie.
- **Ne comptent pas** : rejoindre le dossier déjà ouvert de l'unité (`nexus.sync_unite`), le processus créé par un
  message à l'athlète (`RECRUTEUR_ATHLETE` : le push du message suffit). Un message au coach compte.
- **Plafond « vue »** : après l'envoi du jour, une nouvelle vue réécrit la notification du jour (compte du jour,
  recruteurs actifs seulement) et la remet à non lue — sans 2e push.
- **Gardes** : recruteur `ACTIF`, fiche avec compte. Pas de retenue pendant le black-out. Aucun écran de préférences.
- **Heures calmes : 22 h 00 – 7 h 59, heure de Montréal, pour tout ce qui passe par `push_heure_calme()`** — la file
  (badges, évaluations, cartes, vues, ajouts), le consentement partenaire, le push parent de contact. Le push attend
  8 h (il n'est pas perdu) ; la cloche s'écrit tout de suite. Une nuit de vues = UN push à 8 h, au bon compte.
  **Hors de cette horloge** (envoi direct par `push_to_user`, jamais retardé) : messages (`notify_on_message`),
  premier contact recruteur (`notify_first_recruiter_contact`), prise en charge et refus d'école
  (`claim_school_athletes`, `reject_school_athlete`). Non modifiés par ce lot : chantier « pushs directs dans la file / heures calmes » (`docs/fast-follow-1.4.2.md`).
- **Ancienne cloche favori** (`trg_notify_favorited`, texte avec région, migration `20261028120000`) : débranchée,
  la fonction reste pour le rollback.
- **Apps** : aucune mise à jour requise. 1.4.4 ouvre l'accueil ; 1.4.5 envoie un `nx_type` inconnu vers
  `/athlete/notifications`. Les deux types de cloche existent déjà dans les apps.
- **Web** : `app/athlete/notifications/page.tsx` — icône « liste » au lieu du cœur pour `ADDED_TO_FAVORITES`.

## Pile dédiée `NexusNotif` (ports 563xx)

La pile `:54321` n'est pas touchée. Le rejeu complet des migrations échoue (migration de données propre à la prod,
`20260825020802`), donc la pile porte **le schéma de la prod** :

1. `supabase/config.toml` du worktree : `project_id = "NexusNotif"`, ports 563xx, migrations et seed désactivés.
   **Modification locale, à ne pas commiter.**
2. `pg_dump --schema-only` de `public` et `nexus_prive` (prod, lecture seule) + données de 4 référentiels sans
   donnée personnelle (`sports`, `positions`, `badges`, `app_settings`).
3. Fidélité vérifiée : `etat-objets.sql` rend `bba20215160886b637ed628bbe4fa293|51` en prod ET en pile dédiée
   (et mêmes nombres de fonctions, déclencheurs, politiques, tables).
4. `fixtures-pile-dediee.sql` : comptes synthétiques (`exemple.test`, `demo.local`, `preuve.local`), validés dans
   la pile dédiée seulement (garde : refuse toute base qui a déjà des comptes).

## Preuves (pile dédiée, transactions annulées)

Migration md5 `728c0778d678cfbea89870c707ba098f`, rollback md5 `ddf0543770d89fa5bfbce21e691f1f4e`.

- `tests-notif-interet.sql` → `tests-notif-interet-resultats.txt` : **48/48**. Heures calmes : 21 h 59 part,
  22 h 00 attend, 7 h 59 attend, 8 h 00 part ; 3 vues la nuit → UN push à 8 h « consulté 3 fois » ; ajout la nuit →
  cloche tout de suite, push à 8 h ; badge du coach de 22 h 45 → 8 h ; parent : 21 h 59 part, 22 h 00 et 7 h 59
  attendent, 8 h 00 part. Rejoué sans la migration : 12/48 (rien n'est branché).
- Banc A5 : `adapter-banc-a5.py` écrit une copie adaptée (`tests-push-a5-adapte-avant.sql` / `-apres.sql`) ;
  le fichier d'A5 n'est pas modifié. Adaptations : (1) verrou de lancement collégial C0, (3) tri constant de D3,
  (4) porte B1 sur K2/K3 — toutes indépendantes de ce chantier ; (2) H3 : 21 h n'est plus calme.
  - avant migration : 89/89 (`tests-push-a5-avant-resultats.txt`) ; après : **89/89** ; après rollback : 89/89 ;
  - contre-épreuve : la version « avant » sur base migrée échoue sur H3 seulement.
- État des objets : avant = prod `bba20215160886b637ed628bbe4fa293|51` ; après `619e5f2e9620c07c15d7fb66b9388f80|59` ;
  après rollback `bba20215…|51` ; 2e envoi refusé (« déjà appliquée »), état inchangé.
- Aucun résidu après les bancs (file, envois, notifications, vues, favoris, processus, avis parent, Vault : 0).
