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

- [ ] **Signup errors swallowed client-side.** Both
      [`app/auth/page.tsx`](../app/auth/page.tsx) and
      [`app/auth/pro/page.tsx`](../app/auth/pro/page.tsx) show toasts for
      `error.message` but don't catch DB-layer rejections from the
      `handle_new_auth_user` trigger or follow-up upserts. Add explicit
      `{ error }` destructuring on every secondary write and a
      catch-all try/finally around the flow.

- [ ] **Verified badge inconsistent between search and favoris views.**
      Same athlete renders with different `isVerified` values across
      pages — e.g. verified on [`/recruteur/recherche`](../app/recruteur/recherche/page.tsx)
      but not on [`/recruteur/favoris`](../app/recruteur/favoris/page.tsx),
      or vice versa. Discovered 2026-04-23 during favorites counter
      fix verification.
      Repro: log in as a recruiter, favorite any athlete, compare the
      verified badge on `/recruteur/recherche` vs `/recruteur/favoris`.
      Hypothesis: one page reads `athletes.verified` directly, the
      other reads a stale joined view or a different field. Needs
      investigation, not fixing yet.
      Next step: grep both pages for `verified` reads and compare
      sources.

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

## P1 — Data collection

- [ ] **`recruiter_athlete_views` table never written.** 0 rows in
      production across the full Phase 5 test window. The
      instrumentation on the recruiter athlete profile page
      ([`app/recruteur/athletes/[id]/page.tsx`](../app/recruteur/athletes/%5Bid%5D/page.tsx))
      is either missing or failing RLS. Blocks the athlete visibility
      feature (who viewed me / CÉGEP interest) from showing any
      data to Pro athletes.

---

## P2 — Observability

- [ ] **`recruiter_activity_log` query returns HTTP 400 on dashboard.**
      Appears in the browser network tab on the recruiter dashboard.
      Likely a missing column, bad FK hint, or ambiguous join in a
      PostgREST `.select(...)`. File:
      [`app/recruteur/tableau-de-bord/page.tsx`](../app/recruteur/tableau-de-bord/page.tsx).

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
