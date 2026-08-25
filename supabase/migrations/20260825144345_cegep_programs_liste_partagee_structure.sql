-- ═══════════════════════════════════════════════════════════════
-- T1 — Programme CÉGEP visé : liste partagée (structure).
--
-- TROIS COUCHES, une seule sélection :
--   cegep_programs        183 entrées — LA CLÉ DE MATCHING (code MEQ)
--   cegep_program_labels  228 libellés — CE QUE L'ATHLÈTE VOIT ET CHOISIT
--   athletes.programmes_vises uuid[] → cegep_program_labels.id, max 3
--
-- POURQUOI L'ATHLÈTE PORTE UN LIBELLÉ ET NON UN CODE
-- Le libellé rejoue à l'écran exactement ce qu'il a choisi
-- (« Sciences humaines — Psychologie »), pendant que le matching
-- passe par program_id (300.M1, offert par 38 cégeps). Stocker le
-- code seul aurait rendu cette fidélité impossible ; stocker le
-- libellé seul aurait cassé le matching. Une jointure sépare les deux.
--
-- POURQUOI PAS DE FK VERS school_programs
-- « Sciences de la nature » existe chez 50 établissements. Une FK
-- directe ferait viser à l'athlète le programme D'UNE école.
--
-- CE QUE T1 NE FAIT PAS
-- Aucune écriture sur athletes.programme_cegep_vise. Les 40 valeurs
-- existantes restent intactes jusqu'à T3.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. La liste nationale ────────────────────────────────────────
CREATE TABLE public.cegep_programs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE,
  nom_canonique     text NOT NULL,
  type              text NOT NULL CHECK (type IN ('preuniversitaire','technique')),
  hors_nomenclature boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.cegep_programs IS
  'Liste nationale des programmes collegiaux — cle de matching. Un code MEQ = une entree. code NULL uniquement pour hors_nomenclature (Tremplin DEC, BI, doubles DEC).';
COMMENT ON COLUMN public.cegep_programs.code IS
  'Code MEQ. UNIQUE mais nullable : PostgreSQL autorise plusieurs NULL, ce qui laisse coexister les 5 entrees hors nomenclature.';
COMMENT ON COLUMN public.cegep_programs.nom_canonique IS
  'Le libelle vedette du programme (le plus repandu). Sert de repli d''affichage, PAS de source pour le selecteur — celui-ci lit cegep_program_labels.';

-- ── 2. Les libellés — ce que l'athlète voit ──────────────────────
CREATE TABLE public.cegep_program_labels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.cegep_programs(id) ON DELETE CASCADE,
  label      text NOT NULL,
  nb_ecoles  integer NOT NULL DEFAULT 0,
  is_vedette boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un libellé ne peut pas apparaître deux fois dans le sélecteur.
-- C'est l'invariant qui force la règle ⑤ (« Sciences humaines » nu
-- appartient à 300.A1, pas aussi à 300.M1) à rester vraie dans le temps.
CREATE UNIQUE INDEX cegep_program_labels_label_uidx
  ON public.cegep_program_labels (lower(label));
-- Exactement une vedette par programme.
CREATE UNIQUE INDEX cegep_program_labels_vedette_uidx
  ON public.cegep_program_labels (program_id) WHERE is_vedette;
CREATE INDEX cegep_program_labels_program_idx
  ON public.cegep_program_labels (program_id);

COMMENT ON TABLE  public.cegep_program_labels IS
  'Ce que l''athlete voit et choisit. Les vedettes forment la liste au repos (une entree par code, zero doublon visuel) ; la recherche court sur la totalite, libelles de queue compris.';
COMMENT ON COLUMN public.cegep_program_labels.nb_ecoles IS
  'Portee reelle du libelle : combien d''etablissements le nomment ainsi. Alimente la ligne de portee affichee sous un libelle de queue (« 2 cegeps le nomment ainsi »). Denormalise.';
COMMENT ON COLUMN public.cegep_program_labels.is_vedette IS
  'Libelle le plus repandu de son programme. La liste au repos n''affiche que ceux-la.';

-- ── 3. Le pont catalogue-école → liste nationale ─────────────────
ALTER TABLE public.school_programs
  ADD COLUMN program_id uuid REFERENCES public.cegep_programs(id) ON DELETE SET NULL;
CREATE INDEX school_programs_program_id_idx ON public.school_programs (program_id);

COMMENT ON COLUMN public.school_programs.program_id IS
  'Rattachement a la liste nationale. C''est ce lien qui rend possible « les athletes qui visent un programme que MON cegep offre ». name reste le libelle local d''affichage.';

-- ── 4. Le porteur côté athlète ───────────────────────────────────
ALTER TABLE public.athletes
  ADD COLUMN programmes_vises uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.athletes
  ADD CONSTRAINT athletes_programmes_vises_max3
  CHECK (cardinality(programmes_vises) <= 3);

-- GIN : c'est l'index dont dépend le filtre recruteur (&&).
CREATE INDEX athletes_programmes_vises_gin
  ON public.athletes USING GIN (programmes_vises);

COMMENT ON COLUMN public.athletes.programmes_vises IS
  'Jusqu''a 3 cegep_program_labels.id. Le matching passe par leur program_id ; l''affichage rejoue le libelle choisi. Remplace programme_cegep_vise (videe en T3, supprimee une release plus tard).';
