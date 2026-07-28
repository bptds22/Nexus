-- ═══════════════════════════════════════════════════════════════
-- Phase A — Groupe chat. Phase 2 : RPC create_group (DEFINER).
--
-- Crée (ou retrouve) LE groupe d'une entité + seed conversation_participants
-- selon l'AUTORITÉ LÉGALE (même résolution de roster que send_broadcast —
-- mineur-safety). Idempotent (re-seed = reconcile roster). Find-or-create via
-- les index uniques uq_group_staff / uq_group_team.
--   audience = { kind:'team', team_id }        → GROUP TEAM (staff + athlètes)
--            | { kind:'all_coaches' }          → GROUP STAFF (tous les coachs de l'école)
-- Retourne { conversation_id, created }.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_group(p_audience jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
DECLARE
  v_sender  uuid := auth.uid();
  v_kind    text := p_audience->>'kind';
  v_conv    uuid;
  v_created boolean := false;
  v_school  uuid;
  v_team    uuid;
  v_name    text;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  -- ── GROUP STAFF (tous les coachs de l'école de l'expéditeur) ──
  IF v_kind = 'all_coaches' THEN
    SELECT sc.school_id INTO v_school FROM public.school_coaches sc WHERE sc.coach_id = v_sender LIMIT 1;
    IF v_school IS NULL THEN RAISE EXCEPTION 'sender has no school'; END IF;
    SELECT s.name INTO v_name FROM public.schools s WHERE s.id = v_school;

    SELECT id INTO v_conv FROM public.conversations
      WHERE conversation_type = 'GROUP' AND group_scope = 'STAFF' AND group_school_id = v_school;
    IF v_conv IS NULL THEN
      INSERT INTO public.conversations (conversation_type, group_scope, group_school_id, group_name, owner_id, status, last_message_at)
        VALUES ('GROUP', 'STAFF', v_school, 'Staff — ' || COALESCE(v_name, 'École'), v_sender, 'ACTIVE', now())
        RETURNING id INTO v_conv;
      v_created := true;
    END IF;

    -- seed / reconcile : tous les coachs de l'école = STAFF
    INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
      SELECT v_conv, sc.coach_id, 'STAFF' FROM public.school_coaches sc WHERE sc.school_id = v_school
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- ── GROUP TEAM (hybride : staff + athlètes de l'équipe) ──
  ELSIF v_kind = 'team' THEN
    v_team := (p_audience->>'team_id')::uuid;
    IF v_team IS NULL THEN RAISE EXCEPTION 'team_id required'; END IF;
    -- Autorité : l'expéditeur doit être coach de l'équipe OU de son école.
    IF NOT EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = v_team AND tc.coach_id = v_sender)
       AND NOT EXISTS (
         SELECT 1 FROM public.teams t JOIN public.school_coaches sc ON sc.school_id = t.school_id
         WHERE t.id = v_team AND sc.coach_id = v_sender)
    THEN RAISE EXCEPTION 'not authorized for this team'; END IF;

    SELECT name INTO v_name FROM public.teams WHERE id = v_team;

    SELECT id INTO v_conv FROM public.conversations
      WHERE conversation_type = 'GROUP' AND group_scope = 'TEAM' AND group_team_id = v_team;
    IF v_conv IS NULL THEN
      INSERT INTO public.conversations (conversation_type, group_scope, group_team_id, group_name, owner_id, status, last_message_at)
        VALUES ('GROUP', 'TEAM', v_team, COALESCE(v_name, 'Équipe'), v_sender, 'ACTIVE', now())
        RETURNING id INTO v_conv;
      v_created := true;
    END IF;

    -- staff de l'équipe = STAFF
    INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
      SELECT v_conv, tc.coach_id, 'STAFF' FROM public.team_coaches tc WHERE tc.team_id = v_team
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    -- athlètes actifs de l'équipe AYANT un compte user = ATHLETE
    INSERT INTO public.conversation_participants (conversation_id, user_id, member_role, athlete_id)
      SELECT v_conv, a.user_id, 'ATHLETE', a.id
      FROM public.team_athletes ta
      JOIN public.athletes a ON a.id = ta.athlete_id AND a.status = 'ACTIF' AND a.user_id IS NOT NULL
      WHERE ta.team_id = v_team
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

  ELSE
    RAISE EXCEPTION 'unknown audience kind: %', v_kind;
  END IF;

  RETURN jsonb_build_object('conversation_id', v_conv, 'created', v_created);
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_group(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_group(jsonb) TO authenticated;
