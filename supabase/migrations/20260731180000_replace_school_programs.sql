-- ============================================================================
-- replace_school_programs — remplacement ATOMIQUE des programmes d'une école.
--
-- POURQUOI. Le motif client actuel est : DELETE ciblé, puis N UPDATE un par un,
-- puis INSERT — soit N+2 allers-retours HTTP sans transaction commune. Un échec
-- au milieu (réseau, session, contrainte) laisse la liste à moitié écrite, et
-- le DELETE est déjà commité. Jusqu'à 42 lignes par école, saisies à la main,
-- sans plafond en base pour limiter la casse. C'est la sauvegarde la plus
-- exposée du dépôt.
--
-- SECURITY INVOKER (le défaut, non déclaré) : le RLS de school_programs
-- s'applique normalement. Une fonction DEFINER ouvrirait un contournement pour
-- rien — l'appelant a déjà exactement les droits nécessaires. Le patron est
-- create_custom_group, moins le DEFINER.
--
-- p_autoriser_vide. Une liste vide efface tout : c'est légitime quand le
-- collège a retiré ses programmes un à un, et catastrophique quand le client
-- envoie [] parce qu'il n'a rien chargé. Le client ne passe true QUE s'il a
-- observé la transition (sa baseline chargée n'était pas vide). Le garde ici
-- est le second filet, indépendant : il ne refuse que si la base a réellement
-- des lignes à perdre.
-- ============================================================================

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
    RAISE EXCEPTION 'Aucune école ciblée — rien n''a été modifié.';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Liste de programmes illisible — rien n''a été modifié.';
  END IF;

  -- Droits. Le RLS refuserait déjà l'écriture, mais sans ce garde l'appelant
  -- non autorisé obtiendrait un DELETE de 0 ligne suivi d'un INSERT refusé :
  -- un demi-échec silencieux plutôt qu'un refus net.
  IF NOT public.can_edit_school_page(p_school_id) THEN
    RAISE EXCEPTION 'Tu n''as pas les droits d''édition sur cette école.'
      USING ERRCODE = '42501';
  END IF;

  -- Garde-fou « liste vide ». On ne bloque que s'il y a vraiment quelque chose
  -- à perdre : une école déjà sans programme n'a pas besoin d'être protégée.
  IF jsonb_array_length(p_rows) = 0 AND NOT p_autoriser_vide THEN
    IF EXISTS (SELECT 1 FROM public.school_programs WHERE school_id = p_school_id) THEN
      RAISE EXCEPTION 'Aucun programme reçu — la liste n''a pas été effacée.';
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

REVOKE ALL ON FUNCTION public.replace_school_programs(uuid, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_school_programs(uuid, jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.replace_school_programs(uuid, jsonb, boolean) IS
  'Remplacement atomique des programmes d''une école. p_autoriser_vide=true seulement si le client a observé que l''utilisateur a vidé la liste.';
