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

### [ ] Guard — PARENT_COACH excluded from generic coach insert (SECURITY, this train)
Branch `feat/messaging-athlete-coach`. A **today-bug**, not a P2 feature: the generic
`coach_conversations_insert` allowed any type except COACH_COACH/RECRUTEUR_COACH — so
it permitted **PARENT_COACH** (Phase A type). Its per-type CHECK only requires
`parent_id NOT NULL`, NOT that parent_id is the child's real parent → a coach could
open a channel to an ARBITRARY user by labelling them the "parent" of one of their
athletes (`is_conversation_participant` grants the named parent read access). Nothing
creates PARENT_COACH today (0 rows, no UI), so the fix breaks nothing live.

- `supabase/migrations/20260724170000_guard_parent_coach_generic_insert.sql`
  — `DROP`+`CREATE coach_conversations_insert` adding `'PARENT_COACH'` to the excluded
  types. After this PARENT_COACH is unreachable from ANY policy until the P2 train adds
  the guarded ones. **Must apply AFTER** the coach_coach / coach-initiate-recruteur
  migrations that define this policy (filename order guarantees it). Idempotent.

Proof (local): `scratchpad/prove-guard.sql` — coach PARENT_COACH-with-arbitrary-parent
insert BLOCKED (t), ATHLETE_COACH own-athlete insert still ALLOWED (t).

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

### [ ] Transferts — assigner un athlète non réclamé (correctif #1)
Branch `feat/messaging-athlete-coach`. Règle validée BP. Proven locally 4/4
(`scratchpad/proof-unclaimed-assign.sql`): coach régulier assigne un athlète NON
RÉCLAMÉ → autre coach (allow) ; → soi (allow) ; → non-coach (deny) ; réassignation
d'un athlète DÉJÀ réclamé par un non-directeur reste DENY (aucun élargissement).

- `supabase/migrations/20260724130000_assign_unclaimed_school_athletes.sql`
  — nouvelle policy UPDATE `coaches assign unclaimed school athletes` :
  `USING (coach_id IS NULL AND school_id = current_user_school_id())` +
  `WITH CHECK (school_id = current_user_school_id() AND (coach_id IS NULL OR le
  nouveau coach_id est un school_coach de mon école))`.
- **Portée STRICTE** : la clause USING `coach_id IS NULL` fait que la policy ne
  s'applique JAMAIS aux athlètes déjà réclamés → la réassignation d'un athlète
  réclamé reste directeur/team-coach seulement. Additif, idempotent.
- **Bug corrigé** : assigner un athlète du pool « Non assigné » à un collègue
  échouait ("new row violates RLS") — la policy `claim` existante ne permettait
  le WITH CHECK que vers soi. Vérifié navigateur : coachb assigne Émile (non
  réclamé) → Marc Tremblay, succès.

Re-run its proof après prod apply : `scratchpad/proof-unclaimed-assign.sql` — expect 4/4.

### [ ] Notification tableau de bord — message coach↔coach (correctif #6)
Branch `feat/messaging-athlete-coach`. Proven locally : diffusion Tremblay →
coachs crée +1 activité NEW_MESSAGE pour coachb (2 → 3, preview de la diffusion).

- `supabase/migrations/20260724140000_coach_message_activity.sql`
  — `CREATE OR REPLACE log_coach_activity_message` : ajoute une branche
  COACH_COACH qui insère une activité `NEW_MESSAGE` (table `activities`,
  coach-facing) pour le coach DESTINATAIRE (participant ≠ expéditeur), avec le
  nom de l'expéditeur en metadata. Vaut pour message direct ET diffusion (le RPC
  `send_broadcast` insère des messages normaux → AFTER INSERT s'applique).
  RECRUTEUR_COACH inchangé. Idempotent.
- **Effet** : un coach qui reçoit une diffusion « tous les entraîneurs » (ou un
  message direct d'un collègue) obtient l'entrée « Activités » + le badge sidebar,
  comme pour un message recruteur→coach (corrige #2b « pas reçu »). Les broadcasts
  vers ATHLÈTES notifient l'athlète via son inbox (déjà OK) ; `activities` est
  coach-facing donc pas d'entrée athlète (hors-scope).

### [ ] Broadcast « Une équipe » = athlètes + coachs (correctif systémique)
Branch `feat/messaging-athlete-coach`. Proven locally 4/4 (`scratchpad/proof-team.sql`):
un broadcast équipe atteint les athlètes (team_athletes) ET les coachs
(team_coaches), et un coach de l'équipe SANS athlète (coachb, assistant Titans)
reçoit + voit le fil.

- `supabase/migrations/20260724150000_broadcast_team_full_roster.sql`
  — `CREATE OR REPLACE send_broadcast` : le kind `team` a sa propre branche —
  TOUS les `team_athletes` (ACTIF) → ATHLETE_COACH (coach_id=expéditeur, sans la
  restriction « mes athlètes »), + TOUS les `team_coaches` sauf soi → COACH_COACH.
  all_athletes/athletes gardent la portée directeur=école / coach=SES athlètes
  (#2 inchangé). last_message_at bumpé partout. Idempotent.
- **Règle BP** : messager une équipe = tout le monde dessus.

Re-run après prod apply : `scratchpad/proof-team.sql` — expect 4/4.

### [ ] Staff-picker civil — fallback team_coaches ressuscité (correctif civil)
Branch `feat/messaging-athlete-coach`. Trouvé pendant la PASSE VÉRIF CIVIL :
`_messageable_staff_ids` branchait son fallback team_coaches sur
`athletes.league_team_id`, colonne JAMAIS peuplée (onboarding + saveAthlete
écrivent l'appartenance dans `team_athletes` et forcent `league_team_id = NULL`).
Fallback mort → un athlète ne pouvait PAS messager un coach qui dirige SON équipe
si ce coach n'était pas AUSSI un school_coach du club. 2 coachs « team-only »
réels existaient déjà en base (invisibles à leurs athlètes).

- `supabase/migrations/20260724160000_fix_messageable_staff_team_athletes.sql`
  — `CREATE OR REPLACE _messageable_staff_ids` : les équipes viennent de
  `team_athletes` (roster réel), l'école effective = `school_id` propre UNION
  l'école-club de l'équipe. Branche school_coaches (club/école) + branche
  team_coaches (coachs de l'équipe même hors roster club). Corrige aussi le gate
  RLS `athlete_messageable_coach` (il délègue à cette fonction). Idempotent.
- Anti-régression scolaire : un athlète scolaire (school_id + zéro team_athletes)
  résout au même school_coaches qu'avant. Vérifié (Olivier, Académie
  Antoine-Manseau → 4 staff inchangés).
- **Orphelin (school_id NULL, aucun team_athletes)** : résout à VIDE — pas
  corrigé ici, chantier orphelin PARKÉ. L'UI dégrade proprement
  (« Aucun entraîneur rattaché à ton école pour l'instant »), pas de crash.

Preuve navigateur (civil, local) : cast fixture `scratchpad/civil-fixture.sql` —
club LIGUE_CIVILE « Union Test Civil », directrice + 3 coachs (A/B roster,
C team-only), athlète civil (school_id=club) + orphelin (school_id NULL).
Charlie voit 4 staff dont Carla CoachC (team-only) ; l'orphelin voit l'empty state.

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

### [ ] P2 — parent↔coach RLS + picker RPCs + notify fan-out  ⚠️ PROMOTED TO TRAIN-1
**Was train-2; PROMOTED to the P1 pre-flight batch.** The P2 UI shipped on THIS
train (parent Messages portal surface + coach Parent tile / inbox segment / thread
view), so the DB half is now a FLIP DEPENDENCY of train-1 — the coach compose +
parent portal would 42501 in prod without these policies/RPCs. Apply in filename
order in the P1 pre-flight (after the coach-coach + guard migrations it builds on).

Decisions (BP): (1) BOTH parent & coach initiate. (2) Coach reach = ANY staff of the
child's school/club. (3) Parent diffusions DEFERRED — Parent tile is compose-only,
NOT a Groupe audience. (4) Freeze reopened for this feature only, then resealed.

Branch `feat/messaging-athlete-coach`. Proven locally (`scratchpad/prove-p2.sql` +
browser both-directions): parent→child's-staff-coach ALLOW; parent→non-staff DENY;
coach→child's-real-parent ALLOW; coach→arbitrary-user DENY; parent sends + reads own
thread; child-scoping (a parent cannot reach another child's staff); notify parent.

- `supabase/migrations/20260725120000_p2_parent_coach_rls.sql`
  — DEFINER helpers `coach_reaches_athlete` + `is_parent_link` (resolve the child's
  user_id / the parent link with `row_security off` — REQUIRED: an inline subquery in
  a policy WITH CHECK runs under the CALLER's RLS, a parent can't SELECT `athletes`, a
  coach can't SELECT `parent_athletes`, so the naive inline form silently denied
  legitimate inserts). Policies: `parent_initiate_parent_coach`,
  `coach_initiate_parent_coach` (GUARDED — closes the hole), `parent_conversations_
  select/update`, `parent_messages_select/insert/update`. Dedup index
  `uq_conversations_parent_coach`. Picker RPCs `list_messageable_staff_for_child`
  (parent→child's staff, gated by is_parent_of) + `list_athlete_parents`
  (coach→child's parents, gated by coach_reaches_athlete). `notify_on_message` gains
  `c.parent_id` in the push fan-out. Read side reuses `is_conversation_participant`
  (parent-aware). Idempotent.
- Depends on: PARENT_COACH enum + `parent_id` column + per-type CHECK (Phase A —
  already prod), `is_parent_of`, `_messageable_staff_ids`, `parent_athletes`.

Re-run after prod apply: `scratchpad/prove-p2.sql` (seeded cast —
`scratchpad/civil-fixture.sql` + `scratchpad/parent-seed.sql`).

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
