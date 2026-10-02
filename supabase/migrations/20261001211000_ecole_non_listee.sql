-- ═══════════════════════════════════════════════════════════════════════════
-- « Mon école n'est pas listée » (décision BP 2026-10-01).
--
-- Pas de chantier cégep : on RECUEILLE. L'athlète qui ne trouve pas son école
-- l'écrit en clair, l'inscription continue (school_id NULL — chk_school_or_league
-- l'admet), et l'admin reçoit ce qu'il a écrit. Le chantier cégep se décidera
-- sur ces données (16 des 33 comptes bloqués à l'étape école étaient majeurs).
--
-- Additif seulement : une colonne nullable, un trigger AFTER.
--   • athletes.ecole_non_listee — le texte, tel qu'écrit (2 à 200 car.).
--     PAS dans le périmètre protégé : c'est une déclaration de l'athlète, pas
--     une donnée tenue par le coach. Remis à NULL par le client dès qu'une
--     école est choisie ; l'admin, en rattachant l'école, le laisse ou l'efface.
--   • notifier_ecole_non_listee() — une ligne admin_notifications par texte
--     NOUVEAU (INSERT, ou UPDATE qui change le texte). Une resauvegarde à
--     l'identique (le web sauve à chaque étape) n'en crée pas d'autre.
--
-- ⚠ admin_notifications n'a AUCUN lecteur aujourd'hui (RLS sans policy, cf.
-- app/admin/ambassadeurs/page.tsx). La ligne est écrite pour l'historique ;
-- ce qui se VOIT est la carte « Écoles non listées » de /admin/dashboard, lue
-- en direct sur athletes.ecole_non_listee.
-- ═══════════════════════════════════════════════════════════════════════════

-- Le trigger écrit un NOM d'athlète dans admin_notifications : la table doit
-- être fermée aux clients. Prod : RLS active, 0 policy (relevé 2026-10-01).
-- Le local avait dérivé (RLS INACTIVE → anon/authenticated lisaient tout).
-- Idempotent en prod ; gardé par l'assertion en fin de fichier.
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS ecole_non_listee text;

ALTER TABLE public.athletes
  ADD CONSTRAINT athletes_ecole_non_listee_longueur
  CHECK (ecole_non_listee IS NULL OR char_length(btrim(ecole_non_listee)) BETWEEN 2 AND 200)
  NOT VALID;
ALTER TABLE public.athletes VALIDATE CONSTRAINT athletes_ecole_non_listee_longueur;

COMMENT ON COLUMN public.athletes.ecole_non_listee IS
  'Texte libre « Mon école n''est pas listée » saisi à l''onboarding (2026-10-01). NULL dès qu''une école est choisie.';

CREATE OR REPLACE FUNCTION public.notifier_ecole_non_listee()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ecole_non_listee IS NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND btrim(NEW.ecole_non_listee) IS NOT DISTINCT FROM btrim(OLD.ecole_non_listee) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.admin_notifications (type, title, message, related_user_id)
  VALUES (
    'ECOLE_NON_LISTEE',
    'École non listée à l''inscription',
    coalesce(nullif(btrim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')), ''), 'Un athlète')
      || ' a écrit : « ' || btrim(NEW.ecole_non_listee) || ' »',
    NEW.user_id
  );
  RETURN NULL;
END;
$function$;

-- Fonction de trigger : personne n'a à l'appeler. Les default privileges de
-- Supabase viennent d'accorder EXECUTE à anon/authenticated/service_role —
-- on retire tout, puis on compare la liste COMPLÈTE.
REVOKE ALL ON FUNCTION public.notifier_ecole_non_listee() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_notifier_ecole_non_listee ON public.athletes;
CREATE TRIGGER trg_notifier_ecole_non_listee
  AFTER INSERT OR UPDATE OF ecole_non_listee ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.notifier_ecole_non_listee();

DO $$
DECLARE
  vus  text[];
  veut text[] := ARRAY['postgres'];
BEGIN
  SELECT array_agg(t.g ORDER BY t.g) INTO vus
    FROM pg_proc pr,
         LATERAL (SELECT coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') AS g
                    FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = 'public.notifier_ecole_non_listee'::regproc;
  IF vus IS DISTINCT FROM veut THEN
    RAISE EXCEPTION 'NEXUS: ACL notifier_ecole_non_listee = %, attendu %', vus, veut;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.admin_notifications'::regclass) THEN
    RAISE EXCEPTION 'NEXUS: admin_notifications sans RLS — le texte et le nom de l''athlète seraient lisibles';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.admin_notifications'::regclass) THEN
    RAISE EXCEPTION 'NEXUS: admin_notifications porte une policy — revoir qui lit ces avis avant d''y écrire des noms';
  END IF;
END $$;
