-- =====================================================================
-- CLAIM SIGNUP ROLE -- nexus-prod
-- =====================================================================
-- Contexte : bug prod (launch, juillet 2026). Le signup OAuth NATIF
-- (iOS/Android) ne transmet aucun role :
--   - le trigger handle_new_auth_user fait COALESCE(meta->>'role', 'ATHLETE')
--   - l'OAuth ne peut pas ecrire raw_user_meta_data.role
--   - le web corrige au retour via /auth/callback (route handler, service_role)
--   - MAIS /auth/callback est EXCLU du build mobile output:'export'
--     => la correction du role est physiquement absente de l'app native.
-- Resultat : tout coach/recruteur qui s'inscrit avec Google/Apple sur mobile
-- devient ATHLETE.
--
-- Cette migration fournit le chemin d'ecriture privilegie qui manque au
-- mobile. Elle est INERTE tant que personne n'appelle les RPC : elle peut
-- donc etre appliquee AVANT le rebuild natif, sans rien casser.
--
-- Pourquoi une RPC SECURITY DEFINER et pas un simple UPDATE client :
--   la policy "users update own" porte
--     WITH CHECK user_privileged_cols_unchanged(role, status, is_platform_admin,
--                                               context, is_school_admin)
--   => un utilisateur ne peut PAS s'auto-attribuer un role. Seul is_admin()
--   ecrit users.role. La RPC est le seul chemin legitime.
--
-- HORS SCOPE : le trigger n'est pas modifie (son defaut ATHLETE reste le
-- filet de securite du web). Le signup email/mot de passe n'est pas touche.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Marqueur one-shot.
--    Sans lui, les seuls predicats disponibles (onboarding_complete=false,
--    pas de fiche athlete) restent vrais pendant toute la duree de
--    l'onboarding : l'utilisateur pourrait rappeler la RPC en boucle.
--    Ce n'est pas une escalade (la whitelist bloque ADMIN/PARTNER), mais
--    ce ne serait pas un one-shot. Cette colonne rend la garantie reelle.
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role_claimed_at timestamptz;

COMMENT ON COLUMN public.users.role_claimed_at IS
  'Horodatage de la reclamation de role au signup (RPC claim_signup_role, ou override OAuth web /auth/callback). NON NULL = role fige, la RPC refuse toute nouvelle reclamation.';

-- ---------------------------------------------------------------------
-- 2. Backfill defensif : tout compte ETABLI devient inelig ible a la RPC.
--    On laisse volontairement role_claimed_at IS NULL sur les comptes
--    encore en cours d'onboarding -- dont les comptes sociaux casses par
--    le bug : ils redemanderont leur role au prochain login (auto-reparation).
-- ---------------------------------------------------------------------
UPDATE public.users
SET    role_claimed_at = now()
WHERE  role_claimed_at IS NULL
  AND (onboarding_complete IS TRUE OR role IN ('ADMIN', 'PARTNER'));

-- ---------------------------------------------------------------------
-- 3. needs_signup_role() -- MEME predicat que la garde en ecriture.
--    C'est le point critique : le client ne DEVINE pas s'il s'agit d'un
--    compte neuf (created_at ~ last_sign_in_at est une heuristique
--    temporelle evaluee sur une horloge client -- un faux positif
--    re-attribuerait le role d'un utilisateur existant). Il DEMANDE au
--    serveur. La decision UI et la garde en ecriture partagent le meme
--    predicat, donc elles ne peuvent pas diverger.
--
--    Retourne false (jamais d'exception) : un appel non authentifie ou un
--    profil absent ne doit pas afficher d'ecran de role.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.needs_signup_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM public.users WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_row.role_claimed_at IS NOT NULL THEN
    RETURN false;                       -- role deja fige (one-shot consomme)
  END IF;

  IF v_row.onboarding_complete IS TRUE THEN
    RETURN false;                       -- compte etabli
  END IF;

  IF EXISTS (SELECT 1 FROM public.athletes WHERE user_id = v_uid) THEN
    RETURN false;                       -- fiche athlete deja creee
  END IF;

  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. claim_signup_role(p_role, p_context)
--
--    AUCUN parametre d'identite. La cible est TOUJOURS auth.uid(), jamais
--    un id passe en argument -- c'est la faille C1 de consume_invitation_token
--    et elle ne se reproduit pas ici : la signature ne l'autorise pas.
--
--    p_role est en TEXT, pas en public.user_role, et c'est deliberé :
--    typer le parametre avec l'enum ne protegerait de rien puisque 'ADMIN'
--    EST une valeur valide de l'enum -- le cast passerait. La whitelist doit
--    etre explicite dans le corps.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_signup_role(
  p_role    text,
  p_context text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_row     public.users%ROWTYPE;
  v_context text := NULL;
BEGIN
  -- Garde 1 -- authentification obligatoire.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'claim_signup_role: appel non authentifie'
      USING ERRCODE = '28000';
  END IF;

  -- Garde 2 -- whitelist stricte. JAMAIS ADMIN, JAMAIS PARTNER.
  IF p_role IS NULL OR p_role NOT IN ('ATHLETE', 'COACH', 'RECRUTEUR') THEN
    RAISE EXCEPTION 'claim_signup_role: role % non autorise (attendu ATHLETE|COACH|RECRUTEUR)', p_role
      USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE : verrouille la ligne. Sans ce verrou, deux appels concurrents
  -- (double-tap, retry reseau) pourraient tous deux lire role_claimed_at IS NULL
  -- et le one-shot serait franchissable deux fois.
  SELECT * INTO v_row FROM public.users WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_signup_role: profil introuvable'
      USING ERRCODE = 'P0002';
  END IF;

  -- Garde 3 -- one-shot.
  IF v_row.role_claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'claim_signup_role: role deja reclame (%) -- immuable', v_row.role_claimed_at
      USING ERRCODE = '55000';
  END IF;

  -- Garde 4 -- onboarding termine = role fige.
  IF v_row.onboarding_complete IS TRUE THEN
    RAISE EXCEPTION 'claim_signup_role: onboarding deja complete -- role fige'
      USING ERRCODE = '55000';
  END IF;

  -- Garde 5 -- une fiche athlete existante fige le role.
  IF EXISTS (SELECT 1 FROM public.athletes WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'claim_signup_role: fiche athlete existante -- role fige'
      USING ERRCODE = '55000';
  END IF;

  -- Coherence role/context -- MIROIR EXACT de maybeApplySignupRole
  -- (app/auth/callback/route.ts:111-122). Web et mobile ne doivent pas diverger.
  --   COACH     -> context ∈ {scolaire, ligue_civile} (choix du picker)
  --   RECRUTEUR -> collegial (derive, pas un choix utilisateur)
  --   ATHLETE   -> context ignore ici (choisi a l'ecran 2 / onboarding)
  IF p_role = 'COACH' AND p_context IN ('scolaire', 'ligue_civile') THEN
    v_context := p_context;
  ELSIF p_role = 'RECRUTEUR' THEN
    v_context := 'collegial';
  END IF;

  UPDATE public.users
  SET    role            = p_role::public.user_role,
         context         = COALESCE(v_context, context),
         role_claimed_at = now()
  WHERE  id = v_uid;

  RETURN jsonb_build_object(
    'role',       p_role,
    'context',    v_context,
    'claimed_at', now()
  );
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Grants -- authenticated uniquement. Jamais anon, jamais public.
--    (Une SECURITY DEFINER est EXECUTE-to-PUBLIC par defaut : le REVOKE
--    n'est pas cosmetique.)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.needs_signup_role()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_signup_role(text, text)     FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.needs_signup_role()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_role(text, text)  TO authenticated;

COMMIT;
