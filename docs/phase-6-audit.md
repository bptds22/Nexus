# Phase 6 Audit — Surface civil/école

**Date** : 2026-05-11
**Audit run by** : Claude Code
**État pre-refacto** : pre-beta, 0 users prod
**Scope** : pure discovery — aucun changement de code, schema, ou data
**Output method** : grep (ripgrep) sur app/ + components/ + lib/ + supabase/, +
7 SQL queries via `docker exec` sur DB locale `supabase_db_Nexus`

---

## 1. Sanity counts (DB)

| Table / set | Count |
|---|---|
| `leagues` | 4 |
| `league_coaches` | 2 |
| `league_teams` | 2 |
| `league_team_athletes` | 2 |
| `schools` with `type='LIGUE_CIVILE'` | **0** |
| `users` with `context='ligue_civile'` | 7 |
| `athletes` with `league_team_id IS NOT NULL` | 2 |

**Constat** : `schools.type` admet aujourd'hui `SECONDAIRE` ou `CEGEP`
uniquement (CHECK constraint stricte ; voir section 9). Aucune donnée
LIGUE_CIVILE n'existe encore dans `schools`. La migration Phase 6
devra ALTER cette CHECK avant de pouvoir insérer.

Distribution `users.context` complète :
- `ligue_civile` : 7
- `scolaire` : 3
- `collegial` : 1
- NULL : 17 (pré-onboarding ou recruteurs)

---

## 2. Code references — tables legacy

### 2.1 `leagues` (table name as Supabase `from('leagues')`)

| File | Line | Context |
|---|---|---|
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L1804) | 1804 | `.from("leagues")` — wizard CivilLeague step |
| [lib/onboarding/findOrCreateLeague.ts](../lib/onboarding/findOrCreateLeague.ts#L52) | 52, 66, 78 | 3 calls in find/insert flow |
| [components/onboarding/TeamCreateForm.tsx](../components/onboarding/TeamCreateForm.tsx#L109) | 109 | `.from("leagues")` — autocomplete |

**Total** : 5 occurrences / 3 fichiers. Toutes côté onboarding civil.

### 2.2 `league_coaches`

| File | Line | Context |
|---|---|---|
| [components/coach/CivilCoachPicker.tsx](../components/coach/CivilCoachPicker.tsx#L70) | 70 | List coaches of a team for athlete picker |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L167) | 167 | Role lookup (ADMIN/COACH) on team page |
| [app/coach/components/CoachSidebar.tsx](../app/coach/components/CoachSidebar.tsx#L186) | 186 | Sidebar civil branch — fetch team name |
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L85) | 85 | Civil "Mon équipe" load |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L2032) | 2032, 2118 | 2 INSERTs in wizard (league_coaches row creation) |
| [components/shared/AthleteRecruiterProfileBody.tsx](../components/shared/AthleteRecruiterProfileBody.tsx#L616) | 616 | Recruiter reads coaches for civil athlete |
| [app/coach/decouvrir/page.tsx](../app/coach/decouvrir/page.tsx#L143) | 143 | Coach team resolution (sport + team) |

**Total** : 8 occurrences / 7 fichiers.

### 2.3 `league_teams` (TABLE references — distinct from `league_team_id` FK column)

| File | Line | Context |
|---|---|---|
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx#L112) | 112 | `.from("league_teams")` — picker load |
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx#L344) | 344 | Select embed `league_teams!league_team_id` |
| [app/athlete/profil/page.tsx](../app/athlete/profil/page.tsx#L939) | 939 | Profile load embed |
| [app/athlete/parametres/page.tsx](../app/athlete/parametres/page.tsx#L120) | 120 | Settings embed |
| [app/athlete/layout.tsx](../app/athlete/layout.tsx#L83) | 83 | Sidebar embed |
| [app/athlete/notifications/_components/PendingInvitations.tsx](../app/athlete/notifications/_components/PendingInvitations.tsx#L71) | 71 | Invitation embed |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L2097) | 2097 | Wizard create team |
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L89) | 89 | Civil "Mon équipe" embed |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L151) | 151 | Team detail base load |
| [app/coach/athletes/create/page.tsx](../app/coach/athletes/create/page.tsx#L310) | 310 | Athlete create wizard |
| [app/coach/decouvrir/page.tsx](../app/coach/decouvrir/page.tsx#L151) | 151 | Team name embed in Découvrir |
| [components/coach/CivilCoachPicker.tsx](../components/coach/CivilCoachPicker.tsx#L72) | 72 | Filter coaches by team |
| [components/shared/AthleteRecruiterProfileBody.tsx](../components/shared/AthleteRecruiterProfileBody.tsx#L434) | 434 | Recruiter profile embed |
| [components/onboarding/TeamSearchOrCreate.tsx](../components/onboarding/TeamSearchOrCreate.tsx#L105) | 105 | Team search component |
| [app/coach/athletes/_data/loadAthleteFromSupabase.ts](../app/coach/athletes/_data/loadAthleteFromSupabase.ts#L78) | 78 | Shared loader embed |

**Total** : ~15 occurrences directes du nom de table / 14 fichiers.

**Note** : la **colonne** `league_team_id` (sur `athletes`) est référencée environ
**90+ fois** dans le code (calcul/branching/select), spanning :
- Coach pages (decouvrir, equipes, athletes/create, equipes/[teamId])
- Athlete pages (onboarding, profil, parametres, layout, notifications, dashboard)
- Recruteur pages (recherche, favoris, pipeline)
- Shared components (AthleteRecruiterProfileBody, profileCompletion utility)

C'est cette **colonne** qui est l'épicentre de la refacto — chaque
référence devra être migrée vers `school_id` (avec `schools.type = 'LIGUE_CIVILE'`).

### 2.4 `league_team_athletes` (junction table)

| File | Line | Context |
|---|---|---|
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L207) | 207 | Roster load (civil) |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L458) | 458 | `removeCivilAthlete` DELETE |
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L124) | 124 | Civil team count for "Mon équipe" card |

**Total** : 3 occurrences / 2 fichiers.

**Note** : également référencé dans 3 migrations + le trigger
`apply_team_invitation_acceptance` (voir section 6.2).

### 2.5 Références dans migrations SQL

10 fichiers de migration touchent les 4 tables legacy :
- `20260417120000_baseline.sql` (CREATE TABLE leagues/league_coaches initial)
- `20260504010000_civil_leagues_phase1.sql`
- `20260506000000_athlete_recruiter_read_league_coaches.sql`
- `20260507010000_unique_leagues_identity.sql`
- `20260508010000_league_team_athletes.sql`
- `20260508020000_reset_athlete_anchor_on_team_remove.sql`
- `20260509000000_rls_civil_coach_update_athletes.sql`
- `20260509010000_team_invitations.sql`
- `20260511000000_civil_accept_set_coach_id.sql`
- `20260504040000_drop_coach_verification_tier.sql` (référence indirecte)

---

## 3. Code patterns — civil branching

### 3.1 Early-returns / branching `context === 'ligue_civile'`

| File | Line | Pattern |
|---|---|---|
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L158) | 158 | `if (profile?.context === "ligue_civile")` → civil load path |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L318) | 318 | `if (profile?.context === "ligue_civile")` → `setIsCivil(true)` + `loadCivilTeam()` |
| [app/coach/decouvrir/page.tsx](../app/coach/decouvrir/page.tsx#L132) | 132 | `if (profile?.context !== "ligue_civile")` → redirect to dashboard (civil-only page) |
| [app/coach/components/CoachSidebar.tsx](../app/coach/components/CoachSidebar.tsx#L182) | 182 | Sidebar civil branch detection |
| [app/coach/athletes/create/page.tsx](../app/coach/athletes/create/page.tsx#L306) | 306 | Wizard branching for athlete create form |
| [app/athlete/layout.tsx](../app/athlete/layout.tsx#L96) | 96 | `isCivil` derivation for sidebar affiliation label |
| [app/athlete/parametres/page.tsx](../app/athlete/parametres/page.tsx#L279) | 279, 315, 440, 709, 711 | 5 branches (Mon coach picker + display) |
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx#L356) | 332, 356, 412, 436, 463, 569, 761 | Wizard branching for school vs league_team selection |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L326) | 326, 329, 331, 1854, 1997, 2254 | Coach wizard branching (transient `coach_league` role) |
| [app/auth/page.tsx](../app/auth/page.tsx#L92) | 92, 141, 150, 427, 429 | Signup context selector |
| [app/auth/pro/page.tsx](../app/auth/pro/page.tsx#L32) | 32, 48, 58, 87 | Pro signup form context (3-way: scolaire/collegial/ligue_civile) |
| [lib/supabase/auth.actions.ts](../lib/supabase/auth.actions.ts#L19) | 19, 48 | Auth action context param |
| [components/partenaire/PartnerAthletesSearch.tsx](../components/partenaire/PartnerAthletesSearch.tsx#L99) | 99, 141, 393 | Partner search filter |
| [app/recruteur/recherche/page.tsx](../app/recruteur/recherche/page.tsx#L410) | 410, 505, 773 | Recruiter search filter |
| [app/recruteur/_data/mockSearchAthletes.ts](../app/recruteur/_data/mockSearchAthletes.ts#L29) | 29, 208, 217, 226, 235 | Mock data orgType |

**Total grossier** : ~45 occurrences du literal `'ligue_civile'` sur ~15 fichiers.

### 3.2 `isCivil` / `isLeagueCoach` state + derived bools

| File | Line | Pattern |
|---|---|---|
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L69) | 69, 287 | `useState(false)` + branch return |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L129) | 129, 531 | `useState(false)` + branch return at line 531 (after 5.5e-v additions) |
| [app/coach/components/CoachSidebar.tsx](../app/coach/components/CoachSidebar.tsx#L120) | 120, 270, 273 | State + `CIVIL_ITEMS` vs `CORE_ITEMS` switch + admin gate |
| [app/athlete/profil/page.tsx](../app/athlete/profil/page.tsx#L969) | 969, 1022, 1116, 1147, 1521 | Derived from `!raw.school_id` ; drives label `"Équipe civile"` vs `"École"` |
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx#L463) | 463, 569 | `userContext === "ligue_civile"` → governs school vs team write |
| [app/athlete/layout.tsx](../app/athlete/layout.tsx#L96) | 96, 107 | Sidebar affiliation label |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L1100) | 1100, 1115 | `user.role === "coach_league"` (transient onboarding role) |
| [app/auth/pending/page.tsx](../app/auth/pending/page.tsx#L47) | 47, 74 | `isLeagueCoach = role === "coach_league"` for pending message |

**Total** : ~25 occurrences / 8 fichiers principaux. Pattern dominant : early-return civil branch dans une page partagée école/civil.

### 3.3 Composants `Civil*` (named components / types)

| File | Symbol |
|---|---|
| [components/coach/CivilCoachPicker.tsx](../components/coach/CivilCoachPicker.tsx) | Component + `CivilCoachPickerProps` interface — picker pour "Mon coach" athlete-side |
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx#L51) | `CivilTeamPicker` inline component + `CivilTeamRow` type |
| [app/coach/equipes/[teamId]/page.tsx](../app/coach/equipes/[teamId]/page.tsx#L47) | `CivilAthlete` interface + `CivilTeamHeader` interface |
| [app/coach/equipes/page.tsx](../app/coach/equipes/page.tsx#L27) | `CivilTeam` interface |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L1773) | `CivilLeagueRow` type + inline component |

**Total** : 5 files; ~7 types/interfaces; 3 React components (inline ou exported).

### 3.4 Transient `coach_league` role (onboarding-only)

`coach_league` n'est PAS une valeur dans la table `users.role` (qui reste
COACH / RECRUTEUR / ATHLETE / ADMIN). C'est une **valeur transient** utilisée
dans le wizard d'onboarding pour brancher les steps.

| File | Line | Usage |
|---|---|---|
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L331) | 331-332 | `if (onboardingRole === "coach" && profile.context === "ligue_civile") onboardingRole = "coach_league"` |
| [app/onboarding/page.tsx](../app/onboarding/page.tsx#L369) | 369, 392, 600, 627, 655, 1100 | 6 branchings sur cette pseudo-role |
| [app/auth/pro/page.tsx](../app/auth/pro/page.tsx#L87) | 87, 102, 104 | Map context → onboarding role |
| [app/auth/pending/page.tsx](../app/auth/pending/page.tsx#L47) | 47, 74 | Affiche message d'attente différent |
| [lib/mock/admin.ts](../lib/mock/admin.ts#L26) | 26, 78, 79, 80, 1139, 1210 | Mock data type + entries |

---

## 4. RLS policies

### 4.1 Policies SUR les tables legacy (Q1 result)

| Table | Policy | CMD | Notes |
|---|---|---|---|
| `leagues` | Anyone can read leagues | SELECT | Public read |
| `leagues` | Anyone insert leagues | INSERT | Public insert (anti-pattern) |
| `leagues` | Authenticated read leagues | SELECT | Doublon avec public read |
| `leagues` | Authenticated users can create leagues | INSERT | Authenticated only |
| `league_coaches` | Athletes read coaches of own team | SELECT | Via `athletes.user_id=auth.uid()` |
| `league_coaches` | Coaches read own league assignments | SELECT | `coach_id = auth.uid()` |
| `league_coaches` | Recruiters read all league_coaches | SELECT | EXISTS users WHERE role='RECRUTEUR' |
| `league_coaches` | Team owners insert league_coaches | INSERT | Via `league_teams.owner_id` |
| `league_teams` | Authenticated read league_teams | SELECT | `true` (open) |
| `league_teams` | Owners manage their teams | ALL | `owner_id = auth.uid()` |
| `league_team_athletes` | Admins manage all rosters | ALL | `is_admin()` |
| `league_team_athletes` | Athletes read own membership | SELECT | Via `athletes.user_id=auth.uid()` |
| `league_team_athletes` | Coaches of team manage roster | ALL | Via `league_coaches` self-join |
| `league_team_athletes` | Recruiters read all rosters | SELECT | EXISTS users WHERE role='RECRUTEUR' |

**Total** : 14 policies on legacy tables.

### 4.2 Policies sur AUTRES tables référençant legacy (Q2 result — CRITIQUE)

⚠️ **Ces policies vont casser silencieusement si on supprime les tables legacy
sans les mettre à jour en premier**.

| Table | Policy | CMD | Référence à legacy |
|---|---|---|---|
| `athletes` | Civil coaches update own team athletes | UPDATE | Sub-select dans `league_coaches` WHERE `coach_id = auth.uid()` |
| `team_invitations` | Coaches cancel own invitations | UPDATE | Sub-select dans `league_coaches` (USING + WITH CHECK) |
| `team_invitations` | Coaches insert invitations on own teams | INSERT | Sub-select dans `league_coaches` (WITH CHECK) |
| `team_invitations` | Coaches select invitations on own teams | SELECT | Sub-select dans `league_coaches` (USING) |

**Total** : 4 policies sur 2 tables (`athletes`, `team_invitations`).

Ces policies utilisent `league_coaches` comme la "source of truth" pour
savoir qui est coach d'une équipe civile. Le refacto Phase 6 devra
remplacer ces sub-selects par des sub-selects sur la table équivalente
post-unification (vraisemblablement `school_coaches` ou un équivalent
unifié, selon le design final).

---

## 5. Foreign keys

### 5.1 FK pointant VERS legacy (Q3 filtré `to_table`)

| from_table | from_column | → to_table | to_column |
|---|---|---|---|
| `athletes` | `league_team_id` | `league_teams` | `id` |
| `league_coaches` | `league_id` | `leagues` | `id` |
| `league_coaches` | `league_team_id` | `league_teams` | `id` |
| `league_team_athletes` | `league_team_id` | `league_teams` | `id` |
| `league_teams` | `league_id` | `leagues` | `id` |
| `team_invitations` | `league_team_id` | `league_teams` | `id` |

**Total** : 6 FKs pointant vers legacy. Le DROP TABLE devra gérer ces
références (CASCADE explicite ou migration préalable).

### 5.2 FK pointant DEPUIS legacy (vers non-legacy)

| from_table | from_column | → to_table | to_column |
|---|---|---|---|
| `league_coaches` | `coach_id` | `users` | `id` |
| `league_team_athletes` | `athlete_id` | `athletes` | `id` |
| `league_teams` | `owner_id` | `users` | `id` |
| `league_teams` | `sport_id` | `sports` | `id` |
| `leagues` | `sport_id` | `sports` | `id` |

**Total** : 5 FKs. Aucun blocage post-DROP (les `users`, `athletes`, `sports`
ne dépendent pas de legacy).

---

## 6. Triggers et functions

### 6.1 Triggers attachés aux tables legacy (Q4 result)

| Table | Trigger | Timing | Event | Function |
|---|---|---|---|---|
| `league_team_athletes` | `reset_athlete_anchor_on_team_remove` | AFTER | DELETE | `reset_athlete_anchor_on_team_remove()` |
| `league_teams` | `set_updated_at_league_teams` | BEFORE | UPDATE | `update_updated_at()` |
| `leagues` | `set_updated_at_leagues` | BEFORE | UPDATE | `update_updated_at()` |

**Total** : 3 triggers. Le trigger `reset_athlete_anchor_on_team_remove`
(5.5d-iii-a) est load-bearing — il null-out `athletes.league_team_id` quand
une junction est supprimée. Sa logique devra être préservée post-unification
(probablement sur le nouveau modèle `school_athletes` ou équivalent).

### 6.2 Functions qui MENTIONNENT legacy (Q5 result — incluant fonctions
non attachées aux tables legacy)

| Function | Mentions |
|---|---|
| `apply_team_invitation_acceptance` | INSERT/UPDATE/DELETE sur `league_team_athletes` + UPDATE `athletes.league_team_id` + SELECT `league_coaches` |

**Total** : 1 function (mais c'est LA function du Flow A — toute la
logique d'acceptation civile s'appuie dessus). 5.5e-iii-a + 5.5e-iv-d
documentent son contenu.

Le trigger handler `reset_athlete_anchor_on_team_remove` mentionne aussi
les tables legacy mais comme c'est le handler du trigger ci-dessus, c'est
déjà couvert.

---

## 7. Index legacy (Q6 result)

| Table | Index | Type |
|---|---|---|
| `leagues` | `leagues_pkey` | PK |
| `leagues` | `uq_leagues_identity` | UNIQUE on `lower(name), sport_id, level` |
| `league_coaches` | `league_coaches_pkey` | PK |
| `league_coaches` | `idx_league_coaches_coach` | btree(coach_id) |
| `league_coaches` | `idx_league_coaches_league` | btree(league_id) |
| `league_coaches` | `league_coaches_league_id_league_team_id_coach_id_key` | UNIQUE 3-tuple |
| `league_teams` | `league_teams_pkey` | PK |
| `league_teams` | `idx_league_teams_league` | btree(league_id) |
| `league_teams` | `idx_league_teams_owner` | btree(owner_id) |
| `league_teams` | `uq_league_teams_identity` | UNIQUE on (league_id, name, age_group, division, season) |
| `league_team_athletes` | `league_team_athletes_pkey` | PK |
| `league_team_athletes` | `idx_league_team_athletes_athlete` | btree(athlete_id) |
| `league_team_athletes` | `idx_league_team_athletes_team` | btree(league_team_id) |
| `league_team_athletes` | `uq_league_team_athletes_membership` | UNIQUE (team, athlete) |

**Total** : 14 index. Tous disparaissent au DROP TABLE.

---

## 8. Estimation refactor effort

| Catégorie | Fichiers touchés | Effort estimé | Risque |
|---|---|---|---|
| Schema migration (ALTER schools.type CHECK + new constraint, data migration leagues/league_teams → schools) | 4 tables, 14 policies (4 legacy + 4 external + 6 RLS-affected sur autres), 3 triggers + 1 function | 4-6h | **High** |
| Code unification — pages | ~20 fichiers (auth, onboarding, equipes, decouvrir, athletes/create, profil, parametres, layout, dashboard, notifications, recherche, favoris, pipeline, partenaire) | 8-12h | **High** (régression école si mauvais routing du discriminator) |
| Code unification — components | 5 (CivilCoachPicker, AthleteRecruiterProfileBody, TeamCreateForm, TeamSearchOrCreate, profileCompletion util) | 3-4h | Medium |
| Drop tables + indexes | 4 tables + 14 indexes + 6 FKs in + 5 FKs out | 1h | Medium (cascade ordering) |
| Validation e2e | 2 scénarios complets (école end-to-end + civil end-to-end + recruteur cross-cutting) | 3-5h | Low |
| **Total** | **~30 fichiers** | **19-28h** | — |

---

## 9. Risques découverts NON prévus dans le plan v7

### 9.1 `schools.type` CHECK constraint bloque LIGUE_CIVILE today

```
schools_type_check : CHECK ((type = ANY (ARRAY['SECONDAIRE'::text, 'CEGEP'::text])))
```

Aucun row avec `type='LIGUE_CIVILE'` ne peut être inséré tant que la
CHECK n'est pas mise à jour. **À traiter en TOUT PREMIER en Phase 6.1**
sinon la data migration crashe.

### 9.2 Transient `coach_league` role pollutes le wizard

Le wizard `app/onboarding/page.tsx` utilise une pseudo-role `coach_league`
qui n'existe pas en DB. Mappé depuis `context='ligue_civile' + role='COACH'`.

Cette mécanique transient est cohérente avec le plan v7 (qui unifie sous
schools), mais 6 branchings + 2 fichiers auth en dépendent — devra être
**simplifié ou supprimé** en Phase 6.

Référencé aussi dans `lib/mock/admin.ts` (6 entries avec role='coach_league'),
mais c'est du mock — peut être supprimé après refacto si l'admin n'utilise
plus le concept.

### 9.3 Recruteur recherche / favoris / pipeline ont du civil-branching

```
app/recruteur/recherche/page.tsx#410 : if (orgType === "ligue_civile") query.is("school_id", null)
app/recruteur/favoris/page.tsx#390   : noTeam: !a?.school_id && !a?.league_team_id
app/recruteur/pipeline/page.tsx#924  : noTeam: !a?.school_id && !a?.league_team_id
```

Les 3 pages recruteur utilisent **l'absence de `school_id`** comme proxy
pour "civil". Post-unification (`schools.type='LIGUE_CIVILE'`), il faudra
basculer ces filtres vers `schools.type` au lieu de tester NULL/NOT NULL
sur `school_id` + `league_team_id`. **3 fichiers recruteur à toucher** —
pas mentionné explicitement dans le plan v7.

### 9.4 Composant partagé recruteur/coach `AthleteRecruiterProfileBody`

Lignes 352, 429, 434, 576, 600, 603, 618 — 7 références à `league_team_id` +
`league_teams!league_team_id` embed + un sub-query sur `league_coaches`.
**Composant cross-portail** : recruteur + coach. À unifier proprement
sans casser les deux côtés simultanément.

### 9.5 `lib/utils/profileCompletion.ts` checks `league_team_id`

Ligne 27 type def + ligne 112 logic. La complétion de profil compte
`league_team_id` ou `equipe_id` ou `t.id`. Petit fichier mais impact :
le score de complétion d'un athlète civil va passer par 0 le temps de
la migration. À handler dans la même PR.

### 9.6 Seed `supabase/seed/reference_data_full.sql` mentionne legacy

À auditer pour savoir si le seed initial du dev seed les tables legacy.
Si oui, le seed sera obsolète post-refacto.

### 9.7 Mock data `lib/mock/admin.ts` hardcode `LEAGUE_TEAMS` + role `coach_league`

```
lib/mock/admin.ts:1139 : export interface LeagueTeam { ... }
lib/mock/admin.ts:1210 : export const LEAGUE_TEAMS: LeagueTeam[] = [ ... ]
```

Mock data ; non bloquant mais devient obsolète. À nettoyer dans la même
PR si l'admin dépend de ce mock pour le moment.

### 9.8 Policies RLS public-write sur `leagues`

```
"Anyone insert leagues" : INSERT, with_check=NULL
```

Cette policy autorise n'importe quel utilisateur (même anon) à insérer
dans `leagues`. **Anti-pattern**. Le refacto devra remplacer par une
policy authenticated-only sur `schools` (déjà existant en tant que
"Authenticated users can create leagues" mais doublonné). Pre-existing
issue — à logger même hors Phase 6.

### 9.9 Doublon de policies SELECT sur `leagues`

```
"Anyone can read leagues"          SELECT qual=true
"Authenticated read leagues"        SELECT qual=true
```

Deux policies équivalentes. Effet net = ON (OR de policies). Post-DROP
TABLE c'est moot, mais à noter — pre-existing.

### 9.10 PendingInvitations component utilise `league_teams` embed direct

[app/athlete/notifications/_components/PendingInvitations.tsx#L71](../app/athlete/notifications/_components/PendingInvitations.tsx#L71)

```ts
league_teams!league_team_id(name, sports!sport_id(nom))
```

Post-unification, faudra que `team_invitations.league_team_id` devienne
soit `school_id` (avec embed sur `schools`), soit reste tel quel mais
référence vers `schools.id`. Décision Phase 6.

---

## 10. Critical path items (à attaquer en premier en Phase 6.1)

**Ordre OBLIGATOIRE** sous peine de crash de la data migration :

1. **ALTER `schools_type_check`** pour accepter `'LIGUE_CIVILE'` ([baseline.sql:1407](../supabase/migrations/20260417120000_baseline.sql#L1407)).
   Sans ça, l'INSERT de la migration data fail.

2. **Migrer les triggers** :
   - `reset_athlete_anchor_on_team_remove` doit avoir un équivalent sur
     la table junction unifiée (probablement `school_athletes` ou
     équivalent) AVANT de supprimer la junction legacy.
   - `apply_team_invitation_acceptance` doit être réécrit pour pointer
     vers les nouvelles tables/colonnes — c'est la function du Flow A.

3. **Migrer les RLS policies externes (section 4.2)** :
   - 1 policy sur `athletes`
   - 3 policies sur `team_invitations`
   - Toutes utilisent `league_coaches` en sub-select. Si on supprime
     `league_coaches` sans remplacer le sub-select, le UPDATE/INSERT/
     SELECT bloque silencieusement (FALSE par défaut).

4. **Data migration leagues → schools (LIGUE_CIVILE)** :
   - 4 leagues + 2 league_teams → schools rows + relation mapping.
   - 2 league_team_athletes → school_athletes (ou équivalent unifié).
   - 2 league_coaches → school_coaches (ou équivalent unifié).
   - 2 athletes.league_team_id → athletes.school_id (avec `schools.type='LIGUE_CIVILE'`).
   - team_invitations.league_team_id → team_invitations.school_id.

5. **Code refacto** (peut être splitté en sous-PRs après la data migration) :
   - Pages onboarding (athlete + coach + auth/pro)
   - Pages coach (equipes, equipes/[teamId], decouvrir, athletes/create, sidebar)
   - Pages athlete (layout, parametres, profil, dashboard, notifications, profileCompletion util)
   - Pages recruteur (recherche, favoris, pipeline, AthleteRecruiterProfileBody)

6. **DROP tables legacy** (en dernier, après que tout le code pointe
   vers le nouveau modèle) : `leagues`, `league_coaches`, `league_teams`,
   `league_team_athletes`. CASCADE sera nécessaire pour les triggers
   résiduels et les FKs.

---

## 11. Décisions à prendre par BP avant Phase 6.1

### Q1 — Que devient le champ `leagues.level` (AAA/AA/A/Club/Civil) ?

Le champ existe sur `leagues` mais `schools` n'a pas d'équivalent. Options :
- (a) Ajouter `schools.level` (nullable, only used for LIGUE_CIVILE rows)
- (b) Ajouter `schools.level` (général, applicable aux 3 types ?)
- (c) Migrer dans un sub-attribut JSONB

### Q2 — Que faire des seed data civil + des 2 athletes anchored ?

Aujourd'hui 2 athletes (Alex Dubois + MutTest) sont anchored à des
league_teams. Stratégies :
- (a) Migration in-place : déplacer dans `schools` avec `type='LIGUE_CIVILE'`,
  préserver les anchors
- (b) Reset des seed data : drop tout, re-seed depuis zéro post-refacto
- (c) Mix : préserver les test users (testsignup, Alex via auth.users) mais
  reset les seed bulk

### Q3 — `team_invitations` reste-t-il un système distinct ou unifié avec
   un futur `school_invitations` ?

La table `team_invitations` est neuve (5.5e-iii-a). Elle pointe vers
`league_teams`. Post-refacto :
- (a) Renommer pour pointer vers `schools` (LIGUE_CIVILE only ou unifié)
- (b) Créer un système d'invitation unifié école + civil
- (c) Garder distinct mais re-mapper la FK vers `schools`

### Q4 — La pseudo-role `coach_league` du wizard d'onboarding :
   - (a) La conserver pour le branching wizard
   - (b) Remplacer par `context==='ligue_civile' && role==='COACH'` direct
   - (c) Supprimer complètement et fusionner les wizards

### Q5 — Les 17 `users` avec `context=NULL` :
   Sont-ce des pré-onboarding (à laisser tel quel) ou des recruteurs/admins
   pour qui le context ne s'applique pas ? La policy de filtrage post-refacto
   devra clarifier ce que signifie un user sans context.

### Q6 — Anti-pattern policy "Anyone insert leagues" (section 9.8) :
   À fixer même hors Phase 6, ou à ignorer parce que la table disparaît ?

### Q7 — Mock data `lib/mock/admin.ts` LEAGUE_TEAMS + `coach_league` role :
   Le portail admin dépend-il encore de ces mocks ? Si oui, faut-il
   les régénérer post-refacto ?

---

## Annexe — Files par catégorie de touchpoint

### Pages avec early-return civil (à refactor)
- `app/coach/equipes/page.tsx`
- `app/coach/equipes/[teamId]/page.tsx`
- `app/coach/decouvrir/page.tsx` (civil-only, redirige non-civil)
- `app/coach/components/CoachSidebar.tsx`
- `app/coach/athletes/create/page.tsx`
- `app/athlete/layout.tsx`
- `app/athlete/parametres/page.tsx`
- `app/athlete/onboarding/page.tsx`
- `app/athlete/profil/page.tsx`
- `app/onboarding/page.tsx`

### Composants à refactor
- `components/coach/CivilCoachPicker.tsx`
- `components/shared/AthleteRecruiterProfileBody.tsx`
- `components/onboarding/TeamCreateForm.tsx`
- `components/onboarding/TeamSearchOrCreate.tsx`
- `components/partenaire/PartnerAthletesSearch.tsx`

### Auth flows
- `app/auth/page.tsx`
- `app/auth/pro/page.tsx`
- `app/auth/pending/page.tsx`
- `lib/supabase/auth.actions.ts`

### Recruteur cross-cutting
- `app/recruteur/recherche/page.tsx`
- `app/recruteur/favoris/page.tsx`
- `app/recruteur/pipeline/page.tsx`
- `app/recruteur/_data/mockSearchAthletes.ts` (mock — peut être supprimé)

### Utility libs
- `lib/onboarding/findOrCreateLeague.ts`
- `lib/utils/profileCompletion.ts`
- `lib/mock/admin.ts` (mock — refactor scope optional)

### Data loaders
- `app/coach/athletes/_data/loadAthleteFromSupabase.ts`
- `app/athlete/notifications/_components/PendingInvitations.tsx`
