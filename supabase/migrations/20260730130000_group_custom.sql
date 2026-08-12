-- ═══════════════════════════════════════════════════════════════
-- Groupe chat — #2 : groupes CUSTOM (ad-hoc, composition libre).
--
-- Coach/directeur crée un groupe nommé avec une sélection libre d'athlètes
-- et/ou de coachs DE SON PÉRIMÈTRE (coach = ses athlètes + staff école ;
-- directeur = toute l'école). La visibilité suit la COMPOSITION : dès qu'un
-- participant est ATHLETE, ses réponses = staff seulement (le trigger + la RLS
-- existants s'appliquent tels quels à TOUT GROUP, quel que soit le scope).
--
-- Additif : nouveau scope 'CUSTOM' (group_school_id = école de scoping, PAS de
-- contrainte d'unicité → plusieurs customs possibles). RPC create_custom_group
-- (DEFINER) valide chaque membre contre le périmètre de l'expéditeur.
-- ═══════════════════════════════════════════════════════════════

-- 1. group_scope : + CUSTOM
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_group_scope_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_group_scope_check
  CHECK (group_scope IS NULL OR group_scope IN ('STAFF','TEAM','CUSTOM'));

-- 2. CHECK participants-par-type : branche GROUP += CUSTOM (5 types verbatim)
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_participants_by_type;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_participants_by_type CHECK (
  CASE conversation_type
    WHEN 'RECRUTEUR_COACH'::conversation_type  THEN ((recruiter_id IS NOT NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'ATHLETE_COACH'::conversation_type    THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'PARENT_COACH'::conversation_type     THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NOT NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'RECRUTEUR_ATHLETE'::conversation_type THEN ((recruiter_id IS NOT NULL) AND (coach_id IS NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'COACH_COACH'::conversation_type       THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (coach_b_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_id <> coach_b_id))
    WHEN 'GROUP'::conversation_type             THEN (
      (recruiter_id IS NULL) AND (coach_id IS NULL) AND (coach_b_id IS NULL) AND (parent_id IS NULL) AND (athlete_id IS NULL)
      AND (group_scope IS NOT NULL)
      AND ( (group_scope = 'STAFF'  AND group_school_id IS NOT NULL AND group_team_id IS NULL)
         OR (group_scope = 'TEAM'   AND group_team_id  IS NOT NULL AND group_school_id IS NULL)
         OR (group_scope = 'CUSTOM' AND group_school_id IS NOT NULL AND group_team_id IS NULL AND group_name IS NOT NULL) )
    )
    ELSE NULL::boolean
  END
);

-- 3. is_group_school_authority : CUSTOM scopé par group_school_id (comme STAFF)
CREATE OR REPLACE FUNCTION public.is_group_school_authority(p_conv uuid, p_uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.school_coaches sc ON sc.coach_id = p_uid
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role, 'DIRECTEUR_INTERIM'::public.coach_school_role)
    WHERE c.id = p_conv AND c.conversation_type = 'GROUP'
      AND ( (c.group_scope IN ('STAFF','CUSTOM') AND sc.school_id = c.group_school_id)
         OR (c.group_scope = 'TEAM' AND sc.school_id = (SELECT t.school_id FROM public.teams t WHERE t.id = c.group_team_id)) )
  );
$fn$;

-- 4. RPC create_custom_group
CREATE OR REPLACE FUNCTION public.create_custom_group(p_name text, p_member_ids uuid[])
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_sender uuid := auth.uid();
  v_school uuid;
  v_is_director boolean;
  v_conv uuid;
  v_seeded int := 0;
  m uuid;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF COALESCE(btrim(p_name), '') = '' THEN RAISE EXCEPTION 'group name required'; END IF;

  SELECT sc.school_id INTO v_school FROM public.school_coaches sc WHERE sc.coach_id = v_sender LIMIT 1;
  IF v_school IS NULL THEN RAISE EXCEPTION 'sender has no school'; END IF;
  v_is_director := EXISTS (
    SELECT 1 FROM public.school_coaches sc WHERE sc.coach_id = v_sender AND sc.school_id = v_school
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role, 'DIRECTEUR_INTERIM'::public.coach_school_role));

  INSERT INTO public.conversations (conversation_type, group_scope, group_school_id, group_name, owner_id, status, last_message_at)
    VALUES ('GROUP', 'CUSTOM', v_school, btrim(p_name), v_sender, 'ACTIVE', now())
    RETURNING id INTO v_conv;

  -- L'expéditeur = STAFF (créateur)
  INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
    VALUES (v_conv, v_sender, 'STAFF') ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Membres : seedés seulement s'ils sont DANS LE PÉRIMÈTRE de l'expéditeur.
  FOREACH m IN ARRAY COALESCE(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF m = v_sender THEN CONTINUE; END IF;
    -- (a) coach du même école → STAFF
    IF EXISTS (SELECT 1 FROM public.school_coaches sc WHERE sc.coach_id = m AND sc.school_id = v_school) THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id, member_role)
        VALUES (v_conv, m, 'STAFF') ON CONFLICT (conversation_id, user_id) DO NOTHING;
      v_seeded := v_seeded + 1;
    -- (b) athlète du périmètre (directeur = école ; coach = SES athlètes) → ATHLETE
    ELSIF EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.user_id = m AND a.status = 'ACTIF'
        AND ( (v_is_director AND a.school_id = v_school) OR (NOT v_is_director AND a.coach_id = v_sender) )
    ) THEN
      INSERT INTO public.conversation_participants (conversation_id, user_id, member_role, athlete_id)
        SELECT v_conv, m, 'ATHLETE', a.id FROM public.athletes a WHERE a.user_id = m LIMIT 1
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      v_seeded := v_seeded + 1;
    END IF;
    -- hors périmètre → ignoré (silencieux)
  END LOOP;

  RETURN jsonb_build_object('conversation_id', v_conv, 'seeded', v_seeded);
END;
$fn$;
REVOKE ALL ON FUNCTION public.create_custom_group(text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_custom_group(text, uuid[]) TO authenticated;
