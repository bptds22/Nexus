-- Loi 25 — Nexus-level settings singleton. One row (enforced via id=true
-- PRIMARY KEY + CHECK), holds the platform RPRP record (name / email /
-- nomination date). Per-school RPRPs are NOT stored here — they're the
-- is_school_admin=true director user on each school (read live; no
-- duplication into schools.rprp_* columns to avoid drift). Admin-only RLS.

CREATE TABLE public.loi25_settings (
  id              boolean     PRIMARY KEY DEFAULT true CHECK (id),
  rprp_name       text,
  rprp_email      text,
  rprp_named_at   date,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loi25_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage loi25_settings" ON public.loi25_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

INSERT INTO public.loi25_settings (id, rprp_name, rprp_email, rprp_named_at)
VALUES (true, 'Bruno-Philippe Desfosses Simard', 'confidentialite@nexussports.ca', '2026-01-01');
