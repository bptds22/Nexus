# Phase 6 — Civil / École Unification — COMPLETE

## Status : SHIPPED (2026-05-14)

Phase 6 unifie le modèle DB Nexus en collapsant les tables legacy
(`leagues`, `league_coaches`, `league_teams`, `league_team_athletes`)
sous une seule table `schools` avec un discriminator `type`
(`SECONDAIRE`, `CEGEP`, `LIGUE_CIVILE`).

## Architecture finale

- `schools` — table unifiée pour écoles secondaires, CÉGEPs, ligues civiles. Discriminator : `type`.
- `school_coaches` — relation coach ↔ établissement (rôles : `COACH`, `DIRECTEUR`, `DIRECTEUR_INTERIM`).
- `teams` — équipes attachées à un établissement (école ou ligue, via `school_id`).
- `team_coaches` — relation coach ↔ équipe (`head_coach`, `assistant`, `coordinator`).
- `team_athletes` — junction athlete ↔ équipe (rattachement effectif).
- `team_invitations` — invitations de coach vers athlete (Flow A).

## Commits Phase 6 (chronologique)

### Bloc 1 — DB squelette
| SHA | Phase | Description |
|-----|-------|-------------|
| `f3496fd` | 6.1.0 | ALTER schools.type CHECK pour accepter LIGUE_CIVILE |
| `684eeb8` | 6.1.a | teams identity unique + team_invitations.league_team_id → team_id |
| `5a6bcb0` | 6.1.b | unify coaches RLS → school_coaches + team_coaches |
| `ec5d0a2` | 6.1.c | rewrite Flow A triggers pour le modèle unifié |
| `c563423` | 6.1.d | deterministic civil leagues seed |
| `181e725` | 6.1.e | purge legacy civil tables (vidage Bloc 2) |
| `206d474` | 6.1.f | smoke test SQL post-unification |

### Bloc 2 — Code applicatif
| SHA | Phase | Description |
|-----|-------|-------------|
| `37f15ad` | 6.2.pré | orgLabel helper (context-aware UI labels) |
| `e79ce73` | 6.2.a | unify civil/école onboarding wizard |
| `7982a93` | 6.2.a-hotfix | school_coaches INSERT policy + users.school_id sync |
| `2e3601b` | 6.2.b | remove /coach/decouvrir page + sidebar item |
| `ae2a0e5` | 6.2.c-1 | email lookup + inline banner on athletes/create |
| `0d8ff21` | 6.2.c-1-fix | diagnostic log + help text |
| `8a5dc09` | 6.2.c-1-debug-2 | instrument handleEmailChange |
| `360ea9a` | 6.2.c-1-clean | remove diagnostic console.logs |
| `0d3b430` | 6.2.c-1-pivot | name autocomplete (orphans only) |
| `61ba896` | 6.2.c-1-pivot | email partial autocomplete (orphans only) |
| `fa97c99` | 6.2.c-2 | invitation card + INSERT team_invitations |
| `0b54a66` | 6.2.d | unify team detail page (drop civil early-return) |
| `2963ed7` | 6.2.d-hotfix | restore école soft skeleton route guard |
| `4c3ce41` | 6.2.e | unify /coach/equipes list + sidebar CIVIL_ITEMS |
| `1a012d3` | 6.2.f | unify recruteur portal + cross-portail components |
| `d344538` | 6.2.f-hotfix | orgType filter silently ignored fix |
| `bfb041d` | 6.2.g | final legacy refs cleanup |
| `21e4575` | 6.1.x | admin off school_coaches.team_name dependency |
| `da54c8e` | 6.2.h | refacto 6 fichiers athlete portal (unblock 6.3) |

### Bloc 3 — DROP + finalisation
| SHA | Phase | Description |
|-----|-------|-------------|
| `20f072c` | 6.3 | DROP legacy tables + school_coaches.team_name |
| `2d70641` | 6.3-followup | include orphan athletes in search regardless of org type |
| `3d7ef66` | 6.3-followup-2 | filter orphan athletes by origin context |
| `5be6de2` | 6.3-followup-3 | orphan athletes get undefined orgType, not civil fallback |
| `429db44` | 6.3-followup-4 | denormalize athletes.context (RLS-blocked embed fix) |
| `2867c2f` | 6.1.y | admin Établissements unification (LIGUE_CIVILE support) |

## Tables DROP (Phase 6.3)

- `leagues`
- `league_coaches`
- `league_teams`
- `league_team_athletes`

## Column DROP (Phase 6.3)

- `school_coaches.team_name`
- FK `athletes_league_team_id_fkey` (la colonne `athletes.league_team_id` est preservée — P3)

## Column ADD (Phase 6.3-followup-4)

- `athletes.context` — denormalisé depuis `users.context` (la table users
  est RLS-blocked pour le recruteur). Backfill + sync trigger.

## Triggers Phase 6 actifs

- `apply_team_invitation_acceptance` (6.1.c) — Flow A : invitation ACCEPTED
  → set `athletes.school_id` + INSERT `team_athletes`.
- `reset_athlete_anchor_on_team_remove` (6.1.c) — sur DELETE `team_athletes`,
  reset l'anchor de l'athlete (`school_id` → NULL).
- `trg_sync_athlete_context` (6.3-followup-4) — AFTER UPDATE OF context ON
  users → propage vers `athletes.context`.

## Helpers RLS

- `is_coach()` (6.2.c-1) — SECURITY DEFINER, évite la recursion RLS dans
  les policies users.

## Conventions DB locked

- `schools.type` : `SECONDAIRE` | `CEGEP` | `LIGUE_CIVILE`.
- `users.context` : `'ligue_civile'` (positif) vs NULL/`'scolaire'` (défaut).
- `athletes.context` : miroir denormalisé de `users.context`.
- Pattern positif côté code : test explicite sur `'ligue_civile'`, sinon
  scolaire (NULL = défaut scolaire/legacy).

## Validation finale (Phase 6.4)

- Smoke test 6.1.f : **8/8 PASS**
- Zero refs `from('league_*')` / `from('leagues')` en code applicatif.
- Zero refs `school_coaches.team_name` en code (2 comments documentaires).
- `league_team_id` en code : uniquement 2 INSERT `league_team_id: null`
  dans `app/athlete/onboarding/page.tsx` (P3 deferred).
- `npm run build` successful, `tsc --noEmit` clean.

## P3 deferred

- **`athletes.league_team_id` column** — toujours présente, 2 INSERT
  `league_team_id: null` dans `app/athlete/onboarding/page.tsx:495,599`.
  DROP différé jusqu'au refacto onboarding.
- **`trg_sync_athlete_context` AFTER UPDATE only** — gap si un flow set
  `users.context` puis crée la row athlete sans UPDATE ultérieur. Les
  flows actuels (onboarding) font un UPDATE → OK.
- **Admin — changement de type établissement** — modifier `schools.type`
  sur une row existante a des effets de bord non gardés (athletes
  anchored, teams attachées).
- **Admin — permissions création LIGUE_CIVILE** — pas de différenciation
  admin vs directeur.
- **URL `/admin/schools`** — non renommée en `/admin/etablissements`
  (évite la cassure des bookmarks ; seul le label sidebar a changé).

## Next : Phase 7+

Roadmap produit — Capacitor mobile, civil onboarding V2, Stripe billing,
ambassador program, coach reputation system (coach_reviews table).
