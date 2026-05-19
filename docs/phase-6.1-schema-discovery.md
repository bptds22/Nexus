# Phase 6.1 — Schema Discovery

**Date** : 2026-05-11
**Pré-flight pour** : Phase 6.1 data migration + seed reset
**Méthode** : `docker exec` queries sur DB locale `supabase_db_Nexus`

---

## 0. Surprise majeure dès la query 1

**Il existe DEUX tables coaches école distinctes** (pas une seule comme
le spec assumait) :

| Table | Rôle apparent | Convention role |
|---|---|---|
| `school_coaches` | Coach **rattaché à une école** (niveau institution) | Enum `coach_school_role` (DIRECTEUR_INTERIM, DIRECTEUR, COACH, PENDING) |
| `team_coaches` | Coach **rattaché à une équipe** (niveau team) | TEXT CHECK (head_coach, assistant, coordinator) |

Plus `league_coaches` côté civil — qui mélange institution (`league_id`) ET
team (`league_team_id`) dans la même row, avec son propre enum-via-CHECK
(ADMIN, COACH, PENDING).

**Implication pour Phase 6** : "junction unifiée + coaches unifiés"
nécessite de choisir entre 3 modèles de granularité :
- 1 ligne par (institution, coach) — modèle `school_coaches`
- 1 ligne par (team, coach) — modèle `team_coaches`
- 1 ligne par (institution, team, coach) — modèle `league_coaches` actuel

Voir section 8 D1 + D2 pour les décisions ouvertes.

---

## 1. Table coaches école — `school_coaches`

### Colonnes

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| school_id | uuid | NO | — |
| coach_id | uuid | NO | — |
| role | `coach_school_role` (enum) | NO | `'PENDING'` |
| sport | varchar | YES | — |
| team_name | varchar | YES | — |
| approved_at | timestamptz | YES | — |
| approved_by | uuid | YES | — |
| created_at | timestamptz | YES | `now()` |

### Enum role : `coach_school_role`

```
DIRECTEUR_INTERIM, DIRECTEUR, COACH, PENDING
```

(Type Postgres natif, distinct du CHECK simple sur `league_coaches.role`.)

### FKs

| Constraint | From | → To | Delete rule |
|---|---|---|---|
| `school_coaches_school_id_fkey` | school_id | schools.id | NO ACTION |
| `school_coaches_coach_id_fkey` | coach_id | users.id | CASCADE |
| `school_coaches_approved_by_fkey` | approved_by | users.id | SET NULL |

### UNIQUE

- `school_coaches_school_id_coach_id_key` : UNIQUE (school_id, coach_id)

### Data actuelle

1 row : role = `DIRECTEUR_INTERIM`.

---

## 1.b Table coaches équipe — `team_coaches`

### Colonnes

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| team_id | uuid | NO | — |
| coach_id | uuid | NO | — |
| role | text | YES | `'assistant'` |
| created_at | timestamptz | YES | `now()` |

### CHECK role

```
CHECK (role = ANY (ARRAY['head_coach', 'assistant', 'coordinator']))
```

### FKs

| Constraint | From | → To | Delete rule |
|---|---|---|---|
| `team_coaches_team_id_fkey` | team_id | teams.id | CASCADE |
| `team_coaches_coach_id_fkey` | coach_id | users.id | CASCADE |

### UNIQUE

- `team_coaches_team_id_coach_id_key` : UNIQUE (team_id, coach_id)

### Data actuelle

2 rows : both role = `head_coach`.

---

## 2. Junction athletes ↔ teams école — `team_athletes`

### Colonnes

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| team_id | uuid | NO | — |
| athlete_id | uuid | NO | — |
| jersey_number | text | YES | — |
| is_captain | boolean | YES | `false` |
| joined_at | timestamptz | YES | `now()` |

### FKs

| Constraint | From | → To | Delete rule |
|---|---|---|---|
| `team_athletes_team_id_fkey` | team_id | teams.id | CASCADE |
| `team_athletes_athlete_id_fkey` | athlete_id | athletes.id | CASCADE |

### UNIQUE

- `team_athletes_team_id_athlete_id_key` : UNIQUE (team_id, athlete_id)

**Comparaison avec `league_team_athletes`** (legacy civil) :
- `team_athletes` porte **jersey_number + is_captain** ; `league_team_athletes` les a aussi (per 5.5b mention dans le code, mais "no longer surfaced in this view" per le team page comment).
- Both UNIQUE sur (team, athlete) — convention identique.
- Junction unification = direct (renommer/migrer rows).

---

## 3. Table teams école — `teams`

### Colonnes

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| school_id | uuid | **NO** | — |
| sport_id | uuid | NO | — |
| name | text | NO | — |
| division | text | YES | — |
| league | text | YES | — |
| season | text | YES | `'2025-2026'` |
| is_active | boolean | YES | `true` |
| created_at | timestamptz | YES | `now()` |
| age_group | text | YES | — |

### FKs

| Constraint | From | → To | Delete rule |
|---|---|---|---|
| `teams_school_id_fkey` | school_id | schools.id | CASCADE |
| `teams_sport_id_fkey` | sport_id | sports.id | NO ACTION |

### UNIQUE / CHECK

**Aucune contrainte UNIQUE ni CHECK** sur `teams`. C'est notable —
`league_teams` a `uq_league_teams_identity` (league_id, name, age_group,
division, season) qui n'a pas d'équivalent ici.

### Data actuelle

2 teams, **toutes avec school_id NOT NULL** (cohérent avec NOT NULL FK).

**Comparaison avec `league_teams`** :
| Aspect | `teams` | `league_teams` |
|---|---|---|
| school_id | NOT NULL (CASCADE) | n/a |
| league_id | n/a | NOT NULL (CASCADE) |
| owner_id | n/a | uuid → users.id |
| age_group | nullable | nullable |
| division | nullable | nullable |
| league | text (free) | n/a (relationship via league_id) |
| gender | n/a | text (présent dans league_teams) |
| UNIQUE | none | (league_id, name, age_group, division, season) |

**Post-unification** : si on garde `teams` comme table unifiée, faudra
décider du sort de `league_teams.owner_id` et `league_teams.gender`.

---

## 4. `athletes.school_id` et `league_team_id`

| Column | Type | Nullable | FK → | Delete rule |
|---|---|---|---|---|
| school_id | uuid | YES | schools.id | RESTRICT |
| league_team_id | uuid | YES | league_teams.id | NO ACTION |

### État actuel des 2 athletes civils

```sql
SELECT id, first_name, school_id IS NULL, league_team_id IS NULL FROM athletes WHERE league_team_id IS NOT NULL;
```

| id | first_name | no_school | no_team |
|---|---|---|---|
| 7f7efb96-… | Alex | **t** (NULL) | f (anchored) |
| f86c0c61-… | MutTest | **t** (NULL) | f (anchored) |

**Constat** : les 2 athletes civils ont bien `school_id = NULL` et
`league_team_id NOT NULL` exclusivement. Pas d'anomalie. Post-migration,
ils basculeront sur `school_id` (avec `schools.type='LIGUE_CIVILE'`) et
`league_team_id` sera dropped/NULL.

---

## 5. Enums role : league_coaches vs school_coaches vs team_coaches

### `league_coaches.role` (CHECK + valeurs)

```
CHECK (role = ANY (ARRAY['ADMIN', 'COACH', 'PENDING']))
```

Data : 2 rows, all `ADMIN`.

### `school_coaches.role` (Postgres native enum `coach_school_role`)

```
{DIRECTEUR_INTERIM, DIRECTEUR, COACH, PENDING}
```

Data : 1 row, `DIRECTEUR_INTERIM`.

### `team_coaches.role` (text CHECK)

```
CHECK (role = ANY (ARRAY['head_coach', 'assistant', 'coordinator']))
```

Data : 2 rows, all `head_coach`.

### Mapping proposé pour Phase 6.1.e (data migration)

⚠️ **Question ouverte** : on unifie dans quel modèle ?

#### Option A — Unifier dans `school_coaches` (institution-level)
| Source | role | → school_coaches.role |
|---|---|---|
| league_coaches.ADMIN | ADMIN | `DIRECTEUR` (head of league = directeur de l'institution civile) |
| league_coaches.COACH | COACH | `COACH` |
| league_coaches.PENDING | PENDING | `PENDING` |

`school_coaches.team_name` (varchar) pourrait absorber la notion de team
(au lieu de migrer dans `team_coaches`). Mais c'est un fallback texte —
perd la FK.

#### Option B — Migrer dans les deux (`school_coaches` + `team_coaches`)
- 1 row dans `school_coaches` pour le lien institution
- 1 row dans `team_coaches` pour le lien team (avec role `head_coach`
  pour les ADMIN, `assistant` pour les COACH)

Plus correct sémantiquement mais 2x les inserts.

#### Option C — Étendre `team_coaches` avec un `school_id` nullable + role enum unifié
Refonte plus large mais permet une vraie table junction unifiée pour
les 3 cas (école seule, civil seul, hybride).

---

## 6. `team_invitations` (actuel)

### Colonnes

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | `gen_random_uuid()` |
| league_team_id | uuid | **NO** | — |
| athlete_id | uuid | NO | — |
| invited_by_coach_id | uuid | YES | — |
| status | text | NO | `'PENDING'` |
| expires_at | timestamptz | YES | — |
| created_at | timestamptz | NO | `now()` |
| responded_at | timestamptz | YES | — |

### FKs

| Constraint | From | → To | Delete rule |
|---|---|---|---|
| `team_invitations_league_team_id_fkey` | league_team_id | **league_teams**.id | CASCADE |
| `team_invitations_athlete_id_fkey` | athlete_id | athletes.id | CASCADE |
| `team_invitations_invited_by_coach_id_fkey` | invited_by_coach_id | users.id | SET NULL |

### CHECK

```
status = ANY (ARRAY['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'])
```

**Note critique** : la colonne `league_team_id` (NOT NULL) référence
`league_teams`. Post-Phase 6, faudra :
- **Soit** : renommer en `team_id` → FK `teams.id` (unifié école+civil)
- **Soit** : ajouter `school_id` directement → FK `schools.id` (saute la
  granularité team, ce qui changerait la sémantique du Flow A)

Voir D3 section 8.

---

## 7. Convention `coach_id`

### FK confirmées (3 tables)

| Table | From column | → To table.column |
|---|---|---|
| `school_coaches` | coach_id | **users.id** |
| `team_coaches` | coach_id | **users.id** |
| `league_coaches` | coach_id | **users.id** |

**Aucune table `coaches` séparée n'existe** dans `public`. Les 3 tables
référencent toutes `users.id` directement.

**Implication** : pas de problème de convention à résoudre — le coach_id
post-migration reste `users.id`. Cohérent avec `auth.uid()` qui retourne
le `users.id` (puisque `users.id = auth.users.id` par convention Supabase).

### Enums Postgres natifs trouvés (overview)

| Enum | Values |
|---|---|
| `account_status` | ACTIF, DESACTIVE, EN_ATTENTE, DIPLOME |
| `coach_school_role` | DIRECTEUR_INTERIM, DIRECTEUR, COACH, PENDING |
| `pipeline_status` | NONE, IDENTIFIE, CONTACTE, EN_DISCUSSION, VISITE_PLANIFIEE, ENGAGE, LETTRE_SIGNEE, RETIRE |
| `recruitment_status` | OUVERT, EN_PROCESSUS, RECRUTE, RETIRE |
| `user_role` | ADMIN, COACH, RECRUTEUR, ATHLETE, PARTNER |
| `verification_method` | auto, manuel_coach, manuel_directeur |

---

## 8. Décisions ouvertes pour BP avant 6.1.a

### D1 — Granularité de la table coaches unifiée

3 options vues en section 5 (mapping). Question fondamentale :
**post-Phase 6, on a 1 ou 2 tables de coaches ?**

- (a) 1 table unifiée `coaches` (institution-level, via `school_coaches`
  étendu pour absorber les rôles civils ADMIN/COACH)
- (b) 2 tables `school_coaches` (institution) + `team_coaches` (team),
  les 2 athletes civils sont migrés dans les deux
- (c) Refactor plus large : remplacer les 3 tables par une seule
  `team_coaches` avec `school_id` ajouté + enum unifié

Mon vote : **(b)**. Préserve les 2 tables existantes intactes (école
fonctionne déjà), migre civil dedans (DIRECTEUR_INTERIM ou DIRECTEUR
pour ADMIN, COACH for COACH), `team_coaches` reçoit aussi une row par
ADMIN (role `head_coach`) pour cohérence avec roster.

### D2 — Mapping des rôles civils → unifiés

Si vote (b) sur D1, le mapping détaillé est :

| league_coaches.role | → school_coaches.role | → team_coaches.role |
|---|---|---|
| ADMIN | **DIRECTEUR** | **head_coach** |
| COACH | COACH | assistant |
| PENDING | PENDING | (skip, pas dans team_coaches) |

Bruno : valides ce mapping, ou autre proposition ?

### D3 — FK de `team_invitations`

3 options :

- (a) Renommer `league_team_id` → `team_id` (FK `teams.id`). Sémantique
  identique au flow actuel.
- (b) Ajouter `school_id` à la place. Sémantique différente : invitation
  à une école entière, pas à une team. Casse le Flow A.
- (c) Ajouter `team_id` ET garder `league_team_id` (double FK pendant la
  migration, puis drop `league_team_id` à la fin). Sécurité max.

Mon vote : **(a)**. C'est le rename naturel, préserve toute la sémantique
Flow A déjà testée.

### D4 — `teams.school_id` reste NOT NULL ?

Aujourd'hui : `teams.school_id NOT NULL`. Cohérent avec le fait que
**toutes** les teams (école + civil post-migration) auront une `schools`
row associée (LIGUE_CIVILE pour le civil).

Bruno : confirmer qu'on laisse NOT NULL post-migration ?

### D5 — `teams.owner_id` à ajouter ?

`league_teams.owner_id` existe (`uuid → users.id`) — c'est le créateur
de la team civile. `teams` n'a pas d'équivalent.

Options :
- (a) Ajouter `teams.owner_id` (nullable, pour rétrocompat école)
- (b) Drop ce concept post-migration (la ownership civile devient
  équivalente à `DIRECTEUR` dans `school_coaches`)
- (c) Migrer `owner_id` vers une row `DIRECTEUR` dans `school_coaches`
  avant DROP de `league_teams`

Mon vote : **(c)**. Le `owner_id` est déjà capturé par le `school_coaches.coach_id`
post-migration (l'ADMIN civil devient DIRECTEUR). Pas besoin de colonne.

### D6 — `teams.gender` à ajouter ?

`league_teams.gender` (text) existe ; `teams` n'a pas. Les 2 teams école
existantes n'ont pas de gender stocké (et le mock data école semble
faire abstraction de cette dim).

Options :
- (a) Ajouter `teams.gender` (nullable)
- (b) Stocker dans `age_group` (overload — peu propre)
- (c) Drop (perdre l'info pour les 2 teams civiles)

Mon vote : **(a)**. C'est une dimension métier vraie (équipes filles vs
garçons), même côté école faudra à terme. Nullable pour rétrocompat.

### D7 — UNIQUE sur `teams` post-migration

`teams` n'a aucune UNIQUE actuellement. `league_teams` a
`uq_league_teams_identity` (league_id, name, age_group, division, season).

Question : ajouter une UNIQUE sur `teams` (school_id, sport_id, name,
age_group, division, season) ?

Mon vote : **oui**, cohérent avec l'esprit `uq_league_teams_identity`.
Empêche les doublons de teams comme paTS x2 qu'on a vu.

### D8 — `school_coaches.team_name` (varchar) à conserver ?

Cette colonne (varchar) est un free-text en surplus de la relation
`school_coaches → school_id`. Aujourd'hui : aucune utilisation visible
côté code (à confirmer par grep).

Post-migration : à dropper ou conserver pour les coaches civils qui
n'ont pas de `teams` row dédiée ?

Mon vote : **drop**. Avec la junction `team_coaches`, on a déjà la
relation team. Cette colonne est un héritage.

---

## 9. Notes annexes

### N1 — Tables relatives non-coach trouvées

Pendant la query exploratoire on a aussi vu :
- `coach_badges`, `coach_career_preferences`, `coach_notifications`,
  `coach_reviews`, `subscription_features_coach` — pas dans le scope
  Phase 6.1 (notifications + badges + reviews coach-side, indépendants
  du modèle institution/team).
- `_deprecated_athlete_views_2026_05` — table tagged deprecated, hors
  scope.

### N2 — État data civile pre-migration

| Source | Rows |
|---|---|
| `leagues` | 4 |
| `league_coaches` (ADMIN only) | 2 |
| `league_teams` | 2 (paTS active 85c90887, Jets 8265e168) |
| `league_team_athletes` | 2 (Alex + MutTest) |
| `athletes` avec `league_team_id NOT NULL` | 2 |
| `team_invitations` | 3 rows (1 ACCEPTED Alex, 1 CANCELLED Sophie, 1 PENDING Sophie) |

Toute cette donnée est seed/test — décision déjà lockée (BP Q2) : reset
complet en Phase 6.1.

### N3 — Verrou critique : 0 ligne actuelle sur `schools.type='LIGUE_CIVILE'`

Bien que la CHECK constraint l'autorise maintenant (Phase 6.1.0
shippée), aucune row LIGUE_CIVILE n'existe encore. La data migration
Phase 6.1 sera donc en **mode INSERT pur** (pas d'UPDATE existants),
ce qui simplifie la logique.

---

**Discovery complete.** 8 décisions ouvertes (D1-D8) pour BP review en
section 8.
