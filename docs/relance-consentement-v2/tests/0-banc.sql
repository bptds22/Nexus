-- Banc LOCAL (Docker) de la relance v2 : instantane + etats de depart. Defait par 9-restaurer.sql.
-- Ecritures dans athletes en session_replication_role = replica : aucun declencheur ne part.
\set ON_ERROR_STOP on
begin;
create schema _test_relance_v2;
create table _test_relance_v2.cpv2 as select * from public.consentement_partenaire_v2;
create table _test_relance_v2.ops_avant as select id from public.admin_operations;
create table _test_relance_v2.queue_avant as select count(*) n from net.http_request_queue;

-- Les 17 admissibles locaux, numerotes de facon stable.
create table _test_relance_v2.roles as
select row_number() over (order by a.id) as rang, a.id as athlete_id, a.user_id,
       a.partner_visibility_opt_in as opt_in_avant, a.partner_visibility_opted_in_at as opted_avant
  from public.athletes a join public.users u on u.id = a.user_id
 where coalesce(u.onboarding_complete, false) and a.status in ('ACTIF', 'EN_ATTENTE')
   and not exists (select 1 from public.consentement_partenaire_v2 c where c.athlete_id = a.id);
alter table _test_relance_v2.roles add column role text;
update _test_relance_v2.roles set role = case rang
  when 1 then 'REFUSE' when 2 then 'V2_ACCEPTE' when 3 then 'DEMANDE_PARENT' when 4 then 'PLUS_TARD_3'
  when 5 then 'PLUS_TARD_1' when 6 then 'RAPPELS_OFF' when 7 then 'OPT_IN_V1' when 8 then 'OPT_IN_V1_B'
  else 'CIBLE' end;
create table _test_relance_v2.prefs_avant as
  select pp.* from public.push_preferences pp join _test_relance_v2.roles r on r.user_id = pp.user_id;

set local session_replication_role = replica;
update public.athletes a set partner_visibility_opt_in = true, partner_visibility_opted_in_at = now() - interval '1 day'
  from _test_relance_v2.roles r where r.athlete_id = a.id and r.role in ('V2_ACCEPTE', 'OPT_IN_V1', 'OPT_IN_V1_B');
set local session_replication_role = origin;

insert into public.consentement_partenaire_v2 (athlete_id, refuse_le)
  select athlete_id, now() - interval '2 days' from _test_relance_v2.roles where role = 'REFUSE';
insert into public.consentement_partenaire_v2 (athlete_id, accepte_le)
  select athlete_id, now() from _test_relance_v2.roles where role = 'V2_ACCEPTE';
insert into public.consentement_partenaire_v2 (athlete_id, demande_parent_le)
  select athlete_id, now() - interval '2 days' from _test_relance_v2.roles where role = 'DEMANDE_PARENT';
insert into public.consentement_partenaire_v2 (athlete_id, plus_tard_nb, plus_tard_le)
  select athlete_id, 3, now() - interval '20 days' from _test_relance_v2.roles where role = 'PLUS_TARD_3';
insert into public.consentement_partenaire_v2 (athlete_id, plus_tard_nb, plus_tard_le)
  select athlete_id, 1, now() - interval '20 days' from _test_relance_v2.roles where role = 'PLUS_TARD_1';
insert into public.push_preferences (user_id, categorie, actif)
  select user_id, 'RAPPELS', false from _test_relance_v2.roles where role = 'RAPPELS_OFF'
  on conflict (user_id, categorie) do update set actif = false;
commit;

select role, count(*) from _test_relance_v2.roles group by role order by role;
select 'v2_valide(V2_ACCEPTE)=' || public.consentement_partenaire_v2_valide(athlete_id)
  from _test_relance_v2.roles where role = 'V2_ACCEPTE';
