-- Temps de réponse des listes d'équipes, sous un utilisateur authentifié réel (RLS active), requêtes
-- calquées sur les écrans. Écoles : les 5 qui portent le plus d'équipes après création.
-- Sortie : écran | école | lignes | temps d'exécution (ms), médiane de 5 passages.
\set ON_ERROR_STOP on
create temp table _ecoles (school_id uuid);
-- Les 5 écoles qui portent le plus d'équipes APRÈS création (mêmes écoles avant et après).
insert into _ecoles values ('f7a54b0e-698f-4bc2-9bba-5ee28c91ede6'), ('ea11a9e0-aad9-4294-8ac2-2a6302317e0c'), ('24ee7ebf-fede-47dd-b666-bd1530b303ad'), ('d911ac4b-e71e-47df-949c-2a42d6407ef7'), ('3d98b714-fbdf-45ad-bb8f-ec24e3a824fd');
grant select on _ecoles to authenticated;
create temp table _mesures (ecran text, ecole text, lignes int, ms numeric);
grant all on _mesures to authenticated;

create or replace function pg_temp.chrono(p_sql text) returns table (lignes int, ms numeric) language plpgsql as $$
declare plan json; t numeric[] := '{}'; n int;
begin
  for i in 1..5 loop
    execute 'explain (analyze, format json) ' || p_sql into plan;
    t := t || (plan -> 0 ->> 'Execution Time')::numeric;
    n := (plan -> 0 -> 'Plan' ->> 'Actual Rows')::int;
  end loop;
  select percentile_cont(0.5) within group (order by x) into ms from unnest(t) x;
  lignes := n; return next;
end $$;

begin;
select set_config('request.jwt.claims', '{"sub":"f51384b5-a2c2-4827-9137-8aa8d29a1fe0","role":"authenticated"}', true);
set local role authenticated;
do $$
declare e record; nom text; r record; football uuid := '4b859bf1-5832-4258-897c-e094062926af';
begin
  for e in select school_id from _ecoles loop
    select name into nom from public.schools where id = e.school_id;
    -- Inscription athlète (app/athlete/onboarding, AthleteOnboardingMobile) : école + sport, actives, par nom
    for r in select * from pg_temp.chrono(format($q$select id, name, age_group, division, gender, season from public.teams
               where school_id = %L and sport_id = %L and is_active order by name$q$, e.school_id, football)) loop
      insert into _mesures values ('inscription athlète (école+sport)', nom, r.lignes, r.ms); end loop;
    -- Page d'école (schoolPageData) : toutes les équipes + sport
    for r in select * from pg_temp.chrono(format($q$select t.id, t.division, t.gender, t.name, t.age_group, t.season, s.nom
               from public.teams t left join public.sports s on s.id = t.sport_id where t.school_id = %L$q$, e.school_id)) loop
      insert into _mesures values ('page d''école (toutes)', nom, r.lignes, r.ms); end loop;
    -- Saison en cours (saisonEnCours) : école + saison
    for r in select * from pg_temp.chrono(format($q$select t.id, t.division, t.gender, s.nom from public.teams t
               left join public.sports s on s.id = t.sport_id where t.school_id = %L and t.season = '2026-2027'$q$, e.school_id)) loop
      insert into _mesures values ('saison en cours (école+2026)', nom, r.lignes, r.ms); end loop;
    -- Sélecteur d'équipe (TeamPickerSheet) / supervision coach : école, actives, par nom
    for r in select * from pg_temp.chrono(format($q$select id, name, age_group, division, gender, season, sport_id from public.teams
               where school_id = %L and is_active order by name$q$, e.school_id)) loop
      insert into _mesures values ('sélecteur d''équipe (école)', nom, r.lignes, r.ms); end loop;
  end loop;
  -- Admin écoles (fetchAllRows) : toutes les équipes, colonnes school_id, sport_id (lecture complète)
  for r in select * from pg_temp.chrono($q$select school_id, sport_id from public.teams$q$) loop
    insert into _mesures values ('admin écoles (toute la table)', '—', r.lignes, r.ms); end loop;
end $$;
commit;
select ecran, ecole, lignes, round(ms, 2) as ms from _mesures order by ecran, ecole;
