# Post-Launch Bugs — Nexus

**Date discovered:** 2026-04-23
**Context:** Phase 5 manual testing against `v0.9.0-pre-cloud`
**Status:** Logged for post-tag fix pass

Each item is actionable as a stand-alone PR. Grouped by impact, not by
file.

---

## P0 — Affect new user onboarding

- [x] **Signup photo upload fails — `avatars` bucket missing.**
      Reported 2026-04-29. During the role-selection onboarding
      wizard (`/onboarding`), the `PhotoUpload` component throws
      a `StorageApiError: Bucket not found` when an athlete /
      coach / recruiter tries to upload a profile picture.
      Stack: `node_modules/@supabase/storage-js/src/lib/common/fetch.ts:65:16`
      Root cause:
      [`app/onboarding/page.tsx`](../app/onboarding/page.tsx)
      line ~103 calls
      `supabase.storage.from("avatars").upload(...)` but the
      `avatars` bucket doesn't exist. Only `Ath Photos` exists
      in this Supabase (verified via
      `SELECT * FROM storage.buckets`).

      **Closed 2026-04-29** (migration
      [`20260429020000_add_avatars_bucket.sql`](../supabase/migrations/20260429020000_add_avatars_bucket.sql)):
      created the `avatars` bucket (public read) and four RLS
      policies on `storage.objects` — public SELECT, INSERT
      gated to authenticated users, UPDATE/DELETE gated to
      the row owner (`storage.objects.owner = auth.uid()`).
      Cleaner separation kept: `avatars` for generic user
      profile pictures (coaches, recruiters, partners,
      onboarding wizard), `Ath Photos` for athlete-specific
      photos with their own path-namespacing scheme. Verified
      via `SELECT id, name, public FROM storage.buckets` —
      both buckets present and public.

---

## P1 — Silent UX failures

- [ ] **Loi 25 onboarding consent wording (v1) requires Quebec privacy
      counsel review before production launch.** Current onboarding
      partner-visibility consent wording in
      [`components/shared/PartnerVisibilityConsentCard.tsx`](../components/shared/PartnerVisibilityConsentCard.tsx)
      uses approximate Loi 25 language for transfer of editorial
      responsibility once a partner downloads an athlete's card
      (the bolded bullet "Une fois la carte téléchargée par un
      partenaire, celui-ci devient responsable de l'usage qu'il
      en fait dans ses publications, conformément à la Loi 25").
      Validate exact phrasing with Quebec privacy lawyer. When
      wording finalizes, bump `terms_version` from `v1` to `v2`
      and decide whether to force re-acceptance for existing
      partners + parents who opted in under v1.

      Companion scope note: this commit also broadens the partner
      framing from Phase 2's "partenaires médias" to "partenaires
      Nexus" — same partners table on the backend, but the parent-
      facing copy now explicitly covers camps de sport, services
      d'entraînement, podcasts, etc., not just journalists. If
      counsel pushes back on the broader framing, the wording
      change is contained to the single component above.

- [ ] **Athlete photo upload doesn't persist to profile.** Athlete
      fills profile, uploads a photo, UI reports success (or no
      error), but `photo_url` stays empty and the profile shows
      placeholder initials. Tried with Kako, couldn't resolve.
      Repro: log in as athlete, go to
      [`/athlete/profil`](../app/athlete/profil/page.tsx), click
      modifier, attempt to upload avatar.

      Code audit 2026-05-03 surfaced two probable causes at
      [`app/athlete/profil/page.tsx:1457-1466`](../app/athlete/profil/page.tsx#L1457-L1466):
      1. Upload targets `supabase.storage.from("Ath Photos")` —
         a bucket name with a space and capital A. The Phase 2
         signup-photo fix (4c7236a, 2026-05-01) created an
         `avatars` bucket. If `Ath Photos` doesn't exist or has
         different RLS, `uploadError` triggers the early return
         and the toast still fires deceptively.
      2. The `athletes.update({ photo_url })` call at line 1464
         doesn't destructure or check `error`. Any RLS denial
         on the update succeeds silently from the UI's
         perspective.

      Fix path: confirm bucket via
      `docker exec supabase_db_Nexus psql -c "SELECT id, public, owner FROM storage.buckets WHERE name IN ('avatars', 'Ath Photos');"`,
      align the upload target to whatever bucket actually exists,
      add an error check on the athletes UPDATE, and surface the
      error path to the toast instead of always saying "Photo
      mise à jour!".

- [x] **Hidden trigger blocks `coach_id = NULL` on athletes.**
      Reported 2026-04-28 while testing the new claim flow.
      Attempted to free test athletes via:
      ```sql
      UPDATE athletes SET coach_id = NULL WHERE id IN (...);
      ```
      The query reported 3 rows updated and the RETURNING clause
      showed... the OLD `coach_id` values still in place. A
      trigger or constraint is silently rolling back
      `coach_id = NULL` on existing rows.
      This blocks:
      - Any future data migration that needs to clear `coach_id`
      - Edge cases like coach account deletion (athletes get
        orphaned with bad `coach_id` pointing at non-existent
        users)
      Diagnostic:
      ```sql
      SELECT trigger_name, event_manipulation, action_timing,
             action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'athletes'
      ORDER BY trigger_name;
      ```
      Likely a BEFORE UPDATE trigger that "protects" `coach_id`
      from being NULLed. Made sense in the old coach_id-only
      world; blocks the new claim model.
      Fix: modify or drop the offending trigger. `coach_id =
      NULL` is now a valid state (the unclaimed pool — newly
      created athletes who haven't been claimed yet).
      Workaround for testing: INSERT new athletes with
      `coach_id = NULL` directly (the trigger appears to only
      block UPDATE, not INSERT).

      **Closed 2026-04-28 — Piece 2 ship** (commit
      [`a11bb98`](../../../commit/a11bb98)):
      Trigger `auto_link_athlete_to_coach` and its function dropped
      in migration
      [`20260428060000_drop_auto_link_athlete_coach_trigger.sql`](../supabase/migrations/20260428060000_drop_auto_link_athlete_coach_trigger.sql).
      Function used `SELECT ... LIMIT 1` with no `ORDER BY` to pick
      an arbitrary coach when `coach_id` was NULL — non-deterministic
      and conflicted with the new model.

      **Un-claim flow — closed without implementation
      2026-04-28**: architecturally considered as a Piece 1
      follow-up but deliberately not built. Coaches don't have a
      real need to return an athlete to the unclaimed pool — the
      existing `recruitment_status = RETIRE` option covers the
      actual workflow. The coach marks the athlete as retired
      (out of recruitment, records preserved); the athlete stays
      in the coach's roster, history intact. RETIRE handles the
      three real Quebec scenarios: athlete graduating, athlete
      leaving the program, athlete switching schools. Trying to
      "release" an athlete back to unclaimed creates more
      confusion than it solves. Revisit only if a multi-coach
      scenario emerges (rare in current single-coach-per-athlete
      design).

- [x] **Coach cannot see athletes from their own school.** Coach at
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

      **Closed 2026-04-28 — full revisit shipped**: After Pieces
      1 + 2 of the claim model shipped (coach claim flow +
      athlete coach selection at signup/settings), all five
      coach surfaces were tightened back from the school-scoped
      over-correction to coach-scoped via the claim model:

      1. **Coach dashboard** (commit
         [`2bf628b`](../../../commit/2bf628b)) —
         [`app/coach/tableau-de-bord/page.tsx`](../app/coach/tableau-de-bord/page.tsx)
         athletes query swapped `.eq("school_id", coachSchoolId)`
         for `.eq("coach_id", user.id)`. All downstream widgets
         (KPIs, hot athletes, activity feed, suggestions,
         conversations) flip via the same `coachAthleteIds`
         array.

      2. **Mes Athlètes À traiter tab** (commit
         [`c9045c2`](../../../commit/c9045c2)) —
         [`app/coach/athletes/page.tsx`](../app/coach/athletes/page.tsx)
         unverified-athletes filter and pending-suggestions
         query both add `coach_id === session.user.id`. The
         page-level athletes query stays school-scoped because
         the À réclamer tab still needs school-wide data.

      3. **Mes Équipes list** (commit
         [`b96ffa1`](../../../commit/b96ffa1)) —
         [`app/coach/equipes/page.tsx`](../app/coach/equipes/page.tsx)
         now fetches my team IDs from `team_coaches` first,
         then loads only those teams via `.in("id", myTeamIds)`.
         Team detail page stays school-scoped (athlete picker
         needs school-wide).

      4. **`recruiter_activity_log` RLS** (commit
         [`a08cc30`](../../../commit/a08cc30), migration
         [`20260428090000_activity_log_coach_scope.sql`](../supabase/migrations/20260428090000_activity_log_coach_scope.sql))
         — replaces the school-scoped SELECT policy with
         `Coaches read activity for their claimed athletes`
         using `athletes.coach_id = auth.uid()`. The athletes-
         self SELECT policy stays.

      5. **`athlete_suggestions` RLS** (commit
         [`accaa38`](../../../commit/accaa38), migration
         [`20260428100000_athlete_suggestions_coach_scope.sql`](../supabase/migrations/20260428100000_athlete_suggestions_coach_scope.sql))
         — coach-claimed SELECT + UPDATE policies replace
         school-scoped SELECT and the permissive UPDATE that
         had let any authenticated user mutate any suggestion
         row. Bonus security hole closed at the RLS layer; app
         layer was the only thing previously preventing
         cross-coach approval/rejection.

      The school-coach over-correction is fully unwound. The
      claim model is now the source of truth for coach
      visibility everywhere.

- [ ] **Duplicate Signaler/Favori buttons on the recruiter view of
      athlete profile.** The recruiter sticky CTA bar in
      [`AthleteRecruiterProfileBody.tsx`](../components/shared/AthleteRecruiterProfileBody.tsx)
      renders the favorite + signaler pair twice — once at
      [lines 1326-1336](../components/shared/AthleteRecruiterProfileBody.tsx#L1326-L1336)
      and again at
      [lines 1353-1364](../components/shared/AthleteRecruiterProfileBody.tsx#L1353-L1364)
      with identical onClick handlers
      (`toggleFavorite`, `setShowFlagModal(true)`). Code audit
      2026-05-03 confirms still duplicated post-recruiter-page
      extraction — likely a copy-paste artifact from the
      mobile-vs-desktop split that never got reconciled.
      User prefers the bottom CTA bar (`px-4 py-2.5` style). Pick
      one and delete the other. Originally reported 2026-04-26.

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

- [x] **Onboarding wizard allows skipping school selection.** In the
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

      **Closed 2026-04-26** (commit
      [`4f9c55d`](../../../commit/4f9c55d)): gate shipped on the
      shared coach/recruiter wizard via a new
      `canProceed(role, step, localUser)` at
      [`app/onboarding/page.tsx:363-383`](../app/onboarding/page.tsx#L363-L383).
      Step 1 enforces `localUser.institution?.name` for `coach`
      and `recruiter` roles. Two enforcement sites: programmatic
      gate at the top of `next()`
      ([line 387-390](../app/onboarding/page.tsx#L387-L390))
      early-returns when `!canProceed()`, and the Suivant button
      ([line 613](../app/onboarding/page.tsx#L613)) carries
      `disabled={stepSaving || !canProceed()}` for UX affordance.
      The athlete wizard at
      [`app/athlete/onboarding/page.tsx:201-209`](../app/athlete/onboarding/page.tsx#L201-L209)
      already had the equivalent gate (`selectedSchoolId` required
      at step 1), enforced on `saveStepAndAdvance()` at
      [line 213](../app/athlete/onboarding/page.tsx#L213) and on
      both nav buttons at
      [lines 719 + 726](../app/athlete/onboarding/page.tsx#L719-L726).
      Defense in depth via `school_id: selectedSchoolId || null`
      at the payload layer.

      **Verified 2026-05-03**: DB has zero NULL `school_id`
      rows in `athletes` and zero NULL `school_id` rows in
      `users` for `COACH` / `RECRUTEUR` roles. The pre-fix
      audit's 7 affected legacy test accounts were cleaned up
      separately at the time of the fix; nothing has slipped
      through since.

      **Known carve-out** (not part of this P1, captured
      separately as a P3 product decision): league flows
      (`coach_league`, `coordinator_league`) intentionally pass
      through without an institution check per the original
      commit message — what an "institution" means for a
      league-level role is a product question, not a gate bug.

## P1 — Data collection

*(all cleared — see **Closed** at the bottom)*

---

## P2 — Observability

- [x] **Athlete-route guard pushes non-athletes to onboarding.**
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

      **Closed 2026-04-29** (commit
      [`21b0e8b`](../../../commit/21b0e8b)): role-aware layout
      at
      [`app/athlete/layout.tsx`](../app/athlete/layout.tsx)
      checks `users.role` + `users.onboarding_complete` on
      every render. COACH/RECRUTEUR users get a full-takeover
      football-themed wrong-route page
      ([`app/athlete/_components/WrongRoutePage.tsx`](../app/athlete/_components/WrongRoutePage.tsx))
      — no athlete sidebar, no shared chrome — with a CTA back
      to their role-appropriate dashboard
      (`/coach/tableau-de-bord` or
      `/recruteur/tableau-de-bord`). Defense-in-depth role
      check added in
      [`app/athlete/onboarding/page.tsx`](../app/athlete/onboarding/page.tsx)'s
      `handleSubmit` re-verifies `users.role === 'ATHLETE'`
      before BOTH the INSERT and UPDATE paths against the
      athletes table — if the layout guard is bypassed, the
      submit aborts before any phantom row is created or
      modified. Verified manually: COACH and RECRUTEUR both
      land on the wrong-route page; ATHLETE pass through to
      the normal dashboard.

- [x] **Debug `console.log` noise in production.** Examples: `Athletes
      loaded: 1 null` from the recherche page, `[Homepage] Hero section
      rendered` from `app/page.tsx`, `[GrainOverlay] mounted` from the
      editorial system. Strip before public launch. Sweep with
      `grep -rn 'console.log' app/` and decide per-site.

      **Deferred 2026-04-29 — moved to pre-launch checklist**:
      counted 385 `console.log` calls across 79 files
      (concentrated in
      [`app/coach/ecole/analytics/page.tsx`](../app/coach/ecole/analytics/page.tsx)
      with 30, [`app/coach/athletes/[id]/modifier/page.tsx`](../app/coach/athletes/%5Bid%5D/modifier/page.tsx)
      with 25, and a long tail). Mechanical sweep is better
      done in a focused launch prep session than piecemeal
      late evening. Tracked in
      [`docs/pre-launch-checklist.md`](pre-launch-checklist.md)
      under Code hygiene.

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

- [x] **Athlete portal still uses mock data in dashboard and other
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

      **2026-04-28 — Dashboard confirmed mock-bound.** While testing
      Piece 2 (athlete coach selection), confirmed that
      [`app/athlete/dashboard/page.tsx`](../app/athlete/dashboard/page.tsx)
      still seeds `firstName`, `is_verified`, `activities`, and
      `profileChecklist` from `@/lib/mock/athlete` even when the
      logged-in athlete has none of Marc-Antoine's data. KPI cards
      (views, favorites, regions) are wired to real Supabase
      counts and the unread-notifications banner is real, but the
      activity feed and profile-improvement checklist remain mock
      for every athlete that loads the dashboard. Fresh signups
      see Marc-Antoine's mock activity history. Fix: replace
      `athleteActivity` with a real query against
      `athlete_notifications` (or a dedicated activity feed table
      if we add one) and replace `profileChecklist` with a
      derived list from `athletes.profile_completion` field
      gaps.

      **Closed 2026-04-28** (commit
      [`5387755`](../../../commit/5387755)):
      Dashboard now reads real data on all four surfaces. Activity
      feed queries `recruiter_activity_log` filtered by
      `athlete_id`, joined with the recruiter's region for the
      message text — empty state shows when fresh athletes have no
      events. Profile checklist derives from a second `athletes`
      query (with `evaluations` join) — each of the 10 items
      reflects whether that specific field is populated. Greeting
      and `verified` badge initialize to empty/false instead of
      Marc-Antoine defaults; profile completion % reads
      `athletes.profile_completion`. `AthleteSuggestion` type was
      relocated to [`lib/types/models.ts`](../lib/types/models.ts)
      (the only external consumer was the profil page). Mock file
      [`lib/mock/athlete.ts`](../lib/mock/athlete.ts) deleted in
      full (115 lines, 10 exports — the 4 unused exports
      `athleteSuggestions` / `AthleteNotification` /
      `athleteNotifications` / `ProfileChecklistItem` had zero
      consumers per codebase grep before deletion).

      **Audit confirmed 2026-04-28**: full grep across
      `app/athlete/**/*.tsx` and `app/athlete/**/*.ts` for
      `@/lib/mock`, `from.*mock`, `import.*mock`, `MOCK_`,
      `mock[A-Z]` returns zero hits. Athlete portal is fully
      wired to real Supabase data. Coach and recruteur portals
      not yet audited — recruteur tableau de bord and CÉGEP
      sub-pages likely still have mock data, coach has pending
      cleanup per session memory.

- [x] **Starter tier (DB) vs Free tier (code) model mismatch.**
      Database RLS policies on `recruiter_pipeline` (and possibly
      other tables) include a carve-out allowing Free-tier
      recruiters to create rows at IDENTIFIE/CONTACTE stages.
      This was prepped for a $9.99/mo "Starter" tier per CLAUDE.md
      pricing spec, but Starter is not wired into:
      - [`lib/hooks/useSubscription.ts`](../lib/hooks/useSubscription.ts)
        (only recognizes `free` / `pro` / `all_star`)
      - The pipeline UI gating logic in
        [`components/shared/AthleteRecruiterProfileBody.tsx`](../components/shared/AthleteRecruiterProfileBody.tsx)
        (`canUsePipeline = pro || all_star`)
      - Stripe products
      - Pricing pages

      Current RLS check (live in DB) on
      `recruiter_pipeline_insert` + `recruiter_pipeline_update`:
      ```sql
      ((get_user_tier() = 'free' AND stage IN ('IDENTIFIE', 'CONTACTE'))
       OR user_has_pro())
      ```

      Three resolution paths to choose between when revisited:
      - (a) Tighten DB policy to `user_has_pro()` only — drops
        Starter, aligns DB with current code's 2-tier-for-pipeline
        model
      - (b) Wire Starter as a real tier — adds 2-stage pipeline UI
        for Starter users, updates pricing/billing/marketing
      - (c) Continue as-is — accept the model mismatch indefinitely

      Choice depends on monetization product decision: does
      Starter as a $9.99 entry-point recruiter tier exist in your
      model?

      **Test data note**: orphan Free-tier pipeline rows
      (2 rows held by `test-free@gmail.com` at `IDENTIFIE`)
      were cleaned up on 2026-05-03 via direct
      `DELETE FROM recruiter_pipeline ...` against Docker psql
      (no migration file — one-time test data cleanup, see commit
      log). Future Starter-style data may re-appear if the DB
      policy is left unchanged and new test accounts get pipeline
      rows seeded.

      **Closed 2026-05-03** (migration
      [`20260503060000_tighten_recruiter_pipeline_rls_pro_only.sql`](../supabase/migrations/20260503060000_tighten_recruiter_pipeline_rls_pro_only.sql)):
      resolution path **(a)** chosen. User confirmed via the live
      pricing page that only Free / Pro $19.99 / All Star $29.99
      exist — Starter is not in the product, the DB carve-out was
      dead policy from an abandoned spec. The migration drops and
      recreates `recruiter_pipeline_insert` and
      `recruiter_pipeline_update` with `user_has_pro()` only on
      WITH CHECK; ownership + role checks preserved exactly as
      before.

      Verified post-migration with role-impersonated psql
      (`SET LOCAL ROLE authenticated` +
      `SET LOCAL request.jwt.claims = '{"sub":"<free-recruiter-uuid>",...}'`)
      that an INSERT at `IDENTIFIE` for the Free recruiter
      `test-free@gmail.com` errors with `new row violates
      row-level security policy for table "recruiter_pipeline"`.
      DB and code now agree: pipeline is Pro+.

      Scope contained: the other two policies that reference
      `get_user_tier()` —
      `recruiter_favorites_insert` (10-favorite Free cap) and
      `athletes_insert` (30-athlete coach Free cap) — are live
      Free-tier business rules matching the pricing page; not
      touched.

- [ ] **Partner visibility consent has no audit trail (Loi 25 gap).**
      `partner_visibility_opt_in` / `partner_visibility_opted_in_at`
      / `partner_visibility_parental_consent` toggles on the
      `athletes` table only record latest state. The
      `consent_audit_trail` table exists for `parental_consents`
      but its `action` CHECK constraint
      (`'ATTESTED', 'WITHDRAWN', 'EXPIRED', 'PDF_DOWNLOADED',
      'PDF_UPLOADED'`) and FK shape (`consent_id` → `parental_consents`,
      not `athletes`) are wrong for partner-visibility events.
      Result: if a parent disputes "when did I grant or revoke
      partner visibility consent," there's no trail to defend.
      This is a Loi 25 compliance concern beyond the wording
      review (P1 lawyer review).

      Resolution paths:
      - (a) Extend `consent_audit_trail`: relax CHECK constraint
        to add `'PARTNER_VIS_GRANTED'` / `'PARTNER_VIS_REVOKED'`
        (etc.), add a nullable secondary FK to `athletes`, write
        rows on every toggle in onboarding +
        [`/athlete/parametres`](../app/athlete/parametres/page.tsx)
        + [coach create](../app/coach/athletes/create/page.tsx).
      - (b) Build a separate `partner_visibility_audit_trail`
        table mirroring `consent_audit_trail`'s shape but
        FK-pointing to `athletes` directly.
      - (c) Continue as-is — accept that disputes can't be
        defended with a trail. Risky in a Loi 25 jurisdiction.

      Recommended path: **(a)** — re-uses existing audit table
      infrastructure, smaller migration. Estimated 1-2 hours:
      migration + handler updates in three call sites
      ([`app/athlete/onboarding/page.tsx:236-240`](../app/athlete/onboarding/page.tsx#L236-L240)
      and
      [`:367-371`](../app/athlete/onboarding/page.tsx#L367-L371),
      [`app/coach/athletes/create/page.tsx:507-511`](../app/coach/athletes/create/page.tsx#L507-L511),
      [`app/athlete/parametres/page.tsx:494-499`](../app/athlete/parametres/page.tsx#L494-L499)
      + [`:528-559`](../app/athlete/parametres/page.tsx#L528-L559)).
      Block on lawyer review (P1) — they may have audit-trail
      requirements that affect the schema.

- [ ] **Civil coach onboarding is CREATE-team only — no JOIN existing
      team flow.** Discovered 2026-05-06 during Phase 5.4 discovery.
      [`app/onboarding/page.tsx:1805-2103`](../app/onboarding/page.tsx#L1805-L2103)
      (`LeagueCoachLeagueStep`) only supports creating a new
      `league_team` row when a civil coach onboards — there is no
      UX to search for an existing team, request to join, or
      otherwise be added as a `league_coaches` row with
      `role: "COACH"` (the schema's distinction between team-creator
      and team-joiner). Every civil coach therefore becomes ADMIN of
      a fresh team. If two coaches of the same physical team
      onboard, they end up as ADMIN of two separate `league_team`
      rows pointing at the same league — silent data fragmentation.

      Resolution: extend the team section with two paths — "Créer
      une nouvelle équipe" (current behavior) vs "Rejoindre une
      équipe existante" (search by league + name → `league_coaches`
      INSERT with `role: "COACH"`, no `league_teams` INSERT).
      Likely needs an approval/notification step (the existing
      ADMIN of the team approves the join request) — coordinate
      with the eventual coach-invite flow rather than shipping in
      isolation. Out of Phase 5.4 scope.

---

## P3 — Latent / future work

- [x] **KILLED — Recruiter Interest Trigger.** Decision 2026-05-04.
      Spec preserved at
      [`docs/feature-specs/recruiter-interest-trigger.md`](feature-specs/recruiter-interest-trigger.md)
      with killed-status header. Reasoning: trigger bridged to
      absent coaches, but athletes without coaches have no
      displayable profile value (no blue check, no rating). Root
      cause is coach acquisition for civil leagues, tracked
      separately.

- [ ] **Three near-duplicate athlete search implementations.**
      Recruiter
      ([`app/recruteur/recherche/page.tsx`](../app/recruteur/recherche/page.tsx),
      ~918 lines), coach
      ([`app/coach/athletes/page.tsx`](../app/coach/athletes/page.tsx),
      ~1131 lines), and partner
      ([`components/partenaire/PartnerAthletesSearch.tsx`](../components/partenaire/PartnerAthletesSearch.tsx),
      new 2026-05-04) each hand-roll filter UI + state + query
      layer. No shared `<AthleteSearchPanel>` component exists.
      Past bug fixes (position-by-sport, trait-rating-wipe) have
      already required dual-application across recruiter and
      coach; the partner addition makes future fixes a three-way
      patch.

      Consolidation candidate: extract
      `components/shared/AthleteSearchPanel.tsx` with a `mode`
      prop (`"recruiter" | "coach" | "partner"`) parameterizing
      the visible filter set, the data source (athletes vs
      top_athletes_view), and any tier-aware caps; refactor all
      three callers. Estimated 1-day refactor. Defer until
      drift causes a real regression OR a fourth caller is
      needed.

- [ ] **`schoolName` field overloaded for civil-context athletes.**
      Shipped 2026-05-06 in 5.3d-fix as a tight workaround to avoid
      touching the 4-way duplicated PlayerCard ticket components
      (`AthletePlayerCard.tsx` + 3 local `PlayerCard` /
      `PreviewPlayerCard` copies in
      [`AthleteRecruiterProfileBody.tsx`](../components/shared/AthleteRecruiterProfileBody.tsx),
      [`app/coach/athletes/[id]/page.tsx`](../app/coach/athletes/%5Bid%5D/page.tsx),
      [`app/admin/athletes/[id]/page.tsx`](../app/admin/athletes/%5Bid%5D/page.tsx)).

      `AthleteProfileRecruiterView.schoolName` now carries:
      - the school name (école athletes)
      - the civil team name (civil athletes with a team)
      - the literal label "Ligue Civile" (civil athletes who chose
        "Continuer sans équipe")

      Branching lives in
      [`app/coach/athletes/_data/loadAthleteFromSupabase.ts`](../app/coach/athletes/_data/loadAthleteFromSupabase.ts)
      `mapToRecruiterView()` and in
      [`AthleteRecruiterProfileBody.tsx`](../components/shared/AthleteRecruiterProfileBody.tsx)
      load handler (the only consumer that doesn't pass through the
      shared loader). The PlayerCard tickets render `schoolName`
      verbatim — they don't know the field is overloaded.

      Proper fix: consolidate `AthletePlayerCard` + the 3 local
      `PlayerCard` duplicates into a single shared component, then
      add explicit `isCivil` / `leagueTeamName` / `leagueName`
      affiliation fields to `AthleteProfileRecruiterView`. The 4-way
      ticket duplication is the same tech-debt class as the search
      panel + AthleteCard duplications already logged above —
      consolidating any one likely justifies sweeping the others.

- [ ] **`<NoTeamBadge>` + `<AthleteCard>` extraction across
      recruiter surfaces.** The "Pas d'équipe" pill shipped in
      5.3d (commit pending) is duplicated inline at 5 render
      sites across 3 pages: recherche grid + recherche list,
      favoris grid + favoris list, pipeline kanban card +
      pipeline drag-overlay + pipeline detail panel. Same JSX,
      same styling, same `noTeam` boolean derived identically
      (`!school_id && !league_team_id`) at every mapping site.
      Each page also hand-rolls its own athlete-card render
      (related to the search-panel duplication above — the cards
      are tightly coupled to those page-local data shapes).

      Consolidation candidate: extract a small `<NoTeamBadge>`
      component (~5 lines) and a richer `<AthleteCard variant>`
      that absorbs the grid/list/kanban shapes. Smaller scope
      than the search panel above but related — both stem from
      the same per-page-monolith pattern. Logged separately so
      whichever lands first can pull the other into scope.

- [ ] **`terms_version` not persisted on partner visibility consent.**
      [`PartnerVisibilityConsentCard.tsx`](../components/shared/PartnerVisibilityConsentCard.tsx)
      flags `v1` in a JSDoc header, but no DB column records which
      version of the consent text the user actually agreed to. When
      Loi 25 lawyer review (P1) finalizes wording and bumps `v1` →
      `v2`, there will be no way to know which version any given
      existing consent was granted under.

      Resolution: add `partner_visibility_terms_version text NOT NULL
      DEFAULT 'v1'` column to `athletes`, populate on every opt-in
      write across the three call sites
      ([`app/athlete/onboarding/page.tsx`](../app/athlete/onboarding/page.tsx),
      [`app/coach/athletes/create/page.tsx`](../app/coach/athletes/create/page.tsx),
      [`app/athlete/parametres/page.tsx`](../app/athlete/parametres/page.tsx)).
      Defer until lawyer review actually requires v2 — the column
      and the wiring are cheap to add at that point and avoid
      pre-fixing for a version bump that may never happen.

- [ ] **League onboarding flow institution requirement (product
      decision).** The shared onboarding wizard's `canProceed()`
      at
      [`app/onboarding/page.tsx:363-383`](../app/onboarding/page.tsx#L363-L383)
      intentionally skips the institution check for `coach_league`
      and `coordinator_league` roles ("league flows pass through
      unconditionally" per commit
      [`4f9c55d`](../../../commit/4f9c55d)). This is not a gate
      bug — it's a deferred product question:

      What does "institution" mean for a league-level
      coach/coordinator?
      - A regional federation? (e.g., Hockey Québec, Football
        Québec)
      - A specific league office? (e.g., RSEQ, LFCQ)
      - A team within a league? (probably not — those are
        individual coaches)
      - Optional / N/A? (some league roles may not have an
        institution at all)

      Once the product model for league-level institutions is
      defined, gate the league flows in `canProceed()` at
      [`app/onboarding/page.tsx:363-383`](../app/onboarding/page.tsx#L363-L383)
      with the appropriate validation. Until then, league users
      can complete onboarding without an institution, which means
      downstream queries on `users.school_id` will return NULL
      for these accounts.

      Not a launch blocker if league user volume is zero or
      near-zero in pre-launch testing. Revisit when league flow
      product scope is finalized.

- [ ] **Drop deprecated orphan view-tracking tables.**
      Tables soft-deprecated 2026-05-03 in
      [`20260503040000_deprecate_orphan_view_tracking_tables.sql`](../supabase/migrations/20260503040000_deprecate_orphan_view_tracking_tables.sql):
      - `profile_views` → `_deprecated_profile_views_2026_05`
      - `athlete_views` → `_deprecated_athlete_views_2026_05`

      Three views were repointed before the rename in
      [`20260503030000_repoint_athlete_visibility_views_to_canonical_source.sql`](../supabase/migrations/20260503030000_repoint_athlete_visibility_views_to_canonical_source.sql):
      `athlete_visibility_stats`, `athlete_view_details`,
      `athlete_views_weekly` — all now read from
      `recruiter_athlete_views`.

      Original purpose of the rename: any forgotten consumer
      surfaces immediately as a "table not found" error rather
      than silently reading empty data. After 3+ months of zero
      activity (target: **August 2026**), drop with a separate
      destructive migration after a final grep confirms zero
      references — including the SQL snippets at
      `supabase/snippets/admin_rls_bypass.sql` and
      `supabase/snippets/coach_analytics_rls.sql`, which still
      reference `profile_views` for inert hand-run scripts.
      Update or delete those snippets at drop time too.

- [ ] **Canonical `AthleteProfileFullView` extraction.** Currently
      [`/athlete/profil`](../app/athlete/profil/page.tsx) (1828
      lines, monolithic, deeply edit-coupled) and
      [`AthleteProfileView`](../components/shared/AthleteProfileView.tsx)
      (used by partner page in `viewMode="partner"` and by recruiter
      / coach / admin surfaces) are two parallel implementations of
      "render an athlete's profile." Long-term consolidation would
      let future profile improvements propagate to all viewers
      (athlete, partner, future admin / coach full-detail page) with
      one canonical component.

      Estimated effort: 4-6 hours, high regression risk on the
      athlete co-creation edit flow (30+ inline edit affordances
      with the green / yellow / red pencil grammar, monthly
      re-validation banner, slide-out preview panel, suggestions
      section). Defer until either:
      - Admin or coach view of the full athlete profile becomes a
        roadmap item that justifies the cost, OR
      - Drift between `/athlete/profil` and `AthleteProfileView`
        becomes a maintenance burden (a feature added to one needs
        to be manually mirrored to the other often enough to hurt).

      Stopgap shipped 2026-05-03 (commits 057e78d / b4cfe09):
      `AthleteProfileView` partner mode renders a dashed-border
      lock placeholder for the academic section instead of silently
      hiding it, so the redaction reads as intentional rather than
      buggy. The two components stay parallel; the placeholder
      pattern is reusable if future fields need similar redaction.

- [x] **`users.school_id` and `athletes.school_id` can drift.**
      Reported 2026-04-28 during Piece 2 testing.
      `marketing@gmail.com`'s user record had `users.school_id`
      pointing to one school (Saint-Jean-Eudes) while their
      `athletes.school_id` pointed to another (Collège
      St-Jean-Vianney).
      Mitigated for athletes via role-aware
      `current_user_school_id()` function (migration
      [`20260428080000_role_aware_current_user_school_id.sql`](../supabase/migrations/20260428080000_role_aware_current_user_school_id.sql))
      which reads `athletes.school_id` for the `ATHLETE` role.
      But the underlying data inconsistency remains and could
      surface in other queries that read `users.school_id`
      directly.
      Long-term fix options:
      - Backfill `users.school_id` to match `athletes.school_id`
        for all athletes
      - Add a constraint or trigger that keeps them in sync on
        future updates
      - Fully soft-deprecate `users.school_id` for athletes
        (only used for COACH / RECRUTEUR roles)

      **Closed 2026-04-29 — drift count is 0**: underlying
      inconsistency was a one-time test data artifact (role
      change on `marketing@gmail.com`). Normal-flow athletes
      never write `users.school_id` —
      [`app/onboarding/page.tsx`](../app/onboarding/page.tsx)
      only updates that column inside `if (role === "coach"
      || role === "coach_league")` and `if (... role ===
      "recruiter")` branches; the athlete onboarding wizard
      writes only to `athletes.school_id`. The role-aware
      `current_user_school_id()` helper insulates RLS from
      any future drift. No backfill needed; no code change
      needed. Future role changes via admin tooling should
      clear stale `users.school_id`, but that's an admin
      tooling concern, not this entry's scope.

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

      **2026-05-02 — Token expired in the wild.** Alexandre
      Bouchard's signed URL token (`exp = 1777609083`) expired
      today, surfaced as a broken `<img>` with leaking alt text
      ('Alex…') on the partner telechargements page. Manual
      one-off intervention: NULL'd the row's `photo_url` so the
      initials-fallback path renders cleanly:
      ```sql
      UPDATE athletes SET photo_url = NULL
      WHERE first_name = 'Alexandre' AND last_name = 'Bouchard';
      ```
      Verified `UPDATE 1`. Athlete now renders 'AB' initials
      across all surfaces. Underlying bug stays open — same
      class of failure will hit any other Studio-uploaded photo
      when its token expires. Companion follow-up commit adds
      an `AthletePhoto` component with `onError` fallback so
      future expired URLs degrade gracefully without manual
      intervention.

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

- [ ] **Civil coach names silently empty on recruiter profile detail
      (5.3d latent RLS gap).** Discovered 2026-05-06 while planning
      5.3e-iii inline civil coach picker. The query at
      [`AthleteRecruiterProfileBody.tsx:615`](../components/shared/AthleteRecruiterProfileBody.tsx#L615)
      runs `from("league_coaches").select("users!coach_id(...)").eq("league_team_id", id)`
      to populate the civil coach names list, but the only SELECT
      policy on `league_coaches` is `coach_id = auth.uid()` (see
      [`baseline.sql:3951`](../supabase/migrations/20260417120000_baseline.sql#L3951)).
      A recruiter querying that table only sees rows where they
      themselves are the coach — i.e. zero rows for any civil
      athlete. The "Coaches" sub-section under the civil affiliation
      block renders silently empty.

      Same RLS gap also blocks the inline civil coach picker for
      athletes in `parametres` — the reason 5.3e-iii ships with a
      placeholder ("Sélection de coach civil disponible bientôt")
      where the picker would go.

      Resolution scoped to **5.3f**: add an `Athletes read coaches
      of own team` SELECT policy on `league_coaches` (`league_team_id
      IN (SELECT league_team_id FROM athletes WHERE user_id = auth.uid())`),
      then build the inline civil picker in `app/athlete/parametres/page.tsx`
      replacing the 5.3e-iii placeholder, and verify the recruiter-side
      `AthleteRecruiterProfileBody` coach list populates for civil
      athletes. One migration + one page change + one verify pass.

- [ ] **Civil onboarding wizard creates orphan `league_teams` rows on
      back-navigation.** Discovered 2026-05-06 during Phase 5.4
      discovery. In
      [`app/onboarding/page.tsx:1928-1931`](../app/onboarding/page.tsx#L1928-L1931)
      (`LeagueCoachLeagueStep`), `teamSaved` is reset to `false`
      whenever `teamName` / `teamAgeGroup` / `teamCategory` /
      `teamGender` change. Combined with the auto-save `useEffect`
      at line 1851, this means: user fills team fields → INSERT
      `league_teams` row + `league_coaches` row → user navigates
      back to step 0, edits, returns to step 1, modifies team
      name → fresh INSERT of both rows without cleaning up the
      previous pair. Each back-and-forth round-trip leaks one
      `league_team` + one `league_coaches` row.

      Resolution: either (a) UPDATE the existing row when
      `teamSaved=true` instead of resetting to false and re-INSERTing,
      or (b) DELETE the previous team before re-INSERTing. (a) is
      cleaner since league_team_id is referenced from localStorage
      across steps. Defer until orphan accumulation is observed in
      production data.

- [ ] **Orphan `sports_secondaires` keys in `users.profile_data`
      JSONB.** Created 2026-05-06 alongside Phase 5.4a (removal of
      the sports_secondaires UI). The wizard previously wrote
      `profile_data.sports_secondaires: []` (mostly empty arrays)
      for every coach and recruiter onboardee. Removing the writers
      stops new entries but leaves existing keys in place — they
      have no readers anywhere outside the now-deleted recap row,
      so they're functionally dead, just not cleaned up.

      Resolution: a one-shot UPDATE
      `SET profile_data = profile_data - 'sports_secondaires'`
      across `public.users`. Trivial and safe (no readers); defer
      to the next migration that touches `users.profile_data`
      cleanup, or run as a standalone housekeeping migration when
      convenient.

- [ ] **Civil onboarding step 1: minimal "Ligue créée!" feedback after
      custom-league INSERT (5.4f-bis, deferred UX).** Surfaced during
      5.4f discovery. Once a coach creates a custom league via
      `LeagueCoachLeagueStep`, the form is replaced by a green banner
      reading "Ligue créée! Tu peux maintenant créer ton équipe
      ci-dessous." with no echo of what was actually created (name,
      sport, city, region) and no way to revise or undo. The same
      minimalism applies to the existing-league selection path — the
      "C'est ma ligue" card stays visible but there's no "modifier ce
      choix" affordance once the team form below begins to fill.

      Resolution: render a small read-only summary card showing the
      created/selected league details (name + sport pill + city/region)
      with a discreet "Modifier" link that re-opens the picker / form.
      Mirror the pattern already used by `SchoolStep` for école
      ([page.tsx:984-1001](../app/onboarding/page.tsx#L984-L1001)) so
      the two flows feel consistent. Pure UX polish; not a blocker —
      data is correct end-to-end since 5.4f.

- [ ] **`pg_trgm` + GIN index on team/league names for search-as-you-type
      (5.4g performance).** Surfaced during 5.4g-i discovery. The new
      `TeamSearchOrCreate` component runs `ILIKE '%search%'` against
      `league_teams.name` (and the eventual league-name autocomplete
      runs the same against `leagues.name`). Leading wildcards bypass
      btree indexes, so today these queries seq-scan. At pre-beta data
      volume (a handful of civil leagues, dozens of teams) the scan is
      sub-millisecond and there's no real-world performance issue.

      Resolution when team count grows past a few hundred: enable
      `pg_trgm` extension and create
      `CREATE INDEX … USING GIN (name gin_trgm_ops)` on both
      `league_teams.name` and `leagues.name`. Trivial migration; defer
      until search latency becomes observable.

- [ ] **`UNIQUE(LOWER(name), sport_id, level)` on `leagues` to defend
      find-or-create race (5.4g robustness).** Surfaced during 5.4g-i
      discovery, relevant when 5.4g-iii ships the find-or-create
      autocomplete in the team-create form. Without a UNIQUE
      constraint, two coaches typing the same brand-new league name
      within ~1ms create separate `leagues` rows. The constraint
      protects against this race and lets the find-or-create logic
      use `INSERT … ON CONFLICT DO NOTHING RETURNING id` cleanly.

      Resolution: add the constraint as part of 5.4g-iii's migration.
      Edge case is negligible at pre-beta scale, but worth shipping
      together with the find-or-create logic so the production cutover
      lands integrity-tight.

- [ ] **`team_athletes` RLS is essentially open — needs scoped
      hardening to match `league_team_athletes`.** Surfaced during
      5.5b discovery. The current school-side `team_athletes` table
      has two policies:
      `Authenticated access team_athletes` ALL `USING (true)` and
      `admins read all` SELECT `is_admin()`. The first one grants
      every authenticated user full CRUD on the entire roster
      surface — any logged-in user can read, insert, update, or
      delete any team's roster across the platform. This is a real
      security gap that 5.5b consciously did not inherit:
      `league_team_athletes` ships with proper scoped RLS (coach-
      of-team CRUD, athlete-self read, recruiter read, admin all).

      Resolution: drop the open policy and replace with the same
      4-policy scoping used by `league_team_athletes`:
        - "Coaches of team manage roster": `team_id IN (SELECT
          team_id FROM team_coaches WHERE coach_id = auth.uid())`
        - "Athletes read own membership": `athlete_id IN (SELECT
          id FROM athletes WHERE user_id = auth.uid())`
        - "Recruiters read all rosters": role = 'RECRUTEUR'
        - "Admins manage all rosters": is_admin()
      One-migration change, ~30 lines SQL. Defer until either the
      gap surfaces in a security review OR we touch team_athletes
      for another reason (then bundle).

- [ ] **`getCurrentSeason()` helper to consolidate hardcoded
      `"2025-2026"` strings (5.4g-ii cleanup).** Surfaced during
      5.4g-ii. The string `"2025-2026"` is hardcoded in at least 5
      places: `components/onboarding/TeamCreateForm.tsx` (new in
      5.4g-ii), `app/coach/equipes/page.tsx:49` and `:302`,
      `app/coach/equipes/[teamId]/page.tsx:308`, and
      `app/onboarding/page.tsx:1972`. Quebec's academic year flips
      around July/August, so a date-based helper would naturally
      roll over without manual edits.

      Resolution: introduce `lib/utils/season.ts` exporting
      `getCurrentSeason(date?: Date): string` returning e.g.
      `"2026-2027"` once `date >= 2026-08-01`. Replace each
      hardcoded site. Trivial; defer until the 2026-2027 season
      flip is approaching to avoid premature edits.

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

### [x] P2.1 Loi 25 onboarding browser-walk verified via code audit
Closed 2026-05-03 on the strength of a code + DB audit (no
explicit doc bullet preceded — P2.1 was the session-tracking
name for the verification task spun off from the broader P1
lawyer review).

Wiring confirmed correct across all four paths:
- **Athlete signup unchecked** (path A) — spread-conditional at
  [`app/athlete/onboarding/page.tsx:236-240`](../app/athlete/onboarding/page.tsx#L236-L240)
  and
  [`:367-371`](../app/athlete/onboarding/page.tsx#L367-L371)
  omits the three `partner_visibility_*` columns from the upsert
  payload entirely; DB defaults take over (`opt_in = false`,
  `opted_in_at = null`, `parental_consent = false`).
- **Athlete signup checked** (path B) — same code path writes
  `opt_in = true`, `opted_in_at = now()`,
  `parental_consent = true`.
- **Parametres toggle** (path C) — toggle handlers at
  [`app/athlete/parametres/page.tsx:528-559`](../app/athlete/parametres/page.tsx#L528-L559)
  write fresh `opted_in_at` on toggle ON and clear it (`null`)
  on toggle OFF; minor parental-consent revocation at
  [`:494-499`](../app/athlete/parametres/page.tsx#L494-L499)
  cascades `opt_in` off (defensive).
- **Coach create flow** (path D) — same spread-conditional
  pattern at
  [`app/coach/athletes/create/page.tsx:507-511`](../app/coach/athletes/create/page.tsx#L507-L511).

Schema reality double-checked: only three columns written
(`partner_visibility_opt_in`,
`partner_visibility_opted_in_at`,
`partner_visibility_parental_consent`); no
`partner_visibility_consented_at` and no `terms_version`
columns exist (the latter is filed as a P3 follow-up).

Stale test athlete (`ff160979-488b-4647-bce1-68dc113aac19`,
`test-onboard-a@gmail.com`) cleaned up at audit time including
its 4 dependent rows (`recruiter_athlete_views`,
`recruiter_favorites`, `recruiter_pipeline`, `evaluations`) in
a single transaction.

Browser walk explicitly deferred — remaining risk is UI
cosmetic only (layout/copy/accessibility on the
[`PartnerVisibilityConsentCard`](../components/shared/PartnerVisibilityConsentCard.tsx)).
Spot-check candidate if launch readiness needs it; not blocking
the closeout.

Companion P2 (audit trail gap) and P3 (`terms_version`
persistence) filed in their respective sections.
