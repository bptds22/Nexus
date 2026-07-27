-- Revert kit generated from live catalog. Restores pre-migration policy bodies.

DROP POLICY IF EXISTS "Athletes read own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes read own notifications" ON public.athlete_notifications AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Athletes update own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes update own notifications" ON public.athlete_notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "admins insert notifications" ON public.athlete_notifications;
CREATE POLICY "admins insert notifications" ON public.athlete_notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Approved partners read opted-in athletes" ON public.athletes;
CREATE POLICY "Approved partners read opted-in athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING (((partner_visibility_opt_in = true) AND is_approved_partner(auth.uid())));

DROP POLICY IF EXISTS "Coaches update own team athletes" ON public.athletes;
CREATE POLICY "Coaches update own team athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (coach_can_manage_athlete(id))
  WITH CHECK (coach_can_manage_athlete(id));

DROP POLICY IF EXISTS "admins read all" ON public.athletes;
CREATE POLICY "admins read all" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "admins update all" ON public.athletes;
CREATE POLICY "admins update all" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "athletes can claim own orphan match" ON public.athletes;
CREATE POLICY "athletes can claim own orphan match" ON public.athletes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id IS NULL) AND (email IS NOT NULL) AND (lower(email) = lower(current_user_email()))))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "athletes can insert own profile" ON public.athletes;
CREATE POLICY "athletes can insert own profile" ON public.athletes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "athletes can read own orphan match" ON public.athletes;
CREATE POLICY "athletes can read own orphan match" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id IS NULL) AND (email IS NOT NULL) AND (lower(email) = lower(current_user_email()))));

DROP POLICY IF EXISTS "athletes can read own profile" ON public.athletes;
CREATE POLICY "athletes can read own profile" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "athletes can update own profile" ON public.athletes;
CREATE POLICY "athletes can update own profile" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS athletes_insert ON public.athletes;
CREATE POLICY athletes_insert ON public.athletes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((coach_id = auth.uid()) AND is_coach() AND (user_has_pro() OR ((get_user_tier() = 'free'::text) AND (count_coach_athletes() < 30)))));

DROP POLICY IF EXISTS "coaches assign unclaimed school athletes" ON public.athletes;
CREATE POLICY "coaches assign unclaimed school athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((coach_id IS NULL) AND (school_id = current_user_school_id())))
  WITH CHECK (((school_id = current_user_school_id()) AND ((coach_id IS NULL) OR (EXISTS ( SELECT 1
   FROM school_coaches sc
  WHERE ((sc.coach_id = athletes.coach_id) AND (sc.school_id = current_user_school_id())))))));

DROP POLICY IF EXISTS "coaches can claim unclaimed school athletes" ON public.athletes;
CREATE POLICY "coaches can claim unclaimed school athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING (((coach_id IS NULL) AND (school_id = current_user_school_id())))
  WITH CHECK ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "coaches can update own athletes" ON public.athletes;
CREATE POLICY "coaches can update own athletes" ON public.athletes AS PERMISSIVE FOR UPDATE TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "coaches read own athletes" ON public.athletes;
CREATE POLICY "coaches read own athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = auth.uid()) OR (is_coach() AND (school_id = current_user_school_id())) OR (EXISTS ( SELECT 1
   FROM school_coaches sc
  WHERE ((sc.coach_id = auth.uid()) AND (sc.school_id = athletes.school_id))))));

DROP POLICY IF EXISTS "recruiters read active athletes" ON public.athletes;
CREATE POLICY "recruiters read active athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((status = 'ACTIF'::account_status) AND is_recruiter()));

DROP POLICY IF EXISTS "admins read conversations" ON public.conversations;
CREATE POLICY "admins read conversations" ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS athlete_conversations_insert ON public.conversations;
CREATE POLICY athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = auth.uid())))) AND athlete_messageable_coach(coach_id)));

DROP POLICY IF EXISTS athlete_conversations_select ON public.conversations;
CREATE POLICY athlete_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS athlete_conversations_update ON public.conversations;
CREATE POLICY athlete_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO public
  USING (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = auth.uid()))))))
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS athlete_ra_conversations_select ON public.conversations;
CREATE POLICY athlete_ra_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS coach_athlete_conversations_insert ON public.conversations;
CREATE POLICY coach_athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'ATHLETE_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (coach_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND athlete_messageable_coach(auth.uid(), a.user_id))))));

DROP POLICY IF EXISTS coach_coach_conversations_insert ON public.conversations;
CREATE POLICY coach_coach_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'COACH_COACH'::conversation_type) AND (recruiter_id IS NULL) AND (parent_id IS NULL) AND (coach_id = auth.uid()) AND (coach_b_id IS NOT NULL) AND (coach_b_id <> auth.uid()) AND is_same_school_staff(auth.uid(), coach_b_id) AND ((athlete_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN school_coaches sc ON ((sc.school_id = a.school_id)))
  WHERE ((a.id = conversations.athlete_id) AND (sc.coach_id = auth.uid()) AND (sc.role = ANY (ARRAY['COACH'::coach_school_role, 'DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role]))))))));

DROP POLICY IF EXISTS coach_coach_conversations_select ON public.conversations;
CREATE POLICY coach_coach_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = auth.uid()) OR (coach_b_id = auth.uid()))));

DROP POLICY IF EXISTS coach_coach_conversations_update ON public.conversations;
CREATE POLICY coach_coach_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO public
  USING (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = auth.uid()) OR (coach_b_id = auth.uid()))))
  WITH CHECK (((conversation_type = 'COACH_COACH'::conversation_type) AND ((coach_id = auth.uid()) OR (coach_b_id = auth.uid()))));

DROP POLICY IF EXISTS coach_conversations_insert ON public.conversations;
CREATE POLICY coach_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type <> ALL (ARRAY['COACH_COACH'::conversation_type, 'RECRUTEUR_COACH'::conversation_type, 'PARENT_COACH'::conversation_type])) AND (coach_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.coach_id = auth.uid()))))));

DROP POLICY IF EXISTS coach_conversations_select ON public.conversations;
CREATE POLICY coach_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS coach_conversations_update ON public.conversations;
CREATE POLICY coach_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((coach_id = auth.uid()))
  WITH CHECK ((coach_id = auth.uid()));

DROP POLICY IF EXISTS coach_initiate_parent_coach ON public.conversations;
CREATE POLICY coach_initiate_parent_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'PARENT_COACH'::conversation_type) AND (coach_id = auth.uid()) AND (recruiter_id IS NULL) AND (coach_b_id IS NULL) AND (parent_id IS NOT NULL) AND (athlete_id IS NOT NULL) AND is_parent_link(parent_id, athlete_id) AND coach_reaches_athlete(auth.uid(), athlete_id)));

DROP POLICY IF EXISTS coach_initiate_recruteur_coach ON public.conversations;
CREATE POLICY coach_initiate_recruteur_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'RECRUTEUR_COACH'::conversation_type) AND (coach_id = auth.uid()) AND (recruiter_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = conversations.athlete_id) AND (a.coach_id = auth.uid())))) AND user_is_recruiter(recruiter_id)));

DROP POLICY IF EXISTS "conversations participants" ON public.conversations;
CREATE POLICY "conversations participants" ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((recruiter_id = auth.uid()) OR (coach_id = auth.uid())));

DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((recruiter_id = auth.uid()) AND (conversation_type = 'RECRUTEUR_COACH'::conversation_type) AND user_has_pro()));

DROP POLICY IF EXISTS parent_conversations_select ON public.conversations;
CREATE POLICY parent_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((parent_id = auth.uid()));

DROP POLICY IF EXISTS parent_conversations_update ON public.conversations;
CREATE POLICY parent_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((parent_id = auth.uid()))
  WITH CHECK ((parent_id = auth.uid()));

DROP POLICY IF EXISTS parent_initiate_parent_coach ON public.conversations;
CREATE POLICY parent_initiate_parent_coach ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'PARENT_COACH'::conversation_type) AND (parent_id = auth.uid()) AND (recruiter_id IS NULL) AND (coach_b_id IS NULL) AND (coach_id IS NOT NULL) AND (athlete_id IS NOT NULL) AND is_parent_of(athlete_id) AND coach_reaches_athlete(coach_id, athlete_id)));

DROP POLICY IF EXISTS recruiter_conversations_delete ON public.conversations;
CREATE POLICY recruiter_conversations_delete ON public.conversations AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_conversations_select ON public.conversations;
CREATE POLICY recruiter_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_conversations_update ON public.conversations;
CREATE POLICY recruiter_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((recruiter_id = auth.uid()))
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruteur_athlete_conversations_insert ON public.conversations;
CREATE POLICY recruteur_athlete_conversations_insert ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (recruiter_id = auth.uid()) AND (coach_id IS NULL) AND (parent_id IS NULL) AND (EXISTS ( SELECT 1
   FROM recruiter_favorites f
  WHERE ((f.recruiter_id = auth.uid()) AND (f.athlete_id = conversations.athlete_id)))) AND is_athlete_contactable(athlete_id)));

DROP POLICY IF EXISTS recruteur_athlete_conversations_select ON public.conversations;
CREATE POLICY recruteur_athlete_conversations_select ON public.conversations AS PERMISSIVE FOR SELECT TO public
  USING (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (recruiter_id = auth.uid())));

DROP POLICY IF EXISTS recruteur_athlete_conversations_update ON public.conversations;
CREATE POLICY recruteur_athlete_conversations_update ON public.conversations AS PERMISSIVE FOR UPDATE TO public
  USING (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND is_conversation_participant(id)))
  WITH CHECK (((conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND is_conversation_participant(id)));

DROP POLICY IF EXISTS "admins insert all" ON public.evaluations;
CREATE POLICY "admins insert all" ON public.evaluations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins read all" ON public.evaluations;
CREATE POLICY "admins read all" ON public.evaluations AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "admins update all" ON public.evaluations;
CREATE POLICY "admins update all" ON public.evaluations AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;
CREATE POLICY "authenticated read evaluations" ON public.evaluations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = auth.uid()) OR is_director_of_athlete_school(athlete_id) OR (is_recruiter() AND athlete_is_active(athlete_id)) OR (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = evaluations.athlete_id) AND (a.user_id = auth.uid())))) OR is_admin()));

DROP POLICY IF EXISTS "evaluations coach" ON public.evaluations;
CREATE POLICY "evaluations coach" ON public.evaluations AS PERMISSIVE FOR ALL TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "admins read messages" ON public.messages;
CREATE POLICY "admins read messages" ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS athlete_messages_insert ON public.messages;
CREATE POLICY athlete_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'ATHLETE_COACH'::conversation_type) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS athlete_messages_select ON public.messages;
CREATE POLICY athlete_messages_select ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS coach_coach_messages_insert ON public.messages;
CREATE POLICY coach_coach_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = auth.uid()) OR (c.coach_b_id = auth.uid())))))));

DROP POLICY IF EXISTS coach_coach_messages_select ON public.messages;
CREATE POLICY coach_coach_messages_select ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = auth.uid()) OR (c.coach_b_id = auth.uid()))))));

DROP POLICY IF EXISTS coach_coach_messages_update ON public.messages;
CREATE POLICY coach_coach_messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = auth.uid()) OR (c.coach_b_id = auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'COACH_COACH'::conversation_type) AND ((c.coach_id = auth.uid()) OR (c.coach_b_id = auth.uid()))))));

DROP POLICY IF EXISTS "messages participants" ON public.messages;
CREATE POLICY "messages participants" ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = auth.uid()) OR (conversations.coach_id = auth.uid())))));

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND ((( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = 'COACH'::user_role) OR ((( SELECT users.role
   FROM users
  WHERE (users.id = auth.uid())) = 'RECRUTEUR'::user_role) AND user_has_pro())) AND (EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.recruiter_id = auth.uid()) OR (conversations.coach_id = auth.uid())))))));

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = auth.uid()) OR (conversations.coach_id = auth.uid())))));

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO public
  USING ((conversation_id IN ( SELECT conversations.id
   FROM conversations
  WHERE ((conversations.recruiter_id = auth.uid()) OR (conversations.coach_id = auth.uid())))));

DROP POLICY IF EXISTS parent_messages_insert ON public.messages;
CREATE POLICY parent_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM conversations c
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'PARENT_COACH'::conversation_type) AND (c.parent_id = auth.uid()))))));

DROP POLICY IF EXISTS parent_messages_select ON public.messages;
CREATE POLICY parent_messages_select ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS parent_messages_update ON public.messages;
CREATE POLICY parent_messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_conversation_participant(conversation_id))
  WITH CHECK (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS ra_athlete_messages_insert ON public.messages;
CREATE POLICY ra_athlete_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = auth.uid()))))));

DROP POLICY IF EXISTS ra_athlete_messages_update ON public.messages;
CREATE POLICY ra_athlete_messages_update ON public.messages AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'RECRUTEUR_ATHLETE'::conversation_type) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS ra_messages_select ON public.messages;
CREATE POLICY ra_messages_select ON public.messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log;
CREATE POLICY "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Recruiters see their own activity" ON public.recruiter_activity_log;
CREATE POLICY "Recruiters see their own activity" ON public.recruiter_activity_log AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = auth.uid()))
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "admins insert recruiter_activity_log" ON public.recruiter_activity_log;
CREATE POLICY "admins insert recruiter_activity_log" ON public.recruiter_activity_log AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins read recruiter_activity_log" ON public.recruiter_activity_log;
CREATE POLICY "admins read recruiter_activity_log" ON public.recruiter_activity_log AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "cegep admin read activity_log" ON public.recruiter_activity_log;
CREATE POLICY "cegep admin read activity_log" ON public.recruiter_activity_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS "Athletes read own favorites" ON public.recruiter_favorites;
CREATE POLICY "Athletes read own favorites" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Coaches read favorites for their athletes" ON public.recruiter_favorites;
CREATE POLICY "Coaches read favorites for their athletes" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "admins read all" ON public.recruiter_favorites;
CREATE POLICY "admins read all" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "cegep admin insert favorites" ON public.recruiter_favorites;
CREATE POLICY "cegep admin insert favorites" ON public.recruiter_favorites AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS "cegep admin read favorites" ON public.recruiter_favorites;
CREATE POLICY "cegep admin read favorites" ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS "cegep admin update favorites" ON public.recruiter_favorites;
CREATE POLICY "cegep admin update favorites" ON public.recruiter_favorites AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_cegep_admin_over_recruiter(recruiter_id))
  WITH CHECK (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS recruiter_favorites_delete ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_delete ON public.recruiter_favorites AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_favorites_insert ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_insert ON public.recruiter_favorites AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((recruiter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role)))) AND (user_has_pro() OR ((get_user_tier() = 'free'::text) AND (count_user_favorites() < 10)))));

DROP POLICY IF EXISTS recruiter_favorites_select ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_select ON public.recruiter_favorites AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_favorites_update ON public.recruiter_favorites;
CREATE POLICY recruiter_favorites_update ON public.recruiter_favorites AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((recruiter_id = auth.uid()))
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "admins read all" ON public.recruiter_pipeline;
CREATE POLICY "admins read all" ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "admins update all" ON public.recruiter_pipeline;
CREATE POLICY "admins update all" ON public.recruiter_pipeline AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "cegep admin read pipeline" ON public.recruiter_pipeline;
CREATE POLICY "cegep admin read pipeline" ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS "cegep admin update pipeline" ON public.recruiter_pipeline;
CREATE POLICY "cegep admin update pipeline" ON public.recruiter_pipeline AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_cegep_admin_over_recruiter(recruiter_id))
  WITH CHECK (is_cegep_admin_over_recruiter(recruiter_id));

DROP POLICY IF EXISTS "coaches read pipeline for own athletes" ON public.recruiter_pipeline;
CREATE POLICY "coaches read pipeline for own athletes" ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS recruiter_pipeline_delete ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_delete ON public.recruiter_pipeline AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_pipeline_insert ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_insert ON public.recruiter_pipeline AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((recruiter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role)))) AND user_has_pro()));

DROP POLICY IF EXISTS recruiter_pipeline_select ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_select ON public.recruiter_pipeline AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_pipeline_update ON public.recruiter_pipeline;
CREATE POLICY recruiter_pipeline_update ON public.recruiter_pipeline AS PERMISSIVE FOR UPDATE TO public
  USING (((recruiter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role))))))
  WITH CHECK (((recruiter_id = auth.uid()) AND user_has_pro()));

DROP POLICY IF EXISTS "Coaches create civil schools" ON public.schools;
CREATE POLICY "Coaches create civil schools" ON public.schools AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((type = 'LIGUE_CIVILE'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'COACH'::user_role) AND (u.context = 'ligue_civile'::text))))));

DROP POLICY IF EXISTS "admins insert all" ON public.schools;
CREATE POLICY "admins insert all" ON public.schools AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins read all" ON public.schools;
CREATE POLICY "admins read all" ON public.schools AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "admins update all" ON public.schools;
CREATE POLICY "admins update all" ON public.schools AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "schools public read" ON public.schools;
CREATE POLICY "schools public read" ON public.schools AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Coaches lookup orphan athletes" ON public.users;
CREATE POLICY "Coaches lookup orphan athletes" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((is_coach() AND (role = 'ATHLETE'::user_role) AND (EXISTS ( SELECT 1
   FROM athletes
  WHERE ((athletes.user_id = users.id) AND (athletes.school_id IS NULL))))));

DROP POLICY IF EXISTS "Users read conversation participants" ON public.users;
CREATE POLICY "Users read conversation participants" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (((id = auth.uid()) OR (id IN ( SELECT conversations.recruiter_id
   FROM conversations
  WHERE (conversations.coach_id = auth.uid()))) OR (id IN ( SELECT conversations.coach_id
   FROM conversations
  WHERE (conversations.recruiter_id = auth.uid())))));

DROP POLICY IF EXISTS "admins insert users" ON public.users;
CREATE POLICY "admins insert users" ON public.users AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admins read all" ON public.users;
CREATE POLICY "admins read all" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (is_admin());

DROP POLICY IF EXISTS "admins update all" ON public.users;
CREATE POLICY "admins update all" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "authenticated read coaches" ON public.users;
CREATE POLICY "authenticated read coaches" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((role = 'COACH'::user_role));

DROP POLICY IF EXISTS "cegep admin read school recruiters" ON public.users;
CREATE POLICY "cegep admin read school recruiters" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (((role = 'RECRUTEUR'::user_role) AND (school_id = current_user_school_id()) AND is_cegep_admin()));

DROP POLICY IF EXISTS coach_reads_athlete_parent ON public.users;
CREATE POLICY coach_reads_athlete_parent ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (coach_reads_parent_user(id));

DROP POLICY IF EXISTS "coaches read recruiter directory" ON public.users;
CREATE POLICY "coaches read recruiter directory" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (((role = 'RECRUTEUR'::user_role) AND is_coach()));

DROP POLICY IF EXISTS "users read coaches at their school" ON public.users;
CREATE POLICY "users read coaches at their school" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING ((role = 'COACH'::user_role));

DROP POLICY IF EXISTS "users read own" ON public.users;
CREATE POLICY "users read own" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING ((id = auth.uid()));

DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((id = auth.uid()))
  WITH CHECK (((id = auth.uid()) AND user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)));


-- Indexes created by the migration (drop only if reverting them too):
DROP INDEX IF EXISTS public.idx_athletes_user_id;
DROP INDEX IF EXISTS public.idx_school_coaches_coach_id;
DROP INDEX IF EXISTS public.idx_conversations_coach_id;
DROP INDEX IF EXISTS public.idx_conversations_coach_b_id;
DROP INDEX IF EXISTS public.idx_conversations_recruiter_id;
DROP INDEX IF EXISTS public.idx_conversations_parent_id;
DROP INDEX IF EXISTS public.idx_messages_sender_id;
DROP INDEX IF EXISTS public.idx_recruiter_favorites_athlete_id;
DROP INDEX IF EXISTS public.idx_recruiter_pipeline_athlete_id;

-- ---------------------------------------------------------------------------
-- PASS 2 (20260727140000) additional revert: drop the two DEFINER helpers.
-- The CREATE POLICY statements above already restore users."Users read
-- conversation participants" and athletes."coaches read own athletes" to their
-- pristine inline-subquery form, so drop the helpers only AFTER those ran.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.user_shares_conversation(uuid);
DROP FUNCTION IF EXISTS public.coach_staffs_school(uuid);
