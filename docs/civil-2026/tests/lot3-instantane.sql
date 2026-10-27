-- Empreinte de teams / equipes_sources (comparée avant / après rollback du lot 3).
\pset tuples_only on
\pset format unaligned
select 'teams=' || count(*) || ' md5=' || md5(string_agg(id::text || '|' || school_id || '|' || sport_id || '|' || name || '|'
       || coalesce(age_group, '') || '|' || coalesce(division, '') || '|' || coalesce(gender, '') || '|'
       || coalesce(league, '') || '|' || coalesce(season, '') || '|' || zone, E'\n' order by id))
  from public.teams;
select 'equipes_sources=' || count(*) from public.equipes_sources;
