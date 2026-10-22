-- Contrôle à la main des chiffres de /api/admin/ecran (base locale, lecture seule).
-- Écrit sans reprendre le code de la route : SQL seul, fuseau de Montréal.
set timezone = 'America/Toronto';
\set t '2026-10-22T19:13:32.757Z'
begin; -- vues temporaires seulement, annulées par le rollback final

create temp view b as select :'t'::timestamptz t, :'t'::timestamptz - interval '7 days' c, :'t'::timestamptz - interval '14 days' p;
create temp view rec as select id from users where role = 'RECRUTEUR';

-- ── Tuiles ──
select 'tuile nouveaux_athletes (comptes ATHLETE)' quoi,
  (select count(*) from users, b where role='ATHLETE' and created_at >= c and created_at < t) courant,
  (select count(*) from users, b where role='ATHLETE' and created_at >= p and created_at < c) precedent
union all select 'tuile athletes_actifs', (select count(*) from athletes where status='ACTIF'), null
union all select 'tuile profils_vus', (select count(*) from recruiter_athlete_views, b where viewed_at >= c and viewed_at < t),
  (select count(*) from recruiter_athlete_views, b where viewed_at >= p and viewed_at < c)
union all select 'tuile mouvements_processus', (select count(*) from recruiter_activity_log, b where action_type='PIPELINE_CHANGED' and created_at >= c and created_at < t),
  (select count(*) from recruiter_activity_log, b where action_type='PIPELINE_CHANGED' and created_at >= p and created_at < c)
union all select 'tuile nouveaux_coachs', (select count(*) from users, b where role='COACH' and created_at >= c and created_at < t),
  (select count(*) from users, b where role='COACH' and created_at >= p and created_at < c)
union all select 'tuile nouveaux_recruteurs', (select count(*) from users, b where role='RECRUTEUR' and created_at >= c and created_at < t),
  (select count(*) from users, b where role='RECRUTEUR' and created_at >= p and created_at < c);

-- Recruteurs actifs : toute action datée d'un recruteur dans la fenêtre.
with actes as (
  select recruiter_id r, viewed_at d from recruiter_athlete_views
  union all select recruiter_id, created_at from recruiter_favorites
  union all select recruiter_id, created_at from recruiter_activity_log where action_type='PIPELINE_CHANGED'
  union all select sender_id, created_at from messages where sender_id in (select id from rec)
  union all select auteur, note_le from match_notes where auteur in (select id from rec)
  union all select acteur, created_at from cartes_prospect_journal where acteur in (select id from rec) and action not in ('CREEE','NOTE','MODIFIEE'))
select 'tuile recruteurs_actifs', (select count(distinct r) from actes, b where d >= c and d < t),
  (select count(distinct r) from actes, b where d >= p and d < c);

-- ── Activité des recruteurs ──
select 'activite favoris' quoi, (select count(*) from recruiter_favorites, b where created_at >= c and created_at < t) courant,
  (select count(*) from recruiter_favorites, b where created_at >= p and created_at < c) precedent
union all select 'activite suivi_cartes', (select count(*) from cartes_prospect_journal, b where action not in ('CREEE','NOTE','MODIFIEE') and created_at >= c and created_at < t),
  (select count(*) from cartes_prospect_journal, b where action not in ('CREEE','NOTE','MODIFIEE') and created_at >= p and created_at < c)
union all select 'activite notes_match (recruteurs)', (select count(*) from match_notes, b where auteur in (select id from rec) and note_le >= c and note_le < t),
  (select count(*) from match_notes, b where auteur in (select id from rec) and note_le >= p and note_le < c)
union all select 'activite messages (recruteurs)', (select count(*) from messages, b where sender_id in (select id from rec) and created_at >= c and created_at < t),
  (select count(*) from messages, b where sender_id in (select id from rec) and created_at >= p and created_at < c)
union all select '  info : notes_match tous auteurs', (select count(*) from match_notes, b where note_le >= c and note_le < t),
  (select count(*) from match_notes, b where note_le >= p and note_le < c)
union all select '  info : messages tous expéditeurs', (select count(*) from messages, b where created_at >= c and created_at < t),
  (select count(*) from messages, b where created_at >= p and created_at < c);

-- ── Inscriptions par semaine (lundi, Montréal) ──
with s as (select generate_series(date_trunc('week', t) - interval '11 weeks', date_trunc('week', t), interval '1 week') d from b)
select to_char(s.d, 'YYYY-MM-DD') semaine,
  (select count(*) from users, b where role='ATHLETE' and created_at >= s.d and created_at < least(s.d + interval '1 week', t)) athletes,
  (select count(*) from users, b where role<>'ATHLETE' and created_at >= s.d and created_at < least(s.d + interval '1 week', t)) autres
from s order by s.d;

-- ── Parcours (fiches rattachées à un compte ATHLETE) ──
with f as (select a.* from athletes a join users u on u.id = a.user_id where u.role = 'ATHLETE')
select 'parcours inscrits (comptes ATHLETE)' quoi, (select count(*) from users where role='ATHLETE') n
union all select 'parcours profil_80', (select count(*) from f where profile_completion >= 80)
union all select 'parcours valide_coach', (select count(*) from f where verified)
union all select 'parcours vu_recruteur', (select count(*) from f where exists (select 1 from recruiter_athlete_views v where v.athlete_id = f.id))
union all select 'parcours suivi_recruteur', (select count(*) from f where exists (select 1 from recruiter_pipeline p where p.athlete_id = f.id));

-- ── Files d'attente ──
select 'file invitations reclamees' quoi, (select count(*) from parent_invitations where claimed_at is not null) n
union all select 'file invitations en_attente', (select count(*) from parent_invitations, b where claimed_at is null and expires_at > t)
union all select 'file invitations expirees', (select count(*) from parent_invitations, b where claimed_at is null and expires_at <= t)
union all select 'file v2 acceptes (accepte_le non nul)', (select count(*) from consentement_partenaire_v2 where accepte_le is not null)
union all select 'file v2 refuses (refuse_le non nul)', (select count(*) from consentement_partenaire_v2 where refuse_le is not null)
union all select 'file v2 lignes ni l''un ni l''autre', (select count(*) from consentement_partenaire_v2 where accepte_le is null and refuse_le is null)
union all select 'file v2 athletes eligibles sans ligne', (select count(*) from athletes a join users u on u.id=a.user_id where coalesce(u.onboarding_complete,false) and a.status in ('ACTIF','EN_ATTENTE') and not exists (select 1 from consentement_partenaire_v2 c where c.athlete_id=a.id))
union all select 'file ecoles_non_listees', (select count(*) from athletes where ecole_non_listee is not null and school_id is null)
union all select 'file loi25 suppression ouvertes', (select count(*) from deletion_requests where status in ('PENDING','IN_PROGRESS'))
union all select 'file loi25 portabilite ouvertes', (select count(*) from loi25_portability_requests where status in ('pending','in_progress'))
union all select 'file reclamations PENDING', (select count(*) from admin_claims where status='PENDING');

rollback;
