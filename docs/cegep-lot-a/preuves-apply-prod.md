# Lot A — preuves exigées à l'apply en prod

## Le cégépien témoin (2026-10-23, GO BP)

Un athlète réel, actif, qui avait déclaré son cégep en texte libre (`ecole_non_listee`), a été
rattaché à ce cégep : `athletes.school_id` seulement, la seule colonne que lit
`athlete_est_cegepien`. Trace : `admin_operations` `RATTACHEMENT_CEGEPIEN_TEST_LOT_A`
(ids seulement). On le retrouve ainsi, sans écrire son id :

```sql
select (details->>'athlete_id')::uuid from public.admin_operations
 where operation = 'RATTACHEMENT_CEGEPIEN_TEST_LOT_A' order by le desc limit 1;
```

Effets de bord constatés : `updated_at` et `profile_completion` (45 → 50, `school_id` compte
dans le calcul) recalculés par leurs triggers. Aucune notification, aucun journal, aucun appel
réseau (`recruiter_activity_log`, `activities`, `athlete_notifications`, `net.http_request_queue`
inchangés) ; `ecole_non_listee`, son compte `users` et les autres fiches inchangés (md5).

Avant l'apply (relevé 2026-10-23, sous vrai JWT) : c'est le seul cégépien en prod, et le
recruteur collégial le voit encore — lecture directe 1, `recruiter_search_athletes` 1, fiche 1.

## Ajout du 2026-10-25 : le journal recruteur (GO BP)

Trou trouvé : `recruiter_activity_log` recopie le nom du témoin chez **5 recruteurs collégiaux**
(1 ligne `NEW_ATHLETE` chacun, relevé prod 2026-10-25) ; sur mobile, toucher la ligne = roue sans
fin. C'est la seule table qui recopie un nom d'athlète et qu'un recruteur peut lire.

Ajouté à la même migration et au même rollback (base seulement, aucun écran) :
- policy RESTRICTIVE `cegepiens_masques_recruteurs` **FOR SELECT** sur `recruiter_activity_log`,
  même règle que les 5 autres — l'historique du recruteur collégial, le journal partagé de
  l'unité et la lecture par l'admin du cégep perdent les lignes d'un cégépien. Rien n'est effacé :
  admin et coach de l'athlète les lisent toujours, le rollback les rend.
- filtre à l'écriture dans `log_new_athlete`, `log_athlete_update`, `log_coach_reply` : plus
  d'entrée pour un cégépien chez un RECRUTEUR dont l'école ne voit pas les cégépiens.
  Corps rebasés sur la prod du 2026-10-25, garde md5 avant d'écraser :
  `log_new_athlete` 6fc96267…, `log_athlete_update` cda68b5c…, `log_coach_reply` 2fe3a0ef…
  (ACL d'origine, PUBLIC compris, vérifiée identique après).
- hors périmètre : `newsroom_events`, `activities`, tables admin/athlète/parent, écrans.

Le 2026-10-25, garde md5 relancée sur la prod : les 15 corps du lot A n'ont pas bougé depuis le
2026-10-20, aucune fonction-règle présente.

Preuves locales : `docs/cegep-lot-a/preuves-locales-20261025-journal.txt` — dormance identique ;
face à l'ancienne version du lot A, seul le journal change ; les 3 déclencheurs n'écrivent plus
chez le collégial pour un cégépien et écrivent toujours pour un athlète du secondaire ; rollback
à l'identique (1065 lignes d'empreinte du schéma public).

Migration md5 `ce98b188fac2feb9b50f066297e79e30`, rollback md5 `3ff81629983ee40ff2b8eb9155f0a5a6`.

## Rejeu à blanc en prod (journal compris)

Fichier : `docs/cegep-lot-a/prod/rejeu-blanc-20261025.sql`, généré par
`scripts/cegep-lot-a-rejeu-blanc.sh 20261025` (migration et rollback embarqués, gardés par leur
md5). Une seule transaction, `lock_timeout` 3 s, `statement_timeout` 60 s, finit par ROLLBACK.
Trop gros pour le connecteur (173 Ko) : **lancé par BP en psql**, pooler de session, sans `-1`.

Il mesure, sous le rôle de chaque compte (tous les recruteurs, un admin, un partenaire, le coach
du témoin et un autre coach, le témoin, son parent, anon), 15 surfaces AVANT → APRÈS migration →
APRÈS ROLLBACK, et compare l'empreinte du schéma public avant / après rollback.

Joué en local sur la pile mise dans l'état de la prod (2026-10-25) : écarts seulement chez les
recruteurs collégiaux et sans école ; journal du témoin 1 → 0 chez chaque collégial qui en avait
une ligne, admin inchangé ; rollback 0 cellule et 0 ligne d'empreinte différentes ; verrous tenus
environ 3 s ; recherche 3,3 → 3,9 ms.

### Résultat prod (2026-10-25, 22 h 00 → 22 h 01, lancé par BP en psql)

Sortie brute : `docs/cegep-lot-a/prod/rejeu-blanc-20261025.sortie.txt` (UTF-16, telle que
Tee-Object l'a écrite ; copie UTF-8 : `rejeu-blanc-20261025.sortie-utf8.txt`). Les accents
abîmés dans la sortie viennent de la console, pas de la base.

- **ROLLBACK fait.** Relu par le connecteur juste après : aucune fonction-règle, 0 policy
  `cegepiens_masques_recruteurs`, les 3 déclencheurs à leur md5 prod (cda68b5c, 2fe3a0ef,
  6fc96267), le journal compte toujours ses 5 lignes sur le témoin.
- **Rollback à blanc (rapport D) : 0 cellule différente, 0 ligne d'empreinte différente** sur
  1095 lignes (fonctions md5 + ACL + réglages, policies, déclencheurs du schéma public).
- **Comptes mesurés** : les 25 recruteurs (5 collégiaux, 1 collégial avec une ligne du témoin,
  12 admins de cégep, 4 admins de cégep avec une ligne du témoin, 2 sans école, 1 sans école
  désactivé), 1 admin, 1 partenaire, 1 coach, le témoin lui-même, anon — 15 surfaces chacun.
  Le témoin n'a ni coach sur sa fiche ni parent lié : ces deux comptes n'ont pas pu être mesurés.
- **Écarts seulement chez les recruteurs collégiaux et sans école** (rapport B) : admin,
  partenaire, coach, athlète, anon = 0 écart. Chez les 24 recruteurs actifs et le désactivé : le
  témoin disparaît de la lecture directe, de `recruiter_search_athletes` (190 → 189), de la fiche
  et des cartes ; `athletes` par ancrage perd seulement `CEGEP:1` (secondaire 140, civil 35,
  sans ancrage 22 inchangés). Les 3 recruteurs sans école ne voient plus le témoin (validé BP,
  attendu).
- **Journal du témoin (rapport C) : 1 → 0 chez les 5 comptes collégiaux** qui en avaient une ligne
  (a0000000, 74fc504e, 97ba8dc9, c9a63ff5, d8b80d58). L'admin de cégep 97ba8dc9 lisait aussi la
  ligne de son collègue a0000000 (2 → 0) : la lecture par l'admin du cégep est fermée en prod.
  **L'admin garde ses 5 lignes**, une par recruteur, avant, après et après rollback.
- **Matchs** (`matchs_recherche`, 30 j) : aucun écart. Équipes, badges, évaluations, vues de fiche,
  `athletes_targeting_my_cegep` : aucun écart — le témoin n'en a pas en prod ; ces surfaces sont
  prouvées en local (volets 1 à 4).
- **Coût** (rapport F) : `recruiter_search_athletes`, moyenne sur 25 recruteurs, **20,6 → 24,4 ms**
  (max 32,9 → 32,8), 20,1 ms après rollback.
- **Verrous** : tenus de 22 h 00 min 51,9 s à 22 h 01 min 18,6 s, soit **environ 27 s** (3 s en
  local). C'est surtout les mesures APRÈS et APRÈS ROLLBACK sous verrou ; l'apply réel ne
  contient que la migration et ne garde les verrous que le temps de celle-ci.

Rien n'est appliqué : la mise en prod réelle attend le GO de BP (prévue lundi 2026-10-26 en
journée).

## À prouver juste après l'apply (vrai JWT, jamais superuser)

| Compte | Lecture directe `athletes` | `recruiter_search_athletes` | `recruiter_athlete_profile` | Journal du témoin |
|---|---|---|---|---|
| Recruteur collégial (R1 Free et R2 Pro) | **0** (était 1) | **0** (était 1) | **0** (était 1) | **0** (était 1 chez les 5) |
| Recruteur sans école | 0 | 0 | 0 | 0 |
| Admin | **1** | — (réservé recruteur) | — | **5** (1 par recruteur, inchangé) |
| Partenaire | inchangé | — | — | 0 (aucun accès au journal) |

Plus : `athletes ancrés CEGEP` vu par le recruteur collégial = 0 ; ses athlètes secondaire,
civil et sans ancrage inchangés ; les matchs collégiaux toujours visibles ; coach, athlète et
`anon` identiques à avant ; le journal compte toujours ses 5 lignes sur le témoin (rien
d'effacé). Si le recruteur collégial voit encore le témoin : rollback
(`supabase/rollback/20261020190000_rollback_cegep_lot_a_base.sql`) sur GO.
