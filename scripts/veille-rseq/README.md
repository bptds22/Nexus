# Veille RSEQ — correctif de découverte : recette LOCALE (2026-10-08)

Plan : `docs/rseq-audit-20261008/PLAN-VEILLE.md`. Décisions de BP du 2026-10-08 :
- valeur « Tous » dans le journal ;
- découverte dim/lun/mar, passes secondaires mer/jeu/ven ;
- équipes proposées en alerte, créées par une RPC admin, jamais automatiquement.

**Rien en prod** : ni migration, ni fonction, ni cron.

## Migrations (appliquées sur la base locale `postgres` et sur la base jetable `nexus_copie`)
| # | Fichier | Objet |
|---|---|---|
| A | `20261008210000_rseq_codes_sport.sql` | table `rseq_codes_sport`, semée avec 61 codes ; ACL `{postgres,service_role}` |
| B | `20261008210100_rseq_sync_runs_tous_tranche.sql` | `secteur = 'Tous'` (découverte seulement) ; colonne `tranche` |
| C | `20261008210200_rseq_ligues_a_appeler_tranches.sql` | vue des ligues à appeler : sports sans match exclus, catalogue limité à `team_count > 0`, `tranche_passe` (hachage), `matchs_connus` ; `security_invoker` réaffirmé ; ACL conservée |
| D | `20261008210300_rseq_equipes_proposees.sql` | `rseq_proposition_equipe` ; `rseq_sync_detect_teams` (corps prod + proposition) ; RPC admin `rseq_creer_equipes_proposees` |

- **Empreintes, hors objets du lot** (fonctions, policies, triggers, droits des tables, autres vues) :
  identiques avant et après sur les deux bases. Seules s'ajoutent les deux contraintes de `rseq_sync_runs`.
- **ACL en liste complète triée** :
  - `rseq_codes_sport` : `{postgres,service_role}` ;
  - vue : `{anon,authenticated,postgres,service_role}`, comme avant, avec `{security_invoker=true}` ;
  - `rseq_proposition_equipe` et `rseq_sync_detect_teams` : `{postgres,service_role}`, INVOKER ;
  - `rseq_creer_equipes_proposees` : `{authenticated,postgres,service_role}`, DEFINER.
- **Rollbacks** (`supabase/rollback/`, chacun en transaction) testés sur `nexus_copie`, de 4 à 1 :
  - empreintes identiques à l'état d'avant ;
  - vue et `rseq_sync_detect_teams` revenues au md5 exact de la prod (`f6c8bc2a…`, `cf4b292d…`) ;
  - ré-application verte.

  Le premier essai du rollback C a été refusé par son propre gate (rendu `'games'::text`) ; le fichier a
  été corrigé.

## Fonction `rseq-weekly-sync` v2
- **Découverte** : sur `s1.rseq.ca`, pour chaque région de la tranche × chaque code de `rseq_codes_sport`.
  - Secondaire et Collégial vont au catalogue.
  - `GetRegionSports` ne sert plus qu'à repérer un code NOUVEAU (alerte `NOUVEAU_CODE_SPORT`).
- **Passe** :
  - `GetLeagueDiffusion` sur s1 : mêmes données que diffusion, seuls des libellés et des champs `*Html`
    non lus diffèrent ;
  - passe secondaire par `tranche_passe` ;
  - une ligue sans aucun match connu qui répond sans calendrier est comptée « en attente de calendrier »,
    pas « muette ».
- **Paramètres** : 8 combinaisons invalides, refusées en 400. `?provincial=` est obsolète et refusé, pour
  qu'un ancien cron se voie.

## Banc d'essai (`banc/`)
- La fonction tourne dans un conteneur `edge-runtime` autonome, servie depuis ce worktree.
- Elle écrit dans `nexus_copie` (copie de la prod du 2026-10-08, lots 01 à 09 compris), via une
  PostgREST dédiée et `banc/proxy.mjs`.
- Ta base locale `postgres` n'a reçu que les migrations.

## Mesures (contre s1.rseq.ca, 800 ms entre appels)
| Invocation | Durée | Appels | Résultat |
|---|---|---|---|
| Découverte tranche 1 (régions 0–4) | **250,9 s** | 311 | DONE, 474 ligues |
| Découverte tranche 2 (5–9) | **251,3 s** | 311 | DONE, 692 ligues |
| Découverte tranche 3 (10–14) | **251,1 s** | 311 | DONE, 521 ligues (434 secondaires, 87 collégiales) |
| Passe collégiale | 77,7 s | 78 | DONE, 72 ligues OK, 6 en attente de calendrier |
| Passe secondaire 1 / 2 / 3 (`tranche_passe`) | **297 / 281 / 280 s** | 330 / 313 / 313 | DONE, 0 échec, 0 alerte |

- **Premier essai, découpage de la passe par région** (243 / 448 / 265 ligues) : la tranche 2 a été
  arrêtée par le fusible à 331 s (PARTIAL, 71 ligues non traitées, alerte `PASSE_PARTIELLE` levée
  proprement).
- Ce même essai a levé **566 fausses `LIGUE_MUETTE`** : des ligues d'hiver sans calendrier. Les deux
  défauts sont corrigés (migration C et fonction), puis la mesure a été refaite (tableau ci-dessus).

## Preuves
1. **Ligues collégiales que diffusion ne montre pas** : les 27 relevées par l'audit (servies par s1
   seulement) sont **27 sur 27 au catalogue, et 27 sur 27 dans la vue appelée par la passe**
   (`preuve-collegial.sql`). La passe collégiale a inséré leurs 1 621 matchs.
2. **Passe et 1 737 équipes** (`preuve-passe-avant.sql` / `-apres.sql`, après les passes corrigées) :
   - 15 966 sur 15 966 côtés de l'instantané reliés à la MÊME équipe ; 0 délié ou changé ;
   - **20 sur 20 côtés déliés exprès, reliés de nouveau** par `rseq_team_id` à la même équipe ;
   - 0 côté NULL ne porte le `rseq_team_id` d'une équipe des lots ;
   - équipes : 10 037 → 10 037, aucune créée ;
   - 0 `rseq_team_id` en double.
3. **Proposition sans création** (`preuve-proposition.sql`) :
   - deux équipes fictives passent par la vraie `rseq_sync_detect_teams`. L'une ressort « a_creer »
     (École secondaire Saint-Joseph, Volleyball, Juvénile, Féminin, confiance haute), l'autre
     « ecole_introuvable » ;
   - **aucune n'est créée** ;
   - RPC : `anon` n'a pas le droit EXECUTE ; un authentifié non admin est refusé (42501) ;
   - un admin crée 1 équipe et refuse l'introuvable, avec 1 ligne `EQUIPES_RSEQ_CREEES`. L'alerte reste
     OUVERTE, avec sa note. Un second appel crée 0 équipe. Tout cela s'est passé dans une transaction
     ANNULÉE.
   - Vraies propositions collégiales issues de la passe : 175 `a_creer` (2 667 côtés), 19 `doublon`,
     10 `ecole_introuvable`.
4. **La passe ne délie ni ne modifie les côtés reliés** :
   - premier essai : **70 côtés ont changé d'équipe**, **0 délié**. L'enquête (`enquete-70.sql`,
     `enquete-70b.sql`) montre que le RSEQ a changé l'équipe de ces matchs depuis la passe de
     mercredi. La passe a suivi, ce qui est correct. Mais `rseq_sync_apply_games` ne réécrit jamais
     `home/visitor_rseq_team_id` : c'est un défaut PRÉSENT EN PROD, qui explique aussi les 18 anomalies
     des lots. Voir `docs/rseq-audit-20261008/PROPOSITION-APPLY-GAMES.md` (correctif proposé, non
     codé) ;
   - second passage : 0 côté changé.
