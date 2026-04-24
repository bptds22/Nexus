# Post-Launch Bugs — Nexus

**Date discovered:** 2026-04-23
**Context:** Phase 5 manual testing against `v0.9.0-pre-cloud`
**Status:** Logged for post-tag fix pass

Each item is actionable as a stand-alone PR. Grouped by impact, not by
file.

---

## P0 — Affect new user onboarding

- [ ] **`/inscription` route is linked from marketing but doesn't exist.**
      Multiple marketing CTAs (landing, persona cards, pour-les-coachs,
      pour-les-recruteurs, tarifs, guide-recrutement) link to
      `/inscription?role=...`. The actual route is `/auth?mode=signup`.
      Clicking any of these CTAs hits a 404. Either add a redirect in
      `next.config.ts`, create an `app/inscription/page.tsx` that
      forwards to `/auth`, or rewrite all CTAs to the real path.

---

## P1 — Silent UX failures

- [ ] **Free recruiter message send fails silently.** RLS now rejects
      the insert (Phase 2a), but [`app/recruteur/messages/nouveau/page.tsx`](../app/recruteur/messages/nouveau/page.tsx)
      doesn't surface the error or route the user to the upgrade flow.
      Expected: show an inline upsell toast or a `FeatureGate` wrapping
      the compose view for Free tier.

- [ ] **Signup errors swallowed client-side.** Both
      [`app/auth/page.tsx`](../app/auth/page.tsx) and
      [`app/auth/pro/page.tsx`](../app/auth/pro/page.tsx) show toasts for
      `error.message` but don't catch DB-layer rejections from the
      `handle_new_auth_user` trigger or follow-up upserts. Add explicit
      `{ error }` destructuring on every secondary write and a
      catch-all try/finally around the flow.

- [ ] **`first_coach_claim` trigger references non-existent column.**
      The trigger body reads `school_registry.director_id` but the
      `school_registry` table has no such column in the current schema.
      Trigger likely throws on any claim-related insert. Audit the
      trigger body, rename to the correct column, or drop if the
      claim feature is deferred.

## P1 — Data collection

- [ ] **`recruiter_athlete_views` table never written.** 0 rows in
      production across the full Phase 5 test window. The
      instrumentation on the recruiter athlete profile page
      ([`app/recruteur/athletes/[id]/page.tsx`](../app/recruteur/athletes/%5Bid%5D/page.tsx))
      is either missing or failing RLS. Blocks the athlete visibility
      feature (who viewed me / CÉGEP interest) from showing any
      data to Pro athletes.

- [ ] **Favorites counter on athlete profile shows wrong count.** DB
      has the correct total (verified by direct `SELECT COUNT(*) FROM
      recruiter_favorites WHERE athlete_id = …`) but the UI reads from
      a different source (likely a stale `favCount` state from an
      earlier fetch, or a client-side aggregate that's off by one).
      File to audit:
      [`app/athlete/visibilite/page.tsx`](../app/athlete/visibilite/page.tsx)
      and the underlying `useAthleteVisibility()` hook.

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
