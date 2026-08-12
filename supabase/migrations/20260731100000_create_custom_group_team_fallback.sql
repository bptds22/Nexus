-- Neutralité civile #2 : create_custom_group — branche coach += fallback team.
-- Sans coach_can_manage_athlete, un coach CIVIL (rattaché via team_coaches, athlète
-- lié via team_athletes, coach_id≠self) OU un assistant école perd les athlètes de
-- SON équipe. Prouvé par-rôle (coach non-proprio, AVANT seeded=0 → APRÈS seeded=1).
-- Appliqué prod le 2026-07-29 après preuve. Le corps complet du RPC est dans
-- 20260730130000_group_custom.sql ; ici on ne redéclare que la version corrigée.
CREATE OR REPLACE FUNCTION public.create_custom_group(p_name text, p_member_ids uuid[])
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_sender uuid := auth.uid(); v_school uuid; v_is_director boolean; v_conv uuid; v_seeded int := 0; m uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF COALESCE(btrim(p_name), '') = '' THEN RAISE EXCEPTION 'group name required'; END IF;
  SELECT sc.school_id INTO v_school FROM public.school_coaches sc WHERE sc.coach_id = v_sender LIMIT 1;
  IF v_school IS NULL THEN RAISE EXCEPTION 'sender has no school'; END IF;
  v_is_director := EXISTS (SELECT 1 FROM public.school_coaches sc WHERE sc.coach_id = v_sender AND sc.school_id = v_school
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role, 'DIRECTEUR_INTERIM'::public.coach_school_role));
  INSERT INTO public.conversations (conversation_type, group_scope, group_school_id, group_name, owner_id, status, last_message_at)
    VALUES ('GROUP', 'CUSTOM', v_school, btrim(p_name), v_sender, 'ACTIVE', now()) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
    VALUES (v_conv, v_sender, 'STAFF') ON CONFLICT (conversation_id, user_id) DO NOTHING;
  FOREACH m IN ARRAY COALESCE(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF m = v_sender THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.school_coaches sc WHERE sc.coach_id = m AND sc.school_id = v_school) THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
        VALUES (v_conv, m, 'STAFF') ON CONFLICT (conversation_id, user_id) DO NOTHING;
      v_seeded := v_seeded + 1;
    ELSIF EXISTS (
      SELECT 1 FROM public.athletes a WHERE a.user_id = m AND a.status = 'ACTIF'
        AND ( a.coach_id = v_sender OR public.coach_can_manage_athlete(a.id) OR (v_is_director AND a.school_id = v_school) )
    ) THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id, member_role, athlete_id)
        SELECT v_conv, m, 'ATHLETE', a.id FROM public.athletes a WHERE a.user_id = m LIMIT 1
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      v_seeded := v_seeded + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('conversation_id', v_conv, 'seeded', v_seeded);
END;
$fn$;
