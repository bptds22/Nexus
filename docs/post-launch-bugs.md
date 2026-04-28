# Post-Launch Bugs — Nexus

**Date discovered:** 2026-04-23
**Context:** Phase 5 manual testing against `v0.9.0-pre-cloud`
**Status:** Logged for post-tag fix pass

Each item is actionable as a stand-alone PR. Grouped by impact, not by
file.

---

## P0 — Affect new user onboarding

*(all cleared — see **Closed** at the bottom)*

---

## P1 — Silent UX failures

- [ ] **Athlete photo upload doesn't persist to profile.** Athlete
      fills profile, uploads a photo, UI reports success (or no
      error), but `photo_url` stays empty and the profile shows
      placeholder initials. Tried with Kako, couldn't resolve.
      Repro: log in as athlete, go to
      [`/athlete/profil`](../app/athlete/profil/page.tsx), click
      modifier, attempt to upload avatar.
      Needs investigation:
      - Does the file actually land in `storage.objects`?
      - Does `athletes.photo_url` get written?
      - If written, does the UI read from the right field?
      - Any storage RLS policies blocking the upload path?

- [ ] **Coach cannot see athletes from their own school.** Coach at
      a school (e.g., Collège St-Jean-Vianney) cannot see athletes
      assigned to that same school in their roster. Breaks the core
      coach workflow: approval, evaluations, rapport d'entraîneur,
      ratings — all gated behind the coach being able to find the
      athlete.
      Repro: create athlete at School X with `coach_id` set to Coach
      Y's user ID. Log in as Coach Y. Athlete not visible in coach's
      roster.
      Investigate in order:
      1. Is `athletes.coach_id` actually set to Coach Y's user ID?
      2. Does the coach roster query filter by `coach_id`,
         `school_id`, or both? Which tables does it join?
      3. RLS on `athletes` for `COACH` role — what's the SELECT
         policy?

      **2026-04-27 — Partially shipped** (commit
      [`050540c`](../../../commit/050540c)):
      The Mes Athlètes roster page now filters by `school_id`
      instead of `coach_id`. The `athlete_suggestions` SELECT RLS
      policy follows the same school-scoped model.
      Verified live with three coaches at Collège St-Jean-Vianney
      (`test-coach@`, `demo.coach.vianney@`, `coachmarketing@`) —
      all three see the same roster and same À TRAITER suggestions
      queue.
      Architecture note: `athletes.coach_id` is now
      soft-deprecated. Stop reading from it; leave the column in
      place. Hard-deprecation (dropping the column) is logged as
      P3.
      Still open within this P1:
      - Ma Réputation may filter coach stats by `coach_id`
        ownership
      - Coach side of recruiter messages — needs decision: stay
        coach-scoped (private to specific coach) or go
        school-scoped?
      - `/coach/activites` page (separate from the dashboard
        widget) — needs RLS audit; the dashboard widget feed is
        now school-scoped via the new policy, but the standalone
        page may have its own gap
      These need audit + same school-scope fix in a follow-up
      session.
      Migration:
      [`supabase/migrations/20260427130000_athlete_suggestions_school_select.sql`](../supabase/migrations/20260427130000_athlete_suggestions_school_select.sql)

      **2026-04-28 — Dashboard school-scoped** (commit
      [`7d856e7`](../../../commit/7d856e7)): The coach dashboard
      ([`app/coach/tableau-de-bord/page.tsx`](../app/coach/tableau-de-bord/page.tsx))
      foundational athletes query now filters by `school_id`
      instead of `coach_id`. All downstream widgets (KPIs, Hot
      Athletes, Activity Feed, banners) build on
      `coachAthleteIds` and inherit the new scope automatically.
      Three other `coach_id` queries on the page deliberately
      preserved (interim director check, demotion notifications,
      personal "athlete added" counter — all about ME, not
      roster reads).
      Verified as `coachmarketing@`: `totalAthletes` went from 1
      to 4 (full St-Jean-Vianney ACTIF roster).

      **2026-04-28 (late evening) — Activity feed RLS + team
      modal** (commit
      [`058cb86`](../../../commit/058cb86)): Two more pieces of
      school-coach linking shipped:
      - `recruiter_activity_log` SELECT policy now school-scoped
        via JOIN to `users.school_id`. The dashboard activity
        widget on
        [`app/coach/tableau-de-bord/page.tsx`](../app/coach/tableau-de-bord/page.tsx)
        now populates with cross-athlete events. Migration:
        [`supabase/migrations/20260428040000_activity_log_school_scope.sql`](../supabase/migrations/20260428040000_activity_log_school_scope.sql)
      - Team-detail "Ajouter un athlète" modal at
        [`app/coach/equipes/[teamId]/page.tsx`](../app/coach/equipes/%5BteamId%5D/page.tsx)
        switched its athletes query from `coach_id = me` to
        `school_id = team.schoolId`. The coaches picker on the
        same page already used the same pattern.
      Verified as `coachmarketing@`: activity feed populates with
      cross-athlete events; team modal shows all 4
      St-Jean-Vianney ACTIF athletes minus already-on-team ones.

- [ ] **Duplicate Signaler/Favori buttons on athlete profile.** The
      athlete profile page has two sets of Signaler + Favori buttons:
      one in the top-right corner of the header, one in the bottom
      CTA bar next to "Contacter le coach". Should pick one (user
      prefers the bottom CTA bar). Discovered 2026-04-26.

- [ ] **Pipeline tier gating inconsistent.** "Mon processus" appears
      in the Free section of the recruiter sidebar but pipeline is
      documented as a Pro+ feature in /tarifs and is gated by
      paywalls elsewhere (athlete profile shows upgrade modal for
      Free users). Either:
      (a) Pipeline IS a Free feature and the paywall is wrong
      (b) Pipeline is Pro+ and the sidebar should move "Mon
          processus" to the locked section
      Decision needed: confirm tier gating once and align everywhere.

      **2026-04-27 — Partially shipped** (commit
      [`2afa0a3`](../../../commit/2afa0a3)): decision (b). The
      recruiter sidebar at
      [`app/recruteur/_components/RecruiterSidebar.tsx`](../app/recruteur/_components/RecruiterSidebar.tsx)
      now gates each nav item against the user's tier (`free` /
      `pro` / `all_star`) plus their `is_school_admin` flag.
      Locked items show a lock icon and intercept the click to
      open the existing `UpgradeModal` with the matching tier
      card and the nav item's label as the contextual headline.
      Final tier matrix:
      - **Free open:** Tableau de bord, Recherche, Mes favoris,
        Mon profil, Paramètres
      - **Pro+:** Mon processus, Listes, Messages, Activités
      - **All Star:** Mon CÉGEP, Stats recrutement, Recrues
        confirmées (analytics — no admin bypass)
      - **All Star OR school admin:** Recruteurs, Réassignation,
        Inviter (operational — directors reach these regardless
        of tier)

      `RECRUITER_FEATURES.pro.can_use_custom_lists` in
      [`lib/hooks/useSubscription.ts`](../lib/hooks/useSubscription.ts)
      still reads `false` — the hook table is now out of sync
      with the sidebar's "Listes is Pro+" decision. Reconciling
      the hook is deferred to the downstream-gate work.

      Still open within this P1:
      - Mes Favoris cap (10 max for Free) at the favorite action
      - Search results cap (10 for Free) on `/recruteur/recherche`
      - Athlete card anonymization on `/recruteur/recherche`
        (name, photo, jersey hidden for Free)
      - Athlete profile detail gating (videos, academic full,
        coach contact, detailed eval, recruitment status,
        who-viewed)
      - `useSubscription.ts` feature table reconciliation
        (`can_use_custom_lists` still false for Pro in the hook;
        sidebar and page guards both use Pro+ — hook is the
        outlier now)

      **2026-04-28 — Page guards shipped (2/N)** (commit
      [`23c060e`](../../../commit/23c060e)): 13 recruteur pages
      now wrapped in `<FeatureGate>`. Direct URL access for gated
      pages renders `UpgradePlaceholder` instead of the page
      content. Strict conditional render — children not mounted,
      no Supabase calls fire. Verified across 4 user/admin
      scenarios.
      - **Pro+:** pipeline, listes, messages (×3 routes),
        activites
      - **All Star:** cegep root + stats + recrues
      - **All Star + admin bypass:** cegep/recruteurs,
        /reassignation, /inviter, /entraineurs/[id]

      **2026-04-28 — Pipeline demo mode for Free (3/N)** (commit
      [`0002c30`](../../../commit/0002c30)): Pipeline is now
      Free-accessible as a demo. Real favorited athletes load in
      IDENTIFIE; drag/save actions tease toast and revert.
      Sidebar unlocked Mon processus. Listes / Messages /
      Activités / CEGEP routes stay hard-paywalled (no demo
      mode).
      The "see the value" pattern only makes sense where the
      surface is visually compelling AND the demo data is the
      user's own limited-access data (10-favorite cap on Free).
      Pipeline qualifies. Listes (custom prospect lists) and
      Activités (activity feed) don't have natural demo-data —
      those stay paywalled.

- [ ] **Onboarding wizard allows skipping school selection.** In the
      shared onboarding wizard
      ([`app/onboarding/page.tsx`](../app/onboarding/page.tsx)),
      users can advance past steps without selecting a school in
      some flows. The result is users landing in the platform with
      `school_id = NULL`, which breaks downstream queries (no
      athletes visible, no school stats, no roster). Discovered
      2026-04-26 during interim-director feature testing.
      Investigation needed before fix:
      - Which flows allow advancing without a school? (school
        coach, league coach, CÉGEP recruiter, athlete signup at
        `/auth`)
      - Athlete onboarding already enforces school via
        `SchoolSelect` at
        [`app/athlete/onboarding/page.tsx`](../app/athlete/onboarding/page.tsx)
        — verify other flows have the same enforcement
      - League coaches don't have a single "school" — they have a
        league. Don't blanket-require school for that flow
      - CÉGEP recruiters need a CÉGEP school assignment, but the
        validation needs to be flow-specific
      Likely fix surface: `canProceed()` / step-validation logic
      in the onboarding wizard, gated per flow type.

## P1 — Data collection

*(all cleared — see **Closed** at the bottom)*

---

## P2 — Observability

- [ ] **Team filter / view toggle on coach dashboard.** Reported
      2026-04-28. After school-coach linking shipped, dashboard
      shows school-wide roster (correct per model decision). For
      coaches at multi-sport / multi-team schools, this mixes
      relevant data with irrelevant. Add either:
      - A team filter dropdown (default: all teams, narrows
        KPIs/feed/Hot Athletes to selected team)
      - Or a school-view vs team-view toggle (per-coach default
        preference)
      Open product questions:
      - Should ALL widgets honor the filter, or just some?
      - Default selection for new coaches — all or "my primary
        team"?
      - Persist selection per user across sessions?
      - Does this interact with school admin views (school-wide
        stats is the admin's primary use case)?
      Not a launch blocker — single-sport schools already see
      what they need. Defer to post-launch polish.

- [ ] **Athlete-route guard pushes non-athletes to onboarding.**
      Reported 2026-04-28. Visiting any `/athlete/*` route as a
      recruiter or coach triggers the athlete onboarding flow
      with the user's name + email pre-filled. Could create
      phantom athlete rows tied to non-athlete user records if
      the user submits the form.
      Reproduced: logged in as `test-allstar@` (recruiter),
      navigated to `/athlete/visibilite`. App pushed to
      `/athlete/onboarding` with "Test" / "All star" /
      `test-allstar@gmail.com` pre-populated and sidebar showing
      `MON ESPACE ATHLETE`.
      Pre-existing behavior, not introduced by recent commits.
      Fix: athlete route layout/guard should redirect
      non-athletes to their correct portal (`/recruteur/...` or
      `/coach/...`) instead of pushing them through athlete
      onboarding.

- [ ] **Debug `console.log` noise in production.** Examples: `Athletes
      loaded: 1 null` from the recherche page, `[Homepage] Hero section
      rendered` from `app/page.tsx`, `[GrainOverlay] mounted` from the
      editorial system. Strip before public launch. Sweep with
      `grep -rn 'console.log' app/` and decide per-site.

- [ ] **"Pas dans le pipeline" status should tease Pro upgrade for
      Free users.** On the recruiter athlete profile, the "Mon statut"
      box renders `"Pas dans le pipeline"` when the current recruiter
      hasn't added the athlete — but Free recruiters can't add to the
      pipeline at all (Phase 2a RLS blocks the write past `CONTACTE`
      and the Free recruiter currently has no UI to insert even the
      baseline `IDENTIFIE` row from this page). For Free accounts this
      text is dead; should read something like `"Passe à Pro pour
      ajouter au pipeline"` with an upgrade CTA.
      File: [`app/recruteur/athletes/[id]/page.tsx`](../app/recruteur/athletes/%5Bid%5D/page.tsx)
      around the `Mon statut` block. UX polish — save for the
      upgrade-prompts pass.

- [ ] **Athlete portal still uses mock data in dashboard and other
      pages.** The mock file
      [`lib/mock/athlete.ts`](../lib/mock/athlete.ts) exports
      `athleteUser`, `athleteStats`, `athleteActivity`,
      `athleteNotifications`, `profileChecklist`, etc. — all
      hardcoded Marc-Antoine Tremblay data.
      Settings page (`/athlete/parametres`) was wired to real data
      on 2026-04-26 (commit
      [`fa4e295`](../../../commit/fa4e295)), but the dashboard and
      other athlete portal pages likely still import these mock
      values.
      Audit needed: grep for `from "@/lib/mock/athlete"` across
      `app/athlete/` and replace mock imports with real Supabase
      queries on each page. Removing `lib/mock/athlete.ts` entirely
      is the goal once all consumers are wired.

---

## P3 — Latent / future work

- [ ] **Existing Studio-uploaded photos use signed URLs with 7-day
      expiration.** Some athlete photos in the database use signed
      storage URLs (`/storage/v1/object/sign/Ath Photos/...?token=...`)
      with ~7-day expiration tokens. These photos were uploaded via
      Supabase Studio (not the app), and will silently break when
      their tokens expire.
      Examples discovered 2026-04-26:
      - Alexandre Bouchard (`a1c06999-c2f9-4959-b553-cb9dbcaaa923`)
      The `Ath Photos` bucket is now public (commit
      [`982bbb5`](../../../commit/982bbb5)), so future uploads via
      the app use long-lived public URLs. Existing signed-URL photos
      need one of:
      - Manual re-upload (small data set so far, manageable)
      - Migration script that downloads existing files and re-uploads
        them as public URLs
      - Accept they'll break and re-upload on demand
      Decision needed before token expiration. Track which athletes
      have signed URLs vs public URLs:
      ```sql
      SELECT id, first_name, last_name, photo_url
      FROM athletes
      WHERE photo_url LIKE '%/sign/%';
      ```

- [ ] **Implement CÉGEP coach detail messaging (Phase 2).**
      Reported 2026-04-28. The "Envoyer un message" button at
      [`app/recruteur/cegep/entraineurs/[id]/page.tsx:293-295`](../app/recruteur/cegep/entraineurs/%5Bid%5D/page.tsx#L293-L295)
      is a stub. Its `onClick` calls `showToast("Messagerie
      interne (Phase 2)")` instead of navigating.
      When implementing: a director messaging a coach from the
      CÉGEP context has no specific athlete attached. The
      current compose flow requires an athlete (the
      one-thread-per-(recruiter, coach, athlete) tuple
      invariant). Either:
      - Allow athlete-less conversations for director-to-coach
        organizational messaging
      - Or force the director to pick an athlete first
        (degraded UX)
      Product decision needed before code.

---

## Closeout rule

When an item ships, move it to the **Closed** section below with a
commit SHA and/or file path so the audit trail stays intact. Pattern:

```md
### [x] Short title
Closed in commit `abc1234`. One-line summary of what landed.
```

Keep the file; it becomes the Phase 5 → v1.0 delta log.

---

## Closed

### [x] Migrate /auth athlete signup to shared helper
Closed in commits [`aa56cff`](../../../commit/aa56cff) (helper hardening —
`extraMetadata` param, defensive `.upsert()`, surfaced errors) and
[`20158bd`](../../../commit/20158bd) (athlete migration). Inline
duplicate upsert removed from [`app/auth/page.tsx`](../app/auth/page.tsx);
signup now goes through [`lib/supabase/auth.actions.ts`](../lib/supabase/auth.actions.ts)
with `{ sport: selectedSport }` threaded via `extraMetadata`.

### [x] Restore `handle_new_auth_user` trigger on `auth.users`
Closed in migration
[`supabase/migrations/20260423030000_restore_handle_new_auth_user_trigger.sql`](../supabase/migrations/20260423030000_restore_handle_new_auth_user_trigger.sql)
(shipped in commit [`4a60680`](../../../commit/4a60680)). Trigger
restored with `CREATE OR REPLACE TRIGGER` for idempotent replay.
Function body already existed in the baseline — only the
`AFTER INSERT` trigger on `auth.users` was missing. Verified
end-to-end during Phase 5 manual testing.

### [x] `/inscription` 404 from marketing CTAs
Closed in commit [`785a582`](../../../commit/785a582). Added a single
redirect rule in [`next.config.ts`](../next.config.ts):
`/inscription` → `/auth?mode=signup` (307, `permanent: false`). Query
params (`?role=...`, `?ref=...`) pass through via Next.js's default
source-to-destination merge. Fixes all 22 affected CTAs across
[`app/page.tsx`](../app/page.tsx),
[`app/tarifs/page.tsx`](../app/tarifs/page.tsx),
[`app/pour-les-coachs/page.tsx`](../app/pour-les-coachs/page.tsx),
[`app/pour-les-recruteurs/page.tsx`](../app/pour-les-recruteurs/page.tsx),
and [`app/guide-recrutement/page.tsx`](../app/guide-recrutement/page.tsx)
without touching any of them.

### [x] Free recruiter message send fails silently
Closed in commit [`5837c90`](../../../commit/5837c90). Added an
`ErrorToast` component to
[`app/recruteur/messages/nouveau/page.tsx`](../app/recruteur/messages/nouveau/page.tsx)
with an optional `Passer à Pro` CTA linking to `/tarifs`. Both the
`conversations` and `messages` INSERT handlers now detect tier denials
(PostgREST code `42501` or RLS keywords in the error message) and
surface an actionable toast. Side benefit: closed a related latent bug
where a failing `messages` INSERT would still trigger the success
toast — success now only fires when both writes land cleanly.

### [x] `first_coach_claim` trigger references non-existent column
Closed in migration
[`supabase/migrations/20260423200000_fix_first_coach_claim_trigger.sql`](../supabase/migrations/20260423200000_fix_first_coach_claim_trigger.sql)
(shipped in commit [`9719fac`](../../../commit/9719fac)). The old
function body read `school_registry.director_id` — the table had been
dropped and the column never existed. Rewrote to check existing
directors via `school_coaches` rows with role `DIRECTEUR` /
`DIRECTEUR_INTERIM`, guard on `NEW.role = 'COACH'` so PENDING rows
don't auto-promote, and use the correct enum value `DIRECTEUR_INTERIM`
(replacing the outdated `ADMIN_COACH_INTERIM` string). Trigger binding
unchanged — still `BEFORE INSERT` on `school_coaches` via
`trg_first_coach_claim` from the baseline.

### [x] Favorites counter on athlete profile shows wrong count
Closed in commit [`52b9309`](../../../commit/52b9309). The UI was
reading from the RLS-scoped direct `.select("*", { count: "exact" })`
on `recruiter_favorites`, which returned only rows owned by the
current recruiter (0 or 1) instead of the true total across all
recruiters. Fixed via two new `SECURITY DEFINER` SQL functions in
migration
[`supabase/migrations/20260423210000_count_athlete_favorites_function.sql`](../supabase/migrations/20260423210000_count_athlete_favorites_function.sql):
`count_athlete_favorites(athlete_uuid UUID) → INTEGER` and
`count_athlete_views(athlete_uuid UUID) → INTEGER`. Both bypass RLS
for the aggregate only; row-level privacy (who favorited, who viewed)
remains gated by existing RLS policies. `loadCounts` in
[`app/recruteur/athletes/[id]/page.tsx`](../app/recruteur/athletes/%5Bid%5D/page.tsx)
now calls `supabase.rpc(...)` instead. Verified live — Marc-Antoine
shows 3 favoris (was 1) with all 3 test recruiters having favorited
him.

### [x] `recruiter_athlete_views` table never written
Closed in commit [`5c2ff54`](../../../commit/5c2ff54). Profile views
were never landing in the DB — two compounding issues:
1. The `recordView` useEffect in
   [`app/recruteur/athletes/[id]/page.tsx`](../app/recruteur/athletes/%5Bid%5D/page.tsx)
   did fire-and-forget `.upsert(...)` with no `await` and no error
   capture. React's component lifecycle was likely cancelling the
   in-flight request before it completed, and any failure was
   invisible.
2. A redundant unique constraint was added in migration
   [`supabase/migrations/20260424100000_recruiter_athlete_views_unique_constraint.sql`](../supabase/migrations/20260424100000_recruiter_athlete_views_unique_constraint.sql)
   to make the `(recruiter_id, athlete_id, view_date)` dedup
   explicit at the constraint level (the baseline already had the
   same unique index at the index level — this just belts-and-braces
   the upsert's `onConflict` target).

`recordView` now awaits the upsert response and logs any errors via
`console.error("[recordView] ...")`. Verified live: `test-pro` viewed
Marc-Antoine's profile, row landed in the DB, and the `count_athlete_views`
RPC from [`52b9309`](../../../commit/52b9309) surfaces the correct
view count in the UI.

### [x] Signup errors swallowed client-side (both `/auth` and `/auth/pro`)
Closed in commits [`ab369ce`](../../../commit/ab369ce) (`/auth/pro`)
and [`5a697d0`](../../../commit/5a697d0) (`/auth` athlete signup +
login). Four changes spanning the two commits:
1. Extracted the inline `ErrorToast` from `messages/nouveau` into a
   shared component
   [`components/ui/ErrorToast.tsx`](../components/ui/ErrorToast.tsx) —
   red top-center pill with optional `Passer à Pro` CTA, dismiss
   button, no auto-dismiss timer.
2. Promoted the toast slide-in animation to a globally-scoped
   `@keyframes toastSlideDown` in
   [`app/globals.css`](../app/globals.css) (renamed from `slideDown`
   to avoid collision with the existing reveal-pattern `slideDown`).
3. Extracted `translateAuthError(message)` to
   [`lib/utils/translateAuthError.ts`](../lib/utils/translateAuthError.ts)
   with 7 translation rules covering the most common Supabase auth
   errors (duplicate email, weak password, invalid email, invalid
   login credentials, rate limit, network, email not confirmed);
   falls back to the original message for unknown errors.
4. Wired the shared `ErrorToast` + `translateAuthError` helper into
   both [`app/auth/page.tsx`](../app/auth/page.tsx) (athlete signup +
   login handlers) and
   [`app/auth/pro/page.tsx`](../app/auth/pro/page.tsx) (pro signup
   handler). The local `Toast` component in `/auth` was kept intact
   for informational messages (`socialToast`, "Mot de passe oublié?"
   stub) — those aren't errors and the yellow auto-dismissing pill
   is correct for them.

Remaining gap (not in this P1 scope, still logged as a separate
concern in the commit trail): the trigger/upsert error swallowing
inside `auth.actions.signUp` still logs to `console.error` only and
isn't surfaced to either signup UI. If the `handle_new_auth_user`
trigger ever fails silently, users would complete the auth form and
hit downstream breakage later. Worth a follow-up pass when someone
hits that failure mode in testing.

### [x] Verified badge inconsistent between search and favoris views
Closed in commit [`e1e0a75`](../../../commit/e1e0a75). The recherche
page applied `isValidationExpired()` from
[`lib/utils/profileValidation.ts`](../lib/utils/profileValidation.ts)
to gate the blue verified badge on a fresh `last_profile_validation`
timestamp; the favoris page was reading only `verified` and ignoring
freshness. Same athlete rendered as blue on favoris but gray on
recherche when they had `verified=true` and `last_profile_validation=NULL`.
Aligned by adding `last_profile_validation` to the favoris athletes
SELECT, threading `lastValidation` through `FavoriAthlete` + the row
mapper, and wrapping both render sites (grid card + list row) in an
IIFE that computes `active = isVerified && !isValidationExpired(...)`.
The `verifiedOnly` filter still operates on `isVerified` alone — it's
"show athletes who completed verification" (a permanent attribute),
distinct from "show athletes whose validation is currently fresh"
(a time-bounded display state).

### [x] `recruiter_activity_log` 400 on every page load
Closed in commit [`9434d22`](../../../commit/9434d22). Two compounding
silent 400s broke the sidebar badge system:
1. The sidebar's activity-log badge query in
   [`app/recruteur/_components/RecruiterSidebar.tsx`](../app/recruteur/_components/RecruiterSidebar.tsx)
   filtered `.eq("is_read", false)` against `recruiter_activity_log`
   — column did not exist.
2. The same file's messages badge query filtered `.eq("is_read",
   false)` against `messages` — column there is named `read_at`
   (timestamp), not `is_read`.

Migration
[`supabase/migrations/20260424110000_recruiter_activity_log_is_read.sql`](../supabase/migrations/20260424110000_recruiter_activity_log_is_read.sql)
adds the `is_read` column to `recruiter_activity_log` (default
`false`, all pre-existing test rows marked `true` for clean slate)
plus a partial index on `(recruiter_id) WHERE is_read = false` for
the badge-count hot path. Sidebar messages query now uses
`.is("read_at", null)`; activity-log query stays on
`.eq("is_read", false)` against the now-real column.

Activities page
([`app/recruteur/activites/page.tsx`](../app/recruteur/activites/page.tsx))
got two changes in the same commit:
- New `markAllAsRead` `useEffect` clears the unread badge for the
  current user when they land on the page (Pattern 1: visit-as-read
  signal, no per-row tracking).
- Pre-existing column rename in `load()` — `.select(...read...)` →
  `.select(...is_read...)` — was also throwing 400 and rendering an
  empty feed; fixed alongside.

Verified live: sidebar badge counts unread, visiting `/recruteur/activites`
clears badge to 0 on return.

### [x] Athlete signup writes placeholder email instead of user input
Closed in commit [`fa4e295`](../../../commit/fa4e295). Misdiagnosed
on intake — the `athletes.email` column has always held the real
user-typed email. The bug was in
[`app/athlete/parametres/page.tsx`](../app/athlete/parametres/page.tsx),
which imported `athleteUser` from `@/lib/mock/athlete` and rendered
its hardcoded `email: "marc-antoine@gmail.com"` regardless of who
was logged in. Fix swapped the mock object for a per-user load on
mount: pulls `email` from `auth.users` (the live session), and
`schoolName` / `coachName` / parental-consent state via joins on
the current athlete's row. The parental-consent block now also
handles three real states (consent + date + coach, consent without
coach, no consent yet) instead of always rendering the same
hardcoded line. Read-only display only — email Modifier button
still routes to its existing showToast placeholder; a real
email-edit flow needs auth.users re-verification and is deferred.
The mock file was intentionally left in place — dashboard and
other athlete pages still consume it; tracked as P2 'Athlete
portal still uses mock data in dashboard and other pages'.
Verified live as Alexandre Tremblay (marketing@gmail.com).

### [x] Coach onboarding missing interim-director option
Closed 2026-04-26 — interim director feature shipped end-to-end across
3 commits.

- DB: migration
  [`supabase/migrations/20260427010000_coach_notifications_and_interim_demotion.sql`](../supabase/migrations/20260427010000_coach_notifications_and_interim_demotion.sql)
  (commit [`3af30a4`](../../../commit/3af30a4)) added the
  `coach_notifications` table (mirrors `athlete_notifications` shape,
  RLS lets coaches read/update their own rows only, inserts come
  exclusively from triggers) and the
  `demote_interim_on_director_appointment` trigger that fires
  `AFTER INSERT OR UPDATE OF role` on `school_coaches` when a row
  transitions into `role='DIRECTEUR'`. Demotes any existing
  `DIRECTEUR_INTERIM` at the same school to `COACH` and writes an
  `INTERIM_DEMOTED` notification with school + new-director
  metadata.
- UI: `DirectorChoiceStep` in
  [`app/onboarding/page.tsx`](../app/onboarding/page.tsx) (commit
  [`3af30a4`](../../../commit/3af30a4)) gained a third option «&nbsp;Je
  serai intérimaire&nbsp;» for `type === "school"` onboarding only.
  Saves `school_admin_type: 'interim'` to distinguish it from the
  permanent «&nbsp;C'est moi&nbsp;» owner claim. League and CÉGEP
  flows keep the existing 2-option layout.
- Dashboard banner: commit
  [`a8980fb`](../../../commit/a8980fb) added two banners above the
  Action Bar in
  [`app/coach/tableau-de-bord/page.tsx`](../app/coach/tableau-de-bord/page.tsx).
  Persistent gray banner while the coach holds
  `DIRECTEUR_INTERIM` at any school; dismissible amber banner per
  unread `INTERIM_DEMOTED` notification. Both can render
  simultaneously.

Recruiter-side parity deferred — would require a `school_recruiters`
table + recruiter-side enum + `recruiter_notifications` equivalent.
Logged separately if needed in a future session.

### [x] Coach card design inconsistent between compose page and thread page
Closed 2026-04-27 — messages surface card consistency landed across
3 commits ([`c718d96`](../../../commit/c718d96),
[`0c3a0c7`](../../../commit/0c3a0c7),
[`c6eb900`](../../../commit/c6eb900)).

The recruiter messages module now shares two reusable components
across thread detail and compose surfaces:

- [`lib/hooks/useCoachReputation.ts`](../lib/hooks/useCoachReputation.ts)
  — reputation aggregation (reviews + badges + placement stats +
  avg response time) exposed as a single hook with `refresh()`
- [`components/recruteur/CoachInfoCard.tsx`](../components/recruteur/CoachInfoCard.tsx)
  — rich coach card (avatar + contact + reputation + stats +
  badges + review CTA) consuming the hook
- [`components/recruteur/AthleteInfoCard.tsx`](../components/recruteur/AthleteInfoCard.tsx)
  — rich athlete card (photo + name + sport/pos/grad + status
  badges + stars + location + academic + distinctions +
  preferences + profile CTA)

Both surfaces now render identical rich cards. Compose page
queries extended to load all fields the rich cards need. Section
copy unified ("Athlète concerné" everywhere).

Adjacent improvement: thread page also benefits from the
extraction — `onSubmitted` review-refresh logic became a single
`refresh()` call instead of 25 lines of inlined re-fetch.

### [x] Favorites should auto-create pipeline entry under "Identifié"
Closed 2026-04-27 in commit
[`c5f8289`](../../../commit/c5f8289). The favorite action now
serves as the save-to-pipeline action. Two AFTER triggers on
`recruiter_favorites` handle the coupling:

- INSERT trigger: creates pipeline row at IDENTIFIE, or resets a
  RETIRE row back to IDENTIFIE on re-favorite. Active stages
  (CONTACTE through LETTRE_SIGNEE) are protected from reset.
- DELETE trigger: marks pipeline row as RETIRE (preserves history)

All tiers get the auto-pipeline behavior. Pipeline UI tier gating
is a separate still-open P1.

Migration:
[`supabase/migrations/20260427120000_favorites_auto_pipeline.sql`](../supabase/migrations/20260427120000_favorites_auto_pipeline.sql)

### [x] Messaging dead-ends across recruteur surfaces
Closed 2026-04-28 in commit
[`bcbd773`](../../../commit/bcbd773). The pipeline 'Envoyer un
message' Link was building the wrong URL — used `athlete_id`
where `conversation_id` was expected, so the thread page
returned 'Conversation introuvable' for any athlete the
recruiter hadn't already messaged. Fixed by routing to the
compose page (`/recruteur/messages/nouveau?athlete=<id>`),
which already supports pre-selecting the athlete via that
query param.
While in the area, two adjacent UX fixes:
- Athlete profile 'Contacter le coach' buttons hidden from
  users who can't message (Free, Free admin)
- CÉGEP coach detail 'Envoyer un message' stub hidden likewise
Admin bypass does NOT extend to messaging — admin role is for
CÉGEP organizational management, not free product features.
The CÉGEP coach detail messaging button is still a Phase 2 stub
(button calls `showToast`, no Link). Logged separately as P3.
