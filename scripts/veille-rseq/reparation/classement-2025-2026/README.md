# Classement des 1 371 côtés incohérents de 2025-2026 — LECTURE SEULE (2026-10-08)

Rien n'a été écrit en base. Le SQL produit par `generer-reparation.mjs` a été supprimé exprès : il n'y a rien à appliquer.

- `lister-2025-2026.sql` : `prod-20261008/lister-2026.sql`, avec la saison passée à `2025-2026`, exécuté via la CLI.
- `cotes-2025-2026.json` : 1 371 côtés, 1 096 matchs, 80 ligues.
- `classement-2025-2026.liste.csv` : sortie du générateur (RSEQ relu le 2026-10-08).

## Résultat

| catégorie | côtés |
|---|---|
| a, à réaligner | **0** |
| b, autre équipe servie | **1 371** |
| c, plus servi | **0** |

La catégorie b est trompeuse ici. Pour **1 366** côtés, le RSEQ sert **exactement** la valeur déjà présente dans
`games.*_rseq_team_id` : **la colonne du match est juste**. Ce qui diverge, c'est `teams.rseq_team_id` de l'équipe
reliée :

- 174 équipes, toutes avec `season = '2025-2026'`, créées le 2026-07-23 ou le 2026-07-24 ;
- leur `rseq_team_id` est l'identifiant **2026-2027** : il apparaît dans des matchs de 2026-2027 et dans aucun
  de 2025-2026 ;
- 1 304 matchs de 2026-2027 sont reliés à ces équipes ; aucune jumelle 2026 ne partage leur identifiant ;
- 0 athlète, 0 coach rattaché.

Autrement dit, ce sont des équipes pérennes : la même équipe d'école sert les deux saisons, avec l'identifiant RSEQ
de la saison courante et une étiquette `season` restée à 2025-2026.

Les **5** côtés restants sont tous dans *Soccer J M D4 Niveau 2*. Le RSEQ y sert lui-même des identifiants qui ne
concordent pas d'un match à l'autre pour la même école (Champigny, Pionniers, Louis-Jobin). Listés, non traités.
