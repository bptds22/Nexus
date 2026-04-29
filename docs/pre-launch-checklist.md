# Nexus Pre-Launch Checklist

Tasks to complete before public launch. Most are hygiene
items that don't block development but should be done
together in a focused launch prep session.

## Code hygiene

- [ ] **Strip console.log calls** — 385 calls across 79
  files (counted 2026-04-29). Concentrated in:
  - app/coach/ecole/analytics/page.tsx (30)
  - app/coach/athletes/[id]/modifier/page.tsx (25)
  - app/admin/settings/page.tsx (22)
  - app/admin/schools/[id]/page.tsx (18)
  - app/coach/athletes/[id]/page.tsx (17)
  - 74 other files with the rest

  Approach: Claude Code surgical sweep. Delete `console.log`
  calls, KEEP `console.error` and `console.warn` (legitimate
  prod signals). Run `npm run build` after. Spot-check the
  top 5 files for anything that should have been
  `console.error` instead.

- [ ] **Remove debug routes/pages** — audit `app/admin/`,
  `app/dev/`, any `/debug` or `/test-*` paths. Leave only
  what production admins need.

- [ ] **Strip mock data files** — `lib/mock/` folder has 9
  files for non-athlete portals (coach reputation, recruiter,
  admin, review widget, etc.). Audit each for residual
  imports in production code, delete what's unused.

## Security & data

- [ ] **Loi 25 review with Quebec privacy lawyer** —
  pending consultation
- [ ] **Audit RLS policies** — full review of all tables'
  policies, ensure no overly permissive policies remain
  (the school-coach revisit on 2026-04-28 closed the major
  ones; verify others)
- [ ] **Rotate any test API keys** — Stripe test keys, any
  third-party service tokens used in dev
- [ ] **Remove any hardcoded test user IDs** in the codebase

## Deployment

- [ ] **Move from Vercel to OVHcloud Beauharnois VPS** —
  Loi 25 requires Quebec data residency
- [ ] **Configure Coolify** for production hosting
- [ ] **Google OAuth setup** — deferred from dev because
  redirect URL needs to be public
- [ ] **Set up production monitoring** — error tracking,
  uptime monitoring

## Content

- [ ] **Replace placeholder Phase 2 stubs** with real
  features or "coming soon" pages:
  - CÉGEP coach detail messaging (P3 in bug doc)
- [ ] **Pricing page final copy** — confirm tier
  pricing decisions before launch
- [ ] **Marketing site copy** — taglines, hero, value
  prop

## Testing

- [ ] **Demo to real coaches and recruiters** — in
  progress
- [ ] **Multi-coach school stress test** — once a school
  has multiple coaches, verify the team filter / view
  toggle (P2 in bug doc) is needed
