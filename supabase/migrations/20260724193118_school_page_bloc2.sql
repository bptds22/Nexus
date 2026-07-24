-- ============================================================================
-- Bloc 2 — « Ma page » CÉGEP : schéma éditeur + page publique
-- Basé sur l'éditeur v3 (source de vérité). featured / parcours_free_text N'EXISTENT PAS.
-- save=live (pas de draft/publish) ; POST-modération (colonnes *_status).
-- Écriture = RECRUTEURS + DIRECTEURS (is_school_admin) du collège + platform admin
--   (DIRECTEUR n'est PAS un rôle enum → directeurs = is_school_admin).
-- Lecture = authenticated ; service role pour le seed.
-- Miroir de la migration appliquée (version ledger 20260724193118 = ce fichier).
-- ============================================================================

-- ── helper d'édition (pattern current_user_school_id : definer + row_security off) ──
CREATE OR REPLACE FUNCTION public.can_edit_school_page(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND (u.is_platform_admin
        OR (u.school_id = p_school_id AND (u.role = 'RECRUTEUR' OR u.is_school_admin)))
  );
$$;

-- ── cap générique « max N lignes par école » ──
CREATE OR REPLACE FUNCTION public._cap_rows_per_school() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE lim int := TG_ARGV[0]::int; cnt int;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE school_id = $1', TG_TABLE_NAME)
    INTO cnt USING NEW.school_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'Maximum % lignes par école (table %)', lim, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

-- ── a) CONTENU DE PAGE (1:1 schools) ──
CREATE TABLE public.school_page_content (
  school_id      uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  nickname       text CHECK (char_length(nickname) <= 14),
  slogan         text CHECK (char_length(slogan) <= 40),
  tagline        text CHECK (char_length(tagline) <= 20),
  province       text NOT NULL DEFAULT 'Québec',
  ville          text CHECK (char_length(ville) <= 18),
  quartier       text CHECK (char_length(quartier) <= 18),
  code_regional  text CHECK (char_length(code_regional) <= 4),
  initiales      text CHECK (char_length(initiales) <= 3),
  rail_word      text CHECK (char_length(rail_word) <= 12),
  devise_1       text CHECK (char_length(devise_1) <= 8),
  devise_2       text CHECK (char_length(devise_2) <= 8),
  arrow_avant    text CHECK (char_length(arrow_avant) <= 10),
  arrow_apres    text CHECK (char_length(arrow_apres) <= 10),
  wall_words     jsonb NOT NULL DEFAULT '[]'::jsonb
                 CHECK (jsonb_typeof(wall_words) = 'array' AND jsonb_array_length(wall_words) <= 4),
  wall_words_status text NOT NULL DEFAULT 'approved' CHECK (wall_words_status IN ('approved','flagged','removed')),
  ticker_text    text CHECK (char_length(ticker_text) <= 60),
  color_primary  text NOT NULL DEFAULT '#A6192E' CHECK (color_primary ~ '^#[0-9A-Fa-f]{6}$'),
  color_dark     text NOT NULL DEFAULT '#5A0E1B' CHECK (color_dark    ~ '^#[0-9A-Fa-f]{6}$'),
  color_light    text NOT NULL DEFAULT '#E8C7CD' CHECK (color_light   ~ '^#[0-9A-Fa-f]{6}$'),
  nb_athletes    text CHECK (char_length(nb_athletes) <= 6),
  about_title    text CHECK (char_length(about_title) <= 40),
  sell_text      text CHECK (char_length(sell_text) <= 280),
  sell_text_status text NOT NULL DEFAULT 'approved' CHECK (sell_text_status IN ('approved','flagged','removed')),
  niveau         text CHECK (char_length(niveau) <= 30),
  encadrement    jsonb NOT NULL DEFAULT '[]'::jsonb,
  stat_usports   integer,
  stat_usa       integer,
  stat_diplomation integer CHECK (stat_diplomation BETWEEN 0 AND 100),
  universities   jsonb NOT NULL DEFAULT '[]'::jsonb,
  logo_path      text,
  campus_video_url text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id)
);

-- ── b) CARTES CAMPUS (max 5) ──
CREATE TABLE public.school_campus_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  image_path text,
  titre   text NOT NULL CHECK (char_length(titre) <= 24),
  legende text CHECK (char_length(legende) <= 90),
  position integer NOT NULL DEFAULT 0,
  status  text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','flagged','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX school_campus_cards_school_pos_idx ON public.school_campus_cards (school_id, position);
CREATE TRIGGER trg_cap_campus_cards BEFORE INSERT ON public.school_campus_cards
  FOR EACH ROW EXECUTE FUNCTION public._cap_rows_per_school('5');

-- ── c) PROGRAMMES (reçoit le seed) — dédup INSENSIBLE À LA CASSE ──
CREATE TABLE public.school_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  type text CHECK (type IN ('preuniversitaire','technique')),
  is_displayed boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manuel' CHECK (source IN ('seed','manuel')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX school_programs_school_lname_uidx ON public.school_programs (school_id, lower(name));
CREATE INDEX school_programs_displayed_idx ON public.school_programs (school_id) WHERE is_displayed;

-- ── d) NEWS (max 5) ──
CREATE TABLE public.school_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  titre text NOT NULL CHECK (char_length(titre) <= 80),
  url text,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','flagged','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_cap_news BEFORE INSERT ON public.school_news
  FOR EACH ROW EXECUTE FUNCTION public._cap_rows_per_school('5');

-- ── e) athlete_targets : EXISTE DÉJÀ → unicité additive ──
CREATE UNIQUE INDEX IF NOT EXISTS athlete_targets_athlete_school_uidx
  ON public.athlete_targets (athlete_id, school_id);

-- ── f) COMPTEURS AUTO (definer + row_security off = compte global) ──
CREATE OR REPLACE FUNCTION public.count_recruited_by_school(p_school_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT count(DISTINCT p.athlete_id)::int
  FROM public.recruiter_pipeline p
  JOIN public.users r ON r.id = p.recruiter_id
  WHERE r.school_id = p_school_id AND p.stage IN ('ENGAGE','LETTRE_SIGNEE');
$$;
CREATE OR REPLACE FUNCTION public.count_followers_by_school(p_school_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT count(*)::int FROM public.athlete_targets WHERE school_id = p_school_id;
$$;

-- ── g) RLS : lecture authenticated ; écriture via can_edit_school_page ──
ALTER TABLE public.school_page_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_campus_cards  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_programs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_news          ENABLE ROW LEVEL SECURITY;

CREATE POLICY page_content_read ON public.school_page_content FOR SELECT TO authenticated USING (true);
CREATE POLICY page_content_write ON public.school_page_content FOR ALL TO authenticated
  USING (public.can_edit_school_page(school_id)) WITH CHECK (public.can_edit_school_page(school_id));

CREATE POLICY campus_cards_read ON public.school_campus_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY campus_cards_write ON public.school_campus_cards FOR ALL TO authenticated
  USING (public.can_edit_school_page(school_id)) WITH CHECK (public.can_edit_school_page(school_id));

CREATE POLICY programs_read ON public.school_programs FOR SELECT TO authenticated USING (true);
CREATE POLICY programs_write ON public.school_programs FOR ALL TO authenticated
  USING (public.can_edit_school_page(school_id)) WITH CHECK (public.can_edit_school_page(school_id));

CREATE POLICY news_read ON public.school_news FOR SELECT TO authenticated USING (true);
CREATE POLICY news_write ON public.school_news FOR ALL TO authenticated
  USING (public.can_edit_school_page(school_id)) WITH CHECK (public.can_edit_school_page(school_id));

-- ── h) STORAGE : buckets public read, écriture scopée collège ──
INSERT INTO storage.buckets (id, name, public) VALUES
  ('school-logos','school-logos', true),
  ('campus-photos','campus-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Convention de nommage : {school_id}/fichier — Loi 25 : AUCUN mineur identifiable
-- dans les images publiques (garde applicative + modération).
CREATE POLICY "ma_page assets read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('school-logos','campus-photos'));
CREATE POLICY "ma_page assets insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('school-logos','campus-photos')
    AND public.can_edit_school_page(NULLIF((storage.foldername(name))[1],'')::uuid));
CREATE POLICY "ma_page assets update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('school-logos','campus-photos')
    AND public.can_edit_school_page(NULLIF((storage.foldername(name))[1],'')::uuid));
CREATE POLICY "ma_page assets delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('school-logos','campus-photos')
    AND public.can_edit_school_page(NULLIF((storage.foldername(name))[1],'')::uuid));
