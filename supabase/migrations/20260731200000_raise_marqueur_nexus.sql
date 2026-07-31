-- ============================================================================
-- Marqueur « NEXUS: » sur les RAISE destinés à l'utilisateur.
--
-- RÈGLE, valable pour toute fonction future : un message d'erreur écrit POUR
-- l'utilisateur commence par « NEXUS: ». friendlyDbError laisse passer ceux-là
-- (en retirant le préfixe) et remplace tout le reste par un message générique.
-- Un message sans marqueur n'atteint jamais l'écran.
--
-- POURQUOI. 42501 couvre deux choses : le refus du RLS (message anglais du
-- moteur, « session expirée » neuf fois sur dix) et un refus de droits levé par
-- une de nos fonctions, déjà rédigé en français. Les distinguer par le contenu
-- demandait une heuristique — accents, mots outils, longueur — qui aurait fini
-- par se tromper. Le marqueur rend la distinction explicite et sans faux
-- positif possible.
--
-- Aucune signature ne change : les triggers existants continuent d'appeler ces
-- fonctions sans être recréés. Aucun plafond n'est modifié.
-- ============================================================================

-- ── 1. Plafond par équipe — partagé par team_events (8) et team_pennants (8) ──
CREATE OR REPLACE FUNCTION public._cap_rows_per_team()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE lim int := TG_ARGV[0]::int; cnt int;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE team_id = $1', TG_TABLE_NAME)
    INTO cnt USING NEW.team_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'NEXUS: Maximum % lignes par équipe (table %)', lim, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $function$;

-- ── 2. Plafond par école — partagé par school_campus_cards (5) et school_news (5)
CREATE OR REPLACE FUNCTION public._cap_rows_per_school()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE lim int := TG_ARGV[0]::int; cnt int;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE school_id = $1', TG_TABLE_NAME)
    INTO cnt USING NEW.school_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'NEXUS: Maximum % lignes par école (table %)', lim, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $function$;

-- ── 3. Remplacement atomique des programmes — 4 messages utilisateur ─────────
CREATE OR REPLACE FUNCTION public.replace_school_programs(
  p_school_id      uuid,
  p_rows           jsonb,                  -- [{id?, name, code, type, is_displayed}]
  p_autoriser_vide boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_garde uuid[];
  v_n     integer;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'NEXUS: Aucune école ciblée — rien n''a été modifié.';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'NEXUS: Liste de programmes illisible — rien n''a été modifié.';
  END IF;

  -- Droits. Le RLS refuserait déjà l'écriture, mais sans ce garde l'appelant
  -- non autorisé obtiendrait un DELETE de 0 ligne suivi d'un INSERT refusé :
  -- un demi-échec silencieux plutôt qu'un refus net.
  IF NOT public.can_edit_school_page(p_school_id) THEN
    RAISE EXCEPTION 'NEXUS: Tu n''as pas les droits d''édition sur cette école.'
      USING ERRCODE = '42501';
  END IF;

  -- Garde-fou « liste vide ». On ne bloque que s'il y a vraiment quelque chose
  -- à perdre : une école déjà sans programme n'a pas besoin d'être protégée.
  IF jsonb_array_length(p_rows) = 0 AND NOT p_autoriser_vide THEN
    IF EXISTS (SELECT 1 FROM public.school_programs WHERE school_id = p_school_id) THEN
      RAISE EXCEPTION 'NEXUS: Aucun programme reçu — la liste n''a pas été effacée.';
    END IF;
  END IF;

  -- 1. Ce que l'éditeur conserve (lignes déjà en base).
  SELECT coalesce(array_agg((r->>'id')::uuid), '{}')
    INTO v_garde
  FROM jsonb_array_elements(p_rows) r
  WHERE r->>'id' IS NOT NULL;

  -- 2. Retraits — bornés à CETTE école par la clause elle-même.
  DELETE FROM public.school_programs
  WHERE school_id = p_school_id AND id <> ALL (v_garde);

  -- 3. Mises à jour, en UNE instruction au lieu de N. `is distinct from` évite
  --    de réécrire les lignes inchangées.
  UPDATE public.school_programs sp
     SET is_displayed = (r->>'is_displayed')::boolean
  FROM jsonb_array_elements(p_rows) r
  WHERE sp.school_id = p_school_id
    AND r->>'id' IS NOT NULL
    AND sp.id = (r->>'id')::uuid
    AND sp.is_displayed IS DISTINCT FROM (r->>'is_displayed')::boolean;

  -- 4. Ajouts manuels. `position` reprend l'ordre du tableau reçu.
  INSERT INTO public.school_programs (school_id, name, code, type, is_displayed, source, position)
  SELECT p_school_id, r->>'name', r->>'code', r->>'type',
         coalesce((r->>'is_displayed')::boolean, true), 'manuel',
         (r_idx - 1)::int
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, r_idx)
  WHERE r->>'id' IS NULL;

  SELECT count(*) INTO v_n FROM public.school_programs WHERE school_id = p_school_id;
  RETURN v_n;
END $$;
