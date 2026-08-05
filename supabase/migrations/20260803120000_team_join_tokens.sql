-- ============================================================================
-- M1 — team_join_tokens : codes d'adhésion d'équipe (TRANSFER PORTAL, phase 1)
--
-- Un code court, lisible à voix haute et sans ambiguïté visuelle, qui rattache
-- un athlète à UNE équipe. Le code ne fait qu'IDENTIFIER l'équipe : tout le
-- travail (transfert, ancrage, coach_id, parcours) vit dans
-- apply_team_attachment (M3). Cette table ne porte que le cycle de vie du code.
--
-- ALPHABET — 31 caractères : 2-9 + A-Z privé de I, L, O.
--   « 23456789ABCDEFGHJKMNPQRSTUVWXYZ »
-- 0/O et 1/I/L sont retirés parce que le code se dicte au gymnase, se recopie
-- d'un tableau blanc et se tape sur un clavier de téléphone. Sur 8 caractères
-- l'espace fait 31^8 ≈ 8,5e11 — la collision est un non-sujet, mais la
-- génération repasse quand même par une boucle de retry (M3).
--
-- RÉVOCATION = revoked_at, JAMAIS un DELETE. Un code brûlé doit rester lisible
-- (qui l'a créé, combien de fois il a servi) : c'est la seule trace d'audit
-- d'un rattachement fait hors invitation nominative. Aucune policy DELETE, et
-- DELETE est révoqué explicitement au rôle authenticated.
--
-- RLS — phase 1 : ADMIN SEULEMENT (is_admin()). anon n'a aucun droit de table.
-- Les athlètes ne lisent JAMAIS cette table : ils passent par
-- resolve_team_join_token / apply_team_attachment (SECURITY DEFINER), qui ne
-- leur exposent que l'équipe derrière le code — jamais le quota, la date
-- d'expiration ni l'identité du créateur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_join_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,        -- NULL = pas d'expiration
  revoked_at timestamptz NULL,        -- NULL = actif
  max_uses   int NULL,                -- NULL = illimité
  use_count  int NOT NULL DEFAULT 0,

  -- L'alphabet est verrouillé par la base, pas seulement par le générateur :
  -- un code saisi à la main par un futur script d'admin ne peut pas introduire
  -- un 0 ou un I que l'utilisateur confondra ensuite.
  CONSTRAINT team_join_tokens_code_format
    CHECK (code ~ '^[2-9A-HJKMNP-Z]{6,8}$'),
  CONSTRAINT team_join_tokens_max_uses_positive
    CHECK (max_uses IS NULL OR max_uses >= 1),
  CONSTRAINT team_join_tokens_use_count_nonneg
    CHECK (use_count >= 0)
);

-- Lookup « les codes de cette équipe » (écran admin). Le lookup par code passe
-- par l'index unique de la colonne code.
CREATE INDEX IF NOT EXISTS idx_team_join_tokens_team_id
  ON public.team_join_tokens (team_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.team_join_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read join tokens"   ON public.team_join_tokens;
DROP POLICY IF EXISTS "admins create join tokens" ON public.team_join_tokens;
DROP POLICY IF EXISTS "admins update join tokens" ON public.team_join_tokens;

CREATE POLICY "admins read join tokens"
  ON public.team_join_tokens FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admins create join tokens"
  ON public.team_join_tokens FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins update join tokens"
  ON public.team_join_tokens FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Pas de policy DELETE : la révocation pose revoked_at.

-- ── GRANTs de table ─────────────────────────────────────────────────────────
-- anon : zéro. authenticated : SELECT/INSERT/UPDATE, mais chaque ligne reste
-- filtrée par is_admin() ci-dessus — le GRANT ouvre la porte, la policy garde
-- l'entrée. DELETE/TRUNCATE ne sont accordés à personne.
REVOKE ALL ON public.team_join_tokens FROM PUBLIC;
REVOKE ALL ON public.team_join_tokens FROM anon;
REVOKE ALL ON public.team_join_tokens FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.team_join_tokens TO authenticated;
GRANT ALL    ON public.team_join_tokens TO service_role;

-- ── Documentation ───────────────────────────────────────────────────────────
COMMENT ON TABLE public.team_join_tokens IS
  'Codes d''adhesion d''equipe (transfer portal). Alphabet sans ambiguite '
  '2-9 A-Z sauf I/L/O, 6 a 8 caracteres. Revocation = revoked_at, jamais '
  'DELETE. RLS admin seulement ; les athletes passent par '
  'resolve_team_join_token et apply_team_attachment.';

COMMENT ON COLUMN public.team_join_tokens.max_uses IS
  'NULL = illimite. Le quota est consomme par apply_team_attachment '
  'uniquement quand un rattachement a REELLEMENT lieu (un no-op idempotent ne '
  'brule pas d''utilisation).';

COMMENT ON COLUMN public.team_join_tokens.revoked_at IS
  'Non NULL = code brule. La ligne reste en base : c''est la trace d''audit du '
  'rattachement.';
