-- QG admin, lot 1 — chaque chiffre de GET /api/admin/qg recalculé À LA MAIN,
-- en SQL seul, sans le code de la route (base LOCALE, lecture seule).
--   psql -v t='<calcule_le de la réponse>' -v g='jour|semaine|mois' -f controle-main.sql
-- Sortie : une ligne « clé|valeur » par chiffre ; scripts/qg-admin/comparer.mjs
-- la compare clé par clé à la réponse de l'API.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'
set timezone = 'America/Toronto';
begin; -- vues temporaires seulement, annulées par le rollback final

-- ── Périodes, calculées par Postgres dans le fuseau de Montréal ──
create temp view w as
with b as (
  select :'t'::timestamptz t, :'g'::text g,
         case :'g' when 'jour' then date_trunc('day', :'t'::timestamptz)
                   when 'semaine' then date_trunc('week', :'t'::timestamptz)
                   else date_trunc('month', :'t'::timestamptz) end cd
)
select t, g, cd, t ca,
       case g when 'jour' then cd - interval '1 day' when 'semaine' then cd - interval '7 days'
              else cd - interval '1 month' end pd,
       case g when 'jour' then t - interval '1 day' when 'semaine' then t - interval '7 days'
              -- mois : même jour et même heure le mois d'avant, borné à la fin de ce mois.
              else case when extract(day from t) > extract(day from (cd - interval '1 day'))
                        then cd
                        else (cd - interval '1 month') + (t - cd) end end pa,
       case g when 'jour' then 30 else 12 end n
  from b;

-- Débuts des périodes de la série (la dernière est la période en cours).
create temp view s as
select row_number() over (order by d) - 1 i, d,
       coalesce(lead(d) over (order by d), (select t from w)) f,
       lead(d) over (order by d) is null en_cours
  from w, lateral generate_series(
         cd - (case g when 'jour' then interval '1 day' when 'semaine' then interval '7 days' else interval '1 month' end) * (n - 1),
         cd,
         case g when 'jour' then interval '1 day' when 'semaine' then interval '7 days' else interval '1 month' end) d;

create temp view rec as select id from users where role = 'RECRUTEUR';

-- Fiches comptées comme inscriptions : avec compte, rôle ATHLETE (ou rôle inconnu).
create temp view fiches as
select a.id, a.profile_completion, a.verified, u.created_at compte_le
  from athletes a left join users u on u.id = a.user_id
 where a.user_id is not null and (u.role is null or u.role = 'ATHLETE');
create temp view dates_athletes as
select compte_le d from fiches where compte_le is not null
union all select inscrit_le from comptes_athletes_sans_fiche_base() where inscrit_le is not null;
create temp view dates_autres as select created_at d from users where role <> 'ATHLETE';

create temp view acts as
select 'profils_consultes' k, viewed_at d, recruiter_id r from recruiter_athlete_views
union all select 'favoris', created_at, recruiter_id from recruiter_favorites
union all select 'mouvements_processus', created_at, recruiter_id from recruiter_activity_log where action_type = 'PIPELINE_CHANGED'
union all select 'messages', created_at, sender_id from messages where sender_id in (select id from rec)
union all select 'notes_match', note_le, auteur from match_notes where auteur in (select id from rec)
union all select 'suivi_cartes', created_at, acteur from cartes_prospect_journal where action not in ('CREEE', 'NOTE', 'MODIFIEE');

-- ── Fenêtres (en millisecondes) ──
select 'fenetres.courant_de', (extract(epoch from cd) * 1000)::bigint from w
union all select 'fenetres.courant_a', (extract(epoch from ca) * 1000)::bigint from w
union all select 'fenetres.precedent_de', (extract(epoch from pd) * 1000)::bigint from w
union all select 'fenetres.precedent_a', (extract(epoch from pa) * 1000)::bigint from w;

-- ── Aujourd'hui ──
with x as (
  select (coalesce(a.partner_visibility_opt_in, false) and c.accepte_le is not null
          and c.accepte_le >= coalesce(a.partner_visibility_opted_in_at, '-infinity'::timestamptz)) v2,
         c.refuse_le, c.athlete_id is not null a_ligne
    from athletes a join users u on u.id = a.user_id
    left join consentement_partenaire_v2 c on c.athlete_id = a.id
   where coalesce(u.onboarding_complete, false) and a.status in ('ACTIF', 'EN_ATTENTE'))
select 'aujourdhui.consentements_v2.acceptes', count(*) filter (where v2)::text from x
union all select 'aujourdhui.consentements_v2.refuses', (count(*) filter (where not v2 and refuse_le is not null))::text from x
union all select 'aujourdhui.consentements_v2.en_attente', (count(*) filter (where not v2 and refuse_le is null and a_ligne))::text from x
union all select 'aujourdhui.consentements_v2.jamais_demande', (count(*) filter (where not v2 and refuse_le is null and not a_ligne))::text from x;

with e as (
  select deadline e from loi25_portability_requests where status in ('pending', 'in_progress')
  union all select (requested_at::date + 30) from deletion_requests where status in ('PENDING', 'IN_PROGRESS')),
  j as (select (select t from w)::date auj)
select 'aujourdhui.loi25.ouvertes', count(*)::text from e
union all select 'aujourdhui.loi25.portabilite', (select count(*) from loi25_portability_requests where status in ('pending', 'in_progress'))::text
union all select 'aujourdhui.loi25.suppression', (select count(*) from deletion_requests where status in ('PENDING', 'IN_PROGRESS'))::text
union all select 'aujourdhui.loi25.en_retard', count(*) filter (where e < auj)::text from e, j
union all select 'aujourdhui.loi25.sous_7_jours', count(*) filter (where e >= auj and e <= auj + 7)::text from e, j
union all select 'aujourdhui.loi25.prochaine', coalesce(to_char(min(e), 'YYYY-MM-DD'), 'null') from e
union all select 'aujourdhui.loi25_ouvertes', ((select count(*) from loi25_portability_requests where status in ('pending', 'in_progress'))
                                             + (select count(*) from deletion_requests where status in ('PENDING', 'IN_PROGRESS')))::text
union all select 'aujourdhui.invitations_parent.reclamees', (select count(*) from parent_invitations where claimed_at is not null)::text
union all select 'aujourdhui.invitations_parent.en_attente', (select count(*) from parent_invitations, w where claimed_at is null and expires_at > t)::text
union all select 'aujourdhui.invitations_parent.expirees', (select count(*) from parent_invitations, w where claimed_at is null and expires_at <= t)::text
union all select 'aujourdhui.ecoles_non_listees', (select count(*) from athletes where ecole_non_listee is not null and school_id is null)::text
union all select 'aujourdhui.reclamations_etablissement', (select count(*) from admin_claims where status = 'PENDING')::text;

-- ── Croissance ──
with c as (
  select 'courant' quand, coalesce(pu.role::text, 'SANS_ROLE') r
    from auth.users au left join users pu on pu.id = au.id, w
   where au.last_sign_in_at >= cd and au.last_sign_in_at < ca
  union all
  select 'precedent', coalesce(pu.role::text, 'SANS_ROLE')
    from auth.users au left join users pu on pu.id = au.id, w
   where au.last_sign_in_at >= pd and au.last_sign_in_at < pa)
select 'croissance.connectes.' || q.quand || '.total', count(c.r)::text
  from (values ('courant'), ('precedent')) q(quand) left join c on c.quand = q.quand group by q.quand
union all select 'croissance.connectes.' || quand || '.par_role.' || r, count(*)::text from c group by quand, r;

select 'croissance.nouveaux.athletes.courant', (select count(*) from dates_athletes, w where d >= cd and d < ca)::text
union all select 'croissance.nouveaux.athletes.precedent', (select count(*) from dates_athletes, w where d >= pd and d < pa)::text
union all select 'croissance.nouveaux.autres.courant', (select count(*) from dates_autres, w where d >= cd and d < ca)::text
union all select 'croissance.nouveaux.autres.precedent', (select count(*) from dates_autres, w where d >= pd and d < pa)::text;
select 'croissance.nouveaux.par_role.' || r || '.courant', (select count(*) from users, w where role::text = r and created_at >= cd and created_at < ca)::text
  from unnest(array['COACH', 'RECRUTEUR', 'PARENT', 'PARTNER', 'ADMIN']) r
union all
select 'croissance.nouveaux.par_role.' || r || '.precedent', (select count(*) from users, w where role::text = r and created_at >= pd and created_at < pa)::text
  from unnest(array['COACH', 'RECRUTEUR', 'PARENT', 'PARTNER', 'ADMIN']) r;

select 'croissance.serie.' || i || '.athletes', (select count(*) from dates_athletes where d >= s.d and d < s.f)::text from s
union all select 'croissance.serie.' || i || '.autres', (select count(*) from dates_autres where d >= s.d and d < s.f)::text from s
union all select 'croissance.serie.' || i || '.en_cours', (case when en_cours then 1 else 0 end)::text from s;

select 'croissance.parcours.inscrits', ((select count(*) from fiches) + (select count(*) from comptes_athletes_sans_fiche_base()))::text
union all select 'croissance.parcours.profil_80', (select count(*) from fiches where coalesce(profile_completion, 0) >= 80)::text
union all select 'croissance.parcours.valide_coach', (select count(*) from fiches where verified is true)::text
union all select 'croissance.parcours.vu_recruteur', (select count(*) from fiches f where exists (select 1 from recruiter_athlete_views v where v.athlete_id = f.id))::text
union all select 'croissance.parcours.suivi_recruteur', (select count(*) from fiches f where exists (select 1 from recruiter_pipeline p where p.athlete_id = f.id))::text;

-- ── Recruteurs ──
select 'recruteurs.tuiles.' || k || '.courant', (select count(*) from acts, w where acts.k = q.k and d >= cd and d < ca)::text
  from (select distinct k from acts union select 'suivi_cartes') q
union all
select 'recruteurs.tuiles.' || k || '.precedent', (select count(*) from acts, w where acts.k = q.k and d >= pd and d < pa)::text
  from (select distinct k from acts union select 'suivi_cartes') q
union all
select 'recruteurs.tuiles.recruteurs_actifs.courant',
  (select count(distinct r) from acts, w where d >= cd and d < ca and (k <> 'suivi_cartes' or r in (select id from rec)))::text
union all
select 'recruteurs.tuiles.recruteurs_actifs.precedent',
  (select count(distinct r) from acts, w where d >= pd and d < pa and (k <> 'suivi_cartes' or r in (select id from rec)))::text;

select 'recruteurs.serie.' || s.i || '.' || q.k, (select count(*) from acts where acts.k = q.k and d >= s.d and d < s.f)::text
  from s, (values ('profils_consultes'), ('favoris'), ('mouvements_processus'), ('notes_match'), ('messages')) q(k)
union all select 'recruteurs.serie.' || i || '.en_cours', (case when en_cours then 1 else 0 end)::text from s;

rollback;
