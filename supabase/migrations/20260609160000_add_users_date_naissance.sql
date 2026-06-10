-- ═══════════════════════════════════════════════════════════════
-- iter coach-dob-migration — Ajoute users.date_naissance + persistance.
--
-- 1. ALTER TABLE : colonne date nullable. Idempotent (IF NOT EXISTS).
--    Les comptes existants restent à NULL (pas de back-fill). Aucune
--    contrainte ou RLS nouvelle — `users` a déjà ses policies, un
--    champ nullable additif ne casse rien.
--
-- 2. handle_new_auth_user étendu : capture date_naissance depuis
--    raw_user_meta_data->>'date_naissance' et l'écrit dans la colonne.
--    Cast safe par regex ISO YYYY-MM-DD ; format invalide → NULL
--    (ne plante PAS le signup, le trigger doit rester non-bloquant).
--
-- Note cohérence : athletes.date_naissance reste la source de vérité
-- pour les athlètes (déjà câblée + écrite par AthleteOnboardingMobile
-- au submit b3). users.date_naissance = pour les rôles dans users
-- (COACH, RECRUTEUR, ADMIN). Pas de migration des athlètes existants.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_naissance date;

-- Re-create le trigger function en ajoutant date_naissance dans
-- l'INSERT. Le reste (role/status/names/context + invitation_token
-- consume) est repris verbatim. CREATE OR REPLACE → pas de DROP du
-- trigger lui-même (toujours rattaché à auth.users.AFTER INSERT).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_token text;
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
    -- date_naissance : cast safe via regex ISO YYYY-MM-DD. Format
    -- invalide / absent → NULL (le trigger NE doit PAS planter au
    -- signup, sinon auth.users INSERT échoue et le compte n'est
    -- jamais créé). L'input mobile envoie toujours du ISO via
    -- <input type="date">.
    CASE
      WHEN NEW.raw_user_meta_data->>'date_naissance' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN (NEW.raw_user_meta_data->>'date_naissance')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  -- Consume invitation token if present in signup metadata.
  -- consume_invitation_token is SECURITY DEFINER + row_security=off
  -- so it can write to invitations + users atomically.
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_invitation_token IS NOT NULL AND v_invitation_token != '' THEN
    PERFORM public.consume_invitation_token(v_invitation_token, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;
