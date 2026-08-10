-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie P1 — Lot A (2/3) : RLS athlete↔coach (helpers SECURITY DEFINER)
--
-- Décisions produit (BP, verrouillées) :
--   • L'athlète peut INITIER une conversation avec N'IMPORTE QUEL coach/directeur
--     de son école OU club civil (source d'autorité = school_coaches ; filet
--     civil = team_coaches sur le league_team de l'athlète).
--   • PAS d'oversight directeur (D2 refusé) → conversations privées aux
--     participants. Aucune policy « école lit tout ». Seul l'admin plateforme
--     accède (via la table de rétraction, Lot 3).
--
-- SÛRETÉ : ADDITIF. On n'altère AUCUNE policy existante recruteur/coach ; on
-- AJOUTE des policies scopées `conversation_type='ATHLETE_COACH'`. Discipline :
-- checks via helpers SECURITY DEFINER, jamais de sous-requête `users` brute.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Helper 1 : participant d'une conversation (TYPE-AWARE) ────────────────
-- L'athlète n'est participant que pour les types athlète-inclusifs
-- (ATHLETE_COACH / RECRUTEUR_ATHLETE) — JAMAIS pour RECRUTEUR_COACH où il n'est
-- que le SUJET (sinon fuite : l'athlète lirait le fil privé recruteur↔coach).
CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  p_conv uuid, p_uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.athletes a ON a.id = c.athlete_id
    WHERE c.id = p_conv
      AND (
        p_uid = c.recruiter_id
        OR p_uid = c.coach_id
        OR p_uid = c.parent_id
        OR (c.conversation_type IN ('ATHLETE_COACH','RECRUTEUR_ATHLETE')
            AND p_uid = a.user_id)
      )
  );
$$;

-- ── Helper 2 : l'athlète appelant peut-il écrire à ce coach ? ─────────────
-- Vrai si p_coach est rattaché (school_coaches, hors PENDING) à l'école
-- effective de l'athlète — scolaire (athletes.school_id) OU club civil (école
-- LIGUE_CIVILE du team via teams.school_id) — OU coach direct de l'équipe
-- civile de l'athlète (team_coaches). Couvre écoles + clubs par la même règle.
CREATE OR REPLACE FUNCTION public.athlete_messageable_coach(
  p_coach uuid, p_uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.athletes a
    LEFT JOIN public.teams t ON t.id = a.league_team_id
    WHERE a.user_id = p_uid
      AND (
        EXISTS (
          SELECT 1 FROM public.school_coaches sc
          WHERE sc.coach_id = p_coach
            AND sc.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')  -- exclut PENDING
            AND sc.school_id = COALESCE(a.school_id, t.school_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.team_coaches tc
          WHERE tc.coach_id = p_coach AND tc.team_id = a.league_team_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.athlete_messageable_coach(uuid, uuid)   FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.athlete_messageable_coach(uuid, uuid)   TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- CONVERSATIONS — policies athlete↔coach (additives)
-- (Le coach lit/écrit déjà ses fils via `coach_conversations_select` +
--  `messages_insert` role=COACH, qui sont type-agnostiques → réutilisés tels
--  quels pour ATHLETE_COACH.)
-- ═══════════════════════════════════════════════════════════════════════

-- L'athlète lit ses conversations athlete↔coach.
CREATE POLICY "athlete_conversations_select" ON public.conversations
  FOR SELECT
  USING (
    conversation_type = 'ATHLETE_COACH'
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id AND a.user_id = auth.uid())
  );

-- L'athlète INITIE une conversation athlete↔coach vers un staff autorisé.
CREATE POLICY "athlete_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'ATHLETE_COACH'
    AND recruiter_id IS NULL
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id AND a.user_id = auth.uid())
    AND public.athlete_messageable_coach(coach_id)
  );

-- L'athlète met à jour SES conversations (ex. unread_count / last_message_at,
-- même flux applicatif que recruteur/coach). Pas de DELETE (immuable, décision BP).
CREATE POLICY "athlete_conversations_update" ON public.conversations
  FOR UPDATE
  USING (
    conversation_type = 'ATHLETE_COACH'
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id AND a.user_id = auth.uid())
  )
  WITH CHECK (
    conversation_type = 'ATHLETE_COACH'
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id AND a.user_id = auth.uid())
  );

-- Coach INITIE une conversation athlete↔coach avec un athlète de SON école/club.
-- (Symétrique de l'athlète ; réutilise athlete_messageable_coach du point de vue
--  inverse : le coach doit être rattaché à l'école/club de l'athlète.)
CREATE POLICY "coach_athlete_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'ATHLETE_COACH'
    AND recruiter_id IS NULL
    AND coach_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id
                  AND public.athlete_messageable_coach(auth.uid(), a.user_id))
  );

-- ═══════════════════════════════════════════════════════════════════════
-- MESSAGES — policies athlete↔coach (additives)
-- Le coach écrit/lit déjà via les policies existantes (role=COACH +
-- coach_id=auth.uid()). On AJOUTE le volet athlète.
-- ═══════════════════════════════════════════════════════════════════════

-- L'athlète lit les messages de ses fils athlete↔coach.
CREATE POLICY "athlete_messages_select" ON public.messages
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

-- L'athlète écrit (rôle ATHLETE, GRATUIT — pas de garde Pro) dans un fil
-- athlete↔coach où il est le participant athlète.
CREATE POLICY "athlete_messages_insert" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.athletes a ON a.id = c.athlete_id
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'ATHLETE_COACH'
        AND a.user_id = auth.uid()
    )
  );

-- NB : PAS de policy UPDATE athlète sur messages. Le mark-read passe par le RPC
-- public.mark_conversation_read (Lot 4/4, SECURITY DEFINER) → l'athlète n'a
-- AUCUN accès UPDATE direct à messages (registre immuable). Le trigger
-- trg_message_content_immutable (Lot 4/4) verrouille le contenu pour tous.
