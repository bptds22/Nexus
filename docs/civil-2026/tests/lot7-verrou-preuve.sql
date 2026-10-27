-- Preuve (LOCAL) du verrou de lancement civil (lot 7). Tout est ANNULÉ à la fin.
-- Une équipe IMPORTÉE (dans equipes_sources) et une équipe civile créée dans l'appli ;
-- un athlète local SANS équipe (une seule équipe par athlète) ; un coach local.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
begin;
create temp table f as
select (select t.id from public.teams t where exists (select 1 from public.equipes_sources e where e.team_id = t.id)
         order by t.id limit 1) as importee,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'LIGUE_CIVILE' and not exists (select 1 from public.equipes_sources e where e.team_id = t.id)
         order by t.id limit 1) as maison,
       (select a.id from public.athletes a where not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
         order by a.id limit 1) as athlete,
       (select u.id from public.users u where u.role = 'COACH' order by u.id limit 1) as coach;

create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'accepté';
exception when others then
  return 'REFUSÉ (' || sqlstate || ') ' || sqlerrm;
end $$;

select 'interrupteur : ' || (select value from public.app_settings where key = 'lancement_civil')
       || ' → lancement_civil_actif() = ' || public.lancement_civil_actif();

-- ── OFF ──
select 'OFF  athlète → équipe importée : ' || pg_temp.essai(format(
  'insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', (select importee from f), (select athlete from f)));
select 'OFF  coach   → équipe importée : ' || pg_temp.essai(format(
  'insert into public.team_coaches (team_id, coach_id, role) values (%L, %L, %L)', (select importee from f), (select coach from f), 'assistant'));
select 'OFF  athlète → équipe civile de l''appli : ' || pg_temp.essai(format(
  'insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', (select maison from f), (select athlete from f)));
select 'OFF  transfert de cette ligne vers l''équipe importée : ' || pg_temp.essai(format(
  'update public.team_athletes set team_id = %L where team_id = %L and athlete_id = %L',
  (select importee from f), (select maison from f), (select athlete from f)))
       || ' (' || (select count(*) from public.team_athletes ta, f where ta.team_id = f.maison and ta.athlete_id = f.athlete) || ' ligne visée)';
select 'OFF  mise à jour sans changer d''équipe : ' || pg_temp.essai(format(
  'update public.team_athletes set jersey_number = %L where team_id = %L and athlete_id = %L',
  '99', (select maison from f), (select athlete from f)));
select 'OFF  valeur illisible (« oui ») : ' || pg_temp.essai(
  $q$update public.app_settings set value = 'oui' where key = 'lancement_civil'$q$)
       || ' → actif = ' || public.lancement_civil_actif()
       || ' ; athlète → importée : ' || pg_temp.essai(format(
  'insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', (select importee from f), (select athlete from f)));

-- ── Par le rôle authenticated (RLS active) : le verrou ne dépend pas du chemin ──
select set_config('request.jwt.claims', json_build_object('sub', (select coach from f), 'role', 'authenticated')::text, true);
grant select on f to authenticated;
set local role authenticated;
select 'OFF  authenticated, insert direct dans l''équipe importée : ' || pg_temp.essai(format(
  'insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', (select importee from f), (select athlete from f)));
reset role;

-- ── ON (avec espaces et majuscules) ──
update public.app_settings set value = ' True ' where key = 'lancement_civil';
select 'ON   lancement_civil_actif() = ' || public.lancement_civil_actif();
select 'ON   transfert de l''athlète vers l''équipe importée : ' || pg_temp.essai(format(
  'update public.team_athletes set team_id = %L where team_id = %L and athlete_id = %L',
  (select importee from f), (select maison from f), (select athlete from f)))
;
select 'ON   l''athlète est maintenant dans l''équipe importée : '
       || (select count(*) from public.team_athletes ta, f where ta.team_id = f.importee and ta.athlete_id = f.athlete) || ' ligne';
select 'ON   coach   → équipe importée : ' || pg_temp.essai(format(
  'insert into public.team_coaches (team_id, coach_id, role) values (%L, %L, %L)', (select importee from f), (select coach from f), 'assistant'));

-- ── Clé absente : OFF ──
delete from public.app_settings where key = 'lancement_civil';
select 'ABSENTE lancement_civil_actif() = ' || public.lancement_civil_actif();
rollback;
select 'résidu : ' || (select count(*) from public.team_athletes ta
                        where exists (select 1 from public.equipes_sources e where e.team_id = ta.team_id))
       || ' athlète(s) et ' || (select count(*) from public.team_coaches tc
                        where exists (select 1 from public.equipes_sources e where e.team_id = tc.team_id))
       || ' coach(s) dans des équipes importées ; interrupteur = '
       || (select value from public.app_settings where key = 'lancement_civil');
