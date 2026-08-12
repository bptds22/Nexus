-- ═══════════════════════════════════════════════════════════════
-- LOT 2 SÉCURITÉ — TEMPS 1, correctif de grants
--
-- Constat après application de 20260810210500 : les trois RPC
-- portaient « anon=X » dans leur ACL, alors que la migration ne
-- grantait qu'à authenticated et service_role.
--
-- CAUSE : Supabase pose un ALTER DEFAULT PRIVILEGES qui accorde
-- EXECUTE sur toute nouvelle fonction du schéma public à anon et
-- authenticated. Un « REVOKE ALL ... FROM PUBLIC » ne retire PAS
-- un grant nominatif au rôle anon — PUBLIC et anon sont deux
-- attributions distinctes. Le REVOKE doit nommer anon.
--
-- IMPACT RÉEL AVANT CORRECTIF : nul en pratique. Le garde
-- is_recruiter() rejette anon (auth.uid() NULL → EXISTS false →
-- exception 42501), ce qui a été vérifié par test. Mais c'est la
-- défense en profondeur qui manquait : le garde applicatif était
-- la SEULE barrière, sans le grant pour la doubler. On rétablit
-- les deux niveaux.
--
-- NOTE : athlete_identity_ok garde volontairement son EXECUTE à
-- anon. C'est une fonction scalaire pure, sans accès à aucune
-- table : elle ne peut rien divulguer que l'appelant ne lui ait
-- déjà fourni en argument.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

REVOKE EXECUTE ON FUNCTION public.recruiter_athlete_cards(uuid[]) FROM anon;

REVOKE EXECUTE ON FUNCTION public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer
) FROM anon;

REVOKE EXECUTE ON FUNCTION public.recruiter_athlete_profile(uuid) FROM anon;

COMMIT;
