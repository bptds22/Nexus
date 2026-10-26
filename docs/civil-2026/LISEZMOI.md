# Import civil soccer / futsal / basket 2026-27

Équipes et matchs civils du Québec (Spordle, Kreezee, MBL), inventaire du 26 oct. 2026.
Fichiers source hors dépôt : `Documents/Nexus-Imports/civil-2026/`. Aucune donnée de personne.

## Décisions BP (2026-10-26)

- Moins de 18 ans (U14-U18) : équipes rejoignables. 18 ans et plus (U19, U21, Senior) : destinations,
  rejoignables par les 18 ans et plus. Saison civile d'été = `2026-2027`.
- Veille hebdo comme le RSEQ : matchs mis à jour sans jamais être supprimés ; équipes et clubs en alertes.
  **Pas de collecte Spordle avant l'accord écrit de Soccer Québec / Spordle.**
- Matchs à venir seulement. Reportés importés et marqués, annulés ignorés (alerte).
- Sport « Futsal » pour les ligues de futsal ; « Soccer » pour le reste, hiver compris.
- Initiales « (XX) » retirées des noms d'équipe (Loi 25). Doublons de nom : suffixe « #2 », « #3 ».
- Ancre unique conservée ; le coach d'école reste le coach tant que l'équipe de club n'en a pas.

## Lots

| Lot | Contenu | État |
|---|---|---|
| 0 | `scripts/civil-2026/lot0_plan.py` : plan JSON, lecture seule | fait |
| 1 | `20261026210000_civil_sources_lot1` : `games.source_match_id` / `statut_source`, `games_identite_civile` restreint, sources SPORDLE / MBL / KREEZEE, tables de correspondance | **EN PROD** 2026-10-26 20 h 03 UTC (`prod/apply-20261026210000.sql`, admin_operations `69e6300d`) |
| 2 | `lot2/1-organisations.sql` : 201 organisations (69 géocodées) + 86 existantes géocodées + 489 correspondances INVENTAIRE ; rollback `lot2/2-rollback.sql` | local prouvé, **pas en prod** |
| 3 | Équipes de moins de 18 ans | à faire |
| 4 | Équipes de 18 ans et plus | à faire |
| 5 | Matchs à venir | à faire |
| 6 | Veille hebdomadaire | attend l'accord écrit Spordle |
| 7 | Web : destinations 18+, ordre des divisions, vocabulaire coach | à faire |
| 8 | Mobile | lot dédié, sur GO |

## Lot 1 — preuve locale

`tests/lot1-tests.sql` (10 tests dans une transaction annulée), `tests/lot1-rollback-refuse.sql`,
`tests/releve-structure.sql` (structure de `games` comparée avant / après rollback).
Ordre : relevé → apply → tests → refus du rollback avec données → rollback → relevé identique →
second cycle → double apply refusé → rollback sur base défaite refusé.

**Ordre de prod (respecté le 2026-10-26) :** la migration AVANT toute exécution du script football mis à jour
(`scripts/plan-civil-football-games.mjs`, nouveau prédicat d'`ON CONFLICT`).

## Lot 2 — organisations + géocodage approximatif

Générés par `scripts/civil-2026/lot2_sql.py` à partir du plan et de `geocodage-prod.json` (relevé prod en
lecture seule, `lot2_geo.py`). Coordonnée = moyenne des écoles / cégeps géocodés de la ville principale de
l'organisation ; jamais de centre de région, jamais d'écrasement d'une coordonnée existante. Les lignes de
test (`Nexus Civil`, `jdjdhd`, `RSEQ`) ne sont pas géocodées.

Preuve locale (2026-10-26) : apply → contrôles (201 créées, 0 accent corrompu, 0 coordonnée hors zone) →
second apply refusé → rollback refusé avec une équipe sur une organisation créée → rollback → empreinte de
`schools` identique (md5) → second cycle identique → rollback sans opération refusé.
