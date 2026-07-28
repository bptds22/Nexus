# Flip-day ledger — DB changes held LOCAL, pending prod

> ## ✅ PRE-FLIGHT DB : FAIT — 2026-07-26 (anticipé, décision BP)
>
> **Les 16 migrations tenues ont été appliquées à `nexus-prod`
> (`nrloizyemulbhujrqhgx`), dans l'ordre de nom de fichier, une par une,
> vérifiées entre chaque.** Le flip day n'a plus que **merge + release**.
>
> - **Pré-flight diff** : les 5 objets vivants réécrits par le batch
>   (`message_insert_to_pipeline`, `log_coach_activity_message`,
>   `_messageable_staff_ids`, `is_conversation_participant`, `notify_on_message`)
>   ont été diffés corps-à-corps contre leur base git → **zéro dérive
>   sémantique** (md5 des corps normalisés identiques ; prod diffère seulement
>   par le strip des commentaires, artefact de l'apply MCP de `20260722100000`).
> - **Règle enum/txn respectée** : `20260723120000_coach_coach_enum` appliquée
>   et committée SEULE avant `20260723120100`.
> - **Smoke test** (chemin vivant recruteur→coach, sous RLS, comptes démo
>   `@nexussports.ca`, transaction annulée) : fil créé → message livré →
>   `recruiter_pipeline` créé à **CONTACTE** → activité `NEW_MESSAGE` au coach.
> - **Inertie vérifiée** : conversations 1, messages 1, pipeline 4, activities 8
>   — identiques avant/après. Zéro résidu de test.
> - **Versions `schema_migrations` réalignées** sur les noms de fichiers du repo
>   (l'apply MCP attribue sinon un timestamp du jour → un futur `db push` les
>   rejouerait).
> - **Kit de revert** : `scratchpad/revert-kit/` (REVERT.sql + les corps
>   d'origine + les 2 policies d'origine).
> - ⚠️ **Reste à faire (hors batch)** : les 5 helpers DEFINER de
>   `20260725120000_p2_parent_coach_rls.sql` n'ont pas de
>   `REVOKE ALL … FROM public, anon` (toutes les autres migrations du batch en
>   ont un). `coach_reaches_athlete` et `is_parent_link` sont donc exécutables
>   par `anon` — sondes booléennes nécessitant 2 UUID connus. À corriger par une
>   migration de suivi.

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

### [x] P4 — COACH_COACH messaging (coach↔coach same-school, directors included)
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

### [x] Coach-initiated RECRUTEUR_COACH (favoris-symmetric)
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

### [x] Coach→recruiter OPENED — favoris precondition REVERSED (deliberate)
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

### [x] Guard — PARENT_COACH excluded from generic coach insert (SECURITY, this train)
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

### [x] Broadcast messaging (Groupe, option a — N individual threads)
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

### [x] P3 — recruteur↔athlète messaging (RLS + blackout + pipeline + notify)
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

### [x] Broadcast — ciblage propriétaire + remontée du fil (correctifs #2)
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

### [x] Transferts — assigner un athlète non réclamé (correctif #1)
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

### [x] Notification tableau de bord — message coach↔coach (correctif #6)
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

### [x] Broadcast « Une équipe » = athlètes + coachs (correctif systémique)
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

### [x] Staff-picker civil — fallback team_coaches ressuscité (correctif civil)
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

### [x] P2 — parent↔coach RLS + picker RPCs + notify fan-out  ⚠️ PROMOTED TO TRAIN-1
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

---

## [ ] RLS initplan + FK indexes (Pass 1) + DEFINER hot path (Pass 2) — athlete-screen statement-timeout fix

**Migrations:** `supabase/migrations/20260727130000_rls_initplan_and_fk_indexes.sql`
(64 policy rewrites + **9** FK indexes — 11 of the Mac's 20 were redundant, see
écarts below) and `supabase/migrations/20260727140000_rls_pass2_definer_hot_path.sql`
(2 policies de-subqueried into DEFINER helpers).
**Held LOCAL — proven on the Windows loop 2026-07-27; flip prod on BP GO.**

> **VERDICT D'AUTEUR : les deux passes partent ensemble. Pass 1 SEULE NE SUFFIT
> PAS.** Mesuré, pas déduit : pass 1 ne fait rien gagner au PLANNING (64,1 ms →
> 69,8 ms warm) alors que c'est le planning qui pèse ~80 % du temps total et qui
> déclenche le `statement_timeout` en prod. Pass 1 divise l'exécution par ~2, ce
> qui ne rattrape pas 302 ms de planning. Pass 2 fait tomber le planning à
> 12 ms (÷5,3). Un flip pass-1-seule serait le « flip à moitié efficace » à
> éviter.

### Verdict (execution-proven, not code-reading)
The athlete screen "won't load / multi-minute timeout → onboarding, logout" is a
server-side **HTTP 500 from `canceling statement due to statement timeout`** (prod
postgres log, bursts at 2026-07-27 09:54 **and** 10:27). NOT CORS, NOT the Supabase
client type (bundle ships the cookieless localStorage client, verified), NOT a broken
self-RLS (impersonation shows the athlete reads its own rows with data), NOT a stale
bundle. Every earlier client-side theory was refuted by raw logs / the shipped binary.

### Measured numbers (prod, athlete `b79de13d`, context=scolaire)
- **Heavy athlete profil query** (embeds `users!athletes_coach_id_fkey` + full
  `evaluations` + schools + team_athletes): **Planning 302 ms** / Execution 75 ms,
  **147 KB plan** — the embeds drag the RLS of users/evaluations/schools into the plan,
  which (post the 22 messaging migrations) references **school_coaches ×37, conversations
  ×14** and calls `current_user_school_id ×86 / is_coach ×43 / is_recruiter ×37 /
  is_approved_partner ×36`.
- **Light `select id`**: Planning ~21 ms / Exec ~4 ms — but it **also 500'd** during the
  bursts → the athlete dashboard fires a concurrent burst of heavy queries; under
  contention even trivial ones exceed `statement_timeout`.
- Civil athlete `fc73a8fe` and the recruiter session (09:33) were fast/200 — the failure
  concentrates on the school-athlete dashboard burst.

### What Pass 1 does / does NOT
- **Does:** wrap every direct `auth.uid()` in the hot-table policies in `(select auth.uid())`
  (initplan — evaluate once per query, not per row); + priority FK indexes to kill the
  school_coaches/conversations seq-scans. Strictly behaviour-preserving.
- **Does NOT:** consolidate `multiple_permissive_policies` (257 lints — **Pass 2**, biggest
  planning win, deferred); no app-side embed lightening (separate track).
- **Honest caveat:** the measured bottleneck is PLANNING (302 ms); initplan is mostly an
  EXECUTION fix. The FK indexes + eventual permissive consolidation are what most cut
  planning. The before/after EXPLAIN will quantify Pass 1's real gain — don't assume it
  alone clears 302 ms.

### Pass 2 — ce qui coûte VRAIMENT le planning (mesuré 2026-07-27)

Ce n'est **pas** la consolidation des 257 `multiple_permissive_policies`.
Fusionner N policies permissives en une seule policy OR-ée produit le même arbre
d'expression : ce lint est surtout un coût d'EXÉCUTION. Testé, le gain planning
serait marginal.

Le vrai moteur, ce sont les **sous-requêtes inline** dans les policies du chemin
chaud. Une sous-requête sur une autre table tire cette table **et tout son jeu de
policies** dans le plan, récursivement :

```
users."Users read conversation participants" -> conversations
  -> les 9 policies SELECT de conversations  -> athletes
    -> les 6 policies SELECT d'athletes      -> school_coaches -> ...
```

C'est ça, le plan de 147 Ko et les 528 subplans vus en prod. Une fonction
`SECURITY DEFINER` est **opaque au planificateur** : elle ne tire rien et casse
la récursion. C'est déjà la règle 4 de CLAUDE.md — ces deux policies la violaient.

**Preuve de mécanisme** (mêmes 3 requêtes, plan complet) :

| | subplans | occurrences `school_coaches` | scans `conversations` | taille du plan |
|---|---|---|---|---|
| pass 0 | 232 | 89 | 14 | 156 Ko |
| pass 1 | 232 | 44 | 14 | 144 Ko |
| **pass 2** | **62** | **1** | **0** | **41 Ko** |

Le plan local (156 Ko) colle au plan prod (147 Ko) : la STRUCTURE du plan est
dictée par le schéma, pas par le volume de données. C'est ce qui permet
d'attendre en prod un gain du même ordre qu'en local.

### Chiffres mesurés (local, requête lourde du dashboard athlète, médiane à chaud)

| | planning | exécution | total |
|---|---|---|---|
| pass 0 (pristine) | 64,1 ms | 23,6 ms | 87,7 ms |
| après pass 1 | 69,8 ms | 12,8 ms | 82,6 ms |
| **après pass 2** | **12,1 ms** | **9,0 ms** | **21,1 ms** |

- requête légère `select id` : 0,338 → 0,335 → **0,182 ms**
- `users.onboarding_complete` (le gate de `app/athlete/layout.tsx`, tiré à chaque
  chargement de page athlète) : 3,714 → 3,545 → **0,467 ms** (÷8)
- À froid (1re requête d'une session, le cas réel d'un cold start) :
  125,4 ms → 92,5 ms → **26,7 ms** total.

**Transposition prod (extrapolation, pas une mesure) :** prod était à 302 ms
planning + 75 ms exec = 377 ms. Au ratio local (÷5,3 planning, ÷2,6 exec) →
~57 + ~29 = **~86 ms**, sous le `statement_timeout` avec de la marge même en
rafale. À confirmer par un EXPLAIN prod après l'apply.

### Écarts vs la passe 1 du Mac (corrigés + documentés)

1. **11 index sur 20 étaient redondants** — retirés. `CREATE INDEX IF NOT EXISTS`
   ne teste que le NOM : les 11 portaient un nom neuf (`idx_athletes_coach_id`)
   alors qu'un index de même colonne existait sous un nom plus court
   (`idx_athletes_coach`) ou en préfixe d'un composite. Ils auraient donc bel et
   bien été créés en double. Coût : écriture amplifiée sur des tables chaudes,
   bloat, autovacuum — et un chemin de plus à considérer au planificateur, ce qui
   joue CONTRE une passe qui vise le temps de planning. Audit rejouable :
   `supabase/tests/rls-initplan-index-redundancy-audit.sql` (local : 9 CREATE /
   11 REDUNDANT). ⚠️ **à rejouer sur prod avant l'apply** — le jeu d'index de
   prod n'est pas garanti identique.
2. **`evaluations."evaluations coach"` réécrite hors substitution mécanique** —
   la passe 1 la passait de `TO public` à `TO authenticated` et lui ajoutait un
   `WITH CHECK` explicite. Le `WITH CHECK` est inerte (sur une policy `FOR ALL`,
   un WITH CHECK omis retombe sur le USING) ; le changement de rôle est un
   rétrécissement, inerte lui aussi (anon voit 0 évaluation avant comme après —
   vérifié ; seuls anon et authenticated sont soumis à la RLS, service_role et
   postgres ont BYPASSRLS). **Restaurée à l'identique** : la valeur de la passe 1
   tient entièrement à sa garantie « rien d'autre que la cadence d'évaluation ne
   change ». Le resserrement `TO authenticated` reste souhaitable → migration de
   portée séparée.
3. **Couverture : 64/64 policies, 0 en trop.** Les 64 réécrites = exactement
   100 % des policies à `auth.uid()` nu des 10 tables chaudes ; aucune policy
   sans `auth.uid()` nu n'a été touchée. Restent **91** policies à `auth.uid()`
   nu sur 39 autres tables (hors chemin chaud) — passe 3 éventuelle, sans
   urgence.
4. **Non converti délibérément : `users."Coaches lookup orphan athletes"`.** Son
   `EXISTS(athletes …)` s'évalue sous la RLS de l'APPELANT ; un athlète orphelin
   a `school_id NULL` donc la branche « mon école » ne peut pas matcher — la
   policy ne se déclenche aujourd'hui que pour les orphelins que le coach possède
   DÉJÀ, autrement dit elle est quasi morte. La passer en DEFINER laisserait
   N'IMPORTE quel coach lire la ligne `users` de N'IMPORTE quel orphelin :
   **élargissement d'accès**, pas un changement de perf. Ça aurait fait gagner
   12 ms → 6 ms de planning ; ça ne vaut pas de faire passer un changement de
   comportement en douce dans une passe de perf. **Décision produit/sécurité à
   prendre séparément — le NOM de la policy dit qu'elle est censée marcher, elle
   ne marche pas.**

### Écarts sur les scripts de preuve (corrigés)

- **Découverte des utilisateurs non déterministe** : le directeur et le parent
  étaient tirés par `limit 1` SANS `order by`. Or cette migration crée
  `idx_school_coaches_coach_id` → le planificateur peut changer de scan → un
  AUTRE directeur tiré après qu'avant → un faux diff et un STOP injustifié.
  Tri total (tiebreak uuid) partout.
- **La matrice ne couvrait que la LECTURE.** Les passes réécrivent aussi des
  `WITH CHECK` INSERT/UPDATE, invisibles à un comptage de lignes. Ajout de
  **16 sondes d'écriture** allow/deny.
- **Sondes d'écriture à verdict binaire = piège** : un UPDATE dont le USING
  masque toutes les lignes, ou un `INSERT … SELECT` sur une source vide,
  RÉUSSIT sans rien écrire — un booléen le rapporte « autorisé ». Verdict passé
  à trois états (`ALLOW(n)` / `DENY` / `ERR-sqlstate`) et sources en `VALUES`
  à une ligne. Le coach représentatif est désormais celui qui POSSÈDE le plus
  d'athlètes (l'ancien tirage tombait sur un coach à 0 athlète → toutes les
  sondes coach vides).
- **Planning mesuré en un seul coup = bruit.** Le planning est dominé par la
  chaleur du relcache. Chaque requête tourne maintenant **5 fois**, on rapporte
  le froid (run 1) et la médiane à chaud (runs 2-5), et on ne compare jamais un
  froid à un chaud.
- **Preuve d'équivalence ajoutée, plus forte que la matrice** :
  `supabase/tests/rls-initplan-policy-snapshot.sql` diffe le TEXTE normalisé des
  272 policies (`( SELECT auth.uid() AS uid)` renormalisé en `auth.uid()`). Une
  substitution purement mécanique donne un diff VIDE ; tout autre changement
  (rôle, commande, WITH CHECK perdu) saute aux yeux. C'est cette preuve qui a
  attrapé l'écart n°2 ci-dessus — la matrice, elle, ne l'avait pas vu.

### Preuves obtenues (local, 2026-07-27)

- **Équivalence pass 1 : 2 diffs / 2 VIDES.** Corps de policies normalisés :
  0 différence sur 272 policies. Matrice par rôle (6 rôles × 17 tables + 16
  sondes d'écriture) : 0 différence.
- **Équivalence pass 2 : 3 diffs / 3 conformes.** Matrice : 0 différence, contre
  pass 1 ET contre la base pristine. Corps de policies : exactement les 2
  policies annoncées ont changé, rôle/commande/permissivité préservés. Preuve
  ciblée `supabase/tests/rls-pass2-targeted-equivalence.sql` (forme inline vs
  forme DEFINER) : **identique** — coach↔recruteur se voient (1/1), coach staff
  voit les 6 athlètes de son école, coach non rattaché en voit 0.
- **Kit de revert validé de bout en bout** : appliqué pour de vrai, il restaure
  la base pristine à 0 différence (policies ET matrice), puis les deux passes ont
  été ré-appliquées. `scratchpad/revert-kit/REVERT-rls-passes-1-2.sql`
  (105 policies des 10 tables + 9 DROP INDEX + 2 DROP FUNCTION) + les deux
  baselines pristine.
- ⚠️ **Non rejoué** : les suites `scratchpad/validation-*.sql` (15/15, 8/8, 11/11…)
  n'existent pas sur cette machine (gitignorées / restées côté Mac). Pour la
  passe 1 le diff de corps normalisé est une garantie PLUS forte qu'un rejeu
  (il prouve que les prédicats sont littéralement identiques). Pour la passe 2,
  couverture = matrice + sondes d'écriture + preuve ciblée. **À rejouer après
  l'apply prod si les scripts sont récupérés.**

### Apply prod (sur GO explicite de BP, par migration — rule 9)
1. Rejouer `rls-initplan-index-redundancy-audit.sql` **sur prod** et n'appliquer
   que les index réellement manquants.
2. Générer le kit de revert **depuis prod** (`rls-initplan-generate-revert-kit.sql`,
   `psql -At`) — ce sont les corps de PROD qu'il faut pouvoir restaurer.
3. Capturer matrice + snapshot + EXPLAIN **avant** sur prod.
4. `20260727130000` puis `20260727140000`, une par une, vérifiées entre chaque.
   **Index en `CREATE INDEX CONCURRENTLY`, hors transaction, une commande à la
   fois** (la migration les pose en transactionnel : sortir les 9 `CREATE INDEX`
   et les jouer séparément en CONCURRENTLY).
5. Re-capturer après → les 3 diffs doivent tomber comme en local.
6. BP re-teste l'iPhone **SANS rebuild** — le code applicatif est innocent ; si
   la DB répond vite, l'écran existant se charge.

### Passe 2b — mesures PROD du 2026-07-27 (transaction annulée, prod inchangée)

Diagnostic établi sur la session iPhone réelle de BP (100 requêtes / 72,6 s,
11 × HTTP 500). `authenticated` porte `statement_timeout = 8s` en prod : chaque
500 est une requête qui a dépassé 8 s. La ligne de partage est nette —
**`athletes` AVEC embeds PostgREST → 500 ; sans embed → 200**. La même URL
apparaît en 500 ET en 200 : dépassement intermittent, pas erreur déterministe.

**Ce que la cause n'est PAS** (réfuté par le catalogue, pas par raisonnement) :
`team_invitations` 500 sur un `select id` alors que la table a **0 ligne vive**
(`ins=2 upd=1 del=3 live=0`), que `idx_team_invitations_athlete (athlete_id)`
**existe déjà**, qu'aucun `AccessExclusiveLock` n'est posé, qu'aucune session
n'attend dans `pg_stat_activity`, et que son seul trigger est un
`AFTER UPDATE OF status WHEN status='ACCEPTED'` (inerte en lecture). Volume,
index et verrous sont donc exclus par construction. Un compteur dénormalisé sur
`athletes` n'aiderait pas non plus : la lecture paierait les 16 policies
d'`athletes` au lieu de celles de `team_invitations` — même taxe, plus un
trigger à maintenir.

**La cause : l'expansion des policies RLS au PLANNING.** 38 policies sur
14 tables portent une sous-requête inline (`athlete_id IN (SELECT … FROM
athletes …)` ou `EXISTS(athletes …)`) qui déplie tout le jeu de policies de la
table visée dans le plan, récursivement. 22 déplient `athletes` (16 policies),
8 déplient `conversations` (25), 3 `school_coaches`.

**RÈGLE DÉCOUVERTE — la conversion doit être TOTALE par table.** Les policies
permissives sont OR-ées : le planificateur les planifie TOUTES, quelle que soit
celle qui matche. Convertir une seule policy ne donne qu'un gain partiel.
Mesuré sur prod, `team_invitations` :

| | planning |
|---|---|
| avant | 79,5 – 224,5 ms |
| 1 policy convertie sur 5 | 75,4 – 75,8 ms (variance tuée, plancher intact) |
| **les 5 converties** | **0,03 – 0,11 ms** |

Autres mesures prod (JWT athlète réel `b79de13d`) : profil lourd 6 embeds =
247 ms planning / 86 ms exec à froid ; `athlete_notifications` 5,4 → 0,1 ms ;
`team_athletes` reste à ~100 ms tant que ses 4 policies ne sont pas toutes
converties.

**Portée du correctif** : toutes les policies porteuses de sous-requête des
tables du premier paint athlète — `athlete_notifications`, `athlete_suggestions`,
`team_invitations`, `athlete_targets`, `recruiter_athlete_views`,
`recruiter_favorites`, `team_athletes`, `conversations`, `evaluations` — **table
par table, intégralement**. Helpers : `is_own_athlete(uuid)` couvre les deux
formes athlète ; `coach_reaches_team(uuid)` la forme coach.

### [ ] FIX APP OBLIGATOIRE avant soumission App Store (pas aujourd'hui)

Mesuré sur la session iPhone : **9 URL distinctes tirées DEUX FOIS à 0–4 ms
d'intervalle** (le profil lourd en double, la requête d'en-tête en double,
`users.onboarding_complete` en double), rafales de 10–13 requêtes parallèles, et
**~20 appels `/auth/v1/user`** sur 72 s.

⚠️ **Nuance factuelle** : ce n'est PAS un retry-storm sans backoff — aucun
réessai après échec n'apparaît dans les logs. C'est du **double-fetch
concurrent** (double montage React / deux hooks sans déduplication) plus une
revalidation de session répétée. Le correctif n'est donc pas « ajouter un
backoff » mais **dédupliquer/mettre en cache les fetchs et mutualiser la session**.
Effet : divise la rafale par deux. À faire au prochain build — une app qui
double chaque requête sur un backend en difficulté est une bombe de rentrée.

### Règle — la preuve d'un correctif inclut son hash sur origin

**Adoptée. Et elle vient de servir dans les deux sens.**

Le 2026-07-27, la consigne « le fix cookieless n'a jamais été commité, implémente-le
maintenant » a été vérifiée avant d'être exécutée. Résultat : **le correctif existe
à chaque maillon depuis longtemps.**

- **Code** : `lib/supabase/client.ts` porte le gate `IS_CAPACITOR`
  (`NEXT_PUBLIC_CAPACITOR_BUILD === "true"`) → `createClient` de
  `@supabase/supabase-js` avec `storage: window.localStorage`, sans cookie ;
  la branche WEB garde `createBrowserClient` de `@supabase/ssr`. C'est
  mot pour mot ce qui était demandé.
- **Commit** : `f27bfa3`.
- **Origin** : présent sur `origin/main`, `origin/dev` et toutes les branches,
  y compris `origin/feat/messaging-athlete-coach` au moment de la vérification.

Donc pas de fix fantôme sur ce point — et le ledger le disait déjà (« NOT the
Supabase client type (bundle ships the cookieless localStorage client,
verified) »). Aucun build/sync n'a été lancé : réimplémenter l'existant aurait
coûté un rebuild pour un no-op.

**Ce qui est réellement fantôme, c'est le correctif RLS.** Vérifié sur prod le
même jour : **0 helper, 0 index de la passe 1, 64 policies à `auth.uid()` nu,
47 policies à sous-requête inline** — rien n'a jamais été appliqué. Toutes les
mesures « 0,03 ms / 1-6 ms » citées venaient de transactions `rollback`, ce que
le log Postgres de prod montre littéralement (chaque `statement:` finit par
`rollback;`). Et les `canceling statement due to statement timeout` continuaient
~5,5 min APRÈS la dernière transaction de mesure.

**Corollaire de la règle** : un chiffre de perf n'est une preuve que si l'état
qui l'a produit a été COMMIS. Une mesure dans une transaction annulée prouve le
mécanisme, jamais le déploiement. Les deux doivent être rapportés séparément.

**Sur `TypeError: Load failed`** : dans WKWebView, `fetch` lève ça sur échec
réseau — y compris quand une requête est coupée après une longue attente. C'est
donc un SYMPTÔME des requêtes qui dépassent le `statement_timeout = 8s` côté
serveur, pas un signe de problème de cookies ou de type de client. Les logs API
le confirment : 100 requêtes de la WebView iPhone sont bien ARRIVÉES à prod
(88 × 200, 11 × 500). Un client incapable d'émettre ne produirait pas ça.

### Audit du 2026-07-27 — trois verdicts, et une décision produit à prendre

**Verdict 1 — policy SELECT `athlete_suggestions` pour l'athlète : SANS OBJET.**
`Athletes can read own suggestions` existe déjà (SELECT/PERMISSIVE/public,
`athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())`). Testée
sous le JWT réel de b79de13d : **20 lignes visibles** (APPROUVEE + EN_ATTENTE),
dont 9 EN_ATTENTE sur son `athlete_id`. Les logs iPhone la montrent en **200**
six fois. Rien à ajouter — une seconde policy SELECT serait un doublon
permissif, et les doublons permissifs AGGRAVENT le planning (toutes les
policies sont planifiées, cf. la règle de conversion totale).

**Verdict 2 — `PGRST201` (embed ambigu) : AUCUNE PREUVE.** Rien dans les logs
API ni Postgres. Les embeds du chemin athlète sont déjà désambiguïsés à la main
(`users!athletes_coach_id_fkey`, `sports!sport_id`, `positions!position_id`,
`schools!school_id`, `teams!team_id`). À rouvrir seulement avec un message
d'erreur brut à l'appui.

**Verdict 3 — la photo : le mécanisme n'est PAS ce qu'on croyait.**
- **Le bucket `avatars` est `public = true` AUJOURD'HUI**, et l'a toujours été.
- **Zéro `createSignedUrl` dans tout le dépôt.** Web, mobile, athlète, coach,
  admin : tout passe par `getPublicUrl`, et l'URL publique est PERSISTÉE dans
  `athletes.photo_url` (`lib/storage/uploadAvatar.ts`, `lib/upload/uploadImage.ts`,
  `app/athlete/profil/page.tsx`, `app/athlete/onboarding/page.tsx`,
  `app/coach/athletes/**`, `app/admin/athletes/**`, les 3 composants mobiles).
- Le web n'est donc PAS cassé et n'utilise PAS de signed URLs : **web et mobile
  partagent le même mécanisme**, qui suppose le bucket public.
- Passer le bucket en privé casserait l'affichage **partout, instantanément** :
  chaque `photo_url` déjà stockée est une URL `/object/public/…` qui
  retournerait une erreur. Ce n'est pas un changement de policy, c'est une
  migration de données + un chantier app (upload, lecture, ré-écriture des
  `photo_url` existantes).

**Le bug d'affichage de la photo n'est pas un bug de storage.** Preuve :
`curl` anonyme sur la photo de b79de13d → `200`, 109 680 octets, JPEG 1638×2048,
59 ms. La photo n'apparaît jamais parce que le **seul écran qui la rend** est
`app/athlete/profil`, tué par la requête ligne 1228 (`select *` + 6 embeds).
Le dashboard récupère bien `photo_url` mais ne s'en sert que pour cocher une
checklist de complétion (ligne 255) — il ne l'affiche pas.

⚠️ **DÉCISION PRODUIT À PRENDRE (séparée du bug, plus importante que lui).**
L'intention exprimée est « le bucket avatars reste PRIVÉ — des photos de
mineurs ». **L'état réel est l'inverse : il est public depuis le début.** Les
photos d'athlètes mineurs sont lisibles par quiconque connaît l'URL, sans
authentification — vérifié en anonyme. Sujet Loi 25, indépendant de la panne
d'affichage. Le passage en privé (signed URLs) est un chantier app à planifier,
pas un correctif DB. Même constat pour le bucket **`legal-documents`, également
`public = true`**.

### Répartition DB-now / build-next — mise à jour

**DB maintenant (toujours pas appliqué) :** la conversion RLS — passe 1
(`20260727130000`) + passe 2 étendue à toutes les policies porteuses de
sous-requête des ~9 tables du premier paint. C'est le seul correctif qui
débloque `app/athlete/profil`. Bloqué sur deux décisions : rétablir le bloc
`evaluations coach` du Mac, et le GO pour la conversion totale.

**Build suivant (app) :** (a) déduplication des fetchs — 9 URL tirées 2× à
0–4 ms, dont la requête profil en double ; (b) alléger `profil/page.tsx:1228`
(`select *` + 6 embeds sur la première peinture — la leçon déjà écrite dans ce
ledger) ; (c) si la décision produit va vers un bucket privé : signed URLs +
migration des `photo_url`.

### [x] Conversion DEFINER — LOT 1 APPLIQUÉ EN PROD (2026-07-27, migration `rls_definer_conversion_lot1`)

**Enregistré au catalogue** via `apply_migration` → présent dans
`supabase_migrations.schema_migrations`. Plus de fantôme.

**Portée** : 15 policies / **9 tables intégralement converties** — motifs purs
uniquement (`athlete_id IN (SELECT id FROM athletes WHERE user_id|coach_id =
auth.uid())`), aucune clause additionnelle à préserver. Helpers créés :
`is_own_athlete(uuid)` et `is_coach_of_athlete(uuid)` (SECURITY DEFINER, STABLE,
`search_path` épinglé, REVOKE public + GRANT anon/authenticated — les policies
sont `TO public`, anon doit pouvoir évaluer sans erreur).

Tables converties à 100 % : `athlete_notifications`, `athlete_suggestions`,
`recruiter_athlete_views`, `recruiter_favorites`, `recruiter_pipeline`,
`recruiter_activity_log`, `partner_card_downloads`, `partner_profile_views`,
`_deprecated_profile_views_2026_05`.

**Preuves** :
- Équivalence per-role (athlète b79de13d / coach le plus doté / recruteur le
  plus doté × 14 tables) : **IDENTIQUE, 0 divergence**. Baseline et after
  stockés en base (`public._rls_equiv_20260727`).
- Catalogue relu : **0** sous-requête `FROM athletes` sur les 9 tables.
  `qual` bruts témoins : `is_own_athlete(athlete_id)` /
  `is_coach_of_athlete(athlete_id)`.
- Backup des 47 corps d'origine : **`public._rls_backup_20260727`** (en base,
  survit à la session).

**Perf mesurée (JWT réel b79de13d)** :

| requête | avant | après lot 1 |
|---|---|---|
| `athlete_notifications` | 0,9–5,4 ms | **0,04–0,34 ms** |
| `athlete_suggestions` | 1,5–4,7 ms | **0,03–0,13 ms** |
| `recruiter_favorites` | — | **0,08–0,26 ms** |
| **profil ligne 1228** | ~141 ms | **120–130 ms** |

**Lecture honnête** : le lot 1 supprime la taxe des satellites de la rafale
(÷20 à ÷40 sur chacune). Il ne corrige PAS la requête ligne 1228 — normal,
aucune de SES tables n'est dans ce lot.

### [ ] LOT 2 — ce qui débloque réellement `app/athlete/profil`

**32 policies à sous-requête restent**, sur les tables que la ligne 1228 traverse :
`athletes` (3), `users` (1), `conversations` (7), `messages` (7),
`team_athletes` (5), `team_invitations` (5), `evaluations` (1),
`school_coaches` (1), `athlete_targets` (1), + variantes.

Ce sont les 22 policies « sur mesure » (motif `P9_AUTRE`) : chacune porte des
clauses propres (type de conversation, rôle, statut) qu'il faut préserver une
par une — pas de substitution mécanique possible. Helpers pressentis :
`coach_reaches_team(uuid)`, `coach_staffs_school(uuid)`,
`user_shares_conversation(uuid)`, plus la réutilisation de
`is_conversation_participant` existant.

⚠️ **Règle de totalité** : convertir partiellement une table ne donne RIEN
(mesuré : `team_invitations` 1 policy sur 5 → 224 → 75 ms ; 5 sur 5 → 0,03 ms).
Le lot 2 doit être fait table par table, intégralement.

### plan_cache_mode — hypothèse testée, RÉFUTÉE et inversée (2026-07-27)

Hypothèse : PostgREST utilise des prepared statements ; après 5 exécutions
Postgres passe au plan générique ; un plan générique catastrophique
expliquerait l'écart entre mes EXPLAIN directs et le vécu de l'app. Correctif
proposé : `ALTER ROLE authenticator SET plan_cache_mode = force_custom_plan`.

**Mesuré AVANT d'appliquer** (PREPARE + 8 EXECUTE sous le JWT réel de
b79de13d, ce qui franchit le seuil des 5) :

| mode | it1 | it5 | it6 | it7 | it8 | moy. post-seuil |
|---|---|---|---|---|---|---|
| `auto` (actuel) | 12,4 | 3,2 | 3,2 | 0,6 | 0,5 | **1,4 ms** |
| `force_custom_plan` | 3,7 | 3,2 | 3,2 | 3,2 | 3,3 | **3,2 ms** |
| `force_generic_plan` | 3,9 | 0,5 | 0,5 | 0,6 | 0,5 | **0,5 ms** |

**Le plan générique est le PLUS RAPIDE, pas le plus lent.** `auto` bascule
correctement vers lui vers l'itération 7 et accélère (3,2 → 0,5 ms) : le cache
de plans fait déjà son travail. `force_custom_plan` est le pire des trois
(~6× plus lent que le comportement spontané) et aurait été une régression
durable pour tous les rôles. **NON APPLIQUÉ.**

Réglage de départ, pour mémoire : `authenticator` ne porte AUCUN
`plan_cache_mode` (`session_preload_libraries=supautils, safeupdate |
statement_timeout=8s | lock_timeout=8s`) ; l'effectif est `auto`. Un revert
éventuel serait donc un `RESET`, pas une valeur.

**Règle de mesure conservée (elle, elle est bonne)** : un `EXPLAIN` direct
reçoit toujours un plan custom et ne dit donc rien du plan générique que
recevra l'app via des prepared statements. Pour mesurer le chemin réel, il faut
soit passer par PostgREST, soit reproduire `PREPARE` + ≥6 `EXECUTE` — ce que
fait le test ci-dessus. La règle tient même si la conclusion s'est inversée :
c'est elle qui a permis de voir que le correctif proposé était une régression.

### Consolidation de la semaine — état au 2026-07-27 fin de journée

#### A. Ce que CETTE session a réellement touché

**APPLIQUÉ À PROD, commis au catalogue (`schema_migrations`)** :

| objet | version | contenu |
|---|---|---|
| `rls_backup_before_definer_conversion` | 20260727183338 | table `public._rls_backup_20260727` — les **47** corps de policies d'origine |
| `rls_equivalence_baseline_capture` | 20260727183400 | table `public._rls_equiv_20260727` (matrice avant/après) |
| `rls_definer_conversion_lot1` | 20260727183554 | **15 policies / 9 tables** + helpers `is_own_athlete()`, `is_coach_of_athlete()` |

**APPLIQUÉ À PROD, PAS commis au catalogue** (dette à régulariser) :
- fonction `public._snap(text,text,uuid)` — sonde de matrice d'équivalence, créée
  via `execute_sql` et non via une migration. Sans danger (lecture seule, appelée
  à la main) mais **orpheline** : absente de `schema_migrations` et du repo.
- `ALTER TABLE public._rls_equiv_20260727 DISABLE ROW LEVEL SECURITY` + grants
  `authenticated` — fait via `execute_sql`. La table ne contient que des
  comptages, mais elle est lisible par tout authentifié.
- `DROP FUNCTION public._rls_equiv_snap(text)` — première version SECURITY DEFINER
  (buggée : elle contournait la RLS et comptait les tables entières).

**JAMAIS APPLIQUÉ NULLE PART** : le **lot 2** — les **32** policies à sous-requête
inline restantes (dont les 22 « sur mesure »). C'est ce qui débloquerait
`app/athlete/profil`.

**APPLIQUÉ EN LOCAL SEULEMENT** (Docker `supabase_db_Nexus`) :
`20260727130000_rls_initplan_and_fk_indexes.sql` (version corrigée, 9 index) et
`20260727140000_rls_pass2_definer_hot_path.sql`. Prouvés localement, jamais
poussés en prod.

⚠️ **PIÈGE `db push`** : ces deux fichiers sont commis dans le repo mais prod a
reçu l'initplan par **SQL direct, non enregistré**. Un futur `db push` les
rejouerait — et `20260727130000` **régresserait** `evaluations."evaluations coach"`
de `TO authenticated` vers `TO public`. À régulariser avant tout push :
enregistrer la version côté prod, ou corriger le fichier.

#### B. État partiel assumé (pas un lot avorté)

La conversion DEFINER est **partielle mais cohérente** : 15 policies converties
sur 47, et surtout **9 tables converties à 100 %**. La règle de totalité par
table est respectée — aucune table n'est à moitié convertie. Les 32 restantes
sont sur des tables **intactes**, dans leur forme d'origine. Il n'y a donc pas
d'état bâtard : soit une table est entièrement convertie, soit elle n'est pas
touchée.

#### C. Verdicts de la semaine

- **`plan_cache_mode` : réfuté et inversé.** `force_custom_plan` (proposé) =
  3,2 ms constant ; `auto` (actuel) = 1,4 ms ; `force_generic_plan` = 0,5 ms.
  Le plan générique est le PLUS rapide et `auto` y bascule déjà tout seul.
  **NON APPLIQUÉ** — il aurait été une régression ~6× pour tous les rôles.
- **Le « retrait du trigger compteur de vues » n'a jamais eu lieu** :
  `trg_log_view` est toujours en place sur `recruiter_athlete_views`, et aucune
  colonne `profile_views_count` n'existe.
- **Le fix cookieless existait déjà** (`f27bfa3`, sur origin) — trois jours de
  chasse sur un correctif présent depuis le début.
- **Buckets** : `avatars` et `legal-documents` sont `public = true`. Les 5
  athlètes ayant une photo sont **tous mineurs**. Décision produit prise (fermer),
  chantier séquencé, timing non arrêté.

#### D. Règles gagnées cette semaine

1. **La preuve d'un correctif inclut son hash sur origin.** Corollaire : une
   mesure prise dans une transaction annulée prouve le MÉCANISME, jamais le
   DÉPLOIEMENT. Les deux se rapportent séparément.
2. **Mesurer via le chemin de l'app, pas en SQL direct.** Un `EXPLAIN` direct
   reçoit toujours un plan *custom* et ment par omission sur le plan *générique*
   que reçoit l'app via ses prepared statements. Reproduire `PREPARE` + ≥6
   `EXECUTE`, ou passer par PostgREST.
3. **Conversion RLS : totale par table, ou rien.** Les policies permissives sont
   OR-ées donc toutes planifiées. Mesuré : `team_invitations` 1 sur 5 → 224→75 ms
   (rien) ; 5 sur 5 → 0,03 ms.
4. **Custody jusqu'au device.** Un correctif n'est acquis que lorsqu'il est
   vérifié sur l'appareil réel. Catalogue vert + EXPLAIN vert ≠ écran qui
   s'affiche : cette semaine, chaque maillon a été prouvé isolément pendant que
   l'écran restait mort.
5. **Vérifier la prémisse avant d'exécuter.** Cinq consignes de la semaine
   reposaient sur un état supposé faux (fix jamais commité, bucket privé, trigger
   retiré, policy manquante, verrou write-hot). Les cinq ont été réfutées par le
   catalogue avant toute action.

#### E. Chantier actif — bissection binaire (Mac)

Base 1.1.1 buildée localement contre la DB actuelle, par groupes de features,
test device à chaque étape. **Silence prod maintenu de mon côté** pour ne pas
polluer les mesures.

Facteur confondant écarté : aucun changement DB modifié/restrictif ne touche le
chemin de LECTURE athlète. Les deux seules contraintes posées après 1.1.1
(`team_athletes_one_per_sport`, `teams_season_guard`) concernent des ÉCRITURES
d'équipe. Voir l'inventaire des 44 migrations depuis le 20 juillet.

⚠️ La base de code a bougé pendant la bissection (`3f1f9f5` coalesce 17×→1×,
`4f0e1d6` no-eject-on-failed-read, `d2cdbfe`). Bissecter sur une cible mouvante
donne un résultat non reproductible — figer avant de conclure.

### Incident 2026-07-27 fin de journée — saturation, auto-résorption, et dimensionnement

**Les trois clients morts ensemble (web + App Store + local) = UNE file d'attente
commune, pas trois pannes.** Relevé au pic : 7 connexions `authenticator` actives
sur 11, dont **5 bloquées 160–178 s** — 4 sur `team_invitations`, 1 sur
`athletes`. **Aucun verrou bloquant** (`pg_locks` non accordés : vide). Trois
minutes plus tard, sans intervention : **11 idle, 0 active, aucune requête >20 s**.

**`plan_cache_mode` n'a jamais été appliqué** — vérifié : aucun rôle ne le porte,
effectif `auto`. Le « revert d'urgence » demandé aurait été un no-op. NON exécuté,
pour ne pas fabriquer un faux coupable puis l'innocenter à tort.

`team_invitations` est le point chaud : c'est la table à 5 policies à sous-requête
**délibérément exclue du lot 1** (ses 3 policies coach sont « sur mesure »). Elle
paie toujours 80–300 ms de planning par requête.

#### Dimensionnement — ce que dit le catalogue

| | valeur |
|---|---|
| `shared_buffers` | 224 Mo |
| `effective_cache_size` | 384 Mo |
| `work_mem` | 2,1 Mo |
| `max_connections` | 60 |
| `max_parallel_workers` / par gather | 2 / 1 |
| **taille de la base** | **54 Mo** |
| **cache hit ratio** | **100,00 %** |

Ces valeurs correspondent à ~1 Go de RAM — soit **Micro**, pas nano (nano
donnerait `shared_buffers` ~128 Mo). À confirmer côté dashboard.

**La base entière (54 Mo) tient des dizaines de fois en RAM, et le cache hit est
à 100 %. Il n'y a AUCUNE pression I/O ni mémoire.** Le goulot est le **CPU de
planification**, exclusivement.

**Hypothèse forte — épuisement des crédits CPU burstables.** Les instances
`t4g.micro/nano` sont burstables : au-delà du baseline (~10–20 % d'un vCPU),
elles consomment des crédits. Générer un plan de 500 Ko à chaque requête, ×10 en
parallèle, brûle ces crédits. Une fois à zéro → throttling brutal → **tous les
clients meurent en même temps** → les crédits se rechargent → **ça repart tout
seul**. C'est exactement la courbe observée aujourd'hui : effondrement simultané
puis auto-résorption en ~3 min sans intervention. **La signature est celle des
crédits, pas d'un bug.**

#### Recommandation de tier

Passer à **Small (~15 $/mois)** : double la RAM et le taux de recharge des
crédits, marge immédiate pour la rentrée. ⚠️ **Small reste burstable** — c'est un
amortisseur, pas une immunité.

**Ce n'est PAS « le fix que la semaine cherchait ».** Un plan de 500 Ko par
requête est un coût de conception qu'aucun tier ne rend gratuit : monter en gamme
achète du temps, le lot 2 supprime la demande — définitivement, et à 0 $/mois.
Faire les deux : Small pour le tampon, lot 2 pour la cause.

#### Sentry — « Lock stolen » sur /athlete/profil (rapporté par BP, non vérifié par moi)

Signalé dans la capture de BP ; je n'ai pas eu accès à Sentry et ne l'ai pas
confirmé. Signature connue de `supabase-js` : le rafraîchissement de token
s'appuie sur `navigator.locks`, et plusieurs onglets/clients concurrents se
volent le verrou. Cohérent avec le double-montage mesuré (9 URL tirées 2× à
0–4 ms, corrigé depuis par `3f1f9f5` coalesce 17×→1×). **À regarder post-crise**,
priorité basse : bruyant, rarement bloquant.

#### Nettoyage des artefacts de la semaine

Supprimés de prod : `public._rls_equiv_20260727`, `public._snap(text,text,uuid)`,
`public._rls_equiv_snap(text)`. Vérifié : plus aucun reliquat `%snap%`/`%probe%`.

**CONSERVÉ volontairement** : `public._rls_backup_20260727` — les 47 corps de
policies d'origine. C'est le kit de revert du lot 1 et du futur lot 2. **Ne pas
supprimer avant validation complète de la conversion.**

`_deprecated_athlete_views_2026_05` et `_deprecated_profile_views_2026_05`
préexistaient à cette semaine — hors périmètre, non touchés.

### Upgrade compute — NON EXÉCUTÉ (2026-07-27) : hors de portée outillage + prémisse à vérifier

Consigne reçue : « upgrade nano → Micro ». **Non exécuté**, pour deux raisons
factuelles.

1. **Aucun outil ne l'expose.** Le serveur MCP Supabase disponible ne couvre pas
   le dimensionnement compute (les outils voisins sont `restore_project` —
   destiné aux projets EN PAUSE, à ne pas confondre —, `create_branch`,
   `create_project`, `deploy_edge_function`, `get_advisors`). `get_project` ne
   renvoie pas non plus la taille d'instance. **L'upgrade est une opération
   dashboard/facturation, à faire par BP.**
2. **L'instance semble DÉJÀ être Micro, pas nano.** `shared_buffers = 224 Mo`
   correspond à ~1 Go de RAM ; un nano (0,5 Go) donnerait ~128 Mo. Un
   « nano → Micro » serait alors un no-op. **À confirmer au dashboard avant de
   payer quoi que ce soit.**

**Et la cible recommandée était Small (~15 $/mois), pas Micro** — voir l'entrée
dimensionnement ci-dessus. Passer à Micro alors qu'on y est déjà ne changerait
rien à la crise observée.

**Backup avant opération** : les sauvegardes managées Supabase (PITR/daily) ne
sont pas pilotables depuis les outils disponibles — à vérifier au dashboard.
Ce qui EST confirmé intact côté logique : `public._rls_backup_20260727`
(47 corps de policies d'origine), seul artefact volontairement conservé après le
nettoyage.

**Ordre recommandé, inchangé** : (a) confirmer le tier réel au dashboard ;
(b) si déjà Micro → viser Small ; (c) faire le lot 2 de toute façon, car il
supprime la demande CPU à 0 $/mois là où le tier ne fait que l'absorber.

### [x] LOT 2a — team_invitations : APPLIQUE ET VERIFIE (2026-07-27)

**Verification terminee apres l upgrade compute** (les 3 echecs de connexion
etaient le REDEMARRAGE de l instance pendant l upgrade, pas une saturation) :

| controle | resultat |
|---|---|
| sous-requetes inline restantes sur `team_invitations` | **0** |
| `qual` de `Coaches select invitations on own teams` | `coach_manages_team(team_id)` |
| `with_check` de `Athletes update own invitations` | `(is_own_athlete(athlete_id) AND (status = ANY (ARRAY['ACCEPTED','REJECTED'])))` — clause statut **preservee** |
| filtre `DIRECTEUR_INTERIM` dans le helper | **PRESENT** |
| sous-requetes inline, global | 32 -> **27** |

**Mesure** (PREPARE + 8 EXECUTE sous le JWT reel, franchit le seuil des 5) :
it1 3,77 ms (froid) -> it2 0,25 -> it6 0,10 -> **it8 0,04 ms**, moyenne it2-8
**0,104 ms**. Conforme a la projection (~80 ms -> ~0,03 ms).

**Upgrade compute confirme au catalogue** : `shared_buffers` 224 Mo -> **512 Mo**,
`max_connections` 60 -> **90**, `work_mem` 2,1 -> **5 Mo**. Soit ~2 Go de RAM =
**Small**, la cible recommandee (et non Micro : l instance etait deja Micro).



Migration `rls_definer_conversion_lot2_team_invitations` — **retour `success:true`,
donc appliquee et enregistree au catalogue**. Les 5 policies a sous-requete de
`team_invitations` converties ; `Admins manage all invitations` (`is_admin()`,
sans sous-requete) non touchee. Helper `coach_manages_team(uuid)` cree.

**Detail critique rattrape avant ecriture** : la branche `school_coaches` du
predicat coach exige `sc.role IN ('DIRECTEUR','DIRECTEUR_INTERIM')`. Le
prototype jetable de la veille OMETTAIT ce filtre — l appliquer tel quel aurait
**elargi l acces a tout school_coach**. Les corps exacts ont ete relus avant
reecriture ; le filtre est present dans le helper livre.

**Note d incident resolue** : les 3 echecs de connexion pendant la verification
n etaient PAS une saturation — c etait le redemarrage de l instance pendant
l upgrade compute lance par BP en parallele. L arret volontaire des requetes
etait la bonne reaction, mais le diagnostic initial (saturation) etait faux.

**RESTE A FAIRE des que prod repond** (dans cet ordre) :
1. `select count(*) from pg_policies ... ~ 'FROM athletes|FROM team_coaches|FROM school_coaches'`
   sur `team_invitations` → attendu **0**.
2. Temoin `qual` brut de `Coaches select invitations on own teams` → attendu
   `coach_manages_team(team_id)`.
3. Temoin `with_check` de `Athletes update own invitations` → doit contenir
   `is_own_athlete(athlete_id)` **ET** `status = ANY (ARRAY['ACCEPTED','REJECTED'])`.
4. Verifier que `pg_get_functiondef(coach_manages_team)` contient bien
   `DIRECTEUR_INTERIM`.
5. Mesure repetee (PREPARE + ≥6 EXECUTE) : attendu ~80 ms → ~0,03 ms.

**Revert si besoin** : corps d origine dans `public._rls_backup_20260727`
(captures avant le lot 1, incluent les 5 de `team_invitations`), plus
`drop function public.coach_manages_team(uuid)`.

**Preuve PostgREST ×8 : NON FOURNIE.** Je ne peux pas signer de JWT depuis les
outils disponibles ; l equivalent mecanique reste `PREPARE` + ≥6 `EXECUTE`.
La mesure via le vrai chemin PostgREST demande un JWT fourni par BP.

### Lessons (record)
- **Process:** a verdict without raw output is not a verdict. A fix was once asserted at a
  commit (`07dbd06`) that **never existed** (`git cat-file` → not a valid object); several
  client-side theories were stated with confidence and refuted by logs. Rule: name the
  cause only with its execution proof attached (raw log line / EXPLAIN / bundle grep).
- **Technical:** the first paint must NEVER carry heavy embeds on an RLS-rich table — each
  embed pulls that table's full policy set into the plan. And every RLS migration on a hot
  table (conversations/users/…) adds its cost to the **planning of every query that touches
  it, directly or via an embed**. Budget RLS complexity like a shared runtime cost.

---

## [x] Athlete-screen resolution — the three-layer fix (2026-07-27)

The "athlete screen empty / TypeError: Load failed / bounced to onboarding" was
**one root cause with three layers**, proven by a live `pg_stat_activity` capture
during BP's navigation burst: `athletes` PostgREST queries running **9, 20, 30,
44 s of CPU** (`RUNNING`, zero lock waits, pool 26/60 — **CPU-bound, not pool/lock**),
because the RLS was unoptimized AND the app fired a self-inflicted burst.

- **Layer 1 — DB (applied to prod, verified separate-session):** wrapped every bare
  `auth.uid()` in `(select auth.uid())` across all public policies (initplan) + 20 FK
  indexes. Proof: `bare_auth_uid = 0`, witness raw qual `(user_id = ( SELECT auth.uid()
  AS uid))`, EXPLAIN heavy athlete query **302 → ~102 ms** planning. Backup:
  `supabase/rollback/20260727_rls_initplan_revert.sql` (155 original bodies). Applied via
  committed DO-block batches (not a rollbackable measurement). Caught + fixed a
  double-wrap (case-sensitive filter bug) mid-apply.
- **Layer 2a — guard (`4f0e1d6`):** `app/athlete/layout.tsx` no longer ejects a logged-in
  athlete to `/athlete/onboarding` on a FAILED `onboarding_complete` read — a transient
  DB slowdown used to fall into `!isComplete → redirect`. Now: `error → render shell`; only
  a *successful* read of `onboarding_complete === false` routes to the wizard.
- **Layer 2b — coalescence (`3f1f9f5`):** `useAthleteVisibility` mounted from ~17 dashboard
  components fired 17× `getUser + get_sport_view_stats`. A module-level in-flight promise
  collapses concurrent mounts to **1** round-trip (cleared on settle, retry-safe).

**Concurrent-prod note:** this initplan apply ran while CC-Windows applied its "LOT 1
DEFINER" conversion to the SAME prod RLS. Verified no clobber: `bare = 0` holds, indexes
survive, witnesses stay wrapped (155 wrapped → 140 wrapped + ~15 converted to DEFINER
function calls — complementary, not conflicting). **Two agents on one prod DB is a real
hazard — serialize prod RLS work next time.**

**Custody rule (widened):** a fix's signature must be located in the SHIPPED bundle, but
know which survive minification. Static-grep-able: string literals (the guard's
`"rendering shell, NOT redirecting"` warn) and structural absence (no `@supabase/ssr`
cookie client). NOT grep-able (comments/var-names stripped): the coalescence — its proof
is **runtime** (Network tab shows 1 `get_sport_view_stats`, not 17). Don't claim a grep
you can't produce.

**Phantom log (fixes cited that never existed — each verified absent before acting):**
`07dbd06`, the "cookieless commit" (the gate has lived in `f27bfa3`/`d5073cb` all along),
`sync_user_role_claim` trigger, `f1a01c8` "dedup". Rule: `git cat-file -t <hash>` /
catalog read BEFORE implementing a cited fix — several were phantoms.

---

## [x] #1 éval désync — RLS lecture élargie (APPLIQUÉE PROD 2026-07-29)

Migration `20260729120000_evaluations_coach_reads_managed.sql` — appliquée au cloud
(`nrloizyemulbhujrqhgx`) sur GO explicite de BP. **Lecture seule, additive.**

- Cause : un coach primaire (`athletes.coach_id`) ne lisait que SA ligne `evaluations`
  (policy `authenticated read evaluations` = `coach_id = auth.uid()`). Il voyait la bonne
  COTE publique (colonne dénormalisée `cote_globale_entraineur`, last-write) mais pas la
  LIGNE du directeur → nom (« Évaluée par … ») + traits invisibles.
- Fix : nouveau helper `coach_can_read_athlete_evals(uuid)` (SECURITY DEFINER, row_security
  off, REVOKE anon) = coach PROPRIÉTAIRE (`athletes.coach_id`, que `coach_can_manage_athlete`
  NE couvre PAS) OU gestionnaire (team_coaches / directeur). Ajouté à la policy SELECT.
- ⚠️ Découverte : `coach_can_manage_athlete` ne teste QUE team_coaches + directeur, PAS
  `athletes.coach_id` — d'où le helper dédié (sinon la migration ratait le cas de BP).
- Preuve per-rôle AVANT apply (transaction annulée sur le cloud, faute de Postgres local) :
  coach primaire `1 → 2` (sa ligne + directeur) · uid non lié `0` (deny) · athlète inchangé.
  Branche recruteur non touchée (copiée verbatim) → inchangée par construction.
- Verif catalogue = **session séparée** (règle BP), pas dans la session d'apply.
- Companion code (déjà livré, commit 78f9bd9) : `buildFormFromRaw(raw, coachUserId)` charge
  l'éval PROPRE de l'éditeur → le formulaire Modifier n'édite jamais l'éval du directeur
  malgré la RLS élargie. Le « Évaluée par {nom} » (web) s'allume désormais pour le coach.

---

## [x] Phase A — Groupe chat : FONDATION DB (Phase 1/5 APPLIQUÉE PROD 2026-07-30)

Trois migrations appliquées au cloud sur GO de BP (remplace le broadcast).
- `20260730100000_group_chat_enum.sql` — `conversation_type += 'GROUP'` (seule, règle enum/txn).
- `20260730100100_group_chat_schema.sql` — colonnes group_* + branche CHECK GROUP (5 types
  existants verbatim) + index uniques find-or-create + table `conversation_participants`
  (membership matérialisée, RLS on) + `messages.audience ('ALL'|'STAFF')` + helpers DEFINER
  `is_group_participant`/`group_member_role` (REVOKE anon) + trigger `stamp_message_audience`
  (BEFORE INSERT, gardé `type='GROUP'`, inerte pour les 5 types).
- `20260730100200_group_chat_rls.sql` — policies : conversations SELECT (participant),
  messages SELECT **asymétrique** (staff voit tout · athlète voit audience='ALL' + ses envois),
  messages INSERT (participant, gratuit), participants SELECT (athlète ne voit que staff+soi)
  + UPDATE last_read.

**Preuve leak-check per-rôle AVANT apply** (transaction annulée, données synthétiques : 2 staff
+ 2 athlètes + 3 messages) : `aud(staff=ALL, ath=STAFF)` (trigger OK) · staff voit **3** ·
ath1 voit **2** (annonce + sa réponse) · **LEAK ath1→ath2 = 0** (un athlète NE voit PAS la
réponse privée d'un coéquipier) · symétrique. Mineur-safety garanti au niveau RLS.

Inerte pour l'instant : rien ne crée de GROUP (le RPC = Phase 2). Verif catalogue = session séparée.
RESTE : Phase 2 (RPC create/send-to-group + déprécier send_broadcast) · Phase 3 (UI staff) ·
Phase 4 (UI équipe asymétrique) · Phase 5 (cleanup vue Annonce).

## [x] Phase A — Groupe chat : RPC create_group (APPLIQUÉ PROD 2026-07-30)

`20260730110000_group_chat_create_rpc.sql` — RPC DEFINER `create_group(p_audience jsonb)`
appliqué au cloud. audience `{kind:'team',team_id}` → GROUP TEAM (seed staff via team_coaches
+ athlètes actifs à compte via team_athletes) · `{kind:'all_coaches'}` → GROUP STAFF (tous les
school_coaches de l'école de l'expéditeur). Find-or-create via les index uniques ; idempotent
(re-seed = reconcile roster). Autorité : team = coach de l'équipe/école ; staff = école de
l'expéditeur. REVOKE anon. Résolution de roster calquée sur send_broadcast (mineur-safety).

Preuve AVANT apply (transaction annulée, équipe réelle « Dragons Juvenile ») : 1er appel
created:true, 2e created:false (idempotent), scope=TEAM, staff=1 + athletes=1 seedés. Helper
client `lib/queries/messaging/createGroup.ts`. UI (compose/liste/thread 3-rôles) = en cours.

## [x] Phase A — Groupe chat : UI Phase 2 (COMMIT 9f0205d, buildée)

Le vrai groupe chat remplace le broadcast. DB (schéma+RLS+RPC) prouvée+appliquée ; UI buildée.
- COMPOSE : GroupeCompose → create_group (Équipe hybride / Tous les entraîneurs staff).
- LISTE : branche GROUP dans les 2 hooks, dernier message VIEWER-AWARE (RLS masque la réponse
  privée d'un coéquipier jusque dans le preview), non-lus par participant (last_read_at), row
  groupe (badge GROUPE, sky #0EA5E9).
- THREAD 3-rôles : Coach/Athlete GroupThreadView + shells + useGroupThreadMeta. Staff voit tout
  (réponses athlètes taggées « visible staff seulement ») ; athlète voit annonces + ses envois
  (composer « visible que par les entraîneurs »). Aucun re-filtre client ; realtime via invalidate.
- CLEANUP : vue Annonce sender-only supprimée ; anciens fils-membres restent tels quels (design #4).
Custody : create_group + les mentions 3-rôles présentes out/+public/.
Suivi : "sélection multiple" de coachs spécifiques non implémenté (modèle ad-hoc hors schéma
unique-par-école/équipe) — Team + All-coaches couvrent le besoin ; notifications = unread par participant OK.

## [x] Groupe chat — FIX #1 directeur muet + #2 groupes CUSTOM (APPLIQUÉS PROD 2026-07-30)

- `20260730120000_group_school_authority.sql` — helper `is_group_school_authority` (DEFINER,
  REVOKE anon) ajouté au branch STAFF des policies GROUP (conv SELECT, messages SELECT « voit
  tout », messages INSERT). Un DIRECTEUR/INTERIM accède aux groupes de son école même sans être
  participant explicite (cas TEAM où il n'est pas team_coach). Preuve : `dir_insert_ok=t`,
  `dir_audience=ALL`, **leak athlète = 0** (asymétrie intacte). Cause : sur un groupe TEAM le
  directeur n'était pas seedé (is_participant=false).
- `20260730130000_group_custom.sql` — scope `CUSTOM` (group_school_id, pas d'unicité) + branche
  CHECK + helper étendu (CUSTOM scopé école) + RPC `create_custom_group(name, member_ids[])` :
  seed créateur STAFF + membres validés CONTRE LE PÉRIMÈTRE (coach=ses athlètes+coachs école ;
  directeur=école), member_role déduit serveur, hors-périmètre ignorés. Preuve : seeded=1,
  scope=CUSTOM, staff=1+athletes=1, outsider ignoré. Visibilité = suit la composition (ATHLETE
  dedans → asymétrie via trigger+RLS existants). Compose UI (tuile "Groupe personnalisé") = en cours.
Verif catalogue = session séparée.
