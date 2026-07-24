-- ═══════════════════════════════════════════════════════════════
-- P2 — Parent ↔ Coach messaging: DB half. HELD LOCAL, TRAIN-2.
-- Applied + proven locally; NOT applied to prod on the P1 flip. Rides
-- the P2 (train-2) flip-day batch. Additive / idempotent.
--
-- Read side is already free: is_conversation_participant() covers parent_id
-- (and keeps the CHILD out of PARENT_COACH threads). What this adds:
--   1. parent-initiate  conversation INSERT (parent → child's staff)
--   2. coach-initiate   conversation INSERT (coach → child's real parent) — GUARDED
--   3. parent SELECT / UPDATE on their PARENT_COACH conversations
--   4. parent messages SELECT / INSERT / UPDATE
--   5. notify_on_message push fan-out extended to parent_id
--
-- Decisions (BP): BOTH initiate; coach reach = ANY staff of the child's
-- school/club (athlete_messageable_coach → _messageable_staff_ids on the child).
-- ═══════════════════════════════════════════════════════════════

-- ── 0. DEFINER helper: is p_coach messageable staff of the athlete? ───────
--    Resolves the child's user_id INTERNALLY. Must be DEFINER + row_security
--    off: an inline (SELECT user_id FROM athletes WHERE id=…) inside a policy
--    WITH CHECK runs under the CALLER's RLS — a parent cannot SELECT the
--    athletes row, so the subquery would return NULL and the check would
--    wrongly fail. Wrapping it here bypasses caller RLS.
CREATE OR REPLACE FUNCTION public.coach_reaches_athlete(p_coach uuid, p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT public.athlete_messageable_coach(
    p_coach,
    (SELECT a.user_id FROM public.athletes a WHERE a.id = p_athlete_id)
  );
$function$;

-- ── 0b. DEFINER helper: is p_parent a linked parent of the athlete? ──────
--    Same reason: the coach-initiate policy must verify parent_id ∈ the
--    child's parents, but a coach cannot SELECT parent-scoped parent_athletes
--    rows under their own RLS. (is_parent_of only checks auth.uid().)
CREATE OR REPLACE FUNCTION public.is_parent_link(p_parent uuid, p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_athletes pa
    WHERE pa.athlete_id = p_athlete_id AND pa.parent_user_id = p_parent
  );
$function$;

-- ── 1. Parent initiates a thread about THEIR child, to a valid staff ──────
DROP POLICY IF EXISTS parent_initiate_parent_coach ON public.conversations;
CREATE POLICY parent_initiate_parent_coach ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_type = 'PARENT_COACH'
    AND parent_id = auth.uid()
    AND recruiter_id IS NULL AND coach_b_id IS NULL
    AND coach_id IS NOT NULL AND athlete_id IS NOT NULL
    AND public.is_parent_of(athlete_id)                 -- auth.uid() is a parent of the child
    AND public.coach_reaches_athlete(coach_id, athlete_id)  -- coach ∈ the child's messageable staff
  );

-- ── 2. Coach initiates a thread to the child's REAL parent (GUARDED) ──────
--    Mirror of the generic hole-fix: parent_id must be a real parent of the
--    child (parent_athletes), and the coach must be valid staff of the child.
DROP POLICY IF EXISTS coach_initiate_parent_coach ON public.conversations;
CREATE POLICY coach_initiate_parent_coach ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_type = 'PARENT_COACH'
    AND coach_id = auth.uid()
    AND recruiter_id IS NULL AND coach_b_id IS NULL
    AND parent_id IS NOT NULL AND athlete_id IS NOT NULL
    AND public.is_parent_link(parent_id, athlete_id)         -- parent_id is a REAL parent of the child
    AND public.coach_reaches_athlete(auth.uid(), athlete_id) -- coach ∈ the child's staff
  );

-- ── 3. Parent reads / updates their own PARENT_COACH conversations ────────
--    (Coach side already covered by "conversations participants" coach_id=self.)
DROP POLICY IF EXISTS parent_conversations_select ON public.conversations;
CREATE POLICY parent_conversations_select ON public.conversations
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

DROP POLICY IF EXISTS parent_conversations_update ON public.conversations;
CREATE POLICY parent_conversations_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

-- ── 4. Parent messages: SELECT / INSERT / UPDATE (mark-read) ──────────────
--    SELECT is technically already granted by athlete_messages_select
--    (is_conversation_participant, parent-aware) — added explicitly for
--    robustness so a future type-restriction there can't silently break it.
DROP POLICY IF EXISTS parent_messages_select ON public.messages;
CREATE POLICY parent_messages_select ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS parent_messages_insert ON public.messages;
CREATE POLICY parent_messages_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'PARENT_COACH'
        AND c.parent_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS parent_messages_update ON public.messages;
CREATE POLICY parent_messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id))
  WITH CHECK (public.is_conversation_participant(conversation_id));

-- ── 4b. Dedup: at most one PARENT_COACH thread per (parent, coach, child) ─
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_parent_coach
  ON public.conversations (parent_id, coach_id, athlete_id)
  WHERE conversation_type = 'PARENT_COACH';

-- ── 4c. Picker RPCs (DEFINER, row_security off) ───────────────────────────
-- Parent → the messageable staff of ONE of their children. Mirrors
-- list_messageable_staff() but keyed on a child athlete_id, gated by is_parent_of.
CREATE OR REPLACE FUNCTION public.list_messageable_staff_for_child(p_athlete_id uuid)
RETURNS TABLE(coach_id uuid, first_name text, last_name text, photo_url text, role_label text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  WITH ids AS (
    SELECT s.coach_id,
           bool_or(s.role IN ('DIRECTEUR','DIRECTEUR_INTERIM')) AS is_director
    FROM public._messageable_staff_ids(
           (SELECT a.user_id FROM public.athletes a WHERE a.id = p_athlete_id)
         ) s
    WHERE public.is_parent_of(p_athlete_id)   -- caller must be a parent of the child
    GROUP BY s.coach_id
  )
  SELECT u.id, u.first_name, u.last_name, u.photo_url,
         CASE WHEN ids.is_director THEN 'Directeur sportif' ELSE 'Entraîneur' END
  FROM ids JOIN public.users u ON u.id = ids.coach_id;
$function$;

-- Coach → the linked parent(s) of one of their reachable athletes. Gated by
-- coach_reaches_athlete (a coach cannot enumerate parents of arbitrary athletes).
CREATE OR REPLACE FUNCTION public.list_athlete_parents(p_athlete_id uuid)
RETURNS TABLE(parent_user_id uuid, first_name text, last_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT pa.parent_user_id, u.first_name, u.last_name
  FROM public.parent_athletes pa
  JOIN public.users u ON u.id = pa.parent_user_id
  WHERE pa.athlete_id = p_athlete_id
    AND public.coach_reaches_athlete(auth.uid(), p_athlete_id);
$function$;

-- ── 4d. Coach may READ the users row of a parent linked to a reachable ───
--    athlete — so the coach inbox / thread FK embeds resolve the parent's
--    NAME (otherwise blocked by users RLS → falls back to "Parent"). DEFINER
--    helper avoids the parent_athletes RLS wall a plain policy subquery hits.
CREATE OR REPLACE FUNCTION public.coach_reads_parent_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_athletes pa
    WHERE pa.parent_user_id = p_user_id
      AND public.coach_reaches_athlete(auth.uid(), pa.athlete_id)
  );
$function$;

DROP POLICY IF EXISTS coach_reads_athlete_parent ON public.users;
CREATE POLICY coach_reads_athlete_parent ON public.users
  FOR SELECT TO authenticated
  USING (public.coach_reads_parent_user(id));

-- ── 5. Push fan-out: include the parent (was omitted) ─────────────────────
--    notify_on_message cross-joined recruiter/coach/coach_b/athlete.user_id
--    but NOT parent_id → a PARENT_COACH message never pushed the parent.
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
        (c.parent_id),
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
