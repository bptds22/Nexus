# Flip-day ledger — DB changes held LOCAL, pending prod

Single source of truth for schema/RLS changes that are **applied locally and
proven, but deliberately NOT applied to production yet**. They are applied to
prod as a batch on the P1 messaging **flip-day pre-flight**, in filename order,
each verified by its per-role proof before the app flip.

All entries are **additive / expand-only** and **idempotent** (safe to re-run:
`IF NOT EXISTS` / `DROP … IF EXISTS` / `CREATE OR REPLACE` / `ADD VALUE IF NOT
EXISTS`). Re-applying a already-present entry is a no-op — the pre-flight can run
the whole batch without pre-checking what's already there.

Apply with the UTF-8-safe path (never `Get-Content | psql`):
```
docker cp <file>.sql supabase_db_Nexus:/tmp/x.sql
docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/x.sql
```
(run the `docker exec` from PowerShell — git-bash mangles `/tmp/…`).

---

## Flip-day checklist

### [ ] P4 — COACH_COACH messaging (coach↔coach same-school, directors included)
Branch `feat/messaging-athlete-coach`. Proven locally 15/15 (per-role suite:
same-school allow, cross-school deny incl. own-athlete hole-closure, director↔coach,
recruiter paths untouched, per-type CHECK rejects null athlete on the 4 anchored
types, works with/without attached athlete, privacy for athlete + third coach,
immutability inherited, mark-read).

1. `supabase/migrations/20260723120000_coach_coach_enum.sql`
   — `ALTER TYPE conversation_type ADD VALUE 'COACH_COACH'`. **MUST be applied and
   committed in its OWN transaction before file 2** (Postgres forbids using a new
   enum value in the same txn — the P3 enum/txn split). Applying the two files as
   two separate `psql -f` invocations satisfies this.
2. `supabase/migrations/20260723120100_coach_coach_model_rls.sql`
   — `coach_b_id` column; `athlete_id` → column-nullable (per-type CHECK re-imposes
   NOT NULL on the 4 existing types → zero behavior change for them; only
   COACH_COACH allows null); rewritten `conversations_participants_by_type`;
   `uq_conversations_coach_coach` dedup index; `is_same_school_staff()` DEFINER
   helper; `is_conversation_participant()` + `notify_on_message()` extended for
   `coach_b_id`; **`coach_conversations_insert` RE-TIGHTENED** to exclude
   COACH_COACH (closes a cross-school hole); 6 new COACH_COACH policies.

Re-run its proof after prod apply: `scratchpad/validation-coach-coach.sql`
(+ the T13 uuid fix) — expect 15/15.

### [ ] Coach-initiated RECRUTEUR_COACH (favoris-symmetric)
Branch `feat/messaging-athlete-coach`. Proven locally 8/8 (allow with
favoris+ownership; deny zero-favoris — **bypass closed**; deny non-owned anchor;
recruiter read/reply; recruiter-initiate intact; helper returns).

- `supabase/migrations/20260723130000_coach_initiate_recruteur_coach.sql`
  — `recruiter_favorited_athlete()` + `list_interested_recruiters()` DEFINER
  helpers; **`coach_conversations_insert` RE-TIGHTENED** to also exclude
  `RECRUTEUR_COACH` (it was a favoris-gate bypass); `coach_initiate_recruteur_coach`
  INSERT policy (coach_id=self + recruiter favorited the anchor + anchor is the
  coach's own athlete). Reuses the RECRUTEUR_COACH type; `athlete_id` stays NOT NULL.

Re-run its proof after prod apply: `scratchpad/validation-coach-initiate.sql` — expect 8/8.
⚠️ **SUPERSEDED by the reversal below** — apply both in order; the favoris
precondition no longer applies after `20260723150000`.

### [ ] Coach→recruiter OPENED — favoris precondition REVERSED (deliberate)
Branch `feat/messaging-athlete-coach`. Proven locally 5/5 (allow WITHOUT favoris;
deny non-owned anchor; deny non-recruiter target; recruiter reads; recruiter-
initiate intact).

- `supabase/migrations/20260723150000_open_coach_recruiter_messaging.sql`
  — replaces `coach_initiate_recruteur_coach`: **removes** the
  `recruiter_favorited_athlete` precondition; keeps anchor = the coach's own
  athlete; adds `user_is_recruiter(recruiter_id)` DEFINER guard (recruiter_id
  must be a real RECRUTEUR — via DEFINER to avoid the users↔conversations
  recursion an inline `EXISTS(users)` triggers).
- **Rationale (BP):** coach/director outbound "sell my athletes" motion — a coach
  contacts any CÉGEP recruiter about one of his athletes without waiting for the
  recruiter to favorite first. Anchor-ownership + recruiter-role stay enforced.

Re-run its proof after prod apply: `scratchpad/validation-open-recruiter.sql` — expect 5/5.

### [ ] Broadcast messaging (Groupe, option a — N individual threads)
Branch `feat/messaging-athlete-coach`. Proven locally 7/7 (all-athletes = school
count only; **leak check: other-school athlete never reached**; martin received a
normal thread; team resolves to members; recruiter favorited_coaches; "Envoyé à N"
via recipient_count; every broadcast msg carries broadcast_id).

- `supabase/migrations/20260723140000_broadcast_messaging.sql`
  — `broadcasts` table (sender-read RLS) + `messages.broadcast_id` marker +
  `send_broadcast(jsonb, text)` DEFINER RPC. Recipients resolved ONLY from the
  sender's legal set (same-school staff / school athletes / team members /
  favorited-athlete coaches) → a broadcast can't reach anyone a 1-on-1 couldn't.
  Reuses ATHLETE_COACH / COACH_COACH / RECRUTEUR_COACH via find-or-create.

Re-run its proof after prod apply: `scratchpad/validation-broadcast.sql` — expect 7/7.

### [x] handle_new_auth_user — VERIFIED prod == local (no diff, no action)
Diffed 2026-07-23, prod (nexus-prod `nrloizyemulbhujrqhgx`) vs local via
`pg_get_functiondef`: **byte-identical.** Both have the same 8 INSERT columns
(id, email, role, status, first_name, last_name, context, date_naissance), the
same `context` CASE (scolaire/collegial/ligue_civile), the same `date_naissance`
ISO-regex cast, the same `ON CONFLICT (id) DO NOTHING`, and BOTH already carry
the `invitation_token` (`consume_invitation_token`) and `claim_token`
(`consume_athlete_invitation`, EXCEPTION-guarded) branches. **No flip-day action
for this trigger** — prod is not lagging.

### Note — idempotent re-apply
Every entry above is safe to re-apply. The pre-flight runs the batch top-to-bottom;
already-applied statements no-op. The only ordering constraint is enum-before-model
(P4 file 1 before file 2).

---

## Product decisions (no code — recorded, not action items)

### Athlete claim scope = SCHOOL-ONLY (no sport restriction) — deliberate
A coach may claim any unclaimed athlete at their school regardless of the coach's
sport(s). Confirmed as intended, NOT a bug — no code/RLS change.
- **Where enforced:** RLS `coaches can claim unclaimed school athletes`
  (`coach_id IS NULL AND school_id = current_user_school_id()`) + `ReclamerSection`
  (no sport filter). Same for the roster's "À réclamer" pool.
- **Rationale:** athletes are frequently multi-sport, so a sport gate would wrongly
  hide legitimate claims; the **Transferts** page is the correction path if an
  athlete lands under the wrong coach.
- Revisit only if a school reports mis-claims at scale.
