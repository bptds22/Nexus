# Session handoff — messaging train (branch `feat/messaging-athlete-coach`)

Flip-day-ledger style. Written for a **fresh session** picking up at **item 4**.
Everything below item 3 is DONE, verified, committed, pushed. Item 4 is the only
open work.

- **Branch tip:** `72cf417` (branch `feat/messaging-athlete-coach`, worktree
  `C:\tmp\nexus-msg`).
- **Remote:** `origin/feat/messaging-athlete-coach` is up to date with the tip.

---

## Shipped this train (items 1–3) — one line each

- **`5cfb44a` — Item 1 TRANSFER edge cases:** `transferAthletes` now `.select()`s
  and row-counts so an RLS-denied reassignment returns an honest error toast
  instead of phantom success. Rule unchanged (owner / team-coach / director) — no
  RLS widening.
- **`8e7786e` — Item 2 OPEN recruiter messaging:** favoris precondition on
  coach→recruiter **reversed** (BP decision); coach/directeur "Recruteurs" tile is
  now a full CÉGEP → recruiter → my-athlete browser; `RECRUTEUR_COACH`
  find-or-create; DB migration `20260723150000` (held local) + ledger entry. Proof
  5/5.
- **`110113f` + `72cf417` — Item 3 ANNONCE consolidated sender view:** broadcast
  delivery unchanged (N private 1-on-1 threads); the **sender's** inbox folds each
  broadcast into ONE `Annonce · [cible] · Envoyé à N` row that REPLACES the N
  member rows; the Annonce view shows the announcement once + each recipient's
  reply, tap a recipient → jump into the 1-on-1. Coach + directeur, web + mobile.
  **No DB change** (broadcast infra already shipped in `20260723140000`). Verified
  end-to-end as Tremblay (send → consolidated entry → martin replies → reply
  surfaces under the Annonce → jump into the 1-on-1). `72cf417` aligns the inbox
  badge to count *recipients who replied* (matches the detail header).

Key files touched by item 3 (for reference): `lib/queries/coach/loadSenderBroadcasts.ts`
(new), `app/coach/demandes/page.tsx`, `app/coach/demandes/annonce/[id]/` (new
route: server `page.tsx` + `PageClient.tsx`), `lib/queries/coach/useCoachConversations.ts`,
`components/shared/CoachDemandesMobile.tsx`.

---

## ITEM 4 — P3 recruiter→athlete merge + UI (the open work)

### Scope (verbatim from BP)

> **P3 UI — RECRUITER→ATHLETE** — merge `feat/messaging-recruiter-athlete` into P1
> branch, apply its 4 held migrations locally; athlete profile gets "Contacter le
> coach"/"Contacter l'athlète" actions; gates: favorite-first required
> (auto-prompt "Ajouter aux favoris pour contacter"), parent/coach first-contact
> notifications ON, blackout dormant, eligibility stub permissive; athlete
> receives/replies (never initiates); P3 migrations join flip-day ledger.

### Concrete breakdown

1. **Merge** `feat/messaging-recruiter-athlete` into `feat/messaging-athlete-coach`
   (this is the P1 train branch). Expect the merge to bring the 4 P3 migration
   files + the P3 backend/UI commits. Resolve conflicts favouring the P1 train's
   already-shipped messaging (items 1–3 are newer).

2. **Apply the 4 held P3 migrations to the LOCAL DB** — they are currently **NOT
   applied** to the shared local DB (verified: `blackout_periods`,
   `is_athlete_contactable`, `is_messaging_blacked_out` are all absent). Apply **in
   filename order, each as its own `psql -f` invocation** (enum/txn-split rule),
   UTF-8-safe path:
   - `20260722110000_p3_eligibility_and_blackout.sql` — `is_athlete_contactable`
     (eligibility **stub → returns true for all**), `blackout_periods` table,
     `is_messaging_blacked_out`.
   - `20260722110100_p3_recruiter_athlete_rls.sql` — `RECRUTEUR_ATHLETE` RLS;
     initiation = RECRUTEUR only, precondition = athlete in the recruiter's
     `recruiter_favorites` + eligibility(stub) + not blacked-out.
   - `20260722110200_p3_blackout_enforcement.sql` — blackout = **mute both sides**
     (trigger, DB-level); dormant because no blackout rows exist.
   - `20260722110300_p3_pipeline_and_notify.sql` — recruiter's 1st message
     auto-advances `recruiter_pipeline` to CONTACTE + first-contact notification.
     ⚠️ **pre-flight: diff prod's `message_insert_to_pipeline` against base before
     this file re-defines it** (noted in the P3 deferral).
   ```
   docker cp <file>.sql supabase_db_Nexus:/tmp/x.sql
   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/x.sql
   ```
   (run the `docker exec` from the **PowerShell tool** — git-bash mangles `/tmp/…`).
   Re-run the P3 per-role proof after applying (P3 branch had 10/10 + mark-read).

3. **Athlete-profile UI** — add the two-button action row on the athlete profile:
   - **"Contacter le coach"** → existing `RECRUTEUR_COACH` find-or-create (already
     wired from earlier work).
   - **"Contacter l'athlète"** → `RECRUTEUR_ATHLETE` find-or-create (new P3 path).
   - **Gate — favorite-first REQUIRED:** if the athlete isn't favorited, don't send;
     auto-prompt **"Ajouter aux favoris pour contacter"** (add-to-favorites CTA),
     then allow.
   - Parent/coach **first-contact notifications ON**, **blackout dormant**,
     **eligibility stub permissive** (all already the DB defaults from the 4
     migrations).
   - **Athlete receives/replies, NEVER initiates** — no "new message → athlete"
     compose entry point; the athlete only sees/answers RECRUTEUR_ATHLETE threads
     in their inbox (P3 branch already built the athlete inbox side).

4. **Ledger:** add the 4 P3 migrations to `docs/flip-day-ledger.md` as a held-local
   entry (prod-apply deferred; enum already exists on prod from Phase A → **no
   `ALTER TYPE ADD VALUE`**, but keep each a separate apply; diff
   `message_insert_to_pipeline` before `110300`; two shipped-object changes:
   `conversations.coach_id` NOT-NULL drop + `conversations_insert` scoped to
   `RECRUTEUR_COACH`; eligibility ships as a `true` stub).

---

## Test accounts + passwords (LOCAL throwaway — you created them; sign-in OK)

Password for ALL of these: **`NexusTest123!`**

| Role | Email | Notes |
|---|---|---|
| Coach (sender) | `coach.tremblay@test.local` | Marc Tremblay, id `630a4125-8940-4941-8532-83f400fec854`, school `59ff9e48-65a4-40f7-a8da-793bc7da1e98` |
| Coach B | `coachb@test.local` | Benoit Lévesque, same school (id `11a64c36-dff9-4c1e-9b0e-dc794d91511b`) |
| Director | `directeur@test.local` | Denise Charbonneau, same school (id `e213ec7a-3b5f-4ff3-bd28-0a8d11166c76`) |
| Recruiter | `recruteur@test.local` | CÉGEP recruiter (favoris/CÉGEP fixtures restored to Limoilou/Sainte-Foy) |
| Athlete | `martin@gmail.com` | "Nexus Athletye", athlete id `60827351-2317-41e1-b2d1-f13f1b8dc9d3`, user id `5cb054c3-ebd0-437b-8995-6875efa4b8c3`, coach_id = Tremblay, school `59ff9e48…`, ACTIF |

Fixture note: martin's `coach_id` has drifted to coachb in past runs — restore to
Tremblay (`630a4125…`) if verification needs it. Tremblay's school has **6 ACTIF
athletes** (a "tous les athlètes" broadcast = Envoyé à 6, martin included).

Browser sign-in that works reliably: navigate `/auth`, set the email + password
inputs via native-setter + `input`/`change` dispatch (React-controlled), click the
**English** "Log in →" submit (`ref` via `find`), wait ~3s. Sign out via the
sidebar-footer **"Déconnexion"** button (`find` → click). Sessions are cookie-based
per browser profile, so athlete↔coach verification is sign-out/sign-in sequential.

---

## Environmental build/dev rules (THIS worktree — critical)

This worktree's `node_modules` is a **junction** → `C:\Users\bptds\Documents\Nexus\node_modules`,
which is out of the `C:\tmp` filesystem root. **Turbopack panics** on it
("Symlink node_modules is invalid, it points out of the filesystem root") for BOTH
`next build` and `next dev`. Use the **webpack builder** everywhere:

- **Web build:** `npx next build --webpack`
- **Dev server:** `npx next dev --webpack --port 3002`
- **Mobile build:** the script `scripts/build-mobile.mjs` runs plain `next build`
  (Turbopack). To build mobile, **temporarily add `--webpack`** to its args array
  (`'next', 'build', '--webpack'`), run `npm run build:mobile` (npm puts
  `node_modules/.bin` on PATH — do NOT `node scripts/…` directly, `cross-env.cmd`
  won't resolve), then **REVERT the edit** — it must NOT be committed (the junction
  is a worktree quirk; prod/CI has a real `node_modules` where Turbopack is fine).

**`.next` isolation rule:** never run `next build` while the dev server is running
(shared `.next` corruption). Before every build cycle: `taskkill /F /IM node.exe`
→ `Remove-Item -Recurse -Force .next` → build(s) → then restart the dev server.

`output: export` (mobile) needs `generateStaticParams()` for every dynamic segment:
the pattern is a **server `page.tsx` wrapper** (`export async function
generateStaticParams(){ return [{ id:'placeholder' }] }` + `<Suspense><PageClient/></Suspense>`)
with the `"use client"` code in a sibling `PageClient.tsx`. Any new dynamic route
must follow it or the mobile build fails.

---

## Final handoff bar (identical to prior items — BP tests ONCE)

1. Both migrations/backend proven (re-run P3 per-role proof after local apply).
2. Both builds green (web `--webpack` + mobile `--webpack`, isolated per the
   `.next` rule).
3. Fresh dev server, single listener on `:3002` (`--webpack`).
4. Click-proof by you as each real test user, with screenshots:
   - As a **recruiter**: open a favorited athlete's profile → "Contacter l'athlète"
     sends (RECRUTEUR_ATHLETE); on a NON-favorited athlete → the
     "Ajouter aux favoris pour contacter" auto-prompt appears first.
   - As the **athlete** (martin): receives the thread, **replies** (and confirm
     there is no initiate entry point).
   - Confirm the first-contact notification fired and pipeline advanced to CONTACTE.
5. P3 migrations added to `docs/flip-day-ledger.md`.
6. Commits on the branch (plain-ASCII commit messages — accents/apostrophes/`?`
   break PowerShell here-strings), push.
