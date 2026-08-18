# CLAUDE.md — Nexus (Quebec Sports Recruitment SaaS)

This file contains all project context, rules, and conventions for Claude Code.
Follow these instructions exactly. Updated April 2026.

---

## PROJECT OVERVIEW

**Nexus** connects Quebec secondary school athletes with CÉGEP recruiters through the RSEQ network. Core insight: athletes are the product — more athletes = more recruiter value = more revenue.

**Stakeholders:** Coaches (distribution channel, free tier), Athletes (supply, primary product), CÉGEP Recruiters (demand, paying customers), School/CÉGEP Directors (admin roles with free Pro access).

**Founder:** Bruno-Philippe Desfosses Simard (sole developer, direct recruiter contacts as GTM entry point).

---

## TECH STACK

- **Framework:** Next.js 14, TypeScript, Tailwind CSS
- **Database:** Supabase (self-hosted via Docker/CLI locally)
- **Font:** Outfit (Google Fonts) — weights: 700 headings, 600 buttons, 500 sidebar, 400 body
- **Dev server:** `npx next dev --port 3002`
- **Local project:** `C:\Users\bptds\OneDrive\Documents\Nexus`
- **Hosting:** AWS Canada Central — Montréal (`ca-central-1`), via Supabase (production, Loi 25), Vercel (demo only)
- **Demo:** `nexus-brown-zeta.vercel.app` (mock data, stable)

---

## DATABASE SCHEMA (Supabase — as of April 2026)

### Core Tables

**athletes** — main table, contains all athlete data
- id, user_id, school_id, coach_id, first_name, last_name, date_naissance, genre
- photo_url, email, telephone, nom_parent, telephone_parent
- consentement_parental, consentement_parental_date
- annee_diplomation, moyenne_generale, matieres_fortes (JSONB), mentions_academiques (JSONB)
- programme_cegep_vise (JSONB), ouvert_cegep_prive, ouvert_cegep_anglophone
- pret_changer_region, regions_cegep_preferees (JSONB)
- taille_pieds, taille_pouces, poids_lbs, envergure, taille_mains
- main_dominante, pied_dominant
- test_40_verges, saut_vertical, saut_longueur, developpe_couche, navette_agilite, sprint_100m
- sport_id (FK → sports), position_id (FK → positions), numero_jersey
- sport_secondaire_id (FK → sports), position_secondaire_id (FK → positions)
- equipe_id, ligue_id, league_team_id, numero_association
- ouvert_entraineur_cegep
- video_faits_saillants_url, hudl_url, youtube_url, instagram_url, video_match_complet_url, video_entrainement_url
- verified, verification_method, verified_at, verified_by
- profile_completion, cote_globale_entraineur, status, notes_coach, bio
- statut_recrutement_override, recrutement_override_at
- modified_since_verification, last_verified_state_at
- created_at, updated_at

**schools** — pre-seeded from MEQ open data (Données Québec)
- id, name, region, city, (+ other fields)
- Coaches join existing schools, never create them

**sports** — 16 sports
- id, nom, categorie, created_at
- Football, Basketball, Soccer, Hockey, Volleyball, Athlétisme, Badminton, Baseball, Cheerleading, Cross-country, Flag football, Futsal, Natation, Rugby, Ultimate frisbee, Autre

**positions** — per sport
- id, nom, abreviation, sport_id (FK → sports)

**evaluations** — coach evaluates athlete (8 criteria)
- coach_id, athlete_id (unique constraint on this pair)
- leadership, discipline, coachabilite, intelligence_jeu, competitivite, esprit_equipe, resilience, attitude_mentalite
- cote_globale, distinctions (JSONB array of strings: "captain", "allstar", "team_leader", etc.)
- rapport_entraineur

**leagues** — coach-declared civil leagues (no open data source exists)
- id, name, abbreviation, sport_id, city, region, level, website, logo_url, is_active
- federation, saison, created_by
- RLS: everyone reads, authenticated users create

### Recruiter Tables (created April 2026)

**recruiter_favorites** — red heart, unique per recruiter-athlete pair
- id, recruiter_id (FK → auth.users), athlete_id (FK → athletes), created_at
- UNIQUE(recruiter_id, athlete_id)
- RLS: recruiters manage own rows only

**recruiter_pipeline** — kanban stages per athlete
- id, recruiter_id, athlete_id, stage (default 'IDENTIFIE'), notes, moved_at, created_at, updated_at
- UNIQUE(recruiter_id, athlete_id)
- RLS: recruiters manage own rows only

**recruiter_notes** — private notes on athletes
- id, recruiter_id, athlete_id, content, created_at, updated_at
- RLS: recruiters manage own rows only

**recruiter_athlete_views** — view tracking for analytics
- id, recruiter_id, athlete_id, viewed_at
- RLS: recruiters manage own rows only

### Key DB Identifiers (cloud project `nrloizyemulbhujrqhgx` — verified 2026-08-03)

**RULE — resolve canonical UUIDs at runtime by email lookup, never hardcode them**
(`select id from public.users where email = '…'`). The IDs below are a map for
reasoning and for reading query output, NOT constants to paste into code or
tests. A stale ID fails silently: the `f35a5cdb-…` "test athlete" that sat here
for months pointed at nothing on cloud, and every test written against it was
green for the wrong reason.

**Admin**
- `bptds22@gmail.com` — user `f51384b5-a2c2-4827-9137-8aa8d29a1fe0`, role ADMIN
  + `is_platform_admin`. **The only account `is_admin()` lets through.** Every
  RPC gated on it (e.g. `create_team_join_token`, `revoke_team_join_token`)
  works with this account and no other.
- `bpdesfosses@gmail.com` / `51ec6dbe-…` is a COACH account, never an admin —
  and it does not exist on the cloud DB at all (local-only leftover). Do not
  use it as a fixture.

**Athlete fixtures** (all four have a real auth user → usable with a genuine JWT)

| athlete_id | user_id | who | state, and what it is good for |
|---|---|---|---|
| `1d06342e-a138-4a88-97ed-d8a9a102428f` | `2a046349-…` | Gabriel Mandziuk | no team — clean slate for a first attachment |
| `d4cd6432-1c45-47bc-8498-071075e4ae7c` | `b79de13d-…` | Athlete Nexus | exactly 14 → sits ON the `< 14` Loi 25 boundary and passes it; anchored on Dragons Juvenile (SECONDAIRE) |
| `fbf03493-03e7-4fc6-8f34-12a661440401` | `c6c679b1-…` | Test Android | anchored on a LIGUE_CIVILE team — the only shape where `reset_athlete_anchor_on_team_remove` actually writes |
| `d1e8b894-5699-4e20-acf1-a89de2966989` | `1b4bdeca-…` | Test Nexus | no team, no dependants — use THIS one for destructive fixture edits (e.g. flipping `date_naissance`), and restore immediately |

**Coach / school**
- Coach accounts: `nexus.coachs@nexussports.ca` (`a0000000-…-0000000000a2`),
  `nexus.coachc@nexussports.ca` (`a0000000-…-0000000000a3`)
- School: Saint-Jean-Eudes (`4f0e52ad-e9c7-4797-9b7b-92b25ed1307b`)

### RLS Policies
- athletes: coaches CRUD own, recruiters SELECT active athletes (status = 'ACTIF')
- recruiter_favorites/pipeline/notes/views: each recruiter sees only their own rows
- leagues: public read, authenticated insert
- Note: old "recruiters can read verified athletes" policy was replaced with "recruiters can read active athletes" — verified filter is client-side

### Supabase Join Syntax
- Use `sports!sport_id(nom)` and `positions!position_id(nom, abreviation)` — short FK hints, not full fkey names
- Use `schools!school_id(name, region, city)` for school joins
- Use `evaluations(distinctions, cote_globale, rapport_entraineur)` — joins on athlete_id automatically

---

## BADGE SYSTEM (Canonical — apply consistently)

### Verification (BINARY)
- Blue check #3B82F6 = verified (coach manually verified)
- Gray check #4a4d56 = not verified
- Profile completion % is a quality signal for recruiters only, NOT a verification gate
- Both verified and non-verified athletes visible to recruiters (filter available)

### Favorite Heart
- Filled red #E63946 = recruiter favorited
- Outline gray #6B7280 = not favorited

### Star Ratings
- Filled: #F59E0B (gold)
- Empty: #4a4d56 (dark gray)
- Cote globale = average of non-zero trait ratings (skip unrated traits, don't count as 0)

### Distinctions (from evaluations.distinctions JSONB)
- captain → "Capitaine" (icon: shield)
- allstar → "Équipe d'étoiles" (icon: star)
- team_leader → "Leader" (icon: award)
- Display as red pills: bg-[#E63946]/15 border-[#E63946]/30 text-[#E63946]

### Recruitment Status (on athlete, last-write-wins)
- Field: athletes.statut_recrutement_override
- Hierarchy: IDENTIFIE → CONTACTE → EN_DISCUSSION → VISITE_PLANIFIEE → ENGAGE → LETTRE_SIGNEE
- Any of coach/athlete/recruiter can update — last write wins
- Color coding: LETTRE_SIGNEE=green, ENGAGE=blue, VISITE=purple, EN_DISCUSSION=amber, CONTACTE=indigo, IDENTIFIE/OUVERT=gray

### Account Status Enum
- ACTIF, DESACTIVE, EN_ATTENTE, DIPLOME

---

## WIRING STATUS (as of April 2026)

### Recruiter Recherche Page (/recruteur/recherche) — FULLY WIRED
- Supabase query: athletes + sports + positions + schools + evaluations
- All data from DB, no mock data (only TypeScript type imported from mock file)
- Filters: sport (16), position (dynamic from DB), promotion, region (dynamic), rating, GPA, height, badges, academic, verified, video, hide favorites, sort
- Two-tier filter UI: primary filters always visible, advanced behind toggle
- Quick preset chips for common filters
- Cards show: photo, name, position, school, promotion, height/weight, stars, verified badge, favorite heart, distinction badges, recruitment status
- Grid and list views
- Favorites read/write from recruiter_favorites table
- FeatureGate on results beyond first 6

### Recruiter Athlete Profile (/recruteur/athletes/[id]) — MOSTLY WIRED
- Full Supabase query with all fields
- Distinctions mapped from string array to display objects
- Coach report, trait ratings, academic details, physical measurements all from DB
- Favorites toggle wired to recruiter_favorites
- Status pills: Vérifié + Actif + recruitment status from DB
- Coach reputation section: placeholder ("À venir") — no real coach_reviews table yet
- Known issue: still falls back to mockAthleteProfileFull for unmapped fields

### Coach Roster (/coach/athletes) — WIRED WITH NEW CARD DESIGN
- Supabase query by coach_id with photos, schools, evaluations
- Card design matches recruiter cards (same layout)
- Shows favorite count (from recruiter_favorites), not toggle
- Has "Modifier" + "Voir" links in footer
- Filters: sport, position, region, promotion, rating, badges, verified, video

### Coach Athlete Profile (/coach/athletes/[id]) — WIRED
- Uses loadAthleteRaw + mapToRecruiterView helpers
- All sections: identity, academic, physical, sport info, coach report, distinctions
- Simplified/Detailed toggle
- Verify/invite/modify actions
- Sport info section shows primary sport/position/team/league
- Academic details: matières fortes, programme CÉGEP visé, régions préférées
- Coach reputation: placeholder

### Coach Create Athlete (/coach/athletes/create) — WIRED
- All fields save correctly to Supabase
- sport_secondaire_id properly looks up UUID from sport name
- mentions_academiques saves correctly
- Position, jersey number, physical stats all save on creation

### Coach Modify Athlete (/coach/athletes/[id]/modifier) — WIRED
- 7-step wizard, loads from DB, saves to DB
- Evaluations upsert to evaluations table
- Sport/position UUID lookups on save

---

## DESIGN SYSTEM

### Colors
- Page background: #111317
- Card/surface: #1A1D24
- Card border: border-[#2D3748] or border-white/5
- Red accent: #E63946 (both coach and recruiter portals)
- Blue: #3B82F6 is the verified-check signal — used on verification badges/checks. Do NOT use blue on elements in athlete/verification contexts where it could be misread as a false verified signal (e.g. info pills on athlete/team cards). Blue is otherwise an acceptable accent/status hue elsewhere in the app (charts, KPIs, IN_PROGRESS status, etc.). Indigo is the distinct hue for CONTACTE pipeline status.
- Green: #22C55E (positive status, active)
- Gold: #F59E0B (star ratings)
- Error red: #EF4444 (critical alerts only)

### Typography
- ALL text: Outfit (Google Font)
- Headings: font-head (Outfit 700), uppercase, tracking-tight
- Body: font-sans (Outfit 400)
- Labels: font-bold, tracking-wider, uppercase, text-[12px], text-[#6b7280]

### Card Design (Athlete Cards — both portals)
- Photo area: 180px height, gradient overlay
- Top-left: verified check (28px) + favorite heart/count
- Top-right: 5 star rating in bg-black/70 backdrop-blur pill
- Info: Name + position pill + recruitment status pill
- School · Promotion year
- Height/weight (if available)
- Red distinction badges
- Footer: region (left) + action links (right)

### Filter UI (Two-tier)
- Always visible: search bar, sport, position, promotion, sort dropdown
- Quick chips: "4+ étoiles", "Vérifié", "Avec vidéo", "Avec distinction", "Masquer favoris"
- Advanced (collapsible): region, organisation, rating dropdown, GPA, height, academic badge
- Filter classes: nx-filter-select, nx-filter-active, nx-filter-checkbox

---

### Clavier mobile — tout conteneur avec input

`capacitor.config.ts` est en `KeyboardResize.None` : la WebView **ne se redimensionne jamais**, et `100vh`/`100dvh` ne rétrécissent pas quand le clavier s'ouvre. Aucune unité viewport ne protège d'un masquage.

Tout sheet, modale ou formulaire mobile contenant un `<input>`/`<textarea>` DOIT appliquer `useSheetKeyboardGeometry()` (`lib/hooks/useSheetKeyboardGeometry.ts`) — c'est-à-dire **remonter ET plafonner** : `bottom: kbdH` **et** `maxHeight: calc(100vh − kbdH − 12px)`.

Remonter sans plafonner est un bug, pas un demi-fix : le conteneur sort par le **haut** et le champ disparaît quand même. La règle globale `html.is-capacitor .fixed.bottom-0` de `globals.css` ne fait que la moitié du travail — ne jamais s'y fier seule.

Un `bottom: 0` **inline** bat cette règle et annule tout : ne jamais poser `bottom` en inline sur un sheet.


## BUSINESS RULES

### Athlete Self-Registration
- Athletes self-register with self-reported data
- Must select school and coach
- Profiles marked "Non vérifié" until coach verifies
- Parent notification for minors (14-17) with 7-14 day response window

### School Registry
- Pre-seeded from MEQ open data (Données Québec)
- Coaches join existing schools, never create them

### Civil Leagues & Clubs — data model (May 2026)

**Conceptual model**
- Civil clubs are CLUBS / CORPORATIONS, not schools. They live in the `schools` table with `type='LIGUE_CIVILE'` for shared plumbing only — do NOT describe them as schools in UI copy, reasoning, or new code.
- `schools` has NO `sport_id` column. Sport lives ONLY on `teams.sport_id`. Civil clubs are sport-agnostic — any sport's teams can hang under any club. Do NOT add `sport_id` to schools; do NOT sport-filter the club search query.
- Civil team model: `club (LIGUE_CIVILE schools row) → teams (each carrying name, division, age_group, gender, league as text, sport_id)`. Mirrors the school → teams model.

**Per-sport data reality**
- **Hockey** — RE-SHAPED from `data/import/elite_civil_leagues.json`. 15 M18 AAA Masculin teams seeded under their existing LIGUE_CIVILE clubs. LHEQ-F deferred (only 2 of 8 franchises publicly named).
- **Soccer** — COACH-CREATION. ~146 civil clubs seeded from Soccer Québec directory; teams are not centrally published, coaches create theirs via the onboarding flow.
- **Football** — COACH-CREATION. 40 civil clubs seeded from Football Québec directory (LFMM/MRFL/QBFL/QMFL/LFJMQ-QMJFL/LFQ9/LFFMQ, deduped). No team-level division/age/gender published per club.
- **Basketball** — COACH-CREATION today. ~32 civil clubs seeded from the regional PDFs (per-club category extraction was garbage with pdfplumber). A re-scrape with better extraction (Adobe PDF Extract API, Camelot lattice mode, or LLM-vision) plus Playwright/Puppeteer for Kreezee-hosted LBQ/CBQ standings is a PARKED future project — would move basketball to re-shaped status.

**Civil onboarding search flow**
- Sport comes from the Profil step's `sport_principal` (declared sport, persisted to `users.sport`). The step-2 search has a working-sport selector that defaults to the declared sport, is modifiable mid-search, and does NOT write back to `users.sport` / `sport_principal`.
- The selector's value is OWNED BY THE PARENT (`workingSportId` in `LeagueCoachLeagueStep`) and passed down to ALL three consumers (team search, umbrella, create form) so changing the sport scopes everything coherently. The old local-to-search version had a silent propagation gap where the umbrella + create used the Profil sport even after the coach switched the selector.
- The merged search surfaces matching TEAMS (sport-filtered) + matching CLUBS (all sports, since clubs are sport-agnostic). Picking a club routes to the umbrella (teams under that club for the working sport). The umbrella's empty state ("no teams in this sport") is the sport-relevance signal for clubs.
- Centralized vocab: `lib/config/civilVocab.ts` exports `AGE_OPTIONS`, `DIVISION_OPTIONS`, `AUTRE_VALUE`. Mirrors the `pricing.ts` shape (JSDoc + interface + named arrays). The team-create form imports from there — "Autre" on either select reveals a required free-text input whose typed value substitutes for the literal "Autre" on submit.

### Director Roles
- Director roles fully removed. The user_role enum has 5 values: COACH, RECRUTEUR, ATHLETE, ADMIN, PARTNER. School/CÉGEP admin status is determined by the is_school_admin boolean (school vs CÉGEP is inferred from role).
- Platform-level admin elevation (the founder account) is the separate is_platform_admin boolean on users — independent of the role enum. is_school_admin and is_platform_admin can coexist; both default to false.
- Free Pro/All Star access via is_school_admin flag

### Two Separate Evaluation Systems — NEVER CONFLATE
- Coaches evaluate athletes → evaluations table (8 criteria + distinctions)
- Recruiters evaluate coaches → CoachReview (not yet built) → feeds coach reputation

### Pipeline Status
- recruiter_pipeline.stage: IDENTIFIE → CONTACTE → EN_DISCUSSION → VISITE_PLANIFIEE → ENGAGE → LETTRE_SIGNEE
- Separate from athlete's statut_recrutement_override
- Both can coexist — athlete override is the "source of truth" shown on profile

---

## SUBSCRIPTION MODEL

- Recruiter: Free / Pro / All Star
- Coach: Free / Pro / All Star
- Athlete: Free / Pro
- "Passe à Pro" sidebar element: small gold card with icon
- Recherche page: first 6 results free, rest behind FeatureGate

## Feature gating

Use `<FeatureGate>` from `@/components/subscription/FeatureGate` to gate sections of UI by subscription tier.

- Conditional render only — gated children are NOT mounted, no Supabase calls fire, no data leaks via the Network tab
- Replaces children with `<UpgradePlaceholder>` showing the required tier and a "Voir les forfaits" CTA
- Admin bypass is opt-in per call via the `adminBypass` prop — only set true for operational items directors need regardless of tier (e.g. CÉGEP Inviter/Réassignation/Recruteurs)
- Do NOT use the older blur-overlay pattern. The `components/ui/FeatureGate.tsx` blur version was deleted in favor of the strict conditional-render version.
- Sidebar nav items use the same tier-rule shape via per-item `requiredTier` + `adminBypass` flags on `NavItem` — see `RecruiterSidebar.tsx`

---

## DEBUGGING PHILOSOPHY (Bruno-Philippe's 3-step method)

1. Identify the field in the UI
2. Tag it to the correct SQL table and column
3. Map it so data flows through to display

If something doesn't show, narrow to:
- (a) mapping not done in code
- (b) data not saved in SQL
- (c) no UI element to display it

Do the field-by-field audit BEFORE jumping to code fixes.

---

## DEV COMMANDS

```bash
npx next dev --port 3002          # dev server
taskkill /F /IM node.exe           # clear ports (Windows)
Remove-Item .next\dev\lock         # stuck lock file
rd /s /q .next && npx next dev --port 3002  # full rebuild
```

### Applying SQL to the local DB (Windows — critical, learned the hard way)

- **Apply SQL files via `docker cp` + `psql -f`, NEVER `Get-Content file.sql | docker exec -i psql`.** The PowerShell pipe corrupts UTF-8 — accented chars (é, è, à) and em-dashes silently become `??`. It once corrupted 188 teams + 4 schools and cost a full `db reset` recovery.
  ```
  docker cp file.sql supabase_db_Nexus:/tmp/file.sql
  docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -f /tmp/file.sql
  ```
  Run that `docker exec` from the **PowerShell tool**, not Bash — git-bash rewrites `/tmp/...` into a Windows path (MSYS path conversion).
- **Verify accented content by bytes, not by eye:** `SELECT octet_length(col), char_length(col)`. An accented char is 2 bytes, an em-dash 3 — so `octet_length > char_length` for clean accented text; `octet_length == char_length` on an accented string means it is corrupt (`??`). Terminal mojibake and real stored corruption look identical in psql output — only the byte count is trustworthy.
- Exporting with `\copy … TO STDOUT` also needs `-e PGCLIENTENCODING=UTF8`, or accents come out as `?`.

---

## MIGRATION SAFETY CHECKLIST

Follow this for EVERY schema change. (Authored 2026-07 from the working discipline — reconcile if a canonical version surfaces elsewhere.)

1. **Diagnostic-first.** Confirm the CURRENT live schema (columns, constraints, RLS, triggers) before drafting — never trust a summary or an old snapshot. Reconcile any discrepancy explicitly.
2. **Additive before code (expand-then-contract).** Ship additive DDL first (new nullable columns, new tables, `DEFAULT`-backfilled columns, `ADD CONSTRAINT … NOT VALID` then `VALIDATE`). Deploy it, then the code that uses it.
3. **No contract-breaking change while a shipped binary references it.** Drops/renames/`NOT NULL`-tightening only AFTER verifying no shipped mobile bundle calls the old shape. A dropped column once 400'd shipped apps; a **nullable stub shim** re-added it. Track deferred contractions in the ledger below.
4. **RLS via `SECURITY DEFINER` helpers**, never a raw `users` subquery inside a policy. Make participant/relationship checks type-aware where a discriminator exists.
5. **Guard positional triggers explicitly.** A trigger that infers role by position (sender vs a participant column) must carry an explicit discriminator guard (e.g. `conversation_type = 'RECRUTEUR_COACH'`) as an allowlist, so new rows/types are inert by default.
6. **Apply SQL UTF-8-safely:** `docker cp` + `psql -f` (never `Get-Content | psql`); run the `docker exec` from the **PowerShell** tool. Verify accents by bytes (`octet_length` vs `char_length`), not by eye.
7. **Local-first, per-role proof.** Apply locally, then prove behavior under each real role via `SET ROLE authenticated` + `request.jwt.claims` (or real JWTs/REST): allow-paths, deny-paths, cross-tenant denial, and **trigger non-firing** for the paths that must not fire. Runtime proof over logic claims.
8. **Both builds pass** (`npm run build` + `npm run build:mobile`) before committing app code.
9. **Prod only on BP's explicit per-migration GO.** CC commits on the branch; BP pushes/merges and applies to prod.

### Deferred contractions (post-build-3 — pending a no-shipped-caller check)

Contraction-breaking changes parked until no shipped binary references the old shape:

- **`athletes.sport_secondaire_id` / `position_secondaire_id`** — stub columns kept nullable for frozen binaries; real drop deferred (`20260717240000_remove_sport_secondaire.sql`).
- **`conversations` hard-delete (`recruiter_conversations_delete` policy)** — "no hard deletes anywhere" requires removing the recruiter's DELETE policy (CASCADE → messages), but that would 400 any shipped delete/archive button. Defer removal until verified no shipped bundle calls conversation delete.

### Deferred prod applies

Migrations validated locally but intentionally NOT applied to prod yet:

- **P3 recruiter↔athlete (`20260722110000`–`110300`, branch `feat/messaging-recruiter-athlete`)** — full backend (RLS + blackout + triggers + notifications), 10/10 per-role proofs + mark-read green locally. **Apply to prod only when the P3 UI build begins** (P1 is the active release train; P1 → main first, then P3). At apply time: (a) `RECRUTEUR_ATHLETE` already exists on prod from Phase A, so **no `ALTER TYPE ADD VALUE`** — but keep each migration a separate `apply_migration` (the enum/transaction split rule) and don't bundle; (b) pre-flight **diff prod's `message_insert_to_pipeline` against the base** before `110300` re-defines it; (c) two shipped-object changes land — `conversations.coach_id` NOT-NULL drop and the `conversations_insert` scope to `RECRUTEUR_COACH`; (d) eligibility ships as a `true` stub.

---

## GIT WORKFLOW

- Commit before each major restructure
- Tag stable UI state as v1.0-ui-only
- Branch strategy: feature branches off main
- GitHub push protection: Supabase keys in .gitignore

---

## FILE STRUCTURE (key files)

```
app/recruteur/recherche/page.tsx       — Recruiter search (fully wired)
app/recruteur/athletes/[id]/page.tsx   — Recruiter athlete profile
app/coach/athletes/page.tsx            — Coach roster (wired, matching cards)
app/coach/athletes/[id]/page.tsx       — Coach athlete profile
app/coach/athletes/[id]/modifier/      — Coach edit athlete (7-step wizard)
app/coach/athletes/create/page.tsx     — Coach create athlete
app/coach/athletes/_data/loadAthleteFromSupabase.ts — Shared data loader
app/coach/athletes/_data/mockRosterData.ts — RosterAthlete type definition
lib/supabase/client.ts                 — Supabase client
lib/types/models.ts                    — Shared TypeScript types
lib/config/sportBadges.ts              — Badge configuration
```

---

## SUBSCRIPTION PRICING (confirmed — exact numbers)

### Coach Tiers
- **Free:** Profile creation, evaluations, verification (always free — coaches are the distribution channel)
- **Pro:** $5.99/mo or $29.99/yr — unlocks Mon École, Stats École, Placement, Ma Réputation, Analytics
- **All Star:** $29.99/mo or $200/yr — everything including school management

### Recruiter Tiers
- **Free:** Anonymized athlete profiles (stats, school, sport, rating visible; name, photo, position, jersey hidden)
- **Starter:** $9.99/mo or $89/yr — full profile reveal, basic pipeline (2 statuses), auto-messaging, unlimited favorites
- **Pro:** $29.99/mo or $269/yr — full pipeline (8 statuses), full inbox, analytics, trends, custom prospect lists, export
- Custom prospect lists are EXCLUSIVELY Pro — Free and Starter have no access

### Athlete Tiers
- **Free:** Basic profile
- **Pro:** $9.99/mo or $79/yr — enhanced features

### Pricing Notes
- Annual pricing ≈ 75% of annualized monthly cost (standard discount)
- 60% option available as aggressive launch promotion
- CÉGEP management features require All Star (sidebar label: red "ALL STAR" not gold "PRO")

---

## AMBASSADOR PROGRAM

### Coach Ambassadors
- One per RSEQ region
- Reward: Pro free for 12 months + 1 bonus month per active referral
- 15% commission on paying referrals for 12 months
- Escalates to 20% commission + lifetime Pro at Elite status (20+ referrals)

### Recruiter Ambassadors
- 5-10 total
- Same reward structure as coach ambassadors

---

## DATA FLOW RULE (Critical — apply everywhere)

The coach's form mode (Simplifié/Détaillé) controls **DATA ENTRY** depth.
The recruiter's toggle (Simplifié/Détaillé) controls **DATA DISPLAY** depth.
These are **INDEPENDENT**.

### Simplified recruiter view benefits from detailed coach input:
- 8 trait criteria → condensed to 1 Cote Globale (auto-calculated average)
- Full mensurations → condensed to taille + poids only
- All academic fields → condensed to moyenne + programme + graduation + preference pills
- All media links → condensed to 1 CTA button (if highlight video exists)
- Full sport info → sport + position on player card (no separate section)
- Coach report → quote + Cote Globale stars only

### Detailed recruiter view shows EVERYTHING the coach entered:
- All 8 trait criteria individually with stars
- Full mensurations grid + all athletic tests
- Matières fortes, honneurs, régions préférées, programme CÉGEP visé
- All media link cards
- Sport info section with secondary sport, team, league
- Coach reputation mini-card

### Empty field handling:
If a field is empty (coach used simplified), show nothing — no placeholder, just skip cleanly.

---

## COACH REPUTATION SYSTEM

### Ma Réputation page IS the coach's public profile
- When a recruiter clicks a coach name, they see this page
- No separate coach profile page exists

### Badge Thresholds
- **Évalué:** 3 reviews (color: #3B82F6 blue)
- **Recommandé:** 5 reviews (color: #FFFFFF white)
- **Coach Élite:** 15 reviews (color: #E63946 red)
- **Placeur:** 5 athletes with LETTRE_SIGNEE pipeline status (color: #FFFFFF white)

### Coach Review System (not yet built)
- Recruiters evaluate coaches on 4 criteria → stored in CoachReview table
- Review widget appears inline in messaging thread (not popup)
- Triggers 24 hours after exchange with ≥1 recruiter message + ≥1 coach reply
- Maximum 2 dismissals before permanent hiding
- Feeds CoachReputationStats → visible on Ma Réputation page

---

## CIVIL LEAGUE SUPPORT (planned migration)

### Additional Tables (from migration prompt, may not be created yet)
- **league_teams** — teams within a league (name, league_id, level, division, gender)
- **league_coaches** — links coaches to leagues (coach_id, league_id, role)
- **users.context** — 'scolaire' | 'ligue_civile' | null

### League Coach Onboarding
- Context check: if coach selects "Ligue civile" during onboarding → different flow
- Select/create league → create team → first athlete
- Athlete creation sets league_team_id instead of school_id
- Sidebar subtitle shows league/team name instead of school name

---

## LOI 25 COMPLIANCE

### RPRP (Responsable de la Protection des Renseignements Personnels)
- Designated: Bruno-Philippe Desfosses Simard
- Contact: confidentialite@nexussports.ca
- Address: 856 Basile-Routhier, Repentigny, Quebec

### Key Decisions
- AWS Canada Central (Montréal, `ca-central-1`) via Supabase for 100% Quebec data residency
- Coach attestation (checkbox + PDF template) as MVP consent mechanism for minors
- Parent notification model for 14-17 year old self-registering athletes (7-14 day response window)
- ÉFVP is a one-time Nexus-level document, not per-athlete or per-CÉGEP
- Institutional contract acceptance required as hard gate before athlete data is accessible
- Privacy policy finalized with real RPRP details, must be used verbatim on /confidentialite

---

## MARKETING & BRAND

### Tagline
- "Be the Next" (playing on NEXT embedded in NEXUS) — assessed as strongest option
- Alternative: "Where talent meets opportunity"

### Logo
- Working with designer named Cody
- Current direction: torch/flame concepts fused with N or X letterform
- Goal: the letter's strokes should BECOME the flame (not carry it as a passenger)
- Reference quality: Chowpow dog logo (inseparable symbol)

### Video Campaign (11 videos, 4 phases)
1. **Teaser:** Coming Soon (anticipation, mystery)
2. **Launch:** Nexus is live, platform overview
3. **How-to series:** One per role (athlete, coach, recruiter, director, CÉGEP ROI)
4. **Credibility:** Coach testimonial, "Try for Greatness" inspiration, senior dev credibility (Loi 25, encryption, experience)

### Platform Strategy (per channel)
- **TikTok/Instagram Reels:** Athletes — POV format, trending audio, 15-30s
- **Facebook:** Coaches/parents — screen recording tutorials
- **LinkedIn:** Recruiters — Bruno-Philippe's personal brand, professional credibility
- **YouTube:** Long-form tutorials

### Marketing Budget (Phase 1)
- ~$105 one-time + ~$27/month — entirely organic

### Competition
- **Pipeline Recruiting (pipelinerecruiting.ca):** English-first, generic North American platform, no RSEQ integration, monetizes athletes not recruiters, questionable privacy for minors, AI-generated feel. Nexus advantage: French-first, Quebec institutional integration, deeper product (evaluations, pipeline, verification), Loi 25 compliant. Threat: their speed to market awareness, not product quality.

---

## PLATFORM SCOPE

- **Total pages:** ~70 (56 across portals + 14 admin)
- **Portals:** Coach, Recruiter (each with Free/Pro/All Star tiers)
- **Director portals removed:** user_role enum has 5 values (COACH, RECRUTEUR, ATHLETE, ADMIN, PARTNER); school/CÉGEP admin status is a boolean flag (is_school_admin) on a coach or recruiter user. Platform admin (the founder) is the separate is_platform_admin boolean.
- **Admin portal:** 14 pages, Phase 2A/2B/2C prioritization

---

## WHAT'S NEXT (TODO)

- Wire recruiter pipeline page to recruiter_pipeline table
- Wire recruiter favorites page (Mes Favoris)
- Google OAuth (deferred until public deployment — needs public redirect URL)
- Stripe integration: Billing, Customer Portal, Tax (TPS/TVQ)
- Supabase feature-flag system: subscriptions table + useSubscription hook
- Ambassador program launch
- Clean up old pipeline table references (replace with recruiter_favorites/recruiter_pipeline)
- Coach reputation system (coach_reviews table — not yet built)
- Logo redesign
## Brand Assets — Logo System

All logos live in `public/brand/` with clean filenames (copied from `brand_assets/`).

### Dark mode (current default)
- **Main logo:** `/brand/logo-white-red.png` (white wordmark + red flame)
- **Icon/favicon:** `/brand/icon-red.png`
- **Neutral fallback (no red):** `/brand/logo-white.png` + `/brand/icon-white.png`

### Light mode (future)
- **Main logo:** `/brand/logo-black-red.png` (black wordmark + red flame)
- **Icon/favicon:** `/brand/icon-red.png`
- **Neutral fallback (no red):** `/brand/logo-black.png` + `/brand/icon-black.png`

### Rules
- NEVER reference old WeLead placeholder logos (White red@4x.png, etc.)
- All logo references go through the NexusLogo component when possible
- Footer "Propulsé par" uses `/brand/logo-white-red.png` (dark) or `/brand/logo-black-red.png` (light)
- Icon red is the universal favicon/app icon across both themes
- Use neutral (no red) variants only when red clashes with surrounding UI
- Source PNGs in `brand_assets/` use spaces and @4x suffix — `public/brand/` uses lowercase-hyphenated names
