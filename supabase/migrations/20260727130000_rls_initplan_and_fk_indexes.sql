-- ============================================================================
-- RLS auth_rls_initplan optimization + FK indexes  (Pass 1)
--
-- WHY: athlete-screen 500s traced to `canceling statement due to statement
-- timeout` (prod postgres log). Heavy athlete profil query = 302ms PLANNING,
-- pulling conversations(14x)/school_coaches(37x) into the plan via embeds;
-- under the dashboard's concurrent burst even trivial `select id` (21ms) hit
-- statement_timeout -> 500. See docs/flip-day-ledger.md handoff entry.
--
-- WHAT: wrap every direct auth.uid() in RLS policies of the hot tables in
-- (select auth.uid()) so it is evaluated ONCE per query (initplan) instead of
-- per row. 64 policies across 10 tables. STRICTLY behaviour-preserving — only
-- the evaluation cadence changes, never the predicate. + priority FK indexes.
--
-- NOT in this pass: multiple_permissive_policies consolidation (Pass 2), and
-- any app-side embed lightening. Deferred deliberately.
--
-- PROOF REQUIRED BEFORE PROD (see scratchpad/rls-initplan-*.sql):
--   1. Per-role equivalence matrix  -> IDENTICAL allow/deny + row counts.
--   2. EXPLAIN before/after: heavy athlete query (302ms planning -> ?),
--      light `select id` (21ms -> ?).
-- Prod apply only on BP's explicit per-migration GO (ledger rule 9).
-- ============================================================================

-- ---- 64 policy rewrites: auth.uid() -> (select auth.uid()) ----

-- athlete_notifications.Athletes read own notifications
DROP POLICY IF EXISTS "Athletes read own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes read own notifications" ON public.athlete_notifications AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = (select auth.uid())))));

-- athlete_notifications.Athletes update own notifications
DROP POLICY IF EXISTS "Athletes update own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes update own notifications" ON public.athlete_notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = (select auth.uid())))));

-- athletes.Approved partners read opted-in athletes
DROP POLICY IF EXISTS "Approved partners read opted-in athletes" ON public.athletes;
CREATE POLICY "Approved partners read opted-in athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING (((partner_visibility_opt_in = true) AND is_approved_partner((select auth.uid()))));

-- athletes.athletes can claim own orphan match
DROP POLICY IF EXISTS "athletes can claim own orphan match" ON public.athletes;
CREATE POLICY "athletes can claim own orphan match" ON public.athletes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id IS NULL) AND (email IS NOT NULL) AND (lower(email) = lower(current_user_email()))))
  WITH CHECK ((user_id = (select auth.uid())));

-- athletes.athletes can insert own profile
DROP POLICY IF EXISTS "athletes can insert own profile" ON public.athletes;
CREATE POLICY "athletes can insert own profile" ON public.athletes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = (select auth.uid())));

-- athletes.athletes can read own profile
DROP POLICY IF EXISTS "athletes can read own profile" ON public.athletes;
CREATE POLICY "athletes can read own profile" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (select auth.uid())));

-- athletes.athletes can update own profile
DROP POLICY IF EXISTS "athletes can update own profile" ON public.athletes;
CREATE POLICY "athletes can update own profile" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

-- athletes.athletes_insert
DROP POLICY IF EXISTS athletes_insert ON public.athletes;
CREATE POLICY athletes_insert ON public.athletes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((coach_id = (select auth.uid())) AND is_coach() AND (user_has_pro() OR ((get_user_tier() = 'free'::text) AND (count_coach_athletes() < 30)))));

-- athletes.coaches can claim unclaimed school athletes
DROP POLICY IF EXISTS "coaches can claim unclaimed school athletes" ON public.athletes;
CREATE POLICY "coaches can claim unclaimed school athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING (((coach_id IS NULL) AND (school_id = current_user_school_id())))
  WITH CHECK ((coach_id = (select auth.uid())));

-- athletes.coaches can update own athletes
DROP POLICY IF EXISTS "coaches can update own athletes" ON public.athletes;
CREATE POLICY "coaches can update own athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING ((coach_id = (select auth.uid())));

-- athletes.coaches read own athletes
DROP POLICY IF EXISTS "coaches read own athletes" ON public.athletes;
CREATE POLICY "coaches read own athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = (select auth.uid())) OR (is_coach() AND (school_id = current_user_school_id())) OR (EXISTS ( SELECT 1
   FROM school_coaches sc
  WHERE ((sc.coach_id = (select auth.uid())) AND (sc.school_id = athletes.school_id))))));

-- conversations.athlete_conversations_insert
DROP POLICY IF EXISTS athlete_conversations_insert ON public.conversations;
CREATE POLICY athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = (select auth.uid()))))) AND athlete_messageable_coach(coach_id)));

-- conversations.athlete_conversations_select
DROP POLICY IF EXISTS athlete_conversations_select ON public.conversations;
CREATE POLICY athlete_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = (select auth.uid())))))));

-- conversations.athlete_conversations_update
DROP POLICY IF EXISTS athlete_conversations_update ON public.conversations;
CREATE POLICY athlete_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO public
  USING (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = (select auth.uid())))))))
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = (select auth.uid())))))));

-- conversations.athlete_ra_conversations_select
DROP POLICY IF EXISTS athlete_ra_conversations_select ON public.conversations;
CREATE POLICY athlete_ra_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = (select auth.uid())))))));

-- conversations.coach_athlete_conversations_insert
DROP POLICY IF EXISTS coach_athlete_conversations_insert ON public.conversations;
CREATE POLICY coach_athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (coach_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND athlete_messageable_coach((select auth.uid()), a.user_id))))));

-- conversations.coach_coach_conversations_insert
DROP POLICY IF EXISTS coach_coach_conversations_insert ON public.conversations;
CREATE POLICY coach_coach_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'COACH_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (parent_id IS NULL) AND (coach_id = (select auth.uid())) AND (coach_b_id IS NOT NULL) AND (coach_b_id <> (select auth.uid())) AND is_same_school_staff((select auth.uid()), coach_b_id) AND ((athlete_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN school_coaches sc ON ((sc.school_id = a.school_id)))
  WHERE ((a.id = conversations.athlete_id) AND (sc.coach_id = (select auth.uid())) AND (sc.role = ANY (ARRAY['COACH'::coach_school_role, 'DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role]))))))));

-- conversations.coach_coach_conversations_select
DROP POLICY IF EXISTS coach_coach_conversations_select ON public.conversations;
CREATE POLICY coach_coach_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = (select auth.uid())) OR (coach_b_id = (select auth.uid())))));

-- conversations.coach_coach_conversations_update
DROP POLICY IF EXISTS coach_coach_conversations_update ON public.conversations;
CREATE POLICY coach_coach_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO public
  USING (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = (select auth.uid())) OR (coach_b_id = (select auth.uid())))))
  WITH CHECK (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = (select auth.uid())) OR (coach_b_id = (select auth.uid())))));

-- conversations.coach_conversations_insert
DROP POLICY IF EXISTS coach_conversations_insert ON public.conversations;
CREATE POLICY coach_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type <> ALL (ARRAY['COACH_COACH'::conversation_type, 'RECRUTEUR_COACH'::conversation_type, 'PARENT_COACH'::conversation_type])) AND (coach_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.coach_id = (select auth.uid())))))));

-- conversations.coach_conversations_select
DROP POLICY IF EXISTS coach_conversations_select ON public.conversations;
CREATE POLICY coach_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING ((coach_id = (select auth.uid())));

-- conversations.coach_conversations_update
DROP POLICY IF EXISTS coach_conversations_update ON public.conversations;
CREATE POLICY coach_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((coach_id = (select auth.uid())))
  WITH CHECK ((coach_id = (select auth.uid())));

-- conversations.coach_initiate_parent_coach
DROP POLICY IF EXISTS coach_initiate_parent_coach ON public.conversations;
CREATE POLICY coach_initiate_parent_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'PARENT_COACH'::conversation_type) AND (coach_id = (select auth.uid())) AND (recruiter_id IS NULL) AND (coach_b_id IS NULL) AND (parent_id IS NOT NULL) AND (athlete_id IS NOT NULL) AND is_parent_link(parent_id, athlete_id) AND coach_reaches_athlete((select auth.uid()), athlete_id)));

-- conversations.coach_initiate_recruteur_coach
DROP POLICY IF EXISTS coach_initiate_recruteur_coach ON public.conversations;
CREATE POLICY coach_initiate_recruteur_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'RECRUTEUR_COACH'::conversation_type) AND (coach_id = (select auth.uid())) AND (recruiter_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.coach_id = (select auth.uid()))))) AND user_is_recruiter(recruiter_id)));

-- conversations.conversations participants
DROP POLICY IF EXISTS "conversations participants" ON public.conversations;
CREATE POLICY "conversations participants" ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((recruiter_id = (select auth.uid())) OR (coach_id = (select auth.uid()))));

-- conversations.conversations_insert
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((recruiter_id = (select auth.uid())) AND (conversation_type = 'RECRUTEUR_COACH'::conversation_type) AND user_has_pro()));

-- conversations.parent_conversations_select
DROP POLICY IF EXISTS parent_conversations_select ON public.conversations;
CREATE POLICY parent_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = (select auth.uid())));

-- conversations.parent_conversations_update
DROP POLICY IF EXISTS parent_conversations_update ON public.conversations;
CREATE POLICY parent_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((parent_id = (select auth.uid())))
  WITH CHECK ((parent_id = (select auth.uid())));

-- conversations.parent_initiate_parent_coach
DROP POLICY IF EXISTS parent_initiate_parent_coach ON public.conversations;
CREATE POLICY parent_initiate_parent_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'PARENT_COACH'::conversation_type) AND (parent_id = (select auth.uid())) AND (recruiter_id IS NULL) AND (coach_b_id IS NULL) AND (coach_id IS NOT NULL) AND (athlete_id IS NOT NULL) AND is_parent_of(athlete_id) AND coach_reaches_athlete(coach_id, athlete_id)));

-- conversations.recruiter_conversations_delete
DROP POLICY IF EXISTS recruiter_conversations_delete ON public.conversations;
CREATE POLICY recruiter_conversations_delete ON public.conversations AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- conversations.recruiter_conversations_select
DROP POLICY IF EXISTS recruiter_conversations_select ON public.conversations;
CREATE POLICY recruiter_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- conversations.recruiter_conversations_update
DROP POLICY IF EXISTS recruiter_conversations_update ON public.conversations;
CREATE POLICY recruiter_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((recruiter_id = (select auth.uid())))
  WITH CHECK ((recruiter_id = (select auth.uid())));

-- conversations.recruteur_athlete_conversations_insert
DROP POLICY IF EXISTS recruteur_athlete_conversations_insert ON public.conversations;
CREATE POLICY recruteur_athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (recruiter_id = (select auth.uid())) AND (coach_id IS NULL) AND (parent_id IS NULL) AND (EXISTS ( SELECT 1
   FROM recruiter_favorites f
  WHERE ((f.recruiter_id = (select auth.uid())) AND (f.athlete_id = conversations.athlete_id)))) AND is_athlete_contactable(athlete_id)));

-- conversations.recruteur_athlete_conversations_select
DROP POLICY IF EXISTS recruteur_athlete_conversations_select ON public.conversations;
CREATE POLICY recruteur_athlete_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (recruiter_id = (select auth.uid()))));

-- evaluations.authenticated read evaluations
DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;
CREATE POLICY "authenticated read evaluations" ON public.evaluations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = (select auth.uid())) OR is_director_of_athlete_school(athlete_id) OR (is_recruiter() AND athlete_is_active(athlete_id)) OR (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = evaluations.athlete_id) AND (a.user_id = (select auth.uid()))))) OR is_admin()));

-- evaluations.evaluations coach
DROP POLICY IF EXISTS "evaluations coach" ON public.evaluations;
CREATE POLICY "evaluations coach" ON public.evaluations AS PERMISSIVE FOR ALL TO authenticated
  USING ((coach_id = (select auth.uid())))
  WITH CHECK ((coach_id = (select auth.uid())));

-- messages.athlete_messages_insert
DROP POLICY IF EXISTS athlete_messages_insert ON public.messages;
CREATE POLICY athlete_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'ATHLETE_COACH'::conversation_type) AND (a.user_id = (select auth.uid())))))));

-- messages.coach_coach_messages_insert
DROP POLICY IF EXISTS coach_coach_messages_insert ON public.messages;
CREATE POLICY coach_coach_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = (select auth.uid())) OR (c.coach_b_id = (select auth.uid()))))))));

-- messages.coach_coach_messages_select
DROP POLICY IF EXISTS coach_coach_messages_select ON public.messages;
CREATE POLICY coach_coach_messages_select ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = (select auth.uid())) OR (c.coach_b_id = (select auth.uid())))))));

-- messages.coach_coach_messages_update
DROP POLICY IF EXISTS coach_coach_messages_update ON public.messages;
CREATE POLICY coach_coach_messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = (select auth.uid())) OR (c.coach_b_id = (select auth.uid())))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = (select auth.uid())) OR (c.coach_b_id = (select auth.uid())))))));

-- messages.messages participants
DROP POLICY IF EXISTS "messages participants" ON public.messages;
CREATE POLICY "messages participants" ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = (select auth.uid())) OR (conversations.coach_id = (select auth.uid()))))));

-- messages.messages_insert
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND ((( SELECT users.role
   FROM users
  WHERE (users.id = (select auth.uid()))) = 'COACH'::user_role) OR ((( SELECT users.role
   FROM users
  WHERE (users.id = (select auth.uid()))) = 'RECRUTEUR'::user_role) AND user_has_pro())) AND (EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.recruiter_id = (select auth.uid())) OR (conversations.coach_id = (select auth.uid()))))))));

-- messages.messages_select
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = (select auth.uid())) OR (conversations.coach_id = (select auth.uid()))))));

-- messages.messages_update
DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = (select auth.uid())) OR (conversations.coach_id = (select auth.uid()))))));

-- messages.parent_messages_insert
DROP POLICY IF EXISTS parent_messages_insert ON public.messages;
CREATE POLICY parent_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'PARENT_COACH'::conversation_type) AND (c.parent_id = (select auth.uid())))))));

-- messages.ra_athlete_messages_insert
DROP POLICY IF EXISTS ra_athlete_messages_insert ON public.messages;
CREATE POLICY ra_athlete_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = (select auth.uid())))))));

-- messages.ra_athlete_messages_update
DROP POLICY IF EXISTS ra_athlete_messages_update ON public.messages;
CREATE POLICY ra_athlete_messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = (select auth.uid()))))));

-- recruiter_activity_log.Coaches read activity for their claimed athletes
DROP POLICY IF EXISTS "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log;
CREATE POLICY "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = (select auth.uid())))));

-- recruiter_activity_log.Recruiters see their own activity
DROP POLICY IF EXISTS "Recruiters see their own activity" ON public.recruiter_activity_log;
CREATE POLICY "Recruiters see their own activity" ON public.recruiter_activity_log AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = (select auth.uid())))
  WITH CHECK ((recruiter_id = (select auth.uid())));

-- recruiter_favorites.Athletes read own favorites
DROP POLICY IF EXISTS "Athletes read own favorites" ON public.recruiter_favorites;
CREATE POLICY "Athletes read own favorites" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = (select auth.uid())))));

-- recruiter_favorites.Coaches read favorites for their athletes
DROP POLICY IF EXISTS "Coaches read favorites for their athletes" ON public.recruiter_favorites;
CREATE POLICY "Coaches read favorites for their athletes" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = (select auth.uid())))));

-- recruiter_favorites.recruiter_favorites_delete
DROP POLICY IF EXISTS recruiter_favorites_delete ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_delete ON public.recruiter_favorites AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- recruiter_favorites.recruiter_favorites_insert
DROP POLICY IF EXISTS recruiter_favorites_insert ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_insert ON public.recruiter_favorites AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((recruiter_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'RECRUTEUR'::user_role)))) AND (user_has_pro() OR ((get_user_tier() = 'free'::text) AND (count_user_favorites() < 10)))));

-- recruiter_favorites.recruiter_favorites_select
DROP POLICY IF EXISTS recruiter_favorites_select ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_select ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- recruiter_favorites.recruiter_favorites_update
DROP POLICY IF EXISTS recruiter_favorites_update ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_update ON public.recruiter_favorites AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((recruiter_id = (select auth.uid())))
  WITH CHECK ((recruiter_id = (select auth.uid())));

-- recruiter_pipeline.coaches read pipeline for own athletes
DROP POLICY IF EXISTS "coaches read pipeline for own athletes" ON public.recruiter_pipeline;
CREATE POLICY "coaches read pipeline for own athletes" ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = (select auth.uid())))));

-- recruiter_pipeline.recruiter_pipeline_delete
DROP POLICY IF EXISTS recruiter_pipeline_delete ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_delete ON public.recruiter_pipeline AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- recruiter_pipeline.recruiter_pipeline_insert
DROP POLICY IF EXISTS recruiter_pipeline_insert ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_insert ON public.recruiter_pipeline AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((recruiter_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'RECRUTEUR'::user_role)))) AND user_has_pro()));

-- recruiter_pipeline.recruiter_pipeline_select
DROP POLICY IF EXISTS recruiter_pipeline_select ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_select ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = (select auth.uid())));

-- recruiter_pipeline.recruiter_pipeline_update
DROP POLICY IF EXISTS recruiter_pipeline_update ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_update ON public.recruiter_pipeline AS PERMISSIVE FOR UPDATE TO public
  USING (((recruiter_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = (select auth.uid())) AND (users.role = 'RECRUTEUR'::user_role))))))
  WITH CHECK (((recruiter_id = (select auth.uid())) AND user_has_pro()));

-- schools.Coaches create civil schools
DROP POLICY IF EXISTS "Coaches create civil schools" ON public.schools;
CREATE POLICY "Coaches create civil schools" ON public.schools AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((type = 'LIGUE_CIVILE'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = (select auth.uid())) AND (u.role = 'COACH'::user_role) AND (u.context = 'ligue_civile'::text))))));

-- users.Users read conversation participants
DROP POLICY IF EXISTS "Users read conversation participants" ON public.users;
CREATE POLICY "Users read conversation participants" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (((id = (select auth.uid())) OR (id IN ( SELECT conversations.recruiter_id
   FROM conversations
  WHERE (conversations.coach_id = (select auth.uid())))) OR (id IN ( SELECT conversations.coach_id
   FROM conversations
  WHERE (conversations.recruiter_id = (select auth.uid()))))));

-- users.users read own
DROP POLICY IF EXISTS "users read own" ON public.users;
CREATE POLICY "users read own" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING ((id = (select auth.uid())));

-- users.users update own
DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((id = (select auth.uid())))
  WITH CHECK (((id = (select auth.uid())) AND user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)));

-- ============================================================
-- INDEX FK — chemin athlète (tue les seq-scans du plan : school_coaches 37x,
-- conversations 14x). CREATE INDEX IF NOT EXISTS = idempotent.
-- NOTE PROD : envisager CONCURRENTLY à l'apply prod (hors transaction) ;
-- en local l'apply transactionnel standard suffit.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_school_coaches_coach_id   ON public.school_coaches (coach_id);
CREATE INDEX IF NOT EXISTS idx_school_coaches_school_id  ON public.school_coaches (school_id);
CREATE INDEX IF NOT EXISTS idx_conversations_coach_id    ON public.conversations (coach_id);
CREATE INDEX IF NOT EXISTS idx_conversations_coach_b_id  ON public.conversations (coach_b_id);
CREATE INDEX IF NOT EXISTS idx_conversations_recruiter_id ON public.conversations (recruiter_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id   ON public.conversations (parent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_athlete_id  ON public.conversations (athlete_id);
CREATE INDEX IF NOT EXISTS idx_athletes_coach_id         ON public.athletes (coach_id);
CREATE INDEX IF NOT EXISTS idx_athletes_school_id        ON public.athletes (school_id);
CREATE INDEX IF NOT EXISTS idx_athletes_user_id          ON public.athletes (user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_athlete_id    ON public.evaluations (athlete_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_coach_id      ON public.evaluations (coach_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id  ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id        ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_favorites_athlete_id ON public.recruiter_favorites (athlete_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_pipeline_athlete_id  ON public.recruiter_pipeline (athlete_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_activity_log_athlete_id ON public.recruiter_activity_log (athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_notifications_athlete_id  ON public.athlete_notifications (athlete_id);
CREATE INDEX IF NOT EXISTS idx_team_athletes_athlete_id  ON public.team_athletes (athlete_id);
CREATE INDEX IF NOT EXISTS idx_team_athletes_team_id     ON public.team_athletes (team_id);
