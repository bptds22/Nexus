-- REVERT KIT — original (bare auth.uid()) bodies of the 155 policies wrapped by
-- the RLS initplan apply (prod, 2026-07-27), captured PRE-APPLY from live catalog.
-- Rollback = run this file (each DROP+CREATE restores the exact original). Indexes:
-- DROP INDEX IF EXISTS the idx_* created by the apply.

DROP POLICY IF EXISTS "Athletes read own views" ON public._deprecated_profile_views_2026_05;
CREATE POLICY "Athletes read own views" ON public._deprecated_profile_views_2026_05 AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Coaches read views for their athletes" ON public._deprecated_profile_views_2026_05;
CREATE POLICY "Coaches read views for their athletes" ON public._deprecated_profile_views_2026_05 AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Recruiters insert views" ON public._deprecated_profile_views_2026_05;
CREATE POLICY "Recruiters insert views" ON public._deprecated_profile_views_2026_05 AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS admin_claims_admin_select ON public.admin_claims;
CREATE POLICY admin_claims_admin_select ON public.admin_claims AS PERMISSIVE FOR SELECT TO public
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS admin_claims_admin_update ON public.admin_claims;
CREATE POLICY admin_claims_admin_update ON public.admin_claims AS PERMISSIVE FOR UPDATE TO public
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS admin_claims_user_insert_own ON public.admin_claims;
CREATE POLICY admin_claims_user_insert_own ON public.admin_claims AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS admin_claims_user_select_own ON public.admin_claims;
CREATE POLICY admin_claims_user_select_own ON public.admin_claims AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS transfer_from_insert ON public.admin_transfer_requests;
CREATE POLICY transfer_from_insert ON public.admin_transfer_requests AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((from_user_id = auth.uid()));

DROP POLICY IF EXISTS transfer_involved_read ON public.admin_transfer_requests;
CREATE POLICY transfer_involved_read ON public.admin_transfer_requests AS PERMISSIVE FOR SELECT TO public
  USING (((from_user_id = auth.uid()) OR (to_user_id = auth.uid())));

DROP POLICY IF EXISTS "Coaches read own athlete invitations" ON public.athlete_invitations;
CREATE POLICY "Coaches read own athlete invitations" ON public.athlete_invitations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((created_by = auth.uid()) OR is_admin()));

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

DROP POLICY IF EXISTS "Athletes can read own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes can read own suggestions" ON public.athlete_suggestions AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Athletes insert own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes insert own suggestions" ON public.athlete_suggestions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS "Authenticated users update suggestions" ON public.athlete_suggestions;
CREATE POLICY "Authenticated users update suggestions" ON public.athlete_suggestions AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));

DROP POLICY IF EXISTS "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Athletes manage own targets" ON public.athlete_targets;
CREATE POLICY "Athletes manage own targets" ON public.athlete_targets AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = athlete_targets.athlete_id) AND (a.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = athlete_targets.athlete_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Approved partners read opted-in athletes" ON public.athletes;
CREATE POLICY "Approved partners read opted-in athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO public
  USING (((partner_visibility_opt_in = true) AND is_approved_partner(auth.uid())));

DROP POLICY IF EXISTS "athletes can claim own orphan match" ON public.athletes;
CREATE POLICY "athletes can claim own orphan match" ON public.athletes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id IS NULL) AND (email IS NOT NULL) AND (lower(email) = lower(current_user_email()))))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "athletes can insert own profile" ON public.athletes;
CREATE POLICY "athletes can insert own profile" ON public.athletes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = auth.uid()));

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

DROP POLICY IF EXISTS "blackout admin write" ON public.blackout_periods;
CREATE POLICY "blackout admin write" ON public.blackout_periods AS PERMISSIVE FOR ALL TO public
  USING (is_platform_admin(auth.uid()))
  WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS broadcast_sender_read ON public.broadcasts;
CREATE POLICY broadcast_sender_read ON public.broadcasts AS PERMISSIVE FOR SELECT TO authenticated
  USING ((sender_id = auth.uid()));

DROP POLICY IF EXISTS coach_own_career_prefs ON public.coach_career_preferences;
CREATE POLICY coach_own_career_prefs ON public.coach_career_preferences AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Coaches can read own notifications" ON public.coach_notifications;
CREATE POLICY "Coaches can read own notifications" ON public.coach_notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "Coaches can update own notifications" ON public.coach_notifications;
CREATE POLICY "Coaches can update own notifications" ON public.coach_notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((coach_id = auth.uid()))
  WITH CHECK ((coach_id = auth.uid()));

DROP POLICY IF EXISTS coach_read_reviews ON public.coach_reviews;
CREATE POLICY coach_read_reviews ON public.coach_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_insert_reviews ON public.coach_reviews;
CREATE POLICY recruiter_insert_reviews ON public.coach_reviews AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_read_reviews ON public.coach_reviews;
CREATE POLICY recruiter_read_reviews ON public.coach_reviews AS PERMISSIVE FOR SELECT TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_update_reviews ON public.coach_reviews;
CREATE POLICY recruiter_update_reviews ON public.coach_reviews AS PERMISSIVE FOR UPDATE TO public
  USING ((recruiter_id = auth.uid()));

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

DROP POLICY IF EXISTS "Coaches can delete their custom distinctions" ON public.custom_distinctions;
CREATE POLICY "Coaches can delete their custom distinctions" ON public.custom_distinctions AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = coach_id));

DROP POLICY IF EXISTS "Coaches can insert custom distinctions" ON public.custom_distinctions;
CREATE POLICY "Coaches can insert custom distinctions" ON public.custom_distinctions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = coach_id));

DROP POLICY IF EXISTS "deletion_requests own" ON public.deletion_requests;
CREATE POLICY "deletion_requests own" ON public.deletion_requests AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS device_tokens_delete_own ON public.device_tokens;
CREATE POLICY device_tokens_delete_own ON public.device_tokens AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS device_tokens_select_own ON public.device_tokens;
CREATE POLICY device_tokens_select_own ON public.device_tokens AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;
CREATE POLICY "authenticated read evaluations" ON public.evaluations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = auth.uid()) OR is_director_of_athlete_school(athlete_id) OR (is_recruiter() AND athlete_is_active(athlete_id)) OR (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = evaluations.athlete_id) AND (a.user_id = auth.uid())))) OR is_admin()));

DROP POLICY IF EXISTS "evaluations coach" ON public.evaluations;
CREATE POLICY "evaluations coach" ON public.evaluations AS PERMISSIVE FOR ALL TO authenticated
  USING ((coach_id = auth.uid()))
  WITH CHECK ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "Users invite from their own school" ON public.invitations;
CREATE POLICY "Users invite from their own school" ON public.invitations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((invited_by = auth.uid()) AND (status = 'PENDING'::invitation_status) AND ((school_id IS NULL) OR (school_id = current_user_school_id()))));

DROP POLICY IF EXISTS "Users read their own invitations" ON public.invitations;
CREATE POLICY "Users read their own invitations" ON public.invitations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((invited_by = auth.uid()) OR (consumed_by_user_id = auth.uid()) OR is_admin()));

DROP POLICY IF EXISTS "Users revoke their own pending invitations" ON public.invitations;
CREATE POLICY "Users revoke their own pending invitations" ON public.invitations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((((invited_by = auth.uid()) AND (status = 'PENDING'::invitation_status)) OR is_admin()))
  WITH CHECK ((((invited_by = auth.uid()) AND (status = 'REVOKED'::invitation_status)) OR is_admin()));

DROP POLICY IF EXISTS "Partners read own profile" ON public.media_partners;
CREATE POLICY "Partners read own profile" ON public.media_partners AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners update own profile" ON public.media_partners;
CREATE POLICY "Partners update own profile" ON public.media_partners AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK (((user_id = auth.uid()) AND partner_privileged_cols_unchanged(status, show_on_homepage)));

DROP POLICY IF EXISTS "message_retractions admin read" ON public.message_retractions;
CREATE POLICY "message_retractions admin read" ON public.message_retractions AS PERMISSIVE FOR SELECT TO public
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS athlete_messages_insert ON public.messages;
CREATE POLICY athlete_messages_insert ON public.messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (conversations c
     JOIN athletes a ON ((a.id = c.athlete_id)))
  WHERE ((c.id = messages.conversation_id) AND (c.conversation_type = 'ATHLETE_COACH'::conversation_type) AND (a.user_id = auth.uid()))))));

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

DROP POLICY IF EXISTS "Approved partners read eligible newsroom events" ON public.newsroom_events;
CREATE POLICY "Approved partners read eligible newsroom events" ON public.newsroom_events AS PERMISSIVE FOR SELECT TO public
  USING ((is_approved_partner(auth.uid()) AND ((athlete_id IS NULL) OR is_partner_eligible_athlete(athlete_id))));

DROP POLICY IF EXISTS "Platform admins read all newsroom events" ON public.newsroom_events;
CREATE POLICY "Platform admins read all newsroom events" ON public.newsroom_events AS PERMISSIVE FOR SELECT TO public
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS user_own_notif_prefs ON public.notification_preferences;
CREATE POLICY user_own_notif_prefs ON public.notification_preferences AS PERMISSIVE FOR ALL TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "parent reads own link" ON public.parent_athletes;
CREATE POLICY "parent reads own link" ON public.parent_athletes AS PERMISSIVE FOR SELECT TO public
  USING ((parent_user_id = auth.uid()));

DROP POLICY IF EXISTS "parent reads own notifications" ON public.parent_notifications;
CREATE POLICY "parent reads own notifications" ON public.parent_notifications AS PERMISSIVE FOR SELECT TO public
  USING ((parent_user_id = auth.uid()));

DROP POLICY IF EXISTS "parent updates own notifications" ON public.parent_notifications;
CREATE POLICY "parent updates own notifications" ON public.parent_notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((parent_user_id = auth.uid()))
  WITH CHECK ((parent_user_id = auth.uid()));

DROP POLICY IF EXISTS "Athletes read their own card downloads" ON public.partner_card_downloads;
CREATE POLICY "Athletes read their own card downloads" ON public.partner_card_downloads AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Partners log own downloads" ON public.partner_card_downloads;
CREATE POLICY "Partners log own downloads" ON public.partner_card_downloads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((partner_id IN ( SELECT media_partners.id
   FROM media_partners
  WHERE ((media_partners.user_id = auth.uid()) AND (media_partners.status = 'APPROVED'::text)))));

DROP POLICY IF EXISTS "Partners read own download history" ON public.partner_card_downloads;
CREATE POLICY "Partners read own download history" ON public.partner_card_downloads AS PERMISSIVE FOR SELECT TO public
  USING ((partner_id IN ( SELECT media_partners.id
   FROM media_partners
  WHERE (media_partners.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Athletes read their own profile views" ON public.partner_profile_views;
CREATE POLICY "Athletes read their own profile views" ON public.partner_profile_views AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Partners log own views" ON public.partner_profile_views;
CREATE POLICY "Partners log own views" ON public.partner_profile_views AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((partner_id IN ( SELECT media_partners.id
   FROM media_partners
  WHERE ((media_partners.user_id = auth.uid()) AND (media_partners.status = 'APPROVED'::text)))));

DROP POLICY IF EXISTS "Partners read own view history" ON public.partner_profile_views;
CREATE POLICY "Partners read own view history" ON public.partner_profile_views AS PERMISSIVE FOR SELECT TO public
  USING ((partner_id IN ( SELECT media_partners.id
   FROM media_partners
  WHERE (media_partners.user_id = auth.uid()))));

DROP POLICY IF EXISTS "pipeline own" ON public.pipeline;
CREATE POLICY "pipeline own" ON public.pipeline AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "recruiters can delete pipeline" ON public.pipeline;
CREATE POLICY "recruiters can delete pipeline" ON public.pipeline AS PERMISSIVE FOR DELETE TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "recruiters can insert pipeline" ON public.pipeline;
CREATE POLICY "recruiters can insert pipeline" ON public.pipeline AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "recruiters can read own pipeline" ON public.pipeline;
CREATE POLICY "recruiters can read own pipeline" ON public.pipeline AS PERMISSIVE FOR SELECT TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "recruiters can update pipeline" ON public.pipeline;
CREATE POLICY "recruiters can update pipeline" ON public.pipeline AS PERMISSIVE FOR UPDATE TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log;
CREATE POLICY "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Recruiters see their own activity" ON public.recruiter_activity_log;
CREATE POLICY "Recruiters see their own activity" ON public.recruiter_activity_log AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = auth.uid()))
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "Coaches read views for their athletes" ON public.recruiter_athlete_views;
CREATE POLICY "Coaches read views for their athletes" ON public.recruiter_athlete_views AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.coach_id = auth.uid()))));

DROP POLICY IF EXISTS "Recruiters manage own views" ON public.recruiter_athlete_views;
CREATE POLICY "Recruiters manage own views" ON public.recruiter_athlete_views AS PERMISSIVE FOR ALL TO public
  USING (((auth.uid() = recruiter_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role))))))
  WITH CHECK (((auth.uid() = recruiter_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role))))));

DROP POLICY IF EXISTS "athletes read own views" ON public.recruiter_athlete_views;
CREATE POLICY "athletes read own views" ON public.recruiter_athlete_views AS PERMISSIVE FOR SELECT TO public
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "rcn admin read" ON public.recruiter_contact_notifications;
CREATE POLICY "rcn admin read" ON public.recruiter_contact_notifications AS PERMISSIVE FOR SELECT TO public
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "rcn coach read own" ON public.recruiter_contact_notifications;
CREATE POLICY "rcn coach read own" ON public.recruiter_contact_notifications AS PERMISSIVE FOR SELECT TO public
  USING (((notified_role = 'COACH'::text) AND (notified_ref = (auth.uid())::text)));

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

DROP POLICY IF EXISTS recruiter_list_members_delete ON public.recruiter_list_members;
CREATE POLICY recruiter_list_members_delete ON public.recruiter_list_members AS PERMISSIVE FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM recruiter_lists
  WHERE ((recruiter_lists.id = recruiter_list_members.list_id) AND (recruiter_lists.recruiter_id = auth.uid())))));

DROP POLICY IF EXISTS recruiter_list_members_insert ON public.recruiter_list_members;
CREATE POLICY recruiter_list_members_insert ON public.recruiter_list_members AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_has_pro() AND (EXISTS ( SELECT 1
   FROM recruiter_lists
  WHERE ((recruiter_lists.id = recruiter_list_members.list_id) AND (recruiter_lists.recruiter_id = auth.uid()))))));

DROP POLICY IF EXISTS recruiter_list_members_select ON public.recruiter_list_members;
CREATE POLICY recruiter_list_members_select ON public.recruiter_list_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM recruiter_lists
  WHERE ((recruiter_lists.id = recruiter_list_members.list_id) AND (recruiter_lists.recruiter_id = auth.uid())))));

DROP POLICY IF EXISTS "Recruiters manage their own list notes" ON public.recruiter_list_notes;
CREATE POLICY "Recruiters manage their own list notes" ON public.recruiter_list_notes AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = auth.uid()))
  WITH CHECK ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_lists_delete ON public.recruiter_lists;
CREATE POLICY recruiter_lists_delete ON public.recruiter_lists AS PERMISSIVE FOR DELETE TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_lists_insert ON public.recruiter_lists;
CREATE POLICY recruiter_lists_insert ON public.recruiter_lists AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((recruiter_id = auth.uid()) AND user_has_pro()));

DROP POLICY IF EXISTS recruiter_lists_select ON public.recruiter_lists;
CREATE POLICY recruiter_lists_select ON public.recruiter_lists AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS recruiter_lists_update ON public.recruiter_lists;
CREATE POLICY recruiter_lists_update ON public.recruiter_lists AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((recruiter_id = auth.uid()))
  WITH CHECK (((recruiter_id = auth.uid()) AND user_has_pro()));

DROP POLICY IF EXISTS "Recruiters manage own notes" ON public.recruiter_notes;
CREATE POLICY "Recruiters manage own notes" ON public.recruiter_notes AS PERMISSIVE FOR ALL TO public
  USING (((auth.uid() = recruiter_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role))))))
  WITH CHECK (((auth.uid() = recruiter_id) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role))))));

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

DROP POLICY IF EXISTS "recruiter_preferences own" ON public.recruiter_preferences;
CREATE POLICY "recruiter_preferences own" ON public.recruiter_preferences AS PERMISSIVE FOR ALL TO public
  USING ((recruiter_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can submit athlete reports" ON public.reports;
CREATE POLICY "Authenticated users can submit athlete reports" ON public.reports AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((reported_by_id = auth.uid()) AND (status = 'OUVERT'::text) AND (target_type = 'athlete'::text) AND (type = 'PROFIL'::text)));

DROP POLICY IF EXISTS "Users can read their own filed reports" ON public.reports;
CREATE POLICY "Users can read their own filed reports" ON public.reports AS PERMISSIVE FOR SELECT TO authenticated
  USING ((reported_by_id = auth.uid()));

DROP POLICY IF EXISTS "Coaches insert school_coaches" ON public.school_coaches;
CREATE POLICY "Coaches insert school_coaches" ON public.school_coaches AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((coach_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM school_coaches sc_dir
  WHERE ((sc_dir.coach_id = auth.uid()) AND (sc_dir.school_id = school_coaches.school_id) AND (sc_dir.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role])))))));

DROP POLICY IF EXISTS coach_read_own ON public.school_coaches;
CREATE POLICY coach_read_own ON public.school_coaches AS PERMISSIVE FOR SELECT TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS coach_update_own ON public.school_coaches;
CREATE POLICY coach_update_own ON public.school_coaches AS PERMISSIVE FOR UPDATE TO public
  USING ((coach_id = auth.uid()));

DROP POLICY IF EXISTS "Admin coaches can update their school" ON public.school_registry;
CREATE POLICY "Admin coaches can update their school" ON public.school_registry AS PERMISSIVE FOR UPDATE TO public
  USING ((claimed_by = auth.uid()));

DROP POLICY IF EXISTS "Coaches create civil schools" ON public.schools;
CREATE POLICY "Coaches create civil schools" ON public.schools AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((type = 'LIGUE_CIVILE'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'COACH'::user_role) AND (u.context = 'ligue_civile'::text))))));

DROP POLICY IF EXISTS "subscriptions own" ON public.subscriptions;
CREATE POLICY "subscriptions own" ON public.subscriptions AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Athletes read own team rows" ON public.team_athletes;
CREATE POLICY "Athletes read own team rows" ON public.team_athletes AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = team_athletes.athlete_id) AND (a.user_id = auth.uid())))));

DROP POLICY IF EXISTS "Athletes self-assign to school team" ON public.team_athletes;
CREATE POLICY "Athletes self-assign to school team" ON public.team_athletes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = team_athletes.athlete_id) AND (a.user_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM (teams t
     JOIN athletes a ON ((a.id = team_athletes.athlete_id)))
  WHERE ((t.id = team_athletes.team_id) AND (t.school_id = a.school_id))))));

DROP POLICY IF EXISTS "Coaches manage own team athletes" ON public.team_athletes;
CREATE POLICY "Coaches manage own team athletes" ON public.team_athletes AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.team_id = team_athletes.team_id) AND (tc.coach_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.team_id = team_athletes.team_id) AND (tc.coach_id = auth.uid())))));

DROP POLICY IF EXISTS "Directors manage school team athletes" ON public.team_athletes;
CREATE POLICY "Directors manage school team athletes" ON public.team_athletes AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN school_coaches sc ON ((sc.school_id = t.school_id)))
  WHERE ((t.id = team_athletes.team_id) AND (sc.coach_id = auth.uid()) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (teams t
     JOIN school_coaches sc ON ((sc.school_id = t.school_id)))
  WHERE ((t.id = team_athletes.team_id) AND (sc.coach_id = auth.uid()) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role]))))));

DROP POLICY IF EXISTS "Recruiters read own target team rows" ON public.team_athletes;
CREATE POLICY "Recruiters read own target team rows" ON public.team_athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'RECRUTEUR'::user_role)))) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = team_athletes.athlete_id) AND (a.status = 'ACTIF'::account_status)))) AND ((EXISTS ( SELECT 1
   FROM recruiter_pipeline rp
  WHERE ((rp.recruiter_id = auth.uid()) AND (rp.athlete_id = team_athletes.athlete_id)))) OR (EXISTS ( SELECT 1
   FROM recruiter_favorites rf
  WHERE ((rf.recruiter_id = auth.uid()) AND (rf.athlete_id = team_athletes.athlete_id)))) OR (EXISTS ( SELECT 1
   FROM (recruiter_list_members rlm
     JOIN recruiter_lists rl ON ((rl.id = rlm.list_id)))
  WHERE ((rl.recruiter_id = auth.uid()) AND (rlm.athlete_id = team_athletes.athlete_id)))))));

DROP POLICY IF EXISTS "Recruiters read verified team athletes" ON public.team_athletes;
CREATE POLICY "Recruiters read verified team athletes" ON public.team_athletes AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'RECRUTEUR'::user_role)))) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.id = team_athletes.athlete_id) AND (a.verified = true) AND (a.status = 'ACTIF'::account_status))))));

DROP POLICY IF EXISTS "team_coaches scoped delete" ON public.team_coaches;
CREATE POLICY "team_coaches scoped delete" ON public.team_coaches AS PERMISSIVE FOR DELETE TO authenticated
  USING (((coach_id = auth.uid()) OR is_director_of_team_school(team_id) OR is_admin()));

DROP POLICY IF EXISTS "team_coaches scoped insert" ON public.team_coaches;
CREATE POLICY "team_coaches scoped insert" ON public.team_coaches AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((coach_id = auth.uid()) OR is_director_of_team_school(team_id)));

DROP POLICY IF EXISTS "team_coaches scoped select" ON public.team_coaches;
CREATE POLICY "team_coaches scoped select" ON public.team_coaches AS PERMISSIVE FOR SELECT TO public
  USING (((coach_id = auth.uid()) OR (team_id IN ( SELECT t.id
   FROM teams t
  WHERE (t.school_id IN ( SELECT users.school_id
           FROM users
          WHERE (users.id = auth.uid()))))) OR is_admin()));

DROP POLICY IF EXISTS "team_coaches scoped update" ON public.team_coaches;
CREATE POLICY "team_coaches scoped update" ON public.team_coaches AS PERMISSIVE FOR UPDATE TO public
  USING (((team_id IN ( SELECT t.id
   FROM teams t
  WHERE (t.school_id IN ( SELECT users.school_id
           FROM users
          WHERE (users.id = auth.uid()))))) OR is_admin()))
  WITH CHECK (((team_id IN ( SELECT t.id
   FROM teams t
  WHERE (t.school_id IN ( SELECT users.school_id
           FROM users
          WHERE (users.id = auth.uid()))))) OR is_admin()));

DROP POLICY IF EXISTS "Athletes select own invitations" ON public.team_invitations;
CREATE POLICY "Athletes select own invitations" ON public.team_invitations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))));

DROP POLICY IF EXISTS "Athletes update own invitations" ON public.team_invitations;
CREATE POLICY "Athletes update own invitations" ON public.team_invitations AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))))
  WITH CHECK (((athlete_id IN ( SELECT athletes.id
   FROM athletes
  WHERE (athletes.user_id = auth.uid()))) AND (status = ANY (ARRAY['ACCEPTED'::text, 'REJECTED'::text]))));

DROP POLICY IF EXISTS "Coaches cancel own invitations" ON public.team_invitations;
CREATE POLICY "Coaches cancel own invitations" ON public.team_invitations AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.coach_id = auth.uid()) AND (tc.team_id = team_invitations.team_id)))) OR (EXISTS ( SELECT 1
   FROM (school_coaches sc
     JOIN teams t ON ((t.school_id = sc.school_id)))
  WHERE ((sc.coach_id = auth.uid()) AND (t.id = team_invitations.team_id) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role])))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.coach_id = auth.uid()) AND (tc.team_id = team_invitations.team_id)))) OR (EXISTS ( SELECT 1
   FROM (school_coaches sc
     JOIN teams t ON ((t.school_id = sc.school_id)))
  WHERE ((sc.coach_id = auth.uid()) AND (t.id = team_invitations.team_id) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role])))))));

DROP POLICY IF EXISTS "Coaches insert invitations on own teams" ON public.team_invitations;
CREATE POLICY "Coaches insert invitations on own teams" ON public.team_invitations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.coach_id = auth.uid()) AND (tc.team_id = team_invitations.team_id)))) OR (EXISTS ( SELECT 1
   FROM (school_coaches sc
     JOIN teams t ON ((t.school_id = sc.school_id)))
  WHERE ((sc.coach_id = auth.uid()) AND (t.id = team_invitations.team_id) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role])))))));

DROP POLICY IF EXISTS "Coaches select invitations on own teams" ON public.team_invitations;
CREATE POLICY "Coaches select invitations on own teams" ON public.team_invitations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM team_coaches tc
  WHERE ((tc.coach_id = auth.uid()) AND (tc.team_id = team_invitations.team_id)))) OR (EXISTS ( SELECT 1
   FROM (school_coaches sc
     JOIN teams t ON ((t.school_id = sc.school_id)))
  WHERE ((sc.coach_id = auth.uid()) AND (t.id = team_invitations.team_id) AND (sc.role = ANY (ARRAY['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role])))))));

DROP POLICY IF EXISTS "Recruiters see teams" ON public.teams;
CREATE POLICY "Recruiters see teams" ON public.teams AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'RECRUTEUR'::user_role)))));

DROP POLICY IF EXISTS "Users read conversation participants" ON public.users;
CREATE POLICY "Users read conversation participants" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (((id = auth.uid()) OR (id IN ( SELECT conversations.recruiter_id
   FROM conversations
  WHERE (conversations.coach_id = auth.uid()))) OR (id IN ( SELECT conversations.coach_id
   FROM conversations
  WHERE (conversations.recruiter_id = auth.uid())))));

DROP POLICY IF EXISTS "users read own" ON public.users;
CREATE POLICY "users read own" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING ((id = auth.uid()));

DROP POLICY IF EXISTS "users update own" ON public.users;
CREATE POLICY "users update own" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((id = auth.uid()))
  WITH CHECK (((id = auth.uid()) AND user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)));
