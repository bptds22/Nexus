-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep, LOT A — preuves du JOURNAL recruteur (recruiter_activity_log), ajout GO BP
-- 2026-10-25. Base locale JETABLE seulement (après scripts/cegep-lot-a-fixtures-locales.sql).
--
-- Même principe que cegep-lot-a-preuves-par-role.sql : chaque cellule tourne sous
-- `role authenticated` (ou service_role) avec `request.jwt.claims` du compte — jamais en
-- superuser — dans une sous-transaction TOUJOURS annulée. Les écritures (inscription d'un
-- athlète, vidéo ajoutée, réponse d'un coach) ne laissent donc aucune trace.
--
-- Lecture : « C » = une ligne du cégépien (ou futur cégépien) est rendue, « S » = une ligne de
-- l'athlète du secondaire, « - » = rien. Écritures : « coll:n » = n entrées chez des recruteurs
-- qui ne voient pas les cégépiens (collégiaux, sans école), « autre:n » = chez les autres.
--
-- Colonnes : R recruteur collégial Pro (cégep X) · N recruteur sans école · AL collègue
--            d'unité de R (même cégep, même sport, Pro) · AC le même compte rendu admin du
--            cégep (is_school_admin, le temps de la preuve) · A admin · P partenaire · K coach
--            de S et C · K2 coach inscrit sur la fiche de C · C (son propre compte) · PA parent de C.
-- ════════════════════════════════════════════════════════════════════════════

\pset pager off
\pset null '·'

create or replace function pg_temp.j_sub(p text)
returns text
language sql
as $$
  select replace(replace(replace(replace(replace(replace(replace(p,
    '{SEC}', '(select id from public.schools where type = ''SECONDAIRE'' and name = ''Académie Antoine-Manseau'')'),
    '{Y}',   '(select id from public.schools where type = ''CEGEP'' and name = ''Cégep Beauce-Appalaches'')'),
    '{C}',   '''c0ce0a00-0000-4000-8000-0000000000a2''::uuid'),
    '{S}',   '''c0ce0a00-0000-4000-8000-0000000000a1''::uuid'),
    '{R}',   '''c0ce0a00-0000-4000-8000-000000000001''::uuid'),
    '{K}',   '''c0ce0a00-0000-4000-8000-000000000005''::uuid'),
    '{CONV}','''c0ce0a00-0000-4000-8000-0000000000d1''::uuid')
$$;

-- Destinataire « collégial » : jugé comme la policy juge le lecteur.
create or replace function pg_temp.j_coll(p_recruiter uuid)
returns text
language sql
as $$
  select case when exists (select 1 from public.users u
                            where u.id = p_recruiter and u.role = 'RECRUTEUR'::public.user_role
                              and coalesce(u.school_id::text, '') not in
                                  (select s.id::text from public.schools s where s.type::text = 'UNIVERSITE'))
              then 'coll' else 'autre' end
$$;

create or replace function pg_temp.j_sonde(p_uid uuid, p_role text, p_sql text, p_prep text default null)
returns text
language plpgsql
as $$
declare
  v text;
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_uid is null then '{"role":"' || p_role || '"}'
           else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
    perform set_config('role', p_role, true);
    if p_prep is not null then execute pg_temp.j_sub(p_prep); end if;
    execute format($q$
      select coalesce(string_agg(x, ',' order by x), '-')
        from (select distinct
                     case v::text
                       when 'c0ce0a00-0000-4000-8000-0000000000a2' then 'C'
                       when 'c0ce0a00-0000-4000-8000-0000000000a1' then 'S'
                       else case when v::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' then null else v::text end
                     end as x
                from (%s) q(v)) z
       where x is not null $q$, pg_temp.j_sub(p_sql)) into v;
    raise exception using errcode = 'NX000', message = v;   -- annule tout effet de bord
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus ' || sqlstate || ' ' || sqlerrm;
  end;
end $$;

\set R  '''c0ce0a00-0000-4000-8000-000000000001'''
\set N  '''c0ce0a00-0000-4000-8000-000000000002'''
\set A  '''c0ce0a00-0000-4000-8000-000000000003'''
\set P  '''c0ce0a00-0000-4000-8000-000000000004'''
\set K  '''c0ce0a00-0000-4000-8000-000000000005'''
\set CA '''c0ce0a00-0000-4000-8000-000000000006'''
\set PA '''c0ce0a00-0000-4000-8000-000000000007'''
\set AL '''22222222-0000-0000-0000-00000000004a'''
\set K2 '''c0ce0a00-0000-4000-8000-000000000008'''

-- ── Lecture ──────────────────────────────────────────────────────────────────
-- AC = AL rendue admin du cégep dans une transaction annulée à la fin du bloc.
begin;
update public.users set is_school_admin = true where id = :AL;

with surfaces(ordre, surface, q) as (values
  ('J1', 'journal : lecture directe (C,S)',
         $$select athlete_id from public.recruiter_activity_log where athlete_id in ({C}, {S})$$),
  ('J2', 'journal : unité — gestes partagés de R (C,S)',
         $$select athlete_id from public.recruiter_activity_log
            where recruiter_id = {R} and athlete_id in ({C}, {S})
              and action_type in ('PIPELINE_CHANGED', 'FAVORITED', 'ATHLETE_ADDED_TO_LIST')$$),
  ('J3', 'journal : admin du cégep — vues de fiche de R (C,S)',
         $$select athlete_id from public.recruiter_activity_log
            where recruiter_id = {R} and athlete_id in ({C}, {S}) and action_type = 'PROFILE_VIEWED'$$),
  ('J4', 'journal : lignes de R, toutes (compte)',
         $$select 'n:' || count(*) from public.recruiter_activity_log where recruiter_id = {R}$$),
  ('J5', 'journal : non lues du compte (badge)',
         $$select 'non-lues:' || count(*) from public.recruiter_activity_log
            where recruiter_id = auth.uid() and coalesce(is_read, false) = false$$)
)
select ordre as "#", surface,
       pg_temp.j_sonde(:R,  'authenticated', q) as "R collégial",
       pg_temp.j_sonde(:N,  'authenticated', q) as "N sans école",
       pg_temp.j_sonde(:AL, 'authenticated', q) as "AC admin du cégep",
       pg_temp.j_sonde(:A,  'authenticated', q) as "A admin",
       pg_temp.j_sonde(:P,  'authenticated', q) as "P partenaire",
       pg_temp.j_sonde(:K,  'authenticated', q) as "K coach",
       pg_temp.j_sonde(:K2, 'authenticated', q) as "K2 coach de C (fiche)",
       pg_temp.j_sonde(:CA, 'authenticated', q) as "C (son compte)",
       pg_temp.j_sonde(:PA, 'authenticated', q) as "PA parent de C"
  from surfaces
 order by ordre;
rollback;

-- AL telle qu'elle est (collègue d'unité, pas admin) : le journal partagé de l'unité.
with surfaces(ordre, surface, q) as (values
  ('J1', 'journal : lecture directe (C,S)',
         $$select athlete_id from public.recruiter_activity_log where athlete_id in ({C}, {S})$$),
  ('J2', 'journal : unité — gestes partagés de R (C,S)',
         $$select athlete_id from public.recruiter_activity_log
            where recruiter_id = {R} and athlete_id in ({C}, {S})
              and action_type in ('PIPELINE_CHANGED', 'FAVORITED', 'ATHLETE_ADDED_TO_LIST')$$),
  ('J3', 'journal : admin du cégep — vues de fiche de R (C,S)',
         $$select athlete_id from public.recruiter_activity_log
            where recruiter_id = {R} and athlete_id in ({C}, {S}) and action_type = 'PROFILE_VIEWED'$$)
)
select ordre as "#", surface, pg_temp.j_sonde(:AL, 'authenticated', q) as "AL collègue d'unité"
  from surfaces
 order by ordre;

-- ── Écriture : les trois déclencheurs ───────────────────────────────────────
-- Le geste tourne sous le compte qui le fait (service_role pour l'inscription, comme le
-- serveur ; le coach K pour sa réponse) ; le décompte, sous service_role (lit tout).
select 'W1 inscription d''un nouvel athlète CÉGÉPIEN' as surface,
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.athlete_id = 'c0ce0a00-0000-4000-8000-0000000000a9' and l.action_type = 'NEW_ATHLETE'
) z group by k$$,
         $$insert into public.athletes (id, school_id, first_name, last_name, status)
           values ('c0ce0a00-0000-4000-8000-0000000000a9', {Y}, 'Nouveau', 'Cegepien', 'ACTIF')$$) as resultat
union all
select 'W2 inscription d''un nouvel athlète du SECONDAIRE',
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.athlete_id = 'c0ce0a00-0000-4000-8000-0000000000a9' and l.action_type = 'NEW_ATHLETE'
) z group by k$$,
         $$insert into public.athletes (id, school_id, first_name, last_name, status)
           values ('c0ce0a00-0000-4000-8000-0000000000a9', {SEC}, 'Nouveau', 'Secondaire', 'ACTIF')$$)
union all
select 'W3 vidéo ajoutée à C',
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.athlete_id = {C} and l.action_type = 'VIDEO_ADDED') z group by k$$,
         $$update public.athletes set video_faits_saillants_url = 'https://youtu.be/fixture-lot-a' where id = {C}$$)
union all
select 'W4 vidéo ajoutée à S',
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.athlete_id = {S} and l.action_type = 'VIDEO_ADDED') z group by k$$,
         $$update public.athletes set video_faits_saillants_url = 'https://youtu.be/fixture-lot-a' where id = {S}$$)
union all
select 'W5 le coach K répond à R (conversation sur C)',
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.action_type = 'COACH_REPLY' and l.details->>'conversation_id' = {CONV}::text) z group by k$$,
         $$insert into public.conversations (id, recruiter_id, coach_id, athlete_id, conversation_type)
           values ({CONV}, {R}, {K}, {C}, 'RECRUTEUR_COACH');
           insert into public.messages (conversation_id, sender_id, content) values ({CONV}, {K}, 'Fixture lot A')$$)
union all
select 'W6 le coach K répond à R (conversation sur S)',
       pg_temp.j_sonde(null, 'service_role',
         $$select k || ':' || count(*) from (select pg_temp.j_coll(l.recruiter_id) as k from public.recruiter_activity_log l
            where l.action_type = 'COACH_REPLY' and l.details->>'conversation_id' = {CONV}::text) z group by k$$,
         $$insert into public.conversations (id, recruiter_id, coach_id, athlete_id, conversation_type)
           values ({CONV}, {R}, {K}, {S}, 'RECRUTEUR_COACH');
           insert into public.messages (conversation_id, sender_id, content) values ({CONV}, {K}, 'Fixture lot A')$$);

-- Le journal n'a rien perdu (décompte sous service_role, qui lit tout) ; ancrage de C.
select pg_temp.j_sonde(null, 'service_role',
         $$select 'journal total (C,S):' || count(*) from public.recruiter_activity_log where athlete_id in ({C}, {S})$$) as etat
union all
select 'C ancré sur : ' || s.type || ' — ' || s.name
  from public.athletes a join public.schools s on s.id = a.school_id
 where a.id = 'c0ce0a00-0000-4000-8000-0000000000a2';
