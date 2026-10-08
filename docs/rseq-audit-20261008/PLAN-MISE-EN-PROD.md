# Plan de mise en prod — veille RSEQ v2

> ✅ **APPLIQUÉ EN PROD le 2026-10-08 (GO BP), fenêtre avancée au jour même.**
> - Fusion locale de `fix/veille-rseq-decouverte` (avec `audit/rseq-diffusion-20261008`) dans `main` : `49f17387`.
>   Tests : 375 sur 376 OK, 1 ignoré. Build : EXIT=0.
> - Migrations : A `20261008204908`, B `20261008204931`, C `20261008204958`, D `20261008205120`,
>   E `20261008205208`. Les md5 des fonctions et de la vue sont identiques au local. Empreintes hors lot
>   inchangées à chaque étape.
> - Réparation unique : 18 côtés en 2026-2027, tous en catégorie (a), réalignés à 20:53:32 UTC, avec 1 ligne
>   `admin_operations` `REPARATION_RSEQ_IDS_COTES`. `team_ids_md5` inchangé (`385267af…`).
>   Fichiers : `scripts/veille-rseq/reparation/prod-20261008/`.
> - Fonction v12, déployée depuis `main` avec `--no-verify-jwt` ; 403 sans secret.
>   **Essai réel, découverte tranche 3** : DONE en 251 s, 311 appels, 521 ligues (87 collégiales), 0 équipe
>   créée. Catalogue : 347 → 697.
> - Crons : migration `20261008205948` (`scripts/veille-rseq/prod/`). Les 2 anciens sont retirés et les 7
>   nouveaux actifs ; `rseq-veille-hebdo` est inchangé.
> - **Non traité** : 1 371 côtés incohérents en 2025-2026, saison passée, hors périmètre de la réparation.
>   Décision à BP.
> - Rollback de la fonction : v1 = `supabase/functions/rseq-weekly-sync/index.ts` au commit `4322adc7`.


Branche `fix/veille-rseq-decouverte`. **Chaque étape attend le GO de BP.** La base passe TOUJOURS avant la
fonction, et la fonction avant les crons.

Heures en UTC et à Montréal (HAE, UTC−4, jusqu'au 2026-11-01 ; ensuite HNE, UTC−5). pg_cron tourne en UTC.

## Fenêtre visée
**Vendredi 2026-10-09, de 10:00 à 12:00 à Montréal (14:00 à 16:00 UTC).**
- Pourquoi ce jour :
  - aucune exécution RSEQ n'est programmée le vendredi en v1 ;
  - il y a deux jours de marge avant la première découverte v2 (dimanche 07:55 UTC) ;
  - le mercredi suivant est loin.
- Repli : **samedi 2026-10-10**, même plage horaire. Pas lundi 2026-10-12, Action de grâce et découverte
  tranche 2 à 07:55 UTC.
- Jamais le mardi (découverte v1 à 07:55 UTC). Jamais le mercredi avant 5 h (passes v1 à 07:55 et
  08:10 UTC).
- Tout doit être terminé **avant dimanche 2026-10-11, 07:55 UTC**. C'est donc bien avant la passe du
  mercredi 2026-10-14.

## 0. Pré-vol (lecture seule, le jour même)
- **Aucune exécution en cours** : `select * from rseq_sync_runs where statut = 'RUNNING'` doit rendre 0.
- **Les objets visés sont dans l'état attendu** (md5) :
  - `rseq_sync_apply_games` = `802495b4…` ;
  - `rseq_sync_detect_teams` = `cf4b292d…` ;
  - `pg_get_viewdef(rseq_ligues_a_appeler)` = `f6c8bc2a…` ;
  - `rseq_codes_sport` absente ;
  - contraintes de `rseq_sync_runs` = `mode_chk` et `pkey` seulement.
- **Les crons sont dans l'état attendu** : exactement `rseq-decouverte-secondaire 55 7 * * 2`,
  `rseq-veille-hebdo 55 7 * * 3` et `rseq-veille-secondaire 10 8 * * 3`.
- **Empreintes de non-régression** (`scripts/veille-rseq/empreintes-schema.sql`) : fonctions, policies,
  triggers, droits des tables et vues, hors objets du lot. Elles sont refaites après chaque migration.

## 1. Migrations A → E
Chacune par un `apply_migration` séparé, renommée à sa version prod, avec son gate et ses relevés avant
et après.

| Étape | Fichier | Compatible avec la fonction v1 encore déployée ? |
|---|---|---|
| A | `20261008204908_rseq_codes_sport.sql` | oui (table nouvelle, non lue par la v1) |
| B | `20261008204931_rseq_sync_runs_tous_tranche.sql` | oui (la v1 écrit `Secondaire`/`Collégial`, `tranche` NULL) |
| C | `20261008204958_rseq_ligues_a_appeler_tranches.sql` | oui (la v1 lit un sous-ensemble des colonnes ; filtre plus strict) |
| D | `20261008205120_rseq_equipes_proposees.sql` | oui (même signature, payload enrichi) |
| E | `20261008205208_rseq_apply_games_rseq_ids.sql` | oui (même signature ; l'upsert réécrit en plus les `rseq_team_id`) |

Chaque migration est donc sûre seule, et la v1 continue de tourner normalement entre deux étapes.

**Rollback de l'étape 1**, dans l'ordre inverse E → A : fichiers de `supabase/rollback/`, chacun dans
une transaction avec gate.
- E, D et C remettent les fonctions et la vue au md5 exact de la prod d'avant.
- B retire la contrainte et la colonne. A retire la table.
- Testé sur `nexus_copie` : empreintes identiques à l'état d'avant.
- **Si la v2 a déjà été déployée, il faut d'abord défaire les étapes 4 puis 3.**

## 2. Réparation unique des identifiants RSEQ de côtés de match
Elle passe après E, pour que la passe suivante ne recrée pas d'incohérence.
1. Lister en lecture seule (`reparation/lister-incoherents.sql`). On attendait 18 côtés au moment des
   lots ; le nombre réel sera relevé ce jour-là.
2. Générer : `node reparation/generer-reparation.mjs cotes-prod.json reparation-prod`. Le générateur lit
   la valeur servie par le RSEQ pour chaque match.
3. **Montrer `reparation-prod.liste.csv` à BP.**
   - Catégorie **a** : seul `*_rseq_team_id` est réaligné.
   - Catégories **b** (le RSEQ sert une autre équipe) et **c** (match plus servi) : rien n'est écrit.
     Toucher à un `*_team_id` exige la décision de BP.
4. Sur GO : appliquer `reparation-prod.sql` par la CLI (`-f`, fichier tel quel, comme les lots). La
   transaction est gardée sur le nombre exact, avec 1 ligne `admin_operations`
   `REPARATION_RSEQ_IDS_COTES`.
5. Relevés après :
   - côtés incohérents servis : 0 ;
   - **md5 des `*_team_id` de `games` inchangé** ;
   - md5 des autres colonnes de `games` inchangé.

**Rollback** : `reparation-prod.rollback.sql`, généré avec la réparation. Il remet les anciens
identifiants, gardé sur le nombre exact. Prouvé sur la copie : 115 côtés, `team_ids_md5` identique
partout.

## 3. Fonction `rseq-weekly-sync` v2
- **Déploiement** : `supabase functions deploy rseq-weekly-sync --project-ref nrloizyemulbhujrqhgx`,
  depuis le worktree de la branche, avec `verify_jwt = false` comme aujourd'hui.
- **Vérifications** :
  - un appel sans secret rend 403 ;
  - un appel avec le secret (passé par `net.http_post`, comme le cron) mais sans `tranche` rend 400, ce
    qui prouve que la v2 répond ;
  - **essai réel proposé : la découverte tranche 3**, celle qui contient le Provincial et le Collégial,
    lancée à la main par la commande du cron. Durée attendue ≈ 251 s. Puis lecture du journal :
    statut DONE, 521 ligues environ, 87 collégiales.
- **Rollback** : redéployer la v1 depuis `main` (`supabase/functions/rseq-weekly-sync/index.ts` au
  commit `4322adc7`). **À faire seulement après le rollback des crons (étape 4)**, et **avant** celui
  des migrations C, D et E, car la v2 lit `tranche_passe` et `matchs_connus`.

## 4. Crons
Fichier : `scripts/veille-rseq/prod/20261008205948_rseq_crons_v2.sql`, rangé hors de
`supabase/migrations` exprès. Un seul `apply_migration`, avec gate sur la liste complète triée des crons
RSEQ.

| Cron | Jours | UTC | Montréal HAE (HNE après le 1ᵉʳ nov.) | Paramètres | Durée mesurée |
|---|---|---|---|---|---|
| `rseq-decouverte-t1` (nouveau) | dim | 07:55 | 03:55 (02:55) | `mode=decouverte&secteur=Tous&tranche=1` | 251 s |
| `rseq-decouverte-t2` (nouveau) | lun | 07:55 | 03:55 (02:55) | `…&tranche=2` | 251 s |
| `rseq-decouverte-t3` (nouveau) | mar | 07:55 | 03:55 (02:55) | `…&tranche=3` | 251 s |
| `rseq-veille-hebdo` (inchangé) | mer | 07:55 | 03:55 (02:55) | `secteur=Collégial` | 78 s |
| `rseq-passe-secondaire-q1` (nouveau) | mer | 08:10 | 04:10 (03:10) | `secteur=Secondaire&tranche=1` | 222 s |
| `rseq-passe-secondaire-q2` (nouveau) | jeu | 08:10 | 04:10 (03:10) | `…&tranche=2` | 232 s (le plus chargé : marge 98 s) |
| `rseq-passe-secondaire-q3` (nouveau) | ven | 08:10 | 04:10 (03:10) | `…&tranche=3` | 197 s |
| `rseq-passe-secondaire-q4` (nouveau) | sam | 08:10 | 04:10 (03:10) | `…&tranche=4` | 203 s |
| `rseq-decouverte-secondaire` | — | — | — | **retiré** (`provincial=1` refusé par la v2) | — |
| `rseq-veille-secondaire` | — | — | — | **retiré** (`tranche` obligatoire en v2) | — |

**Pas de chevauchement :**
- un jour porte soit une découverte (dimanche, lundi, mardi), soit des passes (mercredi à samedi) ;
- le mercredi, la passe collégiale finit vers 07:57 UTC, et la passe secondaire part à 08:10 ;
- chaque invocation reste sous le fusible de 330 s.

**Cadence** : le cron et la fonction changent dans la même session. Entre le déploiement de la v2
(étape 3) et l'étape 4, les deux anciens crons seraient refusés en 400. Cela reste sans effet puisque
leur prochain passage est mardi, mais les deux étapes se font quand même à la suite.

**Rollback** : `scripts/veille-rseq/prod/20261008205948_rollback_rseq_crons_v2.sql`. Il retire les 7
nouveaux crons et remet les 2 anciens avec leurs commandes relevées en prod. Gate sur la liste.
**Toujours en premier**, avant le rollback de la fonction.

## 5. Surveillance après la mise en prod (lecture seule)
- **Dimanche, lundi, mardi après 08:05 UTC** : la découverte de la tranche est DONE dans
  `rseq_sync_runs` (secteur `Tous`, tranche 1, 2 ou 3), avec 0 `PASSE_PARTIELLE` et 0 `DECOUVERTE_VIDE`.
- **Mercredi après 08:20 UTC** : la passe collégiale est DONE. Les ligues collégiales découvertes ont
  inséré leurs matchs, et les `NOUVELLE_EQUIPE` portent une proposition.
- **Mercredi à samedi après 08:20 UTC** : la passe secondaire du quart est DONE. On vérifie :
  - durée < 330 s ;
  - `ligues_en_attente_calendrier` relevé dans `detail` ;
  - aucune rafale de `LIGUE_MUETTE` ;
  - côtés incohérents servis : 0.
- **Après le premier cycle complet** : rejouer l'audit (`scripts/rseq-audit-20261008/`). On attend 0
  ligue avec matchs absente de la base, collégial compris.
