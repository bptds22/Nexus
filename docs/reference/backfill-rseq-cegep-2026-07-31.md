# Backfill RSEQ cégep — 31 juillet 2026

Rapport d'exécution. **Données, pas schéma** : aucun DDL, aucune migration.
Les scripts sont versionnés dans `scripts/`, les sauvegardes sont hors dépôt.

---

## Le problème

78 équipes de cégep sur 398 n'avaient pas de `rseq_team_id`, donc aucun match,
donc ni calendrier ni record dans l'éditeur « Page équipe ». Réparties ainsi :

| Sport | Non pontées | Total cégep |
|---|---:|---:|
| Football | 25 | 25 (**0 %** ponté) |
| Basketball | 21 | 91 |
| Soccer | 17 | 53 |
| Volleyball | 15 | 90 |

**Cause unique** : leur homologue RSEQ n'existe qu'en saison `2026-2027`, alors
que la ligne Nexus portait `2025-2026`. La saison faisant partie de la clé
d'appariement du pont (`school_id, sport_id, name, category, division, sex,
season`), la clé ne pouvait jamais correspondre. Le script les classait
« 0 TeamId — non couverte », silencieusement.

Vérifié avant toute écriture :

- `rseq_teamids.json` secteur Collégial : 181 entrées en 2025-2026, **78 en
  2026-2027** — exactement le compte des non pontées, sport par sport ;
- **0 clé ambiguë** dans le millésime 2026-2027 ;
- **0 clé portant deux saisons** : les deux millésimes RSEQ sont disjoints,
  donc aucune ambiguïté possible.

## La décision

**Avancer `teams.season` à `2026-2027`** plutôt que relâcher la contrainte de
saison dans le script. Raisons :

1. `teams_identity_unique` inclut `season` : le modèle est « une ligne par
   saison », pas une entité qui traverse les saisons.
2. `public.current_season()` bascule au **1er août** — l'app considère
   2026-2027 comme la saison courante dès le lendemain de cette opération.
3. La clé du pont correspond alors naturellement : **aucune modification de la
   logique d'appariement**.
4. Les trois filtres applicatifs `games .eq("season", team.season)` se réparent
   d'eux-mêmes.

Coût mesuré avant écriture : **0 collision** sur `teams_identity_unique`,
**aucune FK ne référence `season`** (les 10 clés étrangères pointent sur
`teams.id`), **aucun `.eq("season", …)` sur `teams`** dans le code applicatif.

---

## Exécution

### Étape 1 — Sauvegarde

`scripts/advance-cegep-season-2026.mjs` écrit la sauvegarde **avant** toute
écriture, y compris en `--dry`. Emplacement hors dépôt et hors OneDrive
(scratchpad de session, variable `NEXUS_BACKUP_DIR`).

```
teams-season-2026-07-31T17-57-38.json     27 642 o     78 équipes
games-team-id-2026-07-31T18-04-40.json                 490 matchs
```

### Étape 2 — `teams.season` → 2026-2027

```
équipes CÉGEP non pontées en 2025-2026 : 78
garde-fou identité : 0 conflit sur teams_identity_unique
mises à jour : 78     échecs : 0
```

| Contrôle | Attendu | Obtenu |
|---|---|---|
| CÉGEP en 2026-2027 | 78 | **78** |
| CÉGEP restés en 2025-2026 | 320 | **320** |
| `team_page_content` rattachée | 1 | **1** |
| `team_position_needs` rattachés | 12 | **12** |
| `users.primary_team_id` rattaché | 1 | **1** |

Les lignes filles suivent l'`id`, qui n'a pas bougé.

### Étape 3 — `teams.rseq_team_id`

`scripts/backfill-rseq-team-id.mjs`, **logique d'appariement inchangée**.

```
ASSIGNABLES (1 TeamId):   78
collisions (>1 TeamId):   167   -> NON écrites
non couvertes (0 TeamId): 526
team_id dupliqués parmi assignables: 0
DONE — 78 teams pontées
```

Les 167 + 526 = 693 sont des équipes **secondaires et civiles**, hors périmètre,
déjà non pontées avant l'opération (771 non pontées au total = 676 SECONDAIRE +
78 CÉGEP + 17 LIGUE_CIVILE). Le script ne les écrit jamais.

> **Écart à signaler.** Le chemin d'écriture appelait
> `public._backfill_rseq_team_id(pairs)`, un helper temporaire de la Phase 4A
> **qui n'existe plus en base**. Le recréer aurait été du DDL, exclu par le
> ticket. Un **repli côté client** a donc été ajouté au script : même UPDATE,
> même garde `.is("rseq_team_id", null)` (zéro écrasement), ligne par ligne.
> La logique d'appariement n'a pas été touchée. L'index UNIQUE partiel
> `teams_rseq_team_id_uidx` reste le garde-fou ultime.

| Contrôle | Résultat |
|---|---|
| CÉGEP pontés | **398 / 398** |
| CÉGEP non pontés | **0** |
| Anciennes (2025-2026) intactes | **320** |
| `rseq_team_id` distincts vs lignes | **7 250 / 7 250** — aucun doublon |

### Étape 4 — `games.home_team_id` / `visitor_team_id`

`scripts/backfill-games-team-id.mjs` (nouveau). Ponter `teams` ne suffit pas :
les matchs portent la clé RSEQ mais pas la clé Nexus, et **rien ne la résout**
— ni trigger, ni vue, ni recalcul au chargement.

```
matchs scannés     : 48 293
matchs à rattacher : 490
rattachés : 490     échecs : 0
```

| Contrôle | Résultat |
|---|---|
| `games` avec au moins un `team_id` | 38 122 |
| Football collégial ponté des deux côtés | **105** / 123 |
| **CNDF Football — matchs** | **8** |
| **CNDF Football — record** | `null` |
| **CNDF Football — premier match** | **2026-08-28** |

Les 18 matchs de football collégial non pontés des deux côtés sont les cases de
séries éliminatoires (`00000000-0000-0000-0000-000000000000`, noms bruts
« 1re position », « 1er section Nord-Est »…) : ce ne sont pas des équipes.

Le calendrier de CNDF Football sort maintenant tel que l'éditeur le lira :

```
2026-08-28  19:30  dom  vs Limoilou          Stade des Anciens
2026-09-05  13:00  ext  @  Vanier            Collège Vanier
2026-09-11  19:30  dom  vs Ch.-Lennoxville   Stade des Anciens
2026-09-26  19:30  ext  @  Vieux Montréal    Collège Notre-Dame
2026-10-02  19:30  dom  vs André-Grasset     Stade des Anciens
2026-10-16  19:30  dom  vs Garneau           Stade des Anciens
2026-10-24  13:00  ext  @  Limoilou          Patro Charlesbourg
2026-10-31  13:00  ext  @  Saint-Jean        Stade Alphonse-Desjardins
```

**Le record reste vide, et c'est correct** : aucun match n'est joué avant le
28 août 2026. L'éditeur affiche désormais « Saison 2026-2027 pas encore
commencée — premier match le 28 août 2026 » au lieu du message alarmant
précédent.

---

## Retour arrière

```
node scripts/advance-cegep-season-2026.mjs --revert "<…/teams-season-….json>"
node scripts/backfill-games-team-id.mjs   --revert "<…/games-team-id-….json>"
```

Aucune ligne n'a été créée ni supprimée : uniquement des colonnes passant de
NULL (ou d'une saison) à une valeur. Pour `teams.rseq_team_id`, le retour est
`UPDATE teams SET rseq_team_id = NULL WHERE id IN (les 78)`.

## Dettes ouvertes

1. **`backfill-games-team-id.mjs` doit être rejoué après chaque chargement de
   matchs** — aucun trigger ne pose `home_team_id` / `visitor_team_id`.
2. **693 équipes secondaires et civiles restent non pontées** (167 collisions
   d'identité + 526 sans homologue RSEQ). Chantier distinct.
3. **La bascule de saison n'a pas de mécanisme.** `current_season()` bascule
   seule au 1er août, mais rien ne fait avancer les données. 320 équipes de
   cégep et 7 317 du secondaire restent en 2025-2026. La migration
   `20260726120000_teams_season_guard.sql` a posé les garde-fous (adoption vers
   `season >= current_season()`, désactivation des orphelines) mais pas la
   bascule elle-même.
4. **`_backfill_rseq_team_id` reste absent** de la base. Le repli client le
   remplace ; si le RPC est recréé un jour, le script le reprendra
   automatiquement (il le sonde avant d'écrire).
