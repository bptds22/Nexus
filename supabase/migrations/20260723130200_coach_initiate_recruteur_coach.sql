-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie — COACH INITIE vers RECRUTEUR (favoris-symétrique)
--
-- Un coach peut ouvrir un fil RECRUTEUR_COACH vers un recruteur QUI A MIS EN
-- FAVORI au moins un de ses athlètes — ancré sur CET athlète (favorisé + à lui).
-- Réutilise le type RECRUTEUR_COACH existant (recruiter_id + coach_id +
-- athlete_id NOT NULL) ; seule l'INITIATION côté coach est nouvelle.
--
-- SÛRETÉ (additif) :
--   • Le recruteur lit/répond via ses policies existantes (recruiter_*_select,
--     messages_insert Pro) — INCHANGÉ.
--   • Le coach écrit via messages_insert existant (role=COACH + coach_id=moi).
--   • On RESSERRE coach_conversations_insert pour exclure AUSSI RECRUTEUR_COACH :
--     cette policy type-agnostique (coach_id=moi + athlète à moi) accordait déjà
--     un RECRUTEUR_COACH vers N'IMPORTE QUEL recruteur → elle CONTOURNAIT le
--     favoris-gate. Après resserrage, le SEUL chemin coach→recruteur est la
--     policy favoris-gatée ci-dessous. (ATHLETE_COACH garde sa policy dédiée,
--     plus large — aucune capacité perdue.)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Helper : ce recruteur a-t-il favorisé cet athlète ? DEFINER (recruiter_favorites
--    est privé au recruteur en RLS → le coach ne peut pas le lire directement,
--    donc un EXISTS brut dans la policy renverrait toujours faux).
CREATE OR REPLACE FUNCTION public.recruiter_favorited_athlete(p_recruiter uuid, p_athlete uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recruiter_favorites f
    WHERE f.recruiter_id = p_recruiter AND f.athlete_id = p_athlete
  );
$$;
REVOKE ALL ON FUNCTION public.recruiter_favorited_athlete(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.recruiter_favorited_athlete(uuid, uuid) TO authenticated;

-- 2. Helper UI : recruteurs ayant favorisé un athlète du coach appelant, avec
--    l'athlète concerné (une ligne par paire recruteur×athlète). DEFINER pour
--    lire recruiter_favorites ; scopé aux athlètes du coach (coach_id=auth.uid()).
CREATE OR REPLACE FUNCTION public.list_interested_recruiters()
RETURNS TABLE (
  recruiter_id uuid, recruiter_first text, recruiter_last text,
  recruiter_photo text, cegep_name text,
  athlete_id uuid, athlete_first text, athlete_last text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ru.id, ru.first_name, ru.last_name,
         COALESCE(ru.photo_url, ru.avatar_url), s.name,
         a.id, a.first_name, a.last_name
  FROM public.recruiter_favorites f
  JOIN public.athletes a ON a.id = f.athlete_id
    AND a.coach_id = auth.uid() AND a.status = 'ACTIF'
  JOIN public.users ru ON ru.id = f.recruiter_id
  LEFT JOIN public.schools s ON s.id = ru.school_id
  ORDER BY ru.last_name NULLS LAST, a.last_name NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.list_interested_recruiters() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_interested_recruiters() TO authenticated;

-- 3. RESSERRE coach_conversations_insert : exclut RECRUTEUR_COACH (+ COACH_COACH
--    déjà exclu) → ferme le contournement du favoris-gate.
DROP POLICY IF EXISTS "coach_conversations_insert" ON public.conversations;
CREATE POLICY "coach_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type NOT IN ('COACH_COACH', 'RECRUTEUR_COACH')
    AND coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = conversations.athlete_id AND a.coach_id = auth.uid()
    )
  );

-- 4. Nouvelle policy : coach initie RECRUTEUR_COACH, favoris-symétrique.
--    Ancre = un athlète (a) à MOI et (b) favorisé par CE recruteur.
DROP POLICY IF EXISTS "coach_initiate_recruteur_coach" ON public.conversations;
CREATE POLICY "coach_initiate_recruteur_coach" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'RECRUTEUR_COACH'
    AND coach_id = auth.uid()
    AND recruiter_id IS NOT NULL
    AND parent_id IS NULL
    AND coach_b_id IS NULL
    AND athlete_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = conversations.athlete_id AND a.coach_id = auth.uid()
    )
    AND public.recruiter_favorited_athlete(recruiter_id, athlete_id)
  );
