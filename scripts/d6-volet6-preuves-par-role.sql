-- ═══════════════════════════════════════════════════════════════════════════
-- D6 volet 6 — preuves par rôle, REJOUABLES, sur la base LOCALE (Docker).
-- Une seule transaction, ANNULÉE à la fin : rien ne reste en base.
-- Rôles réels : SET LOCAL ROLE authenticated + request.jwt.claims.
--
-- Prérequis : migration 20260923161507 appliquée ; fixtures locales Mathis
-- (owner = c1.coach@preuve.local), Maxime et Léa (sans owner, dans l'équipe
-- dddddddd-…-02, sans staff).
-- Lancer : docker cp + psql -f (jamais Get-Content | psql).
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset footer off

\set mathis      '''d3a00000-0000-4000-8000-00000000a001'''
\set mathis_u    '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}'
\set lea         '''ffffffff-0000-0000-0000-000000000001'''
\set lea_u       '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}'
\set maxime      '''eeeeeeee-0000-0000-0000-000000000001'''
\set maxime_u    '{"sub":"eeeeeeee-0000-0000-0000-000000000001","role":"authenticated"}'
\set c1          '''22222222-0000-0000-0000-00000000000c'''
\set c1_u        '{"sub":"22222222-0000-0000-0000-00000000000c","role":"authenticated"}'
\set coach_b     '''b6000000-0000-4000-8000-0000000000b1'''
\set coach_b_u   '{"sub":"b6000000-0000-4000-8000-0000000000b1","role":"authenticated"}'
\set coach_eq    '''b6000000-0000-4000-8000-0000000000e1'''
\set coach_eq_u  '{"sub":"b6000000-0000-4000-8000-0000000000e1","role":"authenticated"}'
\set coach_dir   '''b6000000-0000-4000-8000-0000000000d1'''
\set coach_dir_u '{"sub":"b6000000-0000-4000-8000-0000000000d1","role":"authenticated"}'
\set equipe      '''dddddddd-0000-0000-0000-000000000002'''
\set ecole       '''dddddddd-0000-0000-0000-000000000001'''

BEGIN;

-- ── FIXTURES (postgres) : trois coachs jetables, SANS école (sinon le trigger
--    backfill_athletes_on_coach_join leur donnerait tous les athlètes orphelins).
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES
  (:coach_b,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v6.coach.b@preuve.local',   '{"role":"COACH"}', '{"provider":"email"}', now(), now()),
  (:coach_eq,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v6.coach.eq@preuve.local',  '{"role":"COACH"}', '{"provider":"email"}', now(), now()),
  (:coach_dir, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'v6.coach.dir@preuve.local', '{"role":"COACH"}', '{"provider":"email"}', now(), now());
UPDATE public.users SET role = 'COACH', school_id = NULL WHERE id IN (:coach_b, :coach_eq, :coach_dir);
\echo '── fixtures : 3 coachs (rôle, école)'
SELECT email, role, school_id IS NULL AS sans_ecole FROM public.users WHERE id IN (:coach_b, :coach_eq, :coach_dir) ORDER BY email;

-- coach_eq devient ASSISTANT de l'équipe de Léa/Maxime, ajouté par un tiers
-- (JWT ≠ lui) : il reste assistant, les athlètes restent SANS owner (cas S4).
SELECT set_config('request.jwt.claims', :'c1_u', true);
INSERT INTO public.team_coaches (team_id, coach_id, role) VALUES (:equipe, :coach_eq, 'assistant');
SELECT set_config('request.jwt.claims', NULL, true);
\echo '── fixture équipe : rôle de coach_eq, owner de Léa'
SELECT (SELECT role FROM public.team_coaches WHERE team_id = :equipe AND coach_id = :coach_eq) AS role_eq,
       (SELECT coach_id IS NULL FROM public.athletes WHERE id = :lea) AS lea_sans_owner;

-- ═══════════ P1, P6, P7, P9 — dépôts par l'athlète (Mathis) ═══════════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'mathis_u', true);
INSERT INTO public.athlete_suggestions (athlete_id, submitted_by, champ, valeur_actuelle, valeur_proposee, status)
VALUES (:mathis, '842da8f6-41bf-4b75-bc72-83afc68bfe1c', 'Cote globale', '4.5', '5', 'EN_ATTENTE'),
       (:mathis, '842da8f6-41bf-4b75-bc72-83afc68bfe1c', 'Leadership', '5', '4', 'EN_ATTENTE'),
       (:mathis, '842da8f6-41bf-4b75-bc72-83afc68bfe1c', 'leadership', '5', '3', 'EN_ATTENTE'),
       (:mathis, '842da8f6-41bf-4b75-bc72-83afc68bfe1c', 'Taille', '6''1"', '6''2"', 'EN_ATTENTE'),
       (:mathis, '842da8f6-41bf-4b75-bc72-83afc68bfe1c', 'Champ Inventé', '', 'x', 'EN_ATTENTE');
RESET ROLE;
\echo '── P1 Cote globale → EN_ATTENTE · P9 Leadership ET leadership → EN_ATTENTE · P6 Taille → APPROUVEE · P7 Champ Inventé → REJETEE (nouveau motif)'
SELECT champ, status, raison_rejet, note_systeme IS NOT NULL AS systeme
  FROM public.athlete_suggestions WHERE athlete_id = :mathis AND created_at = now() ORDER BY champ;
\echo '── P6 (suite) : la taille est appliquée à la fiche'
SELECT taille_pieds, taille_pouces FROM public.athletes WHERE id = :mathis;

-- ═══════════ P8 — dépôt sur la fiche d'un AUTRE athlète ═══════════════════
\echo '── P8 Mathis dépose sur la fiche de Maxime → REFUS attendu (RLS)'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'mathis_u', true);
INSERT INTO public.athlete_suggestions (athlete_id, champ, valeur_proposee, status) VALUES (:maxime, 'Cote globale', '5', 'EN_ATTENTE');
RESET ROLE;

-- ═══════════ P3 — l'athlète approuve SA propre proposition ════════════════
\echo '── P3 Mathis passe sa Cote globale à APPROUVEE → 0 ligne touchée, statut inchangé'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'mathis_u', true);
WITH u AS (UPDATE public.athlete_suggestions SET status = 'APPROUVEE'
            WHERE athlete_id = :mathis AND champ = 'Cote globale' AND status = 'EN_ATTENTE' RETURNING 1)
SELECT count(*) AS lignes_touchees FROM u;
RESET ROLE;
SELECT status FROM public.athlete_suggestions WHERE athlete_id = :mathis AND champ = 'Cote globale' AND created_at = now();

-- ═══════════ P2 / P5 / P11 — qui LIT les propositions de Mathis ═══════════
\echo '── P2 owner c1 lit 3 EN_ATTENTE · P5/P11 coach_b (sans lien) en lit 0'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'c1_u', true);
SELECT 'c1 (owner)' AS qui, count(*) AS en_attente_visibles FROM public.athlete_suggestions WHERE athlete_id = :mathis AND status = 'EN_ATTENTE';
SELECT set_config('request.jwt.claims', :'coach_b_u', true);
SELECT 'coach_b (sans lien)' AS qui, count(*) AS en_attente_visibles FROM public.athlete_suggestions WHERE athlete_id = :mathis AND status = 'EN_ATTENTE';

-- ═══════════ P5 — un coach SANS lien tente d'approuver ════════════════════
\echo '── P5 coach_b approuve Leadership de Mathis → 0 ligne'
WITH u AS (UPDATE public.athlete_suggestions SET status = 'APPROUVEE'
            WHERE athlete_id = :mathis AND champ = 'Leadership' AND status = 'EN_ATTENTE' RETURNING 1)
SELECT count(*) AS lignes_touchees FROM u;

-- ═══════════ P4 — l'owner approuve ═════════════════════════════════════════
\echo '── P4 c1 approuve Leadership (4) → appliqué à SON évaluation, notification coach (pas « édition directe »)'
SELECT set_config('request.jwt.claims', :'c1_u', true);
UPDATE public.athlete_suggestions SET status = 'APPROUVEE'
 WHERE athlete_id = :mathis AND champ = 'Leadership' AND status = 'EN_ATTENTE';
RESET ROLE;
SELECT leadership FROM public.evaluations WHERE athlete_id = :mathis AND coach_id = :c1;
SELECT type, title, message FROM public.athlete_notifications WHERE athlete_id = :mathis AND created_at = now() ORDER BY title;

-- ═══════════ P10 — coach d'ÉQUIPE seulement (athlète sans owner) ══════════
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'lea_u', true);
INSERT INTO public.athlete_suggestions (athlete_id, submitted_by, champ, valeur_actuelle, valeur_proposee, status)
VALUES (:lea, 'ffffffff-0000-0000-0000-000000000001', 'Cote globale', '', '4', 'EN_ATTENTE');
\echo '── P10 coach_eq (assistant, lien ÉQUIPE seul) lit la proposition de Léa ; coach_b non'
SELECT set_config('request.jwt.claims', :'coach_eq_u', true);
SELECT 'coach_eq (équipe)' AS qui, count(*) AS visibles FROM public.athlete_suggestions WHERE athlete_id = :lea AND status = 'EN_ATTENTE';
SELECT set_config('request.jwt.claims', :'coach_b_u', true);
SELECT 'coach_b (sans lien)' AS qui, count(*) AS visibles FROM public.athlete_suggestions WHERE athlete_id = :lea AND status = 'EN_ATTENTE';
\echo '── P10 coach_eq approuve → évaluation créée À SON NOM (repli auth.uid()), notification « Ton coach a approuvé… (4/5) »'
SELECT set_config('request.jwt.claims', :'coach_eq_u', true);
UPDATE public.athlete_suggestions SET status = 'APPROUVEE' WHERE athlete_id = :lea AND status = 'EN_ATTENTE';
RESET ROLE;
SELECT coach_id = :coach_eq AS evaluation_au_coach_qui_tranche, cote_globale FROM public.evaluations WHERE athlete_id = :lea;
SELECT cote_globale_entraineur FROM public.athletes WHERE id = :lea;
SELECT type, title FROM public.athlete_notifications WHERE athlete_id = :lea AND created_at = now();

-- ═══════════ P10b — DIRECTEUR (athlète sans owner, hors équipe du directeur)
INSERT INTO public.school_coaches (school_id, coach_id, role) VALUES (:ecole, :coach_dir, 'DIRECTEUR');
-- La nomination rattache le directeur à l'école, et backfill_athletes_on_coach_join
-- lui donne alors les athlètes orphelins de l'école : on remet Maxime SANS owner
-- pour tester la relation DIRECTEUR seule (les 2 cas réels en prod).
\echo '── P10b effet de bord connu : la nomination a-t-elle donné Maxime au directeur ?'
SELECT coach_id = :coach_dir AS maxime_attribue_au_directeur FROM public.athletes WHERE id = :maxime;
UPDATE public.athletes SET coach_id = NULL WHERE id = :maxime;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'maxime_u', true);
INSERT INTO public.athlete_suggestions (athlete_id, submitted_by, champ, valeur_actuelle, valeur_proposee, status)
VALUES (:maxime, 'eeeeeeee-0000-0000-0000-000000000001', 'Cote globale', '', '3', 'EN_ATTENTE');
\echo '── P10b le directeur lit et approuve la proposition de Maxime'
SELECT set_config('request.jwt.claims', :'coach_dir_u', true);
SELECT 'directeur' AS qui, count(*) AS visibles FROM public.athlete_suggestions WHERE athlete_id = :maxime AND status = 'EN_ATTENTE';
UPDATE public.athlete_suggestions SET status = 'APPROUVEE' WHERE athlete_id = :maxime AND status = 'EN_ATTENTE';
RESET ROLE;
SELECT coach_id = :coach_dir AS evaluation_au_directeur, cote_globale FROM public.evaluations WHERE athlete_id = :maxime;

-- ═══════════ P11 — le coach sans lien ne lit rien de Léa/Maxime ═══════════
\echo '── P11 coach_b : total des suggestions lisibles sur Léa + Maxime'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', :'coach_b_u', true);
SELECT count(*) AS lisibles FROM public.athlete_suggestions WHERE athlete_id IN (:lea, :maxime);
RESET ROLE;

-- ═══════════ P12 — gate d'ACL : sabotage ══════════════════════════════════
\echo '── P12 sabotage : EXECUTE rendu à anon → le contrôle d''ACL de la migration doit lever'
SAVEPOINT sabotage;
GRANT EXECUTE ON FUNCTION public.peut_trancher_suggestion(uuid) TO anon;
DO $$
DECLARE vus text[];
BEGIN
  SELECT array_agg(t.g ORDER BY t.g) INTO vus
    FROM pg_proc pr,
         LATERAL (SELECT coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') AS g FROM unnest(pr.proacl::text[]) AS x) t
   WHERE pr.oid = 'public.peut_trancher_suggestion(uuid)'::regprocedure;
  IF vus IS DISTINCT FROM ARRAY['authenticated','postgres','service_role'] THEN
    RAISE EXCEPTION 'NEXUS: ACL peut_trancher_suggestion = %, attendu {authenticated,postgres,service_role}', vus;
  END IF;
END $$;
ROLLBACK TO SAVEPOINT sabotage;

ROLLBACK;
\echo '══ FIN — transaction annulée, rien n''est resté en base'
