-- ════════════════════════════════════════════════════════════════════
-- #48 sous-unité 1 — Token de claim athlète (génération seulement).
--
-- Contexte : un coach pré-crée un orphelin `athletes` (user_id NULL, infos
-- + email). Aujourd'hui le rattachement se fait par match email best-effort
-- (cause #18 + risque #47). On introduit un token EXPLICITE lié à un
-- athletes.id précis, pour que le claim (sous-unité 3) attache le nouveau
-- compte à CET orphelin exact et préserve athletes.id.
--
-- Aligné sur le pattern de public.invitations (20260519130000) :
--   - token text UNIQUE non devinable, status + expiry, audit (created_by),
--   - résolution publique via RPC SECURITY DEFINER (jamais SELECT direct),
--   - garde auth.uid() dans la RPC d'écriture (cf. C1 sur consume).
--
-- Portée STRICTE de cette sous-unité : table + RLS + create/resolve RPC.
--   - PAS de consume ici (sous-unité 3).
--   - PAS d'UI ici (sous-unités suivantes).
--
-- DROP+recreate des fonctions (signatures neuves) pour rester idempotent et
-- éviter tout overload ambigu sur ré-application (rappel Fix #2).
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.athlete_invitations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token               text NOT NULL UNIQUE,
  -- LE lien vers l'orphelin précis (préservation d'identité, #47).
  athlete_id          uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  -- Coach créateur (audit + RLS).
  created_by          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','CONSUMED','EXPIRED','REVOKED')),
  -- Colonnes de consume posées dès maintenant (remplies en sous-unité 3) —
  -- évite un ALTER TABLE plus tard.
  consumed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  consumed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS athlete_invitations_token_idx    ON public.athlete_invitations(token);
CREATE INDEX IF NOT EXISTS athlete_invitations_athlete_idx  ON public.athlete_invitations(athlete_id);
CREATE INDEX IF NOT EXISTS athlete_invitations_created_idx  ON public.athlete_invitations(created_by);
-- Un seul PENDING valide par athlète (anti-prolifération ; historique
-- CONSUMED/EXPIRED/REVOKED autorisé à s'accumuler).
CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_invitations_pending
  ON public.athlete_invitations(athlete_id) WHERE status = 'PENDING';

-- Lecture directe par le coach propriétaire (RLS). Pas d'INSERT direct :
-- la création passe OBLIGATOIREMENT par create_athlete_invitation (garde
-- propriétaire), sinon un coach pourrait forger un token sur un orphelin
-- qu'il ne possède pas. Pas d'UPDATE/DELETE policy (consume/revoke = RPC
-- SECURITY DEFINER en sous-unités suivantes).
ALTER TABLE public.athlete_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches read own athlete invitations" ON public.athlete_invitations;
CREATE POLICY "Coaches read own athlete invitations"
  ON public.athlete_invitations
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

GRANT SELECT ON TABLE public.athlete_invitations TO authenticated;

-- ── 2. RPC create_athlete_invitation(p_athlete_id) ───────────────────
-- SECURITY DEFINER : écrit dans une table sous RLS (aucune INSERT policy →
-- seul ce chemin gardé peut créer). Gardes : appelant authentifié, coach
-- propriétaire de l'orphelin, athlète bien orphelin (user_id NULL).
-- Idempotent : réutilise un PENDING valide existant au lieu d'en empiler.
DROP FUNCTION IF EXISTS public.create_athlete_invitation(uuid);
CREATE FUNCTION public.create_athlete_invitation(p_athlete_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
SET search_path = 'public'
AS $func$
DECLARE
  v_caller   uuid;
  v_coach_id uuid;
  v_user_id  uuid;
  v_token    text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT coach_id, user_id INTO v_coach_id, v_user_id
  FROM public.athletes WHERE id = p_athlete_id;

  IF NOT FOUND OR v_coach_id IS NULL THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  -- GARDE propriétaire : seul le coach qui a pré-créé l'orphelin.
  IF v_coach_id <> v_caller THEN
    RAISE EXCEPTION 'NOT_OWNER';
  END IF;

  -- GARDE orphelin : un athlète déjà rattaché à un compte n'a pas de token
  -- de claim (rien à réclamer).
  IF v_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED';
  END IF;

  -- Réutilise un token PENDING encore valide (anti-prolifération).
  SELECT token INTO v_token
  FROM public.athlete_invitations
  WHERE athlete_id = p_athlete_id
    AND status = 'PENDING'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  -- Token non devinable : 2× uuid v4 (≈244 bits aléatoires), hex 64 chars.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.athlete_invitations (token, athlete_id, created_by)
  VALUES (v_token, p_athlete_id, v_caller);

  RETURN v_token;
END;
$func$;

-- create = authenticated UNIQUEMENT. Postgres accorde EXECUTE à PUBLIC par
-- défaut → on le retire (anon n'a aucune raison de créer ; la garde
-- NOT_AUTHENTICATED le bloquerait de toute façon, mais on resserre).
-- Supabase accorde EXECUTE à PUBLIC + anon par défaut sur les nouvelles
-- fonctions public → on retire les deux. (La garde NOT_AUTHENTICATED bloque
-- déjà anon, mais on resserre le privilège lui-même.)
REVOKE EXECUTE ON FUNCTION public.create_athlete_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_athlete_invitation(uuid) TO authenticated;

-- ── 3. RPC resolve_athlete_invitation(p_token) ───────────────────────
-- SECURITY DEFINER, lecture publique SÛRE (la page de claim est pré-auth →
-- anon). Retourne le STRICT minimum pour afficher la page d'acceptation :
-- athlete_id (cible du futur claim), email (pré-rempli), prénom/nom
-- (affichage), status/expiry + is_valid calculé. AUCUNE donnée sensible
-- (pas de téléphone, notes, mensurations, etc.). NE CONSUME PAS.
DROP FUNCTION IF EXISTS public.resolve_athlete_invitation(text);
CREATE FUNCTION public.resolve_athlete_invitation(p_token text)
RETURNS TABLE (
  athlete_id uuid,
  email      text,
  first_name text,
  last_name  text,
  status     text,
  expires_at timestamptz,
  is_valid   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
SET search_path = 'public'
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.email,
    a.first_name,
    a.last_name,
    ai.status,
    ai.expires_at,
    (ai.status = 'PENDING' AND ai.expires_at > now() AND a.user_id IS NULL) AS is_valid
  FROM public.athlete_invitations ai
  JOIN public.athletes a ON a.id = ai.athlete_id
  WHERE ai.token = p_token
  LIMIT 1;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.resolve_athlete_invitation(text) TO anon, authenticated;

COMMENT ON TABLE public.athlete_invitations IS
  '#48 — token de claim lié à un athletes.id orphelin précis (préservation '
  'id #47). Création via create_athlete_invitation (garde coach-propriétaire '
  '+ orphelin) ; résolution publique via resolve_athlete_invitation. Consume '
  'en sous-unité 3.';
