-- ═══════════════════════════════════════════════════════════════════════════
-- ANCRAGE CIVIL — POSE l'ancrage à l'attachement (miroir constructif)
--
-- INVARIANT PRODUIT : un athlète d'un club civil EXISTANT porte
-- school_id = la ligne `schools` du club. NULL = « civil sans club ».
--
-- CE QUE ÇA FERME
-- ---------------
-- La migration 20260908151616 a supprimé la DESTRUCTION de l'ancrage au
-- retrait d'équipe. Elle n'a pas créé la POSE. Or quatre chemins insèrent
-- directement dans team_athletes SANS jamais écrire school_id :
--
--   app/coach/equipes/[teamId]/PageClient.tsx:512    (page équipe, desktop)
--   components/shared/CoachEquipeDetailMobile.tsx:205 (page équipe, mobile)
--   app/coach/athletes/_data/saveAthlete.ts:316       (création athlète)
--   app/coach/athletes/_data/saveAthlete.ts:432       (édition athlète)
--
-- Seule la RPC athlète `_apply_team_attachment_core` pose l'ancrage
-- (`SET school_id = v_target.school_id`). Elle est INATTEIGNABLE côté coach :
-- son ACL est {postgres}, et son wrapper `apply_team_attachment` résout
-- l'athlète par `WHERE a.user_id = auth.uid()` → un coach y récolte
-- ATHLETE_NOT_FOUND. Router les 4 INSERT vers elle exigerait une nouvelle RPC
-- coach (donc une nouvelle ACL, un nouveau gate) ET imposerait ses invariants
-- (DOB_REQUIRED, refus <14, consentement 14-17, cérémonie de transfert) à des
-- écrans qui ne les portent pas.
--
-- D'où ce trigger : UNE implémentation, qui couvre les 4 chemins et tout
-- chemin futur, et qui ne peut pas dériver de place en place.
--
-- CONDITIONNEL — JAMAIS DE CLOBBER (décision BP, 2026-09-08)
-- ----------------------------------------------------------
-- La pose n'a lieu QUE si `athletes.school_id IS NULL`. Un athlète qui porte
-- déjà une ancre la conserve, même s'il rejoint l'équipe d'une autre
-- organisation. Conséquences assumées :
--   · on RÉPARE l'orphelin, on ne REDÉFINIT jamais une appartenance ;
--   · changer d'organisation reste une décision explicite, portée par la RPC
--     de transfert (qui, elle, écrit inconditionnellement) ou par un flow
--     applicatif — jamais par un effet de bord d'insertion.
--
-- IDEMPOTENCE vis-à-vis de `_apply_team_attachment_core`
-- ------------------------------------------------------
-- Cette RPC pose school_id AVANT son propre INSERT dans team_athletes. Quand
-- le trigger tire ensuite, `a.school_id IS NULL` est déjà faux → le trigger
-- ne fait rien. Les deux chemins convergent sur la même valeur ; le
-- conditionnel rend le double passage strictement inoffensif.
--
-- Garde supplémentaire `t.school_id IS NOT NULL` : le trigger ne peut jamais
-- ÉCRIRE un NULL. Il ne sait que réparer, pas effacer.
--
-- SECURITY DEFINER + search_path pinné + row_security off — modèle
-- `calc_cote_globale`. L'INSERT dans team_athletes peut venir d'un rôle dont
-- la RLS ne couvre pas l'UPDATE sur athletes (c'est précisément le cas du
-- coach ajoutant un athlète civil qu'il ne « possède » pas encore).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_athlete_anchor_on_team_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  -- Pose l'ancrage UNIQUEMENT sur un athlète qui n'en a pas.
  -- Aucun clobber, aucune écriture de NULL.
  UPDATE public.athletes a
     SET school_id = t.school_id
    FROM public.teams t
   WHERE t.id = NEW.team_id
     AND a.id = NEW.athlete_id
     AND a.school_id IS NULL
     AND t.school_id IS NOT NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_athlete_anchor_on_team_add ON public.team_athletes;

CREATE TRIGGER set_athlete_anchor_on_team_add
  AFTER INSERT ON public.team_athletes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_athlete_anchor_on_team_add();

-- ═══════════════════════════════════════════════════════════════════════════
-- ACL — rattrapage EXPLICITE de l'ALTER DEFAULT PRIVILEGES de Supabase.
--
-- Le CREATE ci-dessus vient de re-accorder EXECUTE à anon, authenticated,
-- service_role ET PUBLIC (vérifié : c'est l'état de `calc_cote_globale` et de
-- `team_athletes_set_sport_id`, toutes deux laissées permissives).
--
-- ⚠ PUBLIC D'ABORD. Révoquer anon/authenticated sans révoquer PUBLIC est
-- COSMÉTIQUE : ils conserveraient EXECUTE par héritage. Cible = {postgres},
-- la même que `_apply_team_attachment_core`. Une fonction de trigger n'a
-- aucune raison d'être appelable directement par qui que ce soit.
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.set_athlete_anchor_on_team_add() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_athlete_anchor_on_team_add() FROM anon;
REVOKE ALL ON FUNCTION public.set_athlete_anchor_on_team_add() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_athlete_anchor_on_team_add() FROM service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — comparaison COMPLÈTE, jamais par inclusion (CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  v_oid      oid;
  v_secdef   boolean;
  v_config   text[];
  v_acl      text[];
  v_acl_veut text[] := ARRAY['postgres'];
  v_trig     int;
BEGIN
  SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_oid, v_secdef, v_config
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_athlete_anchor_on_team_add';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: la fonction set_athlete_anchor_on_team_add est absente';
  END IF;

  -- 1. Modèle d'exécution : DEFINER + les DEUX réglages pinnés.
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'NEXUS: set_athlete_anchor_on_team_add n''est pas SECURITY DEFINER';
  END IF;
  IF v_config IS NULL
     OR NOT ('search_path=public' = ANY (v_config))
     OR NOT ('row_security=off'  = ANY (v_config)) THEN
    RAISE EXCEPTION 'NEXUS: proconfig incomplet sur set_athlete_anchor_on_team_add : % (attendu search_path=public ET row_security=off)',
      COALESCE(v_config::text, '<NULL>');
  END IF;

  -- 2. ACL : liste COMPLÈTE triée, comparée intégralement.
  --    NULL = ACL par défaut = tout le monde → refus explicite.
  SELECT array_agg(g ORDER BY g) INTO v_acl
  FROM pg_proc pr,
       LATERAL (SELECT COALESCE(NULLIF(split_part(x,'=',1),''),'PUBLIC') AS g
                  FROM unnest(pr.proacl::text[]) AS x) t
  WHERE pr.oid = v_oid;

  IF v_acl IS DISTINCT FROM v_acl_veut THEN
    RAISE EXCEPTION 'NEXUS: ACL de set_athlete_anchor_on_team_add = %, attendu %',
      COALESCE(v_acl::text, '<NULL = defaut, donc PUBLIC>'), v_acl_veut::text;
  END IF;

  -- 3. Le trigger est bien attaché, en AFTER INSERT, sur team_athletes.
  SELECT count(*) INTO v_trig
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'team_athletes'
    AND t.tgname  = 'set_athlete_anchor_on_team_add'
    AND (t.tgtype::int & 4)  > 0   -- INSERT
    AND (t.tgtype::int & 2)  = 0;  -- AFTER (le bit 2 = BEFORE)

  IF v_trig <> 1 THEN
    RAISE EXCEPTION 'NEXUS: trigger set_athlete_anchor_on_team_add absent ou mal typé sur team_athletes (trouvé %, attendu 1 en AFTER INSERT)', v_trig;
  END IF;

  -- 4. La migration 20260908151616 tient toujours : rien ne remet
  --    school_id à NULL au retrait. Le miroir destructif ne revient pas.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'reset_athlete_anchor_on_team_remove'
  ) THEN
    RAISE EXCEPTION 'NEXUS: reset_athlete_anchor_on_team_remove est revenue — regression de 20260908151616';
  END IF;

  RAISE NOTICE 'NEXUS: ancrage civil — pose a l''attachement, 4/4 gates verts.';
END
$gate$;
