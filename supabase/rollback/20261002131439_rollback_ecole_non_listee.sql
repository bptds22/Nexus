-- ROLLBACK de 20261002131439_ecole_non_listee.
-- ⚠ Supprime les textes saisis. Les exporter d'abord si la colonne a servi :
--   select id, user_id, ecole_non_listee from public.athletes where ecole_non_listee is not null;
-- Les lignes admin_notifications 'ECOLE_NON_LISTEE' sont laissées (historique).
DROP TRIGGER IF EXISTS trg_notifier_ecole_non_listee ON public.athletes;
DROP FUNCTION IF EXISTS public.notifier_ecole_non_listee();
ALTER TABLE public.athletes DROP CONSTRAINT IF EXISTS athletes_ecole_non_listee_longueur;
ALTER TABLE public.athletes DROP COLUMN IF EXISTS ecole_non_listee;
