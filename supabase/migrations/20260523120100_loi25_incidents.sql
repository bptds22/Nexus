-- Manual admin registry for confidentiality incidents (Loi 25 Art. 3.5-3.8
-- + CAI notification tracking). The admin records what happened — no
-- automation, no triggers, no external integration. Admin-only RLS.

CREATE TABLE public.loi25_incidents (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date_incident         date        NOT NULL,
  severity              text        NOT NULL CHECK (severity IN ('Faible','Moyenne','Élevée','Critique')),
  type                  text,
  description           text,
  affected_users_count  integer     NOT NULL DEFAULT 0,
  cause                 text,
  containment           text,
  school_id             uuid        REFERENCES public.schools(id) ON DELETE SET NULL,
  cai_notified          boolean     NOT NULL DEFAULT false,
  cai_notified_at       timestamptz,
  status                text        NOT NULL DEFAULT 'OPEN'
                                    CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  created_by            uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loi25_incidents_date ON public.loi25_incidents (date_incident DESC);

ALTER TABLE public.loi25_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage loi25_incidents" ON public.loi25_incidents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
