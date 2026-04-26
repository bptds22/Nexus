-- ═══════════════════════════════════════════════════════════════
-- coach_notifications + interim director demotion trigger
-- ═══════════════════════════════════════════════════════════════
--
-- When a DIRECTEUR is appointed at a school where a DIRECTEUR_INTERIM
-- already exists, the interim is demoted to COACH and notified.
--
-- The notification table mirrors athlete_notifications structure for
-- consistency. The trigger fires on AFTER INSERT OR UPDATE of
-- school_coaches.role, only when the role transitions INTO 'DIRECTEUR'
-- (not on every update of an already-DIRECTEUR row).

-- ── 1. coach_notifications table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT,
  metadata     JSONB,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the common dashboard query: unread, recent first
CREATE INDEX IF NOT EXISTS coach_notifications_coach_unread_idx
  ON public.coach_notifications (coach_id, created_at DESC)
  WHERE read = false;

-- Enable RLS
ALTER TABLE public.coach_notifications ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own notifications
CREATE POLICY "Coaches can read own notifications"
  ON public.coach_notifications
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Coaches can mark their own notifications as read
CREATE POLICY "Coaches can update own notifications"
  ON public.coach_notifications
  FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Inserts come from triggers (SECURITY DEFINER), not from clients.
-- No client INSERT policy — clients cannot create notifications directly.

-- ── 2. demote_interim_on_director_appointment() function ─────────

CREATE OR REPLACE FUNCTION public.demote_interim_on_director_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interim_record RECORD;
  v_director_name TEXT;
  v_school_name TEXT;
BEGIN
  -- Only fire on transition INTO 'DIRECTEUR'
  -- (not on inserts where someone is already DIRECTEUR but the row is new,
  -- and not on updates that don't change role)
  IF NEW.role <> 'DIRECTEUR' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only proceed if role actually changed to DIRECTEUR
  IF TG_OP = 'UPDATE' AND OLD.role = 'DIRECTEUR' THEN
    RETURN NEW;
  END IF;

  -- Find any existing DIRECTEUR_INTERIM at the same school (excluding this row)
  -- Note: school_coaches uses coach_id (not user_id) — verified against live schema
  FOR v_interim_record IN
    SELECT sc.id, sc.coach_id, u.first_name, u.last_name
    FROM public.school_coaches sc
    JOIN public.users u ON u.id = sc.coach_id
    WHERE sc.school_id = NEW.school_id
      AND sc.role = 'DIRECTEUR_INTERIM'
      AND sc.id <> NEW.id
  LOOP
    -- Demote the interim to COACH
    UPDATE public.school_coaches
    SET role = 'COACH'
    WHERE id = v_interim_record.id;

    -- Resolve names for the notification message
    SELECT first_name || ' ' || last_name INTO v_director_name
    FROM public.users
    WHERE id = NEW.coach_id;

    SELECT name INTO v_school_name
    FROM public.schools
    WHERE id = NEW.school_id;

    -- Write a notification for the demoted interim
    INSERT INTO public.coach_notifications (coach_id, type, title, message, metadata)
    VALUES (
      v_interim_record.coach_id,
      'INTERIM_DEMOTED',
      'Ton rôle de directeur intérimaire a pris fin',
      COALESCE(v_director_name, 'Un directeur officiel') ||
        ' est maintenant directeur sportif de ' ||
        COALESCE(v_school_name, 'l''école') ||
        '. Ton rôle a été ramené à entraîneur.',
      jsonb_build_object(
        'school_id', NEW.school_id,
        'school_name', v_school_name,
        'new_director_user_id', NEW.coach_id,
        'new_director_name', v_director_name,
        'demoted_at', now()
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 3. Attach the trigger ────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_demote_interim_on_director_appointment
  ON public.school_coaches;

CREATE TRIGGER trg_demote_interim_on_director_appointment
  AFTER INSERT OR UPDATE OF role ON public.school_coaches
  FOR EACH ROW
  EXECUTE FUNCTION public.demote_interim_on_director_appointment();

-- ── 4. Verify ────────────────────────────────────────────────────

-- Confirm table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'coach_notifications'
  ) THEN
    RAISE EXCEPTION 'coach_notifications table not created';
  END IF;
END $$;

-- Confirm trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_demote_interim_on_director_appointment'
  ) THEN
    RAISE EXCEPTION 'demotion trigger not created';
  END IF;
END $$;
