-- NLS — import des 622 matchs du 2026-10-14 en prod par psql — GARDES APRÈS.
-- Exécuté dans LA MÊME transaction que l'import (psql -1) : un écart annule
-- l'import ET sa ligne de journal. Lecture seule.
do $$
declare n int; v text; o jsonb;
begin
  select count(*) into n from public.games where source_nom = 'NLS';
  if n <> 622 then raise exception 'NEXUS: % match(s) NLS, attendu 622', n; end if;

  -- par division, au match près
  select string_agg(concat_ws(' ', category, nullif(division, ''), sex_type) || ' = ' || c, ' ; ' order by category, division, sex_type)
    into v from (select category, division, sex_type, count(*) c from public.games where source_nom = 'NLS' group by 1, 2, 3) d;
  if v is distinct from
     'Benjamin Féminin = 43 ; Benjamin Diamond Masculin = 42 ; Benjamin Gold Masculin = 89 ; '
  || 'Cadet Féminin = 52 ; Cadet Diamond Masculin = 66 ; Cadet Gold Masculin = 88 ; '
  || 'Juvénile Diamond Féminin = 42 ; Juvénile Diamond Masculin = 88 ; Juvénile Gold Féminin = 36 ; Juvénile Gold Masculin = 76' then
    raise exception 'NEXUS: répartition inattendue : %', v;
  end if;

  select count(*) into n from public.games where source_nom = 'NLS'
     and (home_team_id is null or visitor_team_id is null or game_date is null or game_time is null or venue is null
          or league_name <> 'No Limits Showcases' or season <> '2026-2027' or sport <> 'Basketball' or zone <> ''
          or source_url is null or collecte_le <> '2026-10-14T11:14:00-04:00'::timestamptz or is_played or home_score is not null);
  if n <> 0 then raise exception 'NEXUS: % match(s) NLS incomplet(s) ou mal formé(s)', n; end if;

  select count(*) into n from (select 1 from public.games where source_nom = 'NLS'
     group by category, division, sex_type, game_date, home_name_raw, visitor_name_raw having count(*) > 1) d;
  if n <> 0 then raise exception 'NEXUS: % doublon(s) de clé naturelle', n; end if;

  select count(*) into n from public.games g where g.source_nom = 'NLS'
     and not exists (select 1 from public.lieux_geocodes l where l.nom_normalise = public.lieu_normalise(g.venue));
  if n <> 0 then raise exception 'NEXUS: % match(s) NLS sans gymnase géocodé', n; end if;

  select count(*) into n from public.admin_operations where operation = 'NLS_MATCHS_IMPORT';
  if n <> 1 then raise exception 'NEXUS: % ligne(s) NLS_MATCHS_IMPORT, attendu 1', n; end if;
  select details into o from public.admin_operations where operation = 'NLS_MATCHS_IMPORT';
  if (o->>'lot_no')::int <> 1 or jsonb_array_length(o->'inseres') <> 622 or jsonb_array_length(o->'modifies') <> 0
     or (o->'compte'->>'nouveaux')::int <> 622 then
    raise exception 'NEXUS: journal inattendu : %', o->'compte';
  end if;

  raise notice 'NEXUS après : 622 matchs, répartition exacte, 0 doublon, 622 géocodés, 1 ligne de journal — OK';
end $$;
