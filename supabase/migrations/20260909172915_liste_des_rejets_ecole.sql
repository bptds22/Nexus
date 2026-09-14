-- ═══════════════════════════════════════════════════════════════════════════
-- LISTER LES REJETS ACTIFS — sans quoi l'annulation n'existe pas
--
-- APPLIQUÉE sur le cloud le 2026-09-09 (version 20260909172915, MCP
--   apply_migration). Gate en post-apply, SQL brut : vert. Périmètre prouvé
--   PAR EXÉCUTION dans une transaction annulée — voir le bas de fichier.
--
-- LE TROU QU'ELLE BOUCHE : dès que `reject_school_athlete` met `school_id` à
-- NULL, PLUS AUCUNE POLICY ne laisse le personnel de l'école lire cet athlète
-- (`coaches read own athletes` exige coach_id = moi, ou l'école, ou une équipe
-- partagée). La trace reste lisible — mais elle ne porte que des identifiants
-- et des dates. Un écran qui afficherait « Rejet du 9 septembre, athlète
-- df02e359… » ne permet à personne de décider quoi que ce soit, et la fenêtre
-- d'annulation ILLIMITÉE décidée par BP n'existait donc que si l'athlète
-- revenait de lui-même par une équipe.
--
-- Un DEFINER franchit la RLS et décide LUI-MÊME qui voit quoi : c'est
-- exactement le cas d'usage. Pas de nom recopié dans la trace, donc rien à
-- maintenir en cohérence, et rien à purger si l'athlète change de nom.
--
-- PÉRIMÈTRE : directeur ou directeur intérimaire de l'école du rejet, et lui
-- seul. Un directeur d'une AUTRE école reçoit zéro ligne — vérifié par
-- exécution après l'apply, pas seulement par lecture du code.
--
-- ⚠ CE QUE LA FONCTION NE REND PAS, ET POURQUOI : l'établissement où l'athlète
-- s'est éventuellement rattaché DEPUIS. Un booléen `reattache` suffit à l'écran
-- (« l'annulation n'est plus possible »), et nommer la nouvelle école
-- rendrait à un établissement qui vient de désavouer ce jeune une information
-- sur lui qu'il n'a plus le droit de lire — la RLS la lui a retirée au rejet.
-- Le strict nécessaire, pas un octet de plus.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_school_rejections()
RETURNS TABLE (
  rejection_id    uuid,
  athlete_id      uuid,
  first_name      text,
  last_name       text,
  rejected_at     timestamptz,
  rejected_by     uuid,
  rejected_by_nom text,
  reattache       boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  SELECT
    r.id,
    r.athlete_id,
    a.first_name::text,
    a.last_name::text,
    r.rejected_at,
    r.rejected_by,
    NULLIF(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')::text,
    (a.school_id IS NOT NULL)
  FROM public.school_claim_rejections r
  JOIN public.athletes a ON a.id = r.athlete_id
  LEFT JOIN public.users u ON u.id = r.rejected_by
  WHERE r.cancelled_at IS NULL
    -- LE PÉRIMÈTRE, dans la requête elle-même : la clause porte sur
    -- `r.school_id`, école PAR ÉCOLE. Un directeur de deux écoles voit les
    -- rejets des deux ; un directeur d'une troisième n'en voit aucun.
    AND EXISTS (
      SELECT 1 FROM public.school_coaches sc
       WHERE sc.coach_id = auth.uid()
         AND sc.school_id = r.school_id
         AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
    )
  ORDER BY r.rejected_at DESC;
$function$;


-- ── ACL — liste complète, jamais par inclusion ─────────────────────────────
REVOKE ALL ON FUNCTION public.list_school_rejections() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_school_rejections() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — post-apply, SQL brut. Le périmètre, lui, se prouve par EXÉCUTION
-- (un directeur d'une autre école appelle et reçoit zéro ligne) : aucun
-- contrôle de catalogue ne peut le dire.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  r         record;
  v_acl     text[];
  v_attendu text[] := ARRAY['authenticated', 'postgres'];
  v_sortie  text;
BEGIN
  SELECT p.oid, p.proname, p.prosecdef, p.proconfig, p.provolatile
    INTO r
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'list_school_rejections';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEXUS: list_school_rejections absente';
  END IF;

  IF NOT r.prosecdef THEN
    RAISE EXCEPTION 'NEXUS: list_school_rejections n''est pas SECURITY DEFINER';
  END IF;

  IF r.proconfig IS NULL
     OR NOT ('search_path=public' = ANY (r.proconfig))
     OR NOT ('row_security=off'  = ANY (r.proconfig)) THEN
    RAISE EXCEPTION 'NEXUS: proconfig incomplet sur list_school_rejections : %',
      COALESCE(r.proconfig::text, '<NULL>');
  END IF;

  -- STABLE et non VOLATILE : c'est une lecture, et rien d'autre.
  IF r.provolatile <> 's' THEN
    RAISE EXCEPTION 'NEXUS: list_school_rejections devrait être STABLE, elle est %', r.provolatile;
  END IF;

  SELECT array_agg(g ORDER BY g) INTO v_acl
    FROM pg_proc pr,
         LATERAL (SELECT COALESCE(NULLIF(split_part(x, '=', 1), ''), 'PUBLIC') AS g
                    FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = r.oid;

  IF v_acl IS DISTINCT FROM v_attendu THEN
    RAISE EXCEPTION 'NEXUS: ACL de list_school_rejections = %, attendu %',
      COALESCE(v_acl::text, '<NULL = defaut, donc PUBLIC>'), v_attendu::text;
  END IF;

  -- La signature de sortie porte bien les 8 colonnes attendues, dont le
  -- booléen qui remplace le nom de la nouvelle école.
  v_sortie := pg_get_function_result(r.oid);
  IF v_sortie NOT LIKE '%reattache boolean%'
     OR v_sortie NOT LIKE '%rejected_by_nom text%'
     OR v_sortie NOT LIKE '%first_name text%' THEN
    RAISE EXCEPTION 'NEXUS: signature de sortie inattendue : %', v_sortie;
  END IF;

  -- Le périmètre est DANS la requête : la fonction doit interroger
  -- school_coaches et les deux rôles de direction. Contrôle grossier —
  -- la preuve reste l'exécution.
  IF pg_get_functiondef(r.oid) NOT ILIKE '%school_coaches%'
     OR pg_get_functiondef(r.oid) NOT ILIKE '%DIRECTEUR_INTERIM%' THEN
    RAISE EXCEPTION 'NEXUS: list_school_rejections ne borne pas son périmètre aux directeurs';
  END IF;

  -- Elle ne doit RIEN écrire : ni school_id, ni quoi que ce soit d'autre.
  IF pg_get_functiondef(r.oid) ~* '(INSERT|UPDATE|DELETE)[[:space:]]+INTO|UPDATE[[:space:]]+public\.' THEN
    RAISE EXCEPTION 'NEXUS: list_school_rejections contient une écriture — elle ne doit que lire';
  END IF;

  RAISE NOTICE 'NEXUS: liste des rejets — gates verts.';
END
$gate$;


-- ═══════════════════════════════════════════════════════════════════════════
-- LE PÉRIMÈTRE, PROUVÉ PAR EXÉCUTION (2026-09-09, transaction annulée)
--
-- Un rejet posé sur un athlète de Wildcats L-L, puis la fonction appelée sous
-- trois identités. Résultat brut :
--
--   directeur de l'école            n=1  athlète « David Caraghin »
--                                        rejeté par « Chuck Guitard »
--                                        reattache = f
--   directeur d'une AUTRE école     n=0
--   coach non directeur, même école n=0
--   après re-rattachement ailleurs  reattache = t  (sans nommer l'école)
--
-- Aucun contrôle de catalogue ne pouvait dire ça : le périmètre vit dans la
-- clause EXISTS, pas dans une propriété du catalogue. Rien n'a persisté —
-- 0 trace, athlète inchangé, file pg_net vide.
-- ═══════════════════════════════════════════════════════════════════════════
