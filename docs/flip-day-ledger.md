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

### [ ] P3 — recruteur↔athlète messaging (RLS + blackout + pipeline + notify)
Branch `feat/messaging-athlete-coach` (merged from `feat/messaging-recruiter-athlete`).
Proven locally **11/11** (per-role suite `scratchpad/validation-p3-ra.sql`): recruiter+
favorite creates RA (allow), recruiter+non-favorite denied (favoris-gate, bypass
closed), recruiter first message (Pro), pipeline auto-CONTACTE, first-contact notif
(coach+parent recorded), athlete replies (free), athlete cannot initiate, eligibility
stub true, blackout dormant + active-blackout blocks send, athlete mark-read.

Apply in filename order, **each as its own `apply_migration` / `psql -f`** (enum/txn
split rule — do NOT bundle):

1. `supabase/migrations/20260722110000_p3_eligibility_and_blackout.sql`
   — **`ALTER TABLE conversations ALTER COLUMN coach_id DROP NOT NULL`** (the per-type
   CHECK re-imposes coach_id NOT NULL on RECRUTEUR_COACH/ATHLETE_COACH/PARENT_COACH →
   zero behavior change; only RECRUTEUR_ATHLETE needs it null). `is_athlete_contactable`
   **eligibility STUB (returns true for all)** — "pas sous sec. 5" rule pending BP/ligue,
   swap the body via CREATE OR REPLACE with zero migration when confirmed.
   `blackout_periods` table (admin-write via `is_platform_admin`, all-read) +
   `is_messaging_blacked_out` (GLOBAL scope in v1).
2. `supabase/migrations/20260722110100_p3_recruiter_athlete_rls.sql`
   — **`conversations_insert` RE-SCOPED to RECRUTEUR_COACH** (was type-agnostic → a Pro
   recruiter could create RA and bypass the favoris-gate; closes it). New RA policies:
   recruiter-initiate (recruiter=self + coach_id NULL + parent_id NULL + athlete in the
   recruiter's `recruiter_favorites` + `is_athlete_contactable`); recruiter + athlete
   SELECT; participant UPDATE; `ra_messages_select`; **`ra_athlete_messages_insert`**
   (athlete replies, free — recruiter still routes through the Pro-gated
   `messages_insert`); `ra_athlete_messages_update` (athlete mark-read).
3. `supabase/migrations/20260722110200_p3_blackout_enforcement.sql`
   — `enforce_messaging_blackout()` BEFORE INSERT triggers on conversations + messages,
   scoped RECRUTEUR_ATHLETE (mute both sides during an active GLOBAL window; existing
   threads persist, only sending suspends). Dormant — no blackout rows in prod.
4. `supabase/migrations/20260722110300_p3_pipeline_and_notify.sql`
   — **⚠️ pre-flight: `pg_get_functiondef` prod's `message_insert_to_pipeline` and diff
   vs base BEFORE this CREATE OR REPLACE** (it only extends the allowlist to
   `IN ('RECRUTEUR_COACH','RECRUTEUR_ATHLETE')`; confirm nothing else drifted).
   `recruiter_contact_notifications` table (admin-read + coach-read-own) +
   `notify_first_recruiter_contact()` AFTER INSERT trigger on conversations (records
   COACH + PARENT first-contact rows; best-effort push via Vault+pg_net, errors swallowed).

**Prod notes (from the P3 deferral):** `RECRUTEUR_ATHLETE` already exists on prod from
Phase A → **NO `ALTER TYPE ADD VALUE`**. Two shipped-object changes land:
`conversations.coach_id` NOT-NULL drop (file 1) + `conversations_insert` scope to
`RECRUTEUR_COACH` (file 2). Eligibility ships as a `true` stub. Re-run
`scratchpad/validation-p3-ra.sql` after prod apply → expect 11/11.

### [ ] Broadcast — ciblage propriétaire + remontée du fil (correctifs #2)
Branch `feat/messaging-athlete-coach`. Proven locally 4/4
(`scratchpad/proof-broadcast-scope.sql`): coach régulier `all_athletes` → SES
athlètes seulement (coachb 0-own → 0 ; Tremblay 2-own → 2) ; directeur
`all_athletes` → école entière (6) ; fil réutilisé bumpe `last_message_at`.

- `supabase/migrations/20260724120000_broadcast_scope_and_surface.sql`
  — `CREATE OR REPLACE send_broadcast` (signature inchangée, idempotent). Deux
  correctifs : **(a) ciblage** — un COACH régulier ne diffuse qu'à SES propres
  athlètes (`a.coach_id = expéditeur`) ; un **DIRECTEUR** (school_coaches role
  DIRECTEUR/DIRECTEUR_INTERIM) garde la portée école (`a.school_id = école`).
  Vaut pour all_athletes/athletes(ids)/team. **(b) remontée** — bump
  `last_message_at = now()` à chaque message (fils réutilisés inclus) pour les
  trois types, sinon la diffusion restait enterrée chez le destinataire.
- **Pas de RLS touchée** — c'est un correctif de RÉSOLUTION des destinataires
  dans le RPC DEFINER. La visibilité inter-coach était déjà étanche (aucun coach
  ne SELECT les fils d'un autre ; vérifié). UI alignée : `GroupeCompose` scope la
  liste d'athlètes au roster du coach (école pour le directeur) + libellé adapté.

Re-run its proof après prod apply : `scratchpad/proof-broadcast-scope.sql` — expect 4/4.

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
