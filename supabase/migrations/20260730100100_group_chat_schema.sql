-- ═══════════════════════════════════════════════════════════════
-- Phase A — Groupe chat réel. MIGRATION 2/3 : SCHÉMA (additif, inerte).
--
-- Additif : colonnes group_* NULLABLE, table conversation_participants,
-- messages.audience, helpers DEFINER, trigger d'estampille gardé sur GROUP.
-- Rien ne CRÉE de GROUP encore (le RPC vient en Phase 2) → inerte pour les
-- 5 types existants. Aucun binaire livré ne référence ces colonnes.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Colonnes GROUP sur conversations (nullable) ──────────────
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_scope     text,
  ADD COLUMN IF NOT EXISTS group_school_id uuid,
  ADD COLUMN IF NOT EXISTS group_team_id   uuid,
  ADD COLUMN IF NOT EXISTS group_name      text,
  ADD COLUMN IF NOT EXISTS owner_id        uuid;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_group_scope_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_group_scope_check
  CHECK (group_scope IS NULL OR group_scope IN ('STAFF','TEAM'));

-- ── 2. CHECK participants-par-type : + branche GROUP (5 existants verbatim) ──
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
      AND ( (group_scope = 'STAFF' AND group_school_id IS NOT NULL AND group_team_id IS NULL)
         OR (group_scope = 'TEAM'  AND group_team_id  IS NOT NULL AND group_school_id IS NULL) )
    )
    ELSE NULL::boolean
  END
);

-- find-or-create : un seul groupe par entité
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_staff ON public.conversations (group_school_id)
  WHERE conversation_type = 'GROUP' AND group_scope = 'STAFF';
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_team  ON public.conversations (group_team_id)
  WHERE conversation_type = 'GROUP' AND group_scope = 'TEAM';

-- ── 3. Table conversation_participants (membership matérialisée) ──
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  member_role     text NOT NULL CHECK (member_role IN ('STAFF','ATHLETE')),
  athlete_id      uuid,               -- renseigné si member_role = 'ATHLETE'
  last_read_at    timestamptz,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cp_user ON public.conversation_participants (user_id);
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- ── 4. messages.audience (visibilité asymétrique) ───────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'ALL';
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_audience_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_audience_check CHECK (audience IN ('ALL','STAFF'));

-- ── 5. Helpers DEFINER (opaques au planner, cassent la récursion RLS) ──
CREATE OR REPLACE FUNCTION public.is_group_participant(p_conv uuid, p_uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conv AND cp.user_id = p_uid
  );
$fn$;

CREATE OR REPLACE FUNCTION public.group_member_role(p_conv uuid, p_uid uuid)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $fn$
  SELECT cp.member_role FROM public.conversation_participants cp
  WHERE cp.conversation_id = p_conv AND cp.user_id = p_uid;
$fn$;

REVOKE ALL ON FUNCTION public.is_group_participant(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.group_member_role(uuid, uuid)   FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_group_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_member_role(uuid, uuid)   TO authenticated;

-- ── 6. Trigger d'estampille audience (BEFORE INSERT, gardé sur GROUP) ──
-- Positionnel → garde explicite conversation_type = 'GROUP' (checklist #5) :
-- inerte pour les 5 types existants. En GROUP TEAM, un envoi d'un membre
-- 'ATHLETE' devient 'STAFF' (réponse privée) ; tout le reste 'ALL'. Le client
-- ne peut PAS forcer audience — c'est ce trigger DEFINER qui décide.
CREATE OR REPLACE FUNCTION public.stamp_message_audience()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
DECLARE v_type public.conversation_type;
BEGIN
  SELECT conversation_type INTO v_type FROM public.conversations WHERE id = NEW.conversation_id;
  IF v_type = 'GROUP' THEN
    IF public.group_member_role(NEW.conversation_id, NEW.sender_id) = 'ATHLETE' THEN
      NEW.audience := 'STAFF';
    ELSE
      NEW.audience := 'ALL';
    END IF;
  ELSE
    NEW.audience := 'ALL';   -- non pertinent hors GROUP
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_stamp_message_audience ON public.messages;
CREATE TRIGGER trg_stamp_message_audience
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_message_audience();
