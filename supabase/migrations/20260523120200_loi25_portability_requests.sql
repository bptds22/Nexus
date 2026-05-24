-- Manual tracker for Loi 25 user-rights requests (access / portability /
-- rectification / deletion). The deadline is a stored generated column
-- (submitted_at + 30 days — Loi 25's 30-day SLA) so the UI computes
-- days-remaining without any client-side date math. Admin-only.

CREATE TABLE public.loi25_portability_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  requester_name  text        NOT NULL,
  requester_email text,
  request_type    text        NOT NULL CHECK (request_type IN ('access','portability','rectification','deletion')),
  submitted_at    date        NOT NULL DEFAULT current_date,
  deadline        date        GENERATED ALWAYS AS (submitted_at + 30) STORED,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_progress','fulfilled','refused')),
  fulfilled_at    date,
  notes           text,
  created_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loi25_portability_status_deadline ON public.loi25_portability_requests (status, deadline);

ALTER TABLE public.loi25_portability_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage loi25_portability" ON public.loi25_portability_requests
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
