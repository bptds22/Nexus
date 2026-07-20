-- consume_athlete_invitation_revoke_anon
-- SUPERSEDED : le REVOKE anon définitif vit dans
-- 20260620130000_consume_athlete_invitation.sql (juste après le CREATE, l.74-76).
-- Ce fichier précède le CREATE → garde IF EXISTS pour ne pas planter au reset
-- local à blanc (fonction pas encore créée). Conservé (non supprimé) pour
-- aligner l'historique des migrations déjà appliquées en prod.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'consume_athlete_invitation'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.consume_athlete_invitation(text, uuid) FROM anon;
  END IF;
END $$;
