-- ═══════════════════════════════════════════════════════════════
-- T1 (suite) — Seed de la liste partagée depuis les 1 263 lignes
-- de school_programs. Facteur de repli 1263 → 183 programmes.
--
-- LES QUATRE RÈGLES, DANS L'ORDRE OÙ ELLES S'APPLIQUENT
--  ① normaliser le préfixe « DEC » — « Techniques de thanatologie »
--    et « DEC Techniques de thanatologie » sont le même programme.
--    Fait tomber les codes multi-noms de 36 à 18.
--  ② arbitrages figés : 200.B0→200.B1, 351.A0→351.A1, 700.A0→700.A1,
--    et les 50 lignes sans code « DEC Sciences de la nature »→200.B1.
--  ③ chaque libellé s'attache au code qui l'emploie LE PLUS.
--    C'est ce qui envoie « Sciences humaines » nu vers 300.A1
--    (51 écoles) et non vers 300.M1 (2), et qui garantit
--    l'unicité globale des libellés.
--  ④ vedette = le libellé le plus répandu de son programme.
--
-- 700.A0 : UN CAS QUE L'ANALYSE N'AVAIT PAS ISOLÉ
-- Sous les règles ①-③ seules, 700.A0 se retrouvait programme SANS
-- AUCUN libellé : son unique nom (« Sciences, lettres et arts »,
-- 3 écoles) est capté par 700.A1 qui l'emploie chez 10. Un tel
-- programme est invisible au sélecteur — donc impossible à choisir —
-- tout en restant une cible de matching. C'est le motif 351.A0/351.A1
-- déjà tranché (version retirée vs courante), appliqué à l'identique.
-- L'invariant « tout programme a au moins un libellé », vérifié en
-- fin de migration, est ce qui a levé le cas.
-- ═══════════════════════════════════════════════════════════════

WITH base AS (
  SELECT sp.id AS sp_id, sp.school_id, sp.type,
         btrim(regexp_replace(sp.name, '^DEC\s+', '', 'i')) AS n2,   -- ①
         CASE                                                        -- ②
           WHEN sp.code = '351.A0' THEN '351.A1'
           WHEN sp.code = '200.B0' THEN '200.B1'
           WHEN sp.code = '700.A0' THEN '700.A1'
           WHEN sp.code IS NULL
                AND lower(btrim(regexp_replace(sp.name, '^DEC\s+', '', 'i'))) = 'sciences de la nature'
             THEN '200.B1'
           ELSE sp.code
         END AS ccode
  FROM public.school_programs sp
),
type_par_code AS (
  SELECT ccode, type,
         row_number() OVER (PARTITION BY ccode ORDER BY count(*) DESC, type) rn
  FROM base WHERE ccode IS NOT NULL GROUP BY ccode, type
),
label_home AS (                                                       -- ③
  SELECT n2, ccode,
         row_number() OVER (PARTITION BY n2 ORDER BY count(DISTINCT school_id) DESC, ccode) rn
  FROM base WHERE ccode IS NOT NULL GROUP BY n2, ccode
),
lab AS (
  SELECT b.n2, h.ccode AS home_code, count(DISTINCT b.school_id) AS nb_ecoles
  FROM base b
  JOIN label_home h ON h.n2 = b.n2 AND h.rn = 1
  WHERE b.ccode IS NOT NULL
  GROUP BY 1, 2
),
vedette AS (                                                          -- ④
  SELECT home_code, n2, nb_ecoles,
         row_number() OVER (PARTITION BY home_code ORDER BY nb_ecoles DESC, length(n2), n2) rn
  FROM lab
),
prog_ins AS (
  INSERT INTO public.cegep_programs (code, nom_canonique, type, hors_nomenclature)
  SELECT v.home_code, v.n2, t.type, false
  FROM vedette v
  JOIN type_par_code t ON t.ccode = v.home_code AND t.rn = 1
  WHERE v.rn = 1
  RETURNING id, code
),
lab_ins AS (
  INSERT INTO public.cegep_program_labels (program_id, label, nb_ecoles, is_vedette)
  SELECT p.id, l.n2, l.nb_ecoles,
         (l.n2 = (SELECT v.n2 FROM vedette v WHERE v.home_code = l.home_code AND v.rn = 1))
  FROM lab l JOIN prog_ins p ON p.code = l.home_code
  RETURNING id
),
-- Les 5 hors nomenclature : Tremplin DEC, BI, bac français, 2 doubles
-- DEC musique. Aucun code MEQ, mais un athlète peut légitimement les
-- viser — les exclure serait une perte.
hors AS (
  SELECT DISTINCT n2, type FROM base WHERE ccode IS NULL
),
hors_prog AS (
  INSERT INTO public.cegep_programs (code, nom_canonique, type, hors_nomenclature)
  SELECT NULL, h.n2, h.type, true FROM hors h
  RETURNING id, nom_canonique
),
hors_lab AS (
  INSERT INTO public.cegep_program_labels (program_id, label, nb_ecoles, is_vedette)
  SELECT hp.id, hp.nom_canonique,
         (SELECT count(DISTINCT b.school_id) FROM base b WHERE b.n2 = hp.nom_canonique AND b.ccode IS NULL),
         true
  FROM hors_prog hp
  RETURNING id
)
SELECT count(*) FROM lab_ins;

-- ── Rattachement des 1 263 lignes locales à la liste nationale ───
-- Deux passes : par code arbitré, puis par libellé normalisé pour
-- les lignes sans code (les 50 « Sciences de la nature » + les 5
-- hors nomenclature).
UPDATE public.school_programs sp
SET program_id = cp.id
FROM public.cegep_programs cp
WHERE cp.code = CASE
        WHEN sp.code = '351.A0' THEN '351.A1'
        WHEN sp.code = '200.B0' THEN '200.B1'
        WHEN sp.code = '700.A0' THEN '700.A1'
        ELSE sp.code
      END;

UPDATE public.school_programs sp
SET program_id = l.program_id
FROM public.cegep_program_labels l
WHERE sp.program_id IS NULL
  AND lower(l.label) = lower(btrim(regexp_replace(sp.name, '^DEC\s+', '', 'i')));

-- ── Garde-fous permanents ────────────────────────────────────────
-- C'est le premier qui a révélé 700.A0. Il reste en place : un
-- programme sans libellé est invisible au sélecteur donc inatteignable,
-- tout en restant une cible de matching — une panne silencieuse.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.cegep_programs p
   WHERE NOT EXISTS (SELECT 1 FROM public.cegep_program_labels l WHERE l.program_id = p.id);
  IF n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % programme(s) sans aucun libellé — invisibles au sélecteur', n;
  END IF;

  SELECT count(*) INTO n FROM public.cegep_programs p
   WHERE NOT EXISTS (SELECT 1 FROM public.cegep_program_labels l WHERE l.program_id = p.id AND l.is_vedette);
  IF n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % programme(s) sans vedette — absents de la liste au repos', n;
  END IF;

  SELECT count(*) INTO n FROM public.school_programs WHERE program_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % ligne(s) school_programs non rattachée(s) à la liste nationale', n;
  END IF;
END $$;

-- ── Recalcul de la portée des libellés ───────────────────────────
-- nb_ecoles est dénormalisé et alimente la ligne de portée affichée
-- sous un libellé de queue. Il ment dès qu'un cégep ajoute ou retire
-- un programme — d'où une fonction, appelée après tout import.
CREATE OR REPLACE FUNCTION public.refresh_cegep_program_label_counts()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH c AS (
    SELECT l.id, count(DISTINCT sp.school_id) AS n
    FROM public.cegep_program_labels l
    LEFT JOIN public.school_programs sp
      ON lower(btrim(regexp_replace(sp.name, '^DEC\s+', '', 'i'))) = lower(l.label)
    GROUP BY l.id
  )
  UPDATE public.cegep_program_labels l
     SET nb_ecoles = c.n
    FROM c WHERE c.id = l.id AND l.nb_ecoles IS DISTINCT FROM c.n
  RETURNING 1;
$$;

COMMENT ON FUNCTION public.refresh_cegep_program_label_counts() IS
  'Recalcule cegep_program_labels.nb_ecoles depuis school_programs. A appeler apres tout import de catalogue : le compteur alimente la ligne de portee du selecteur et ment des qu''un cegep ajoute ou retire un programme.';
