-- Loi 25 — journaliser le RETRAIT de consentement dans deactivate_my_account.
--
-- PROBLÈME CORRIGÉ : deactivate_my_account(p_revoke_consent := true) — appelée
-- par le bouton « Retirer le consentement » des réglages athlète (web
-- app/athlete/parametres/page.tsx:106 et mobile
-- components/shared/AthleteParametresMobile.tsx:320) — mettait
-- athletes.consentement_parental à false SANS écrire une seule ligne dans
-- consent_audit_trail. C'était le retrait de consentement le plus lourd du
-- produit, et il ne laissait aucune trace. Sous Loi 25 un retrait doit être
-- démontrable.
--
-- CE QUI CHANGE : uniquement le CORPS de la fonction. Aucun DDL sur une table,
-- aucun trigger créé ou renommé, aucun privilège touché.
--
--   * Ordre des triggers BEFORE sur `athletes` PRÉSERVÉ. CREATE OR REPLACE
--     FUNCTION ne recrée pas les triggers. trg_zz_preserve_athlete_denorm
--     (chantier badges) reste le dernier — ce qui est load-bearing : s'il
--     cessait de l'être, poser un badge déplacerait la cote affichée.
--   * Privilèges EXECUTE PRÉSERVÉS. CREATE OR REPLACE conserve l'ACL
--     existante ; on ne rejoue donc AUCUN GRANT/REVOKE ici. L'ACL vivante
--     (postgres, anon, authenticated, service_role) reste telle quelle.
--   * Clauses reportées intégralement — SECURITY DEFINER, row_security = off,
--     search_path = public. CREATE OR REPLACE FUNCTION ne conserve PAS les
--     clauses omises : les taire les réinitialiserait silencieusement (même
--     piège que le WITH d'une vue, cf. MIGRATION SAFETY CHECKLIST §10).
--
-- CONDITION D'ÉCRITURE : on ne journalise QUE une transition réelle
-- true -> false. p_revoke_consent = false (désactivation simple, y compris
-- l'appelant recruteur RecruteurParametresMobile.tsx:267) n'écrit rien ;
-- un appelant sans fiche athlète non plus ; un consentement déjà false non
-- plus. Pas de ligne si rien ne change.
--
-- BEST EFFORT : l'INSERT est enveloppé dans exception when others then
-- raise warning — motif déjà employé par notify_parent_on_minor. Si l'audit
-- échoue, la désactivation aboutit quand même. Un journal ne doit jamais
-- casser l'écriture qu'il observe.
--
-- FORME DE L'ENREGISTREMENT : alignée sur set_child_consent (le chemin
-- PARENT), mêmes conventions de metadata — acting_role, l'acteur, consent_key,
-- et previous/new_status en minuscules 'granted' / 'withdrawn'.
-- Différences assumées : acting_role = 'ATHLETE' (au lieu de 'PARENT'),
-- l'acteur est nommé athlete_user_id (miroir de parent_user_id),
-- consent_key = 'consentement_parental' (une 3e clé, hors des deux que
-- set_child_consent accepte), et source = 'deactivate_my_account'.
-- policy_version est ABSENT : la fonction n'en reçoit aucun et on préfère
-- l'omettre plutôt que d'en inventer un.
--
-- NON TRAITÉ ICI, DÉLIBÉRÉMENT : consentement_parental_date reste inscrite
-- après le retrait. Décision laissée à BP (voir rapport). Deux surfaces
-- affichent cette date sans la conditionner au booléen —
-- app/admin/loi25/page.tsx:288 et AthleteParametresMobile.tsx:600.

CREATE OR REPLACE FUNCTION public.deactivate_my_account(p_revoke_consent boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security = off
 SET search_path = public
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_athlete_id uuid;
  v_prev       boolean;
  v_consent_id uuid;
  v_ip         text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Instantané AVANT l'UPDATE : sans lui on ne peut pas distinguer un retrait
  -- réel d'un no-op (la fiche est déjà écrasée après). 0 ligne pour un
  -- appelant non-athlète -> v_athlete_id NULL -> aucun audit.
  SELECT id, consentement_parental, consent_id
    INTO v_athlete_id, v_prev, v_consent_id
    FROM public.athletes
   WHERE user_id = v_uid;

  UPDATE public.users
     SET status = 'DESACTIVE'
   WHERE id = v_uid;

  UPDATE public.athletes
     SET status = 'DESACTIVE',
         consentement_parental = CASE WHEN p_revoke_consent
                                      THEN false
                                      ELSE consentement_parental END
   WHERE user_id = v_uid;

  -- Audit Loi 25 — best effort, jamais bloquant.
  IF p_revoke_consent AND v_athlete_id IS NOT NULL AND v_prev IS TRUE THEN
    BEGIN
      -- IP : même extraction que set_child_consent, garde interne incluse
      -- (request.headers est absent hors contexte PostgREST).
      BEGIN
        v_ip := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for';
      EXCEPTION WHEN others THEN
        v_ip := null;
      END;

      INSERT INTO public.consent_audit_trail
        (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
      VALUES (
        v_consent_id, v_athlete_id, null, 'WITHDRAWN', 'granted', 'withdrawn', v_ip,
        jsonb_build_object(
          'acting_role',     'ATHLETE',
          'athlete_user_id', v_uid,
          'consent_key',     'consentement_parental',
          'source',          'deactivate_my_account'
        )
      );
    EXCEPTION WHEN others THEN
      RAISE WARNING 'deactivate_my_account: retrait NON journalisé pour athlete % : %',
                    v_athlete_id, SQLERRM;
    END;
  END IF;
END;
$function$;
