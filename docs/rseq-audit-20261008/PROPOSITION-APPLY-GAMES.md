# Proposition — `rseq_sync_apply_games` ne réécrit pas les `rseq_team_id` d'un match (2026-10-08)

**Constat, à faire trancher par BP.** Rien n'est codé ni appliqué.

## Le défaut (présent en prod)
Quand le RSEQ change l'équipe d'un côté de match (adversaire remplacé, match réassigné), la passe :
- **met bien à jour** `home_team_id` / `visitor_team_id`, résolus par le `rseq_team_id` SERVI, ainsi que
  `home_name_raw` / `visitor_name_raw` ;
- **ne met jamais à jour** `home_rseq_team_id` / `visitor_rseq_team_id`. Ces colonnes ne figurent pas dans
  le `DO UPDATE` de l'upsert.

Le côté de match pointe alors vers la bonne équipe Nexus, mais sa colonne `rseq_team_id` désigne encore
l'ancienne. Toute logique qui relie ou contrôle par `games.*_rseq_team_id` se trompe ensuite en silence :
- un lot de création d'équipes ;
- la détection `MAPPING_DERIVE` ;
- une recherche des matchs d'une équipe par `rseq_team_id`.

## Preuves
- **Avant toute passe**, dans la copie de la prod du 2026-10-08 : **18 côtés incohérents**. Ce sont ceux
  signalés au lot 01 (LCC, Durocher, Acad. Saint-Louis…).
- **Après une passe locale**, sur la même copie (`scripts/veille-rseq/enquete-70b.sql`) : **70 côtés**
  ont changé d'équipe. Pour **70 sur 70** :
  - l'équipe d'avant portait bien le `rseq_team_id` de la colonne ;
  - le RSEQ sert maintenant une autre équipe ;
  - aucun côté n'a été délié (0 NULL) ;
  - la colonne `rseq_team_id` est périmée pour les 70.

  On compte au total **115 côtés incohérents** dans la copie après cette passe.

## Correctif proposé (migration E, à part des 4 du lot)
Dans `rseq_sync_apply_games`, ajouter au `DO UPDATE` :
```sql
      home_rseq_team_id    = excluded.home_rseq_team_id,
      visitor_rseq_team_id = excluded.visitor_rseq_team_id,
```
Ajouter aussi à la condition `where` du même upsert :
```sql
      or games.home_rseq_team_id    is distinct from excluded.home_rseq_team_id
      or games.visitor_rseq_team_id is distinct from excluded.visitor_rseq_team_id
```
- **Effet** : la passe suivante remet en cohérence chaque match encore servi par le RSEQ. Ceux qu'il ne
  sert plus (retirés) gardent leur état : jamais de DELETE, et aucune source pour savoir.
- **Journal** : l'opération apparaîtrait comme « mise a jour » dans `rseq_sync_changes`. On peut ajouter
  un libellé « equipe changee » dans le `case` du résumé.
- **Preuve attendue** : relancer `enquete-70b.sql` après une passe ; on attend 0 côté incohérent sur les
  matchs servis.
