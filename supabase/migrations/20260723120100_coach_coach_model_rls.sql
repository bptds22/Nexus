-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie P4 — COACH_COACH (2/2) : modèle + RLS
--
-- Coach↔coach de la MÊME école (directeurs inclus — un directeur est un coach
-- avec school_coaches.role=DIRECTEUR, AUCUN type dédié). Fil OPTIONNELLEMENT
-- rattaché à un athlète (contexte) ; sans athlète = fil staff simple.
--
-- SÛRETÉ (expand-only, additif) :
--   • Nouvelle colonne coach_b_id NULLABLE (aucune ligne existante affectée).
--   • athlete_id passe NOT NULL(colonne) → NULLABLE, MAIS le CHECK par type
--     ré-impose athlete_id NOT NULL pour les 4 types existants → ZÉRO changement
--     de comportement pour eux ; seul COACH_COACH tolère athlete_id NULL.
--   • Policies purement AJOUTÉES + une policy existante RESSERRÉE (jamais
--     élargie) : coach_conversations_insert exclut désormais COACH_COACH.
--   • Triggers recruteur déjà allowlistés RECRUTEUR_COACH → inertes.
--     Immutabilité/rétraction = triggers type-agnostiques → HÉRITÉS.
--
-- Idempotence : ré-appliquable (IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE). Voir docs/flip-day-ledger.md.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Second participant coach (réservé, motif parent_id) ───────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS coach_b_id uuid
    REFERENCES public.users(id) ON DELETE RESTRICT;

-- ── 2. Ancre athlète : colonne NULLABLE (ré-imposée par type au CHECK) ───
ALTER TABLE public.conversations
  ALTER COLUMN athlete_id DROP NOT NULL;

-- ── 3. Intégrité par type (réécriture : + athlete_id/coach_b_id par type) ─
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_participants_by_type;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_participants_by_type CHECK (
    CASE conversation_type
      WHEN 'RECRUTEUR_COACH'   THEN recruiter_id IS NOT NULL AND coach_id IS NOT NULL AND parent_id IS NULL     AND coach_b_id IS NULL AND athlete_id IS NOT NULL
      WHEN 'ATHLETE_COACH'     THEN recruiter_id IS NULL     AND coach_id IS NOT NULL AND parent_id IS NULL     AND coach_b_id IS NULL AND athlete_id IS NOT NULL
      WHEN 'PARENT_COACH'      THEN recruiter_id IS NULL     AND coach_id IS NOT NULL AND parent_id IS NOT NULL AND coach_b_id IS NULL AND athlete_id IS NOT NULL
      WHEN 'RECRUTEUR_ATHLETE' THEN recruiter_id IS NOT NULL AND coach_id IS NULL     AND parent_id IS NULL     AND coach_b_id IS NULL AND athlete_id IS NOT NULL
      WHEN 'COACH_COACH'       THEN recruiter_id IS NULL     AND coach_id IS NOT NULL AND coach_b_id IS NOT NULL AND parent_id IS NULL AND coach_id <> coach_b_id
      -- athlete_id : LIBRE pour COACH_COACH (rattachement optionnel)
    END
  ) NOT VALID;
ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_participants_by_type;

-- ── 4. Dé-doublonnage : une conversation par paire de coachs NON-ORDONNÉE
--       et par athlète (athlète NULL = créneau distinct via sentinelle). ──
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_coach_coach
  ON public.conversations (
    LEAST(coach_id, coach_b_id),
    GREATEST(coach_id, coach_b_id),
    COALESCE(athlete_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE conversation_type = 'COACH_COACH';

-- ── 5. Helper : deux coachs sont-ils staff (actif) d'une école commune ? ──
--       Directeurs inclus ; PENDING exclu. SECURITY DEFINER (lit school_coaches
--       hors RLS), jamais de sous-requête users brute côté policy.
CREATE OR REPLACE FUNCTION public.is_same_school_staff(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_coaches sa
    JOIN public.school_coaches sb ON sb.school_id = sa.school_id
    WHERE sa.coach_id = p_a
      AND sb.coach_id = p_b
      AND sa.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')
      AND sb.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')
  );
$$;
REVOKE ALL ON FUNCTION public.is_same_school_staff(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_same_school_staff(uuid, uuid) TO authenticated;

-- ── 6. is_conversation_participant : reconnaît coach_b_id ─────────────────
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
        OR p_uid = c.coach_b_id
        OR p_uid = c.parent_id
        OR (c.conversation_type IN ('ATHLETE_COACH','RECRUTEUR_ATHLETE')
            AND p_uid = a.user_id)
      )
  );
$$;

-- ── 7. notify_on_message : éventaille aussi vers coach_b_id ───────────────
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
declare
  v_secret text;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
  r record;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'PUSH_DISPATCH_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_on_message: PUSH_DISPATCH_SECRET absent du Vault';
      return null;
    end if;

    for r in
      select p.user_id
      from public.conversations c
      cross join lateral (values
        (c.recruiter_id),
        (c.coach_id),
        (c.coach_b_id),
        ((select a.user_id from public.athletes a where a.id = c.athlete_id))
      ) as p(user_id)
      where c.id = NEW.conversation_id
        and p.user_id is not null
        and p.user_id <> NEW.sender_id
    loop
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-secret', v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'title', 'Nexus',
          'body', 'Tu as un nouveau message',
          'data', jsonb_build_object(
            'type', 'message',
            'conversation_id', NEW.conversation_id
          )
        )
      );
    end loop;

  exception when others then
    raise warning 'notify_on_message a échoué pour message %: %', NEW.id, SQLERRM;
  end;

  return null; -- AFTER trigger : retour ignoré
end;
$function$;

-- ── 8. RESSERRE coach_conversations_insert (ferme le trou COACH_COACH) ────
--       Cette policy type-agnostique accordait un INSERT dès que coach_id=moi
--       ET l'athlète m'appartient — SANS valider coach_b_id ni l'école du
--       destinataire. En rattachant l'un de MES athlètes, un coach aurait pu
--       créer un COACH_COACH vers un coach d'une AUTRE école. On l'exclut de
--       COACH_COACH (seule la policy dédiée ci-dessous accorde ce type).
DROP POLICY IF EXISTS "coach_conversations_insert" ON public.conversations;
CREATE POLICY "coach_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type <> 'COACH_COACH'
    AND coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = conversations.athlete_id AND a.coach_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 9. POLICIES COACH_COACH (additives)
-- ═══════════════════════════════════════════════════════════════════════

-- INITIATEUR crée le fil : destinataire = staff (actif) de la même école.
-- Athlète rattaché (optionnel) : doit être d'une école où l'initiateur est staff.
DROP POLICY IF EXISTS "coach_coach_conversations_insert" ON public.conversations;
CREATE POLICY "coach_coach_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'COACH_COACH'
    AND recruiter_id IS NULL
    AND parent_id IS NULL
    AND coach_id = auth.uid()
    AND coach_b_id IS NOT NULL
    AND coach_b_id <> auth.uid()
    AND public.is_same_school_staff(auth.uid(), coach_b_id)
    AND (
      athlete_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.athletes a
        JOIN public.school_coaches sc ON sc.school_id = a.school_id
        WHERE a.id = conversations.athlete_id
          AND sc.coach_id = auth.uid()
          AND sc.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')
      )
    )
  );

-- Les DEUX participants lisent le fil.
DROP POLICY IF EXISTS "coach_coach_conversations_select" ON public.conversations;
CREATE POLICY "coach_coach_conversations_select" ON public.conversations
  FOR SELECT
  USING (
    conversation_type = 'COACH_COACH'
    AND (coach_id = auth.uid() OR coach_b_id = auth.uid())
  );

-- Les DEUX participants mettent à jour (unread_count / last_message_at).
DROP POLICY IF EXISTS "coach_coach_conversations_update" ON public.conversations;
CREATE POLICY "coach_coach_conversations_update" ON public.conversations
  FOR UPDATE
  USING (
    conversation_type = 'COACH_COACH'
    AND (coach_id = auth.uid() OR coach_b_id = auth.uid())
  )
  WITH CHECK (
    conversation_type = 'COACH_COACH'
    AND (coach_id = auth.uid() OR coach_b_id = auth.uid())
  );

-- MESSAGES — lecture par les deux participants.
DROP POLICY IF EXISTS "coach_coach_messages_select" ON public.messages;
CREATE POLICY "coach_coach_messages_select" ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'COACH_COACH'
        AND (c.coach_id = auth.uid() OR c.coach_b_id = auth.uid())
    )
  );

-- MESSAGES — écriture par les deux participants (GRATUIT, aucune garde Pro).
DROP POLICY IF EXISTS "coach_coach_messages_insert" ON public.messages;
CREATE POLICY "coach_coach_messages_insert" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'COACH_COACH'
        AND (c.coach_id = auth.uid() OR c.coach_b_id = auth.uid())
    )
  );

-- MESSAGES — mark-read (UPDATE) par les deux participants. Le CONTENU reste
-- immuable via trg_message_content_immutable (type-agnostique) → seul read_at
-- est modifiable.
DROP POLICY IF EXISTS "coach_coach_messages_update" ON public.messages;
CREATE POLICY "coach_coach_messages_update" ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'COACH_COACH'
        AND (c.coach_id = auth.uid() OR c.coach_b_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'COACH_COACH'
        AND (c.coach_id = auth.uid() OR c.coach_b_id = auth.uid())
    )
  );
