-- ============================================================================
-- « Page équipe » CÉGEP — schéma éditeur + page publique (jumeau de Ma page)
-- Basé sur docs/reference/editeur-page-equipe-mock.html
--   sha256 271f6734c1ac02b3a252c2628c3a23dcb4c48e82c7c447b22589ad8998eb6ae0
-- Conventions reprises de 20260724193118_school_page_bloc2.sql :
--   save=live (pas de draft/publish) ; POST-modération (colonnes *_status,
--   défaut 'approved') ; écriture = RECRUTEURS + is_school_admin du collège
--   + platform admin ; lecture = authenticated ; service role pour le seed.
-- AUCUN seed des 7 943 teams : les défauts besoins vivent dans le CODE
--   (SPORT_CONFIGS + public.positions) et se matérialisent au 1er save.
-- Miroir VERSION-EXACTE de la migration appliquée (ledger 20260727134226).
-- ============================================================================

-- ── 0) Helper d'édition — délègue à can_edit_school_page via teams.school_id ──
CREATE OR REPLACE FUNCTION public.can_edit_team_page(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND public.can_edit_school_page(t.school_id)
  );
$$;

-- ── 0bis) Cap générique « max N lignes par équipe » ──
CREATE OR REPLACE FUNCTION public._cap_rows_per_team() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE lim int := TG_ARGV[0]::int; cnt int;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE team_id = $1', TG_TABLE_NAME)
    INTO cnt USING NEW.team_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'Maximum % lignes par équipe (table %)', lim, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

-- ── a) CONTENU DE PAGE (1:1 teams) ──
CREATE TABLE public.team_page_content (
  team_id          uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  hero_image_path  text,
  hero_focal_x     smallint NOT NULL DEFAULT 50  CHECK (hero_focal_x BETWEEN 0 AND 100),
  hero_focal_y     smallint NOT NULL DEFAULT 25  CHECK (hero_focal_y BETWEEN 0 AND 100),
  hero_zoom        smallint NOT NULL DEFAULT 100 CHECK (hero_zoom  BETWEEN 100 AND 220),
  record_saison    text CHECK (char_length(record_saison)  <= 7),
  playoff_result   text CHECK (char_length(playoff_result) <= 30),
  use_school_socials boolean NOT NULL DEFAULT true,
  socials          jsonb NOT NULL DEFAULT '[]'::jsonb
                   CHECK (jsonb_typeof(socials) = 'array'),
  presentation_text        text CHECK (char_length(presentation_text) <= 280),
  presentation_text_status text NOT NULL DEFAULT 'approved'
                           CHECK (presentation_text_status IN ('approved','flagged','removed')),
  championships    smallint CHECK (championships BETWEEN 0 AND 99),
  staff_since      smallint CHECK (staff_since BETWEEN 1900 AND 2100),
  headcoach_photo_path text,
  headcoach_bio        text CHECK (char_length(headcoach_bio) <= 200),
  headcoach_bio_status text NOT NULL DEFAULT 'approved'
                       CHECK (headcoach_bio_status IN ('approved','flagged','removed')),
  hidden_sections  jsonb NOT NULL DEFAULT '[]'::jsonb
                   CHECK (jsonb_typeof(hidden_sections) = 'array'),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id)
);

COMMENT ON COLUMN public.team_page_content.hero_focal_y IS
  'Défaut 25 (pas 50) : les sujets sont debout, un centrage vertical leur coupe la tête — même règle que TeamData.heroFocal.';

-- ── b) FANIONS / PALMARÈS (max 8) ──
CREATE TABLE public.team_pennants (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  titre     text NOT NULL CHECK (char_length(titre) <= 30),
  annee     smallint CHECK (annee BETWEEN 1900 AND 2100),
  type      text NOT NULL DEFAULT 'championnat'
            CHECK (type IN ('championnat','coupe','banniere')),
  position  integer NOT NULL DEFAULT 0,
  status    text NOT NULL DEFAULT 'approved'
            CHECK (status IN ('approved','flagged','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_pennants_team_pos_idx ON public.team_pennants (team_id, position);
CREATE TRIGGER trg_cap_team_pennants BEFORE INSERT ON public.team_pennants
  FOR EACH ROW EXECUTE FUNCTION public._cap_rows_per_team('8');

COMMENT ON COLUMN public.team_pennants.type IS
  'Pilote la COULEUR du fanion (même forme) : championnat=Principale, coupe=Foncée/Claire, banniere=rectangle sombre liseré.';

-- ── c) CAMPS & ESSAIS (max 3) ──
CREATE TABLE public.team_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  titre      text NOT NULL CHECK (char_length(titre) <= 40),
  event_date date,
  lieu       text CHECK (char_length(lieu) <= 40),
  position   integer NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'approved'
             CHECK (status IN ('approved','flagged','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_events_team_date_idx ON public.team_events (team_id, event_date);
CREATE TRIGGER trg_cap_team_events BEFORE INSERT ON public.team_events
  FOR EACH ROW EXECUTE FUNCTION public._cap_rows_per_team('3');

COMMENT ON TABLE public.team_events IS
  'Camps de sélection / essais UNIQUEMENT (saisie manuelle). Les matchs viennent de public.games (AUTO) et ne sont jamais écrits ici.';

-- ── d) BESOINS PAR POSITION ──
CREATE TABLE public.team_position_needs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  slot_key     text NOT NULL CHECK (char_length(slot_key) <= 32),
  facette      text NOT NULL DEFAULT 'main' CHECK (char_length(facette) <= 16),
  acronym      text CHECK (char_length(acronym) <= 3),
  label        text CHECK (char_length(label)  <= 24),
  position_ids jsonb NOT NULL DEFAULT '[]'::jsonb
               CHECK (jsonb_typeof(position_ids) = 'array'),
  niveau       text NOT NULL DEFAULT 'complet'
               CHECK (niveau IN ('complet','moyen','eleve','urgent')),
  pitch        text CHECK (char_length(pitch) <= 80),
  pitch_status text NOT NULL DEFAULT 'approved'
               CHECK (pitch_status IN ('approved','flagged','removed')),
  is_hidden    boolean NOT NULL DEFAULT false,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES auth.users(id),
  CONSTRAINT team_position_needs_slot_uniq UNIQUE (team_id, slot_key)
);
CREATE INDEX team_position_needs_team_idx ON public.team_position_needs (team_id);

COMMENT ON TABLE public.team_position_needs IS
  'Une ligne = un SLOT du layout du sport (SPORT_CONFIGS). Aucun ajout de slot possible. Absence de ligne = défaut du code.';
COMMENT ON COLUMN public.team_position_needs.position_ids IS
  'Ancrage du « match parfait » : UUID de public.positions. Validé par trigger (existence + même sport que l''équipe).';

CREATE OR REPLACE FUNCTION public._validate_team_need_positions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
DECLARE bad int; t_sport uuid;
BEGIN
  SELECT sport_id INTO t_sport FROM public.teams WHERE id = NEW.team_id;
  SELECT count(*) INTO bad
  FROM jsonb_array_elements_text(NEW.position_ids) AS e(pid)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.positions p
    WHERE p.id = e.pid::uuid AND p.sport_id = t_sport
  );
  IF bad > 0 THEN
    RAISE EXCEPTION '% position(s) ancrée(s) inexistante(s) ou hors du sport de l''équipe', bad;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_team_need_positions
  BEFORE INSERT OR UPDATE OF position_ids ON public.team_position_needs
  FOR EACH ROW EXECUTE FUNCTION public._validate_team_need_positions();

-- ── e) RECORD RSEQ — hint pré-rempli (la valeur manuelle gagne) ──
CREATE OR REPLACE FUNCTION public.team_record_hint(p_team_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  WITH t AS (SELECT id, season FROM public.teams WHERE id = p_team_id),
  g AS (
    SELECT
      CASE WHEN g.home_team_id = t.id THEN g.home_score    ELSE g.visitor_score END AS pour,
      CASE WHEN g.home_team_id = t.id THEN g.visitor_score ELSE g.home_score    END AS contre
    FROM public.games g JOIN t ON (g.home_team_id = t.id OR g.visitor_team_id = t.id)
    WHERE g.season = t.season
      AND g.is_played
      AND COALESCE(g.home_forfeit, false) = false
      AND COALESCE(g.visitor_forfeit, false) = false
      AND g.home_score IS NOT NULL AND g.visitor_score IS NOT NULL
  )
  SELECT CASE WHEN count(*) = 0 THEN NULL
    ELSE count(*) FILTER (WHERE pour > contre)::text || '-' ||
         count(*) FILTER (WHERE pour < contre)::text
  END FROM g;
$$;

-- ── f) RLS ──
ALTER TABLE public.team_page_content     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_pennants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_position_needs   ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_page_content_read  ON public.team_page_content FOR SELECT TO authenticated USING (true);
CREATE POLICY team_page_content_write ON public.team_page_content FOR ALL TO authenticated
  USING (public.can_edit_team_page(team_id)) WITH CHECK (public.can_edit_team_page(team_id));

CREATE POLICY team_pennants_read  ON public.team_pennants FOR SELECT TO authenticated USING (true);
CREATE POLICY team_pennants_write ON public.team_pennants FOR ALL TO authenticated
  USING (public.can_edit_team_page(team_id)) WITH CHECK (public.can_edit_team_page(team_id));

CREATE POLICY team_events_read  ON public.team_events FOR SELECT TO authenticated USING (true);
CREATE POLICY team_events_write ON public.team_events FOR ALL TO authenticated
  USING (public.can_edit_team_page(team_id)) WITH CHECK (public.can_edit_team_page(team_id));

CREATE POLICY team_needs_read  ON public.team_position_needs FOR SELECT TO authenticated USING (true);
CREATE POLICY team_needs_write ON public.team_position_needs FOR ALL TO authenticated
  USING (public.can_edit_team_page(team_id)) WITH CHECK (public.can_edit_team_page(team_id));

-- ── g) RECRUES ENGAGÉES — fiches DÉJÀ anonymisées (Loi 25) ──
CREATE OR REPLACE FUNCTION public.list_team_commits(p_team_id uuid)
RETURNS TABLE (
  athlete_id       uuid,
  prenom           text,
  nom              text,
  position_nom     text,
  etoiles          smallint,
  ecole_provenance text,
  promo            integer,
  visible_public   boolean
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  WITH t AS (SELECT id, school_id, sport_id FROM public.teams WHERE id = p_team_id),
  c AS (
    SELECT DISTINCT ON (a.id) a.id, a.first_name, a.last_name, a.date_naissance,
           a.consentement_parental, a.position_id, a.school_id, a.annee_diplomation,
           a.cote_globale_entraineur, cr.responded_at
    FROM public.commitment_requests cr
    JOIN public.athletes a ON a.id = cr.athlete_id
    JOIN t ON cr.school_id = t.school_id AND a.sport_id = t.sport_id
    WHERE cr.status = 'CONFIRMED'
      AND a.status <> 'DESACTIVE'::public.account_status
    ORDER BY a.id, cr.responded_at DESC NULLS LAST
  )
  SELECT
    CASE WHEN v.ok THEN c.id END,
    CASE WHEN v.ok THEN c.first_name END,
    CASE WHEN v.ok THEN c.last_name END,
    CASE WHEN v.ok THEN p.nom END,
    CASE WHEN v.ok THEN round(COALESCE(c.cote_globale_entraineur, 0))::smallint END,
    CASE WHEN v.ok THEN s.name END,
    CASE WHEN v.ok THEN c.annee_diplomation END,
    v.ok
  FROM c
  CROSS JOIN LATERAL (SELECT (
      (c.date_naissance IS NOT NULL AND c.date_naissance <= current_date - INTERVAL '18 years')
      OR c.consentement_parental
    ) AS ok) v
  LEFT JOIN public.positions p ON p.id = c.position_id
  LEFT JOIN public.schools   s ON s.id = c.school_id
  ORDER BY v.ok DESC, c.last_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_team_commits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_commits(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_team_commits(uuid) IS
  'Recrues engagées d''une équipe (école + sport, CONFIRMED). Mineur sans consentement parental = ligne anonyme (visible_public=false) : compté, jamais nommé. Date de naissance inconnue = traité comme mineur.';

-- ── h) STORAGE : AUCUN nouveau bucket, AUCUNE nouvelle policy ──
-- Les photos équipe vivent dans campus-photos sous
--   {school_id}/teams/{team_id}/hero.jpg  et  {school_id}/teams/{team_id}/coach.jpg
-- Les 4 policies « ma_page assets » scopent déjà sur (storage.foldername(name))[1]
-- = school_id via can_edit_school_page → mêmes éditeurs, même lecture publique,
-- zéro DDL storage. Loi 25 : aucun mineur identifiable (garde applicative +
-- post-modération), même règle que les photos campus.
