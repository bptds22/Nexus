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

- [ ] **Coach onboarding missing interim-director option.** Step 3 of
      coach signup ("Qui est le directeur sportif?") shows only two
      buttons: "C'est moi" and "Inviter quelqu'un." The DB logic also
      supports a third state — first-claim interim director — where
      no director exists yet and the signing-up coach is auto-promoted
      to `DIRECTEUR_INTERIM` by the `first_coach_claim` trigger (fixed
      in commit [`9719fac`](../../../commit/9719fac)).
      Current UX leaves users confused: they may not want to claim
      director responsibility, but there's no director to invite
      either. They pick one of the two wrong answers and the trigger
      overrides their choice silently.
      Needs a third option with explicit language: *"Je ne suis pas
      le directeur, mais il n'y a pas encore de directeur inscrit. Je
      deviens directeur par intérim jusqu'à ce qu'un directeur
      officiel rejoigne l'école."*
      Flow implication: only show this option when no `DIRECTEUR` or
      `DIRECTEUR_INTERIM` currently exists for the selected school.

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

- [ ] **Coach card design inconsistent between compose page and
      thread page.** On
      [`/recruteur/messages/nouveau`](../app/recruteur/messages/nouveau/page.tsx)
      (compose), the right-rail "Coach destinataire" card shows only
      the school name — no coach name, no contact info. On
      `/recruteur/messages/<conv-id>` (thread), the same card area
      shows full info: name, email, "Laisser un avis" CTA.
      Both tiers should see the same coach card design (Pro
      version with full info). The Free-vs-Pro distinction is purely
      about whether the message actually sends — not about what
      coach info is visible. Fix: replace the compose page's minimal
      coach card with the same component/markup the thread page
      uses. Free tier still gets blocked at send time (existing
      behavior); the visual experience is uniform.
      Repro: log in as `test-free` or `test-pro`, click "Nouveau
      message", select Alexandre Bouchard. Compare right rail to
      any existing conversation thread.

- [ ] **Athlete signup writes placeholder email instead of user
      input.** When creating an athlete profile, the email field in
      the `athletes` table gets populated with mock/hardcoded test
      data instead of the actual email the user provided at signup.
      Real athletes end up with fake emails attached to their
      profiles.
      Repro: sign up as a new athlete with a real email. Check the
      `athletes.email` column — it'll likely be a mock string, not
      what was typed.
      Investigate:
      - What path does the athlete signup take?
        (`/auth` with `mode=signup`, `role=ATHLETE`)
      - Where does the `athletes` row get INSERTed — in the trigger,
        the client, or the onboarding flow?
      - Grep for hardcoded email patterns (`example.com`, `@test.`,
        etc.) in the athlete onboarding and `athletes`-table INSERT
        code.

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

- [ ] **Favorites should auto-create pipeline entry under
      "Identifié".** When a recruiter favorites an athlete, the
      athlete should automatically appear in the recruiter's pipeline
      under the "Identifié" stage (matches the natural funnel:
      favorite → identify → contact). Currently favoriting and adding
      to pipeline are disconnected actions.
      Open questions before fixing:
      - Pro/All Star tier only, or all tiers?
      - What happens on unfavorite — remove from pipeline, or keep?
      - What happens if athlete is already in pipeline at a later
        stage (e.g., "Contacté")? Don't downgrade.

## P1 — Data collection

*(all cleared — see **Closed** at the bottom)*

---

## P2 — Observability

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
