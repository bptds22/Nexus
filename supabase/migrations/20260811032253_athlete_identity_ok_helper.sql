-- ═══════════════════════════════════════════════════════════════
-- LOT 2 SÉCURITÉ — TEMPS 1, migration 1/2 : helper partagé
--
-- Unifie le critère « l'identité de cet athlète peut-elle être
-- montrée à autrui ? » (Loi 25). Il existait DEUX formulations
-- divergentes en base :
--
--   list_team_commits        : date_naissance <= current_date - INTERVAL '18 years'
--                              OR consentement_parental
--   is_partner_eligible_athlete : EXTRACT(YEAR FROM AGE(date_naissance)) >= 18
--                              OR partner_visibility_parental_consent
--
-- La seconde est fragile : sur DOB NULL elle produit NULL, qui ne
-- se comporte comme false que par accident de contexte booléen.
-- On retient la formulation de list_team_commits, qui teste
-- explicitement IS NOT NULL — DOB inconnue = traitée comme mineur.
--
-- POURQUOI STABLE ET NON IMMUTABLE
-- La fonction lit current_date. IMMUTABLE promettrait à Postgres
-- que le résultat ne dépend que des arguments — faux : le même
-- athlète bascule de mineur à majeur à sa majorité. Sous IMMUTABLE,
-- Postgres s'autorise à pré-évaluer l'appel au moment de la
-- planification et à figer le résultat (et l'accepterait dans un
-- index, qui deviendrait silencieusement faux le lendemain).
-- STABLE = constant à l'intérieur d'une transaction, réévalué
-- ensuite : c'est exactement la sémantique voulue.
--
-- Signature SCALAIRE (et non p_athlete_id) : inlinable dans un
-- SELECT de masse sans sous-requête corrélée par ligne.
--
-- Cette migration est SANS EFFET DE BORD OBSERVABLE : elle ajoute
-- une fonction et réécrit list_team_commits à sémantique
-- strictement identique (preuve : table de vérité exhaustive +
-- comparaison sur les lignes réelles de public.athletes).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.athlete_identity_ok(
  p_dob     date,
  p_consent boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (p_dob IS NOT NULL AND p_dob <= current_date - INTERVAL '18 years')
      OR COALESCE(p_consent, false);
$$;

COMMENT ON FUNCTION public.athlete_identity_ok(date, boolean) IS
  'Loi 25 — vrai si l''identité de l''athlète peut être montrée à autrui : majeur (18 ans révolus) OU consentement parental. DOB NULL = traité comme mineur (false). STABLE, pas IMMUTABLE : dépend de current_date. Critère unique de la plateforme — ne pas dupliquer l''expression ailleurs.';

REVOKE ALL ON FUNCTION public.athlete_identity_ok(date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.athlete_identity_ok(date, boolean)
  TO authenticated, anon, service_role;

-- ── list_team_commits réécrite sur le helper ────────────────────
-- Corps identique au mot près, SAUF le calcul de v.ok qui délègue.
-- consentement_parental est NOT NULL DEFAULT false en base, donc le
-- COALESCE du helper ne change rien : l'équivalence est stricte.

CREATE OR REPLACE FUNCTION public.list_team_commits(p_team_id uuid)
RETURNS TABLE (
  athlete_id       uuid,
  prenom           text,
  nom              text,
  position_nom     text,
  etoiles          smallint,
  ecole_provenance text,
  promo            integer,
  visible_public   boolean
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
  WITH t AS (SELECT id, school_id, sport_id FROM public.teams WHERE id = p_team_id),
  c AS (
    SELECT DISTINCT ON (a.id) a.id, a.first_name, a.last_name, a.date_naissance,
           a.consentement_parental, a.position_id, a.school_id, a.annee_diplomation,
           a.cote_globale_entraineur, cr.responded_at
    FROM public.commitment_requests cr
    JOIN public.athletes a ON a.id = cr.athlete_id
    JOIN t ON cr.school_id = t.school_id AND a.sport_id = t.sport_id
    WHERE cr.status = 'CONFIRMED'
      AND a.status <> 'DESACTIVE'::public.account_status
    ORDER BY a.id, cr.responded_at DESC NULLS LAST
  )
  SELECT
    CASE WHEN v.ok THEN c.id END,
    CASE WHEN v.ok THEN c.first_name END,
    CASE WHEN v.ok THEN c.last_name END,
    CASE WHEN v.ok THEN p.nom END,
    CASE WHEN v.ok THEN round(COALESCE(c.cote_globale_entraineur, 0))::smallint END,
    CASE WHEN v.ok THEN s.name END,
    CASE WHEN v.ok THEN c.annee_diplomation END,
    v.ok
  FROM c
  CROSS JOIN LATERAL (
    SELECT public.athlete_identity_ok(c.date_naissance, c.consentement_parental) AS ok
  ) v
  LEFT JOIN public.positions p ON p.id = c.position_id
  LEFT JOIN public.schools   s ON s.id = c.school_id
  ORDER BY v.ok DESC, c.last_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_team_commits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_team_commits(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_team_commits(uuid) IS
  'Recrues engagées d''une équipe (école + sport, CONFIRMED). Mineur sans consentement parental = ligne anonyme (visible_public=false) : compté, jamais nommé. Critère délégué à athlete_identity_ok() depuis le Lot 2.';

COMMIT;
