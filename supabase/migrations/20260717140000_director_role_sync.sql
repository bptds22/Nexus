-- ═══════════════════════════════════════════════════════════════
-- Director role sync (Director oversight Part A, Step 2)
--
-- PROBLÈME (R1) : les branches RLS « directeur » testent
-- school_coaches.role IN ('DIRECTEUR','DIRECTEUR_INTERIM'), mais
-- apply_admin_claim_approval() ne pose QUE users.is_school_admin — jamais le
-- rôle school_coaches. Résultat : 0 ligne avec le rôle posé → les branches
-- directeur sont mortes. Cette migration réconcilie les deux représentations.
--
-- Trois parties, dans cet ordre (2a AVANT 2c, sinon le backfill d'un intérimaire
-- le rétrograderait) :
--   2a. sync_user_admin_flag() : DIRECTEUR strict → IN (DIRECTEUR, INTERIM).
--   2b. apply_admin_claim_approval() : upsert aussi school_coaches.role.
--   2c. backfill des directeurs existants, trigger de rétrogradation DÉSACTIVÉ.
--
-- ⚠️ À appliquer en UNE transaction (supabase db push le fait ; en local :
--    psql -1 -f) pour que le DISABLE/ENABLE TRIGGER du 2c soit atomique.
-- ═══════════════════════════════════════════════════════════════

-- ── 2a. Le flag admin doit rester vrai pour un INTÉRIMAIRE aussi.
--     Sans ça, poser role='DIRECTEUR_INTERIM' (au backfill 2c ou via une
--     approbation) mettrait is_school_admin = false → casse ce qui marche.
CREATE OR REPLACE FUNCTION public.sync_user_admin_flag()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE users
  SET is_school_admin = (NEW.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM'))
  WHERE id = NEW.coach_id;

  RETURN NEW;
END;
$function$;

-- ── 2b. À l'approbation d'une réclamation, poser les DEUX représentations.
--     Ajout : après la promotion dans `users`, un upsert dans school_coaches.
--     (Le trigger de rétrogradation reste ACTIF ici — pour une vraie nouvelle
--      approbation, rétrograder l'intérimaire en place + le notifier EST voulu.)
CREATE OR REPLACE FUNCTION public.apply_admin_claim_approval()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_type TEXT;
BEGIN
  -- Only react to PENDING → terminal transitions.
  IF OLD.status IS DISTINCT FROM 'PENDING' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'APPROVED' THEN
    v_admin_type := CASE
      WHEN NEW.claim_type = 'DIRECTEUR' THEN 'owner'
      WHEN NEW.claim_type = 'INTERIM' THEN 'interim'
      ELSE NULL
    END;

    -- Demote any sitting interim on this school when a DIRECTEUR
    -- claim is approved. Skip if the claimant somehow is the same
    -- person (shouldn't happen — wizard prevents claiming twice via
    -- the unique partial index on PENDING — but be defensive).
    IF NEW.claim_type = 'DIRECTEUR' THEN
      UPDATE public.users
      SET is_school_admin = false,
          profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
      WHERE school_id = NEW.school_id
        AND is_school_admin = true
        AND COALESCE(profile_data->>'admin_type', '') = 'interim'
        AND id <> NEW.user_id;
    END IF;

    -- Promote the claimant.
    UPDATE public.users
    SET is_school_admin = true,
        profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', v_admin_type)
    WHERE id = NEW.user_id;

    -- NEW (Part A) : poser AUSSI le rôle school_coaches, source de vérité des
    -- branches RLS directeur. Les approbations futures posent donc les deux
    -- représentations atomiquement.
    -- SCOPE COACH-ONLY : school_coaches est la table coach↔école ; les branches
    -- RLS directeur sont côté COACH. Un admin CÉGEP (RECRUTEUR) ne doit PAS avoir
    -- de ligne school_coaches. On ne pose donc le rôle que pour un COACH.
    IF v_admin_type IS NOT NULL
       AND (SELECT u.role FROM public.users u WHERE u.id = NEW.user_id) = 'COACH'::public.user_role
    THEN
      INSERT INTO public.school_coaches (school_id, coach_id, role)
      VALUES (
        NEW.school_id,
        NEW.user_id,
        CASE WHEN NEW.claim_type = 'INTERIM'
             THEN 'DIRECTEUR_INTERIM'::public.coach_school_role
             ELSE 'DIRECTEUR'::public.coach_school_role END
      )
      ON CONFLICT (school_id, coach_id) DO UPDATE SET role = EXCLUDED.role;
    END IF;

  ELSIF NEW.status = 'REJECTED' THEN
    -- Defensive cleanup. is_school_admin was never set on PENDING
    -- (wizard guard), but profile_data.admin_type was written so the
    -- claimant could read it back. Clear it on rejection.
    UPDATE public.users
    SET profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 2c. Backfill des directeurs déjà en place (is_school_admin = true).
--     ⚠️ trg_demote_interim_on_director_appointment se déclenche sur toute
--     transition vers 'DIRECTEUR' : il rétrograderait les intérimaires de la
--     même école ET écrirait de VRAIES notifications. On le DÉSACTIVE le temps
--     du backfill (ce sont des directeurs déjà établis, pas de nouvelles
--     nominations). trg_sync_admin_flag reste actif (inoffensif : il ré-affirme
--     is_school_admin = true grâce au 2a).
ALTER TABLE public.school_coaches DISABLE TRIGGER trg_demote_interim_on_director_appointment;

INSERT INTO public.school_coaches (school_id, coach_id, role)
SELECT u.school_id,
       u.id,
       CASE WHEN u.profile_data->>'admin_type' = 'interim'
            THEN 'DIRECTEUR_INTERIM'::public.coach_school_role
            ELSE 'DIRECTEUR'::public.coach_school_role END   -- 'owner' ou NULL → DIRECTEUR
FROM public.users u
WHERE u.is_school_admin = true
  AND u.school_id IS NOT NULL
  AND u.role = 'COACH'::public.user_role   -- SCOPE : directeurs d'ÉCOLE seulement,
                                            -- pas les admins CÉGEP (RECRUTEUR).
ON CONFLICT (school_id, coach_id) DO UPDATE SET role = EXCLUDED.role;

ALTER TABLE public.school_coaches ENABLE TRIGGER trg_demote_interim_on_director_appointment;
