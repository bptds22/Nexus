-- ═══════════════════════════════════════════════════════════════
-- La garde de périmètre athlète n'a JAMAIS pu dire ce qu'elle bloque.
--
-- ── LE DÉFAUT ──────────────────────────────────────────────────
-- `enforce_athlete_self_edit_perimeter()` (posée le 2026-09-09 par
-- 20260909191744, redéployée en INVOKER par 20260909191916) accumule les
-- colonnes refusées dans un `text[]` :
--
--     v_bloquees text[] := ARRAY[]::text[];
--     ...
--     v_bloquees := v_bloquees || 'consentement_parental_date';
--
-- Sur `text[] || <littéral unknown>`, PostgreSQL résout l'opérateur en
-- `anyarray || anyarray` et tente de parser la CHAÎNE comme un tableau :
--
--     ERROR 22P02: malformed array literal: "consentement_parental_date"
--     DETAIL: Array value must start with "{" or dimension information.
--
-- La résolution se fait À L'ANALYSE, pas au runtime : vérifié en prod, la
-- forme échoue aussi bien sur un tableau VIDE que NON VIDE. Les VINGT
-- lignes sont donc mortes, et le `RAISE EXCEPTION 'NEXUS: …'` prévu dix
-- lignes plus bas n'a jamais été atteint une seule fois depuis le
-- 2026-09-09.
--
-- ── CE QUE ÇA A COÛTÉ ──────────────────────────────────────────
-- La garde protège correctement — la transaction est bien annulée, aucune
-- écriture interdite n'est passée. C'est le MESSAGE qui est perdu : au lieu
-- de « NEXUS: ces informations ne se modifient pas depuis ton profil (…) »,
-- l'athlète reçoit une erreur interne PostgreSQL, et l'écran affiche un
-- « Échec de sauvegarde » que personne ne peut diagnostiquer.
--
-- C'est ce qui a rendu illisible le signalement du 2026-09-15 : une mineure
-- bloquée à l'inscription web, un message nommant `consentement_parental_date`,
-- et une utilisatrice qui cherche un champ de date qui n'existe pas. La cause
-- fonctionnelle est corrigée côté client (commit dc83173) ; celle-ci corrige
-- ce qui l'a rendue indéchiffrable.
--
-- Parent de la règle « marqueur NEXUS: sur les RAISE » : là un RAISE sans
-- préfixe n'atteignait pas l'écran ; ici le RAISE n'est pas atteint du tout.
-- Même leçon — un chemin d'erreur qui n'est jamais joué n'est pas du code,
-- c'est une intention.
--
-- ── LA CORRECTION ──────────────────────────────────────────────
-- `array_append(anyarray, anyelement)` est NON AMBIGU : il n'existe pas de
-- surcharge qui prendrait le second argument pour un tableau. Aucune autre
-- modification — le corps est repris de `pg_get_functiondef()` en production,
-- vérifié identique au dépôt (20260909191916) hors commentaires et espaces.
-- Les 20 gardes, l'exclusion volontaire de `statut_recrutement_override`, le
-- discriminant `current_user`, le mode INVOKER : tout est inchangé.
--
-- REPLI : `CREATE OR REPLACE` de 20260909191916, identique à ce qui tourne.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture DIRECTE ? On ne s'en mêle pas.
  -- En INVOKER, current_user = 'authenticated' pour un UPDATE venu du client,
  -- et le propriétaire de la fonction appelante pour un chemin DEFINER.
  -- ⚠ EXCLUSION VOLONTAIRE : statut_recrutement_override n'est PAS bloquée —
  -- règle produit CLAUDE.md, l'écriture athlète y est légitime.
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := array_append(v_bloquees, 'user_id');   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id  THEN v_bloquees := array_append(v_bloquees, 'coach_id');  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN v_bloquees := array_append(v_bloquees, 'school_id'); END IF;
  IF NEW.status    IS DISTINCT FROM OLD.status    THEN v_bloquees := array_append(v_bloquees, 'status');    END IF;

  IF NEW.verified            IS DISTINCT FROM OLD.verified            THEN v_bloquees := array_append(v_bloquees, 'verified');            END IF;
  IF NEW.verified_at         IS DISTINCT FROM OLD.verified_at         THEN v_bloquees := array_append(v_bloquees, 'verified_at');         END IF;
  IF NEW.verified_by         IS DISTINCT FROM OLD.verified_by         THEN v_bloquees := array_append(v_bloquees, 'verified_by');         END IF;
  IF NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN v_bloquees := array_append(v_bloquees, 'verification_method'); END IF;

  IF NEW.cote_globale_entraineur IS DISTINCT FROM OLD.cote_globale_entraineur THEN v_bloquees := array_append(v_bloquees, 'cote_globale_entraineur'); END IF;

  IF NEW.profile_completion IS DISTINCT FROM OLD.profile_completion THEN v_bloquees := array_append(v_bloquees, 'profile_completion'); END IF;
  IF NEW.is_showcase        IS DISTINCT FROM OLD.is_showcase        THEN v_bloquees := array_append(v_bloquees, 'is_showcase');        END IF;

  IF NEW.consentement_parental      IS DISTINCT FROM OLD.consentement_parental      THEN v_bloquees := array_append(v_bloquees, 'consentement_parental');      END IF;
  IF NEW.consentement_parental_date IS DISTINCT FROM OLD.consentement_parental_date THEN v_bloquees := array_append(v_bloquees, 'consentement_parental_date'); END IF;
  IF NEW.partner_visibility_opt_in            IS DISTINCT FROM OLD.partner_visibility_opt_in            THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opt_in');            END IF;
  IF NEW.partner_visibility_opted_in_at       IS DISTINCT FROM OLD.partner_visibility_opted_in_at       THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_opted_in_at');       END IF;
  IF NEW.partner_visibility_parental_consent  IS DISTINCT FROM OLD.partner_visibility_parental_consent  THEN v_bloquees := array_append(v_bloquees, 'partner_visibility_parental_consent');  END IF;

  IF NEW.recruitment_status            IS DISTINCT FROM OLD.recruitment_status            THEN v_bloquees := array_append(v_bloquees, 'recruitment_status');            END IF;
  IF NEW.recruitment_status_changed_by IS DISTINCT FROM OLD.recruitment_status_changed_by THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_by'); END IF;
  IF NEW.recruitment_status_changed_at IS DISTINCT FROM OLD.recruitment_status_changed_at THEN v_bloquees := array_append(v_bloquees, 'recruitment_status_changed_at'); END IF;
  IF NEW.committed_school_id           IS DISTINCT FROM OLD.committed_school_id           THEN v_bloquees := array_append(v_bloquees, 'committed_school_id');           END IF;

  IF array_length(v_bloquees, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: ces informations ne se modifient pas depuis ton profil (%). Elles sont tenues par ton entraîneur ou par Nexus.',
      array_to_string(v_bloquees, ', ');
  END IF;

  RETURN NEW;
END;
$function$;

-- ── GATE : la forme fautive ne doit plus exister, et le compte doit tenir ──
-- Un correctif qui se contente de remplacer 20 lignes à la main mérite d'être
-- vérifié par la machine : il suffit d'en oublier une pour que le défaut
-- survive sur la colonne qu'on n'a pas relue.
DO $gate$
DECLARE
  v_def text;
  v_appends int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'enforce_athlete_self_edit_perimeter';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'NEXUS: enforce_athlete_self_edit_perimeter introuvable après remplacement';
  END IF;

  IF position('v_bloquees || ''' in v_def) > 0 THEN
    RAISE EXCEPTION 'NEXUS: la forme fautive « v_bloquees || ''…'' » subsiste dans la fonction';
  END IF;

  v_appends := (length(v_def) - length(replace(v_def, 'array_append(v_bloquees,', '')))
               / length('array_append(v_bloquees,');
  IF v_appends <> 20 THEN
    RAISE EXCEPTION 'NEXUS: % array_append(v_bloquees, …) trouvés, 20 attendus', v_appends;
  END IF;

  -- Le trigger doit toujours être posé sur la table.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
     WHERE t.tgrelid = 'public.athletes'::regclass
       AND t.tgname = 'trg_athlete_self_edit_perimeter'
       AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'NEXUS: trg_athlete_self_edit_perimeter absent de public.athletes';
  END IF;

  RAISE NOTICE 'NEXUS: garde de périmètre — 20 array_append, forme fautive absente, trigger en place.';
END;
$gate$;
