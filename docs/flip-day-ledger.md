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

### [ ] handle_new_auth_user — verify prod parity, apply diff if prod lags
The local `handle_new_auth_user()` trigger inserts the `public.users` row from
`raw_user_meta_data` (role/first/last/context/date_naissance) **and** consumes an
`invitation_token` (school/coach) and a `claim_token` (athlete orphan link,
best-effort with an EXCEPTION guard). ⚠️ **BP to confirm the exact intended
prod-vs-local diff** before flip — this line is a reminder that the function must
match, not a captured patch. If prod's version predates the claim-token branch,
ship the current local definition as a `CREATE OR REPLACE` on flip-day.

### Note — idempotent re-apply
Every entry above is safe to re-apply. The pre-flight runs the batch top-to-bottom;
already-applied statements no-op. The only ordering constraint is enum-before-model
(P4 file 1 before file 2).
