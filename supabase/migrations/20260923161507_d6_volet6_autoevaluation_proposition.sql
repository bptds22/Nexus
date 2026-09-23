-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — VOLET 6 : l'auto-évaluation redevient une PROPOSITION, tranchée par le
-- coach (ou le directeur). Plan : docs/plan-volet6-rollout.md.
-- Brouillon d'origine : docs/d6-volet6-suggestion-evaluation.sql (§1–4).
--
-- En UNE migration, parce que les morceaux ne se séparent pas :
--   1. champs_autoevaluation_athlete()  la liste blanche (règle 11)
--   2. trg_suggestion_transition        l'aiguillage à TROIS sorties
--   3. peut_trancher_suggestion()       qui lit et tranche : propriétaire,
--                                       coach d'équipe, directeur de l'école
--   4. policies d'athlete_suggestions   resserrées — sans elles, l'athlète
--                                       approuverait sa propre proposition
--   5. apply_approved_suggestion        repli d'attribution sur le coach qui
--                                       tranche (evaluations.coach_id NOT NULL)
--
-- Le one-shot de données (4 remises EN_ATTENTE, 4 notifications retirées) N'EST
-- PAS ici : il part APRÈS, sur GO séparé (plan §6).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0. PRÉ-VOL : l'état de départ est bien celui relevé le 2026-09-23 ───────
DO $$
DECLARE v_src text := replace(pg_get_functiondef('public.trg_suggestion_transition()'::regprocedure), chr(13), '');
BEGIN
  IF v_src NOT LIKE '%Les distinctions et évaluations sont attribuées par ton entraîneur.%'
     OR v_src LIKE '%champs_autoevaluation_athlete%' THEN
    RAISE EXCEPTION 'NEXUS: trg_suggestion_transition n''est pas dans l''état attendu (déjà migré, ou modifié depuis le relevé)';
  END IF;
  IF (SELECT count(*) FROM public.athlete_suggestions WHERE status = 'EN_ATTENTE') <> 0 THEN
    RAISE EXCEPTION 'NEXUS: des suggestions EN_ATTENTE existent déjà — relire avant d''ouvrir le flux';
  END IF;
END $$;


-- ── 1. LA LISTE BLANCHE ─────────────────────────────────────────────────────
-- Les DEUX écritures des 14 critères (libellé FR des clients ≤ lot 3, nom de
-- colonne depuis) : n'en prendre qu'une refuserait un client sur deux en
-- silence. Miroir de la liste de notify_athlete_suggestion_result.
CREATE OR REPLACE FUNCTION public.champs_autoevaluation_athlete()
  RETURNS text[]
  LANGUAGE sql IMMUTABLE
  SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    'Cote globale', 'Distinctions', 'Distinction personnalisée',
    'Leadership', 'Discipline', 'Coachabilité', 'Intelligence de jeu',
    'Compétitivité', 'Esprit d''équipe', 'Résilience', 'Attitude / Mentalité',
    'Vitesse / Explosivité', 'Force / Puissance', 'Endurance cardio',
    'Agilité / Coordination', 'Vision du jeu', 'Sens tactique',
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite',
    'vitesse_explosivite', 'force_puissance', 'endurance_cardio',
    'agilite_coordination', 'vision_du_jeu', 'sens_tactique'
  ]::text[];
$$;
-- Appelée seulement depuis un trigger SECURITY DEFINER : aucun client n'en a
-- besoin. Les default privileges Supabase l'ouvrent à anon/authenticated.
REVOKE ALL ON FUNCTION public.champs_autoevaluation_athlete() FROM PUBLIC, anon, authenticated;


-- ── 2. L'AIGUILLAGE À TROIS SORTIES ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_suggestion_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $$
BEGIN
  IF NEW.status <> 'EN_ATTENTE' THEN
    RETURN NEW;
  END IF;

  -- SORTIE 2 — l'auto-évaluation va au coach. Testée EN PREMIER, alors que les
  -- deux listes sont disjointes : la décision « ça se propose, ça ne s'écrit
  -- pas » reste visible ici au lieu de dépendre de l'ordre des tests (règle 11).
  -- On ne touche à rien : la ligne reste EN_ATTENTE → boîte « À traiter ».
  -- ⚠ AUCUNE condition sur l'existence d'un entraîneur (décision BP
  -- 2026-09-12) : une proposition sans coach DORT, et se réveille quand un
  -- coach (ou un directeur) peut la trancher. Refuser les orphelines exigerait
  -- d'AJOUTER un test ici — et de se heurter à ce commentaire.
  IF NEW.champ = ANY (public.champs_autoevaluation_athlete()) THEN
    RETURN NEW;
  END IF;

  -- SORTIE 1 — champs de profil : déjà écrits en direct, la ligne est un
  -- vestige des vieux clients. INCHANGÉE par rapport à l'état précédent.
  IF NEW.champ = ANY (public.champs_profil_athlete()) THEN
    UPDATE public.athlete_suggestions
       SET status = 'APPROUVEE',
           note_systeme = 'Édition directe (transition vieux client mobile)'
     WHERE id = NEW.id;

  -- SORTIE 3 — champ inconnu ou retiré. Le motif ne parle plus d'évaluations.
  ELSE
    UPDATE public.athlete_suggestions
       SET status = 'REJETEE',
           raison_rejet = 'Ce champ ne se modifie plus depuis ton profil.',
           note_systeme = 'Champ hors périmètre (transition vieux client mobile)',
           reviewed_at = now()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- ── 3. QUI PEUT LIRE ET TRANCHER ────────────────────────────────────────────
-- Le périmètre de la boîte « À traiter » (get_coach_athletes) : propriétaire
-- (athletes.coach_id), coach d'une équipe de l'athlète, directeur ou directeur
-- intérimaire de son école. Décision BP 2026-09-23 : un directeur a le même
-- pouvoir qu'un coach. Avant : lecture et décision limitées à
-- athletes.coach_id — la boîte listait des athlètes dont elle ne pouvait pas
-- lire les propositions.
CREATE OR REPLACE FUNCTION public.peut_trancher_suggestion(target_athlete uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.athletes a
                  WHERE a.id = target_athlete AND a.coach_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.team_athletes ta
                   JOIN public.team_coaches tc ON tc.team_id = ta.team_id
                  WHERE ta.athlete_id = target_athlete
                    AND tc.coach_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM public.athletes a
                   JOIN public.school_coaches sc ON sc.school_id = a.school_id
                  WHERE a.id = target_athlete
                    AND sc.coach_id = (SELECT auth.uid())
                    AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM'));
$$;
REVOKE ALL ON FUNCTION public.peut_trancher_suggestion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peut_trancher_suggestion(uuid) TO authenticated;


-- ── 4. LES POLICIES ─────────────────────────────────────────────────────────
-- Était : n'importe quel compte connecté pouvait passer n'importe quelle
-- suggestion à APPROUVEE, et apply_approved_suggestion (DEFINER, RLS off)
-- l'appliquait. Latent tant qu'il n'y avait aucune EN_ATTENTE ; ce volet en
-- crée. Aucun binaire publié (1.2 → 1.4.3) n'écrit hors surfaces coach (plan §2).
DROP POLICY IF EXISTS "Authenticated users update suggestions" ON public.athlete_suggestions;

DROP POLICY IF EXISTS "Athletes insert own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes insert own suggestions"
  ON public.athlete_suggestions FOR INSERT
  WITH CHECK (is_own_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches can read suggestions for their claimed athletes"
  ON public.athlete_suggestions FOR SELECT
  USING (peut_trancher_suggestion(athlete_id));

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches update suggestions for their claimed athletes"
  ON public.athlete_suggestions FOR UPDATE
  USING      (peut_trancher_suggestion(athlete_id))
  -- Sans WITH CHECK, un coach légitime pouvait déplacer une suggestion vers un
  -- athlète qui n'est pas le sien en réécrivant athlete_id.
  WITH CHECK (peut_trancher_suggestion(athlete_id));


-- ── 5. apply_approved_suggestion — repli d'attribution ──────────────────────
-- Une ligne change, substituée sur le corps DÉPLOYÉ (pas une copie du dépôt :
-- la fonction compte ~29 écritures). Sans owner ni coach au dépôt, l'évaluation
-- revient au coach QUI TRANCHE — sinon evaluations.coach_id (NOT NULL) lève.
-- auth.uid() lit request.jwt.claims, que SECURITY DEFINER ne change pas.
DO $$
DECLARE
  v_src text := replace(pg_get_functiondef('public.apply_approved_suggestion()'::regprocedure), chr(13), '');
  v_avant constant text := 'IF v_coach_id IS NULL THEN v_coach_id := NEW.coach_id; END IF;';
  v_apres constant text := 'IF v_coach_id IS NULL THEN v_coach_id := COALESCE(NEW.coach_id, auth.uid()); END IF;';
  v_new text;
BEGIN
  IF (length(v_src) - length(replace(v_src, v_avant, ''))) / length(v_avant) <> 1 THEN
    RAISE EXCEPTION 'NEXUS: ligne d''attribution introuvable (ou multiple) dans apply_approved_suggestion — aucune substitution';
  END IF;
  v_new := replace(v_src, v_avant, v_apres);
  EXECUTE v_new;
END $$;


-- ── 6. CONTRÔLES — comparaison INTÉGRALE, jamais par inclusion ──────────────
DO $$
DECLARE vus text[];
BEGIN
  -- ACL des deux nouvelles fonctions.
  SELECT array_agg(t.g ORDER BY t.g) INTO vus
    FROM pg_proc pr,
         LATERAL (SELECT coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') AS g
                    FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = 'public.peut_trancher_suggestion(uuid)'::regprocedure;
  IF vus IS DISTINCT FROM ARRAY['authenticated','postgres','service_role'] THEN
    RAISE EXCEPTION 'NEXUS: ACL peut_trancher_suggestion = %, attendu {authenticated,postgres,service_role}', vus;
  END IF;

  SELECT array_agg(t.g ORDER BY t.g) INTO vus
    FROM pg_proc pr,
         LATERAL (SELECT coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') AS g
                    FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = 'public.champs_autoevaluation_athlete()'::regprocedure;
  IF vus IS DISTINCT FROM ARRAY['postgres','service_role'] THEN
    RAISE EXCEPTION 'NEXUS: ACL champs_autoevaluation_athlete = %, attendu {postgres,service_role}', vus;
  END IF;

  -- Les policies d'athlete_suggestions, liste complète (nom + commande).
  -- Les deux côtés triés en collation "C", explicitement : polname est de type
  -- `name` (collation C) et une liste littérale suivrait la collation par
  -- défaut — « admins… » changerait de place d'un côté à l'autre.
  SELECT array_agg(x ORDER BY x COLLATE "C") INTO vus
    FROM (SELECT polname::text || ':' || polcmd::text AS x
            FROM pg_policy WHERE polrelid = 'public.athlete_suggestions'::regclass) p;
  IF vus IS DISTINCT FROM (SELECT array_agg(x ORDER BY x COLLATE "C") FROM unnest(ARRAY[
       'Athletes can read own suggestions:r',
       'Athletes insert own suggestions:a',
       'Coaches can read suggestions for their claimed athletes:r',
       'Coaches update suggestions for their claimed athletes:w',
       'admins read athlete_suggestions:r']) x) THEN
    RAISE EXCEPTION 'NEXUS: policies athlete_suggestions = %', vus;
  END IF;

  -- Les deux listes restent disjointes (sinon un champ de profil partirait au coach).
  IF EXISTS (SELECT 1 FROM unnest(public.champs_profil_athlete()) p
              WHERE p = ANY (public.champs_autoevaluation_athlete())) THEN
    RAISE EXCEPTION 'NEXUS: champs de profil et d''auto-évaluation se recouvrent';
  END IF;

  IF pg_get_functiondef('public.apply_approved_suggestion()'::regprocedure)
       NOT LIKE '%COALESCE(NEW.coach_id, auth.uid())%' THEN
    RAISE EXCEPTION 'NEXUS: repli d''attribution absent';
  END IF;
END $$;
