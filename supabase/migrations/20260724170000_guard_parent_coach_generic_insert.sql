-- SECURITY GUARD (ships with the P1 messaging train — this is a hole-closure, not a P2 feature).
--
-- The generic coach_conversations_insert policy allowed any type EXCEPT
-- COACH_COACH/RECRUTEUR_COACH. Phase A added the PARENT_COACH type + parent_id
-- column + a per-type CHECK that only requires parent_id NOT NULL — it does NOT
-- constrain WHO parent_id is. So a coach could insert a PARENT_COACH row naming
-- an ARBITRARY user as the "parent" of one of their athletes, opening a channel
-- to any user (is_conversation_participant grants the named parent read access).
--
-- Fix: exclude PARENT_COACH from the generic insert. After this, PARENT_COACH is
-- unreachable from any policy (no parent-initiate/coach-initiate policy exists on
-- this train) — it stays fully locked until the P2 train adds the guarded policies
-- (parent_id constrained to parent_athletes, coach constrained to child's staff).
-- Nothing creates PARENT_COACH today (0 rows, no UI), so this breaks nothing live.
DROP POLICY IF EXISTS coach_conversations_insert ON public.conversations;
CREATE POLICY coach_conversations_insert ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    (conversation_type <> ALL (ARRAY[
       'COACH_COACH'::conversation_type,
       'RECRUTEUR_COACH'::conversation_type,
       'PARENT_COACH'::conversation_type
     ]))
    AND (coach_id = auth.uid())
    AND (EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = conversations.athlete_id AND a.coach_id = auth.uid()
    ))
  );
