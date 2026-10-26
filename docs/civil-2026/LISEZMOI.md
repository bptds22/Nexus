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
| 2 | `lot2/1-organisations.sql` : 201 organisations (69 géocodées) + 86 existantes géocodées + 489 correspondances INVENTAIRE ; rollback `lot2/2-rollback.sql` | **EN PROD** 2026-10-26 20 h 22 UTC (op `f029d1f8`) |
| 2b | `lot2b/1-geocodage-villes.sql` : 152 organisations géocodées par ville (Nominatim, 111 villes) ; rollback `lot2b/2-rollback.sql` | **EN PROD** 2026-10-26 20 h 34 UTC (op `6daa5649`) : 307 / 473 organisations civiles avec un point |
| 3 | `lot3/1-equipes.sql` : 2 039 équipes de moins de 18 ans + 2 049 clés source ; rollback `lot3/2-rollback.sql` | local prouvé, **pas en prod** |
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

## Lot 2b — géocodage par ville (Nominatim)

`scripts/civil-2026/lot2b_villes.py` : ville = celle en base (relevé prod
`lot0-v2/villes-prod-sans-coordonnees.json`), sinon la ville principale de l'inventaire. Seuls les NOMS de villes
partent chez Nominatim (111 requêtes, 1,1 s d'écart, User-Agent identifié) ; un résultat n'est retenu que s'il est
une localité au Québec ou en Ontario (« Mont-Royal » → la montagne, rejeté puis requis sous « Ville de Mont-Royal »).
Preuve locale : 155 → 307 organisations avec un point, 0 coordonnée existante modifiée, 0 hors zone, rollback
refusé si une coordonnée posée a bougé, empreinte identique après rollback (deux cycles).

## Lot 3 — équipes de moins de 18 ans

Preuve locale : 2 039 équipes (2 031 sous une organisation civile, 8 Sport-études sous leur école), toutes actives,
saison 2026-2027, 0 sans clé source, 0 initiale « (XX) » restante ; rollback refusé dès qu'une ligne vise une équipe
(contrôle générique de TOUTES les clés étrangères vers teams, cascades comprises) ; empreinte identique (deux cycles).

**Voie de prod des gros lots :** `lot3/1-equipes.sql` fait 371 Ko — trop pour le connecteur Supabase. Les lots 3, 4 et
5 passeront par `psql -1 -v ON_ERROR_STOP=1 -f …` (à décider avec BP), le texte restant identique au fichier testé.

## Note pour le lot 5 (BP, 2026-10-26)

Géocoder aussi les TERRAINS des matchs à partir des adresses Spordle (`venue_lat` / `venue_lon`), sinon les matchs
civils n'auront pas de point sur la carte des matchs.
