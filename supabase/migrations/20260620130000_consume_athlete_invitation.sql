-- ════════════════════════════════════════════════════════════════════
-- #48 sous-unité 3 — lier l'athlète orphelin au compte au signup (Option B)
--
-- 1) consume_athlete_invitation(p_token, p_new_user_id) : consomme le token
--    (one-shot, PENDING → CONSUMED) et lie la ligne orpheline précise
--    (UPDATE athletes.user_id WHERE id = athlete_id AND user_id IS NULL) —
--    jamais d'INSERT (#47 préservé). No-op silencieux sur token invalide.
-- 2) handle_new_auth_user : branche claim_token ajoutée APRÈS l'INSERT users,
--    en best-effort STRICT — un token invalide ne doit JAMAIS casser le signup.
--
-- Design : liaison dans le trigger (atomique au signup, NEW.id autoritaire,
-- robuste même si la confirmation email est réactivée au go-live).
-- ════════════════════════════════════════════════════════════════════

-- ── 1. consume_athlete_invitation ───────────────────────────────────
-- DROP+recreate sur la signature exacte (évite tout overload ambigu).
DROP FUNCTION IF EXISTS public.consume_athlete_invitation(text, uuid);

CREATE OR REPLACE FUNCTION public.consume_athlete_invitation(
  p_token        text,
  p_new_user_id  uuid
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
DECLARE
  v_athlete_id uuid;
BEGIN
  -- (a) Garde C1 — un appelant connecté ne peut pas consommer pour un AUTRE
  --     user. Inerte dans le trigger handle_new_auth_user (auth.uid() est NULL
  --     au signup, NEW.id fait foi) ; active en appel client authentifié.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_new_user_id THEN
    RAISE EXCEPTION 'consume_athlete_invitation: cannot consume for another user';
  END IF;

  -- (b) Consume atomique one-shot. No-match (absent / expiré / déjà CONSUMED) →
  --     v_athlete_id NULL, AUCUN RAISE — un mauvais token ne casse jamais le signup.
  UPDATE public.athlete_invitations
  SET status              = 'CONSUMED',
      consumed_by_user_id = p_new_user_id,
      consumed_at         = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING athlete_id INTO v_athlete_id;

  -- (c) Token invalide → no-op silencieux.
  IF v_athlete_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- (d) Liaison orphelin — UPDATE ciblé par id (#47 : jamais d'INSERT, athletes.id
  --     préservé). Gardé par user_id IS NULL → no-op si déjà réclamé (le token
  --     reste CONSUMED / one-shot, pas de re-liaison).
  UPDATE public.athletes
  SET user_id = p_new_user_id
  WHERE id = v_athlete_id
    AND user_id IS NULL;

  -- (e)
  RETURN v_athlete_id;
END;
$function$;

-- EXECUTE réservé. Supabase auto-grant EXECUTE des nouvelles fonctions public à
-- anon/authenticated/service_role via ses default privileges → on révoque
-- EXPLICITEMENT anon : un appelant NON authentifié a auth.uid() NULL, donc la
-- garde C1 serait inerte et il pourrait lier un orphelin à un user_id arbitraire.
-- authenticated garde l'accès (garde C1 active) ; service_role est serveur/de
-- confiance ; le trigger appelle la fonction en tant que propriétaire (postgres).
REVOKE ALL ON FUNCTION public.consume_athlete_invitation(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_athlete_invitation(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_athlete_invitation(text, uuid) TO authenticated;


-- ── 2. handle_new_auth_user — ajout de la branche claim_token ────────
-- Signature inchangée (() RETURNS trigger) → CREATE OR REPLACE conserve le
-- binding du trigger on_auth_user_created sur auth.users (pas de DROP du trigger).
-- Tout le comportement existant est reproduit à l'identique ; seule la branche
-- claim_token est ajoutée, en best-effort strict.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_token text;
  v_claim_token      text;
BEGIN
  INSERT INTO public.users (
    id, email, role, status, first_name, last_name, context, date_naissance
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'ATHLETE'::public.user_role
    ),
    'ACTIF'::public.account_status,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE NEW.raw_user_meta_data->>'context'
      WHEN 'scolaire'     THEN 'scolaire'
      WHEN 'collegial'    THEN 'collegial'
      WHEN 'ligue_civile' THEN 'ligue_civile'
      ELSE NULL
    END,
    -- date_naissance : cast safe via regex ISO YYYY-MM-DD. Format invalide /
    -- absent → NULL (le trigger NE doit PAS planter au signup).
    CASE
      WHEN NEW.raw_user_meta_data->>'date_naissance' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN (NEW.raw_user_meta_data->>'date_naissance')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Existant (INCHANGÉ) : consomme un token d'invitation école/coach si présent.
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_invitation_token IS NOT NULL AND v_invitation_token != '' THEN
    PERFORM public.consume_invitation_token(v_invitation_token, NEW.id);
  END IF;

  -- NOUVEAU : consomme un token de claim athlète → lie l'orphelin au compte.
  -- BEST-EFFORT STRICT : consume_athlete_invitation est déjà no-op sur token
  -- invalide ; le bloc EXCEPTION est une ceinture supplémentaire pour qu'AUCUNE
  -- erreur (token foireux, imprévu) ne puisse rollback la création du compte.
  v_claim_token := NEW.raw_user_meta_data->>'claim_token';
  IF v_claim_token IS NOT NULL AND v_claim_token <> '' THEN
    BEGIN
      PERFORM public.consume_athlete_invitation(v_claim_token, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'consume_athlete_invitation failed (non-fatal): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
