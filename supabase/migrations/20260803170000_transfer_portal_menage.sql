-- ============================================================================
-- A5 — Ménage post-phase 1 : deux écarts relevés au rapport de recette.
--
-- Aucun changement de comportement. Deux nettoyages de droits et d'index qui
-- ne pouvaient pas être faits en phase 1 sans élargir son périmètre.
-- ============================================================================

-- ── É2 — _gen_join_code gardait EXECUTE pour service_role ───────────────────
-- La phase 1 révoquait PUBLIC / anon / authenticated mais laissait le GRANT
-- que Supabase pose à service_role via ALTER DEFAULT PRIVILEGES. Sans
-- conséquence de sécurité (service_role est la clé serveur, elle contourne
-- déjà RLS), mais le helper est INTERNE : son seul appelant légitime est
-- create_team_join_token, qui est SECURITY DEFINER et s'exécute sous le
-- propriétaire — lequel garde ses droits quoi qu'on révoque. Personne d'autre
-- n'a de raison de fabriquer un code hors de la table qui l'enregistre.
REVOKE ALL ON FUNCTION public._gen_join_code(int) FROM service_role;

-- ── Index redondant avec la contrainte d'ancrage unique ─────────────────────
-- idx_team_athletes_athlete_id est un btree simple sur (athlete_id). Depuis
-- team_athletes_athlete_id_key UNIQUE (athlete_id), son index unique couvre
-- exactement les mêmes recherches — le planificateur ne choisira jamais le
-- doublon, qui ne coûte plus que des écritures.
--
-- Les lectures team-first (roster d'une équipe) restent servies par
-- idx_team_athletes_team_id, qui n'est PAS touché ici. C'est important
-- maintenant que la migration A4 a fait tomber UNIQUE (team_id, athlete_id) :
-- idx_team_athletes_team_id est désormais le seul index team-first.
DROP INDEX IF EXISTS public.idx_team_athletes_athlete_id;
