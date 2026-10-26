-- Rollback du lot 2 civil : défait la dernière opération CIVIL_ORGANISATIONS_CREEES non annulée.
-- Refuse si une organisation créée est référencée ailleurs (équipe, athlète, coach, cible…) ou si
-- une coordonnée posée a été modifiée depuis. UN SEUL bloc DO.
do $rb2$
declare
  o       public.admin_operations;
  v_ids   uuid[];
  r       record;
  n       bigint;
  n_del   int;
  n_src   int;
  n_geo   int;
begin
  select * into o from public.admin_operations a
   where a.operation = 'CIVIL_ORGANISATIONS_CREEES'
     and not exists (select 1 from public.admin_operations b where b.operation = 'CIVIL_ORGANISATIONS_ANNULEES'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 2 à défaire'; end if;
  v_ids := array(select jsonb_array_elements_text(o.details->'nouvelles_ids')::uuid);

  -- Toute clé étrangère vers schools, sauf organisations_sources : aucune ligne ne doit viser les créées
  for r in select c.conrelid::regclass as t, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.schools'::regclass
              and c.conrelid <> 'public.organisations_sources'::regclass loop
    execute format('select count(*) from %s where %I = any($1)', r.t, r.col) into n using v_ids;
    if n > 0 then
      raise exception 'NEXUS: % ligne(s) de % visent une organisation du lot 2 — défaire les lots suivants d''abord', n, r.t;
    end if;
  end loop;

  -- Coordonnées : on ne restaure que ce que le lot a posé, inchangé depuis
  if exists (select 1 from jsonb_array_elements(o.details->'geo_existantes') g
               join public.schools s on s.id = (g->>'id')::uuid
              where s.lat is distinct from (g->>'lat_pose')::float8 or s.lng is distinct from (g->>'lng_pose')::float8
                 or s.geo_source is distinct from 'approx') then
    raise exception 'NEXUS: une coordonnée posée par le lot 2 a été modifiée depuis — rien n''est défait';
  end if;
  update public.schools s set lat = (g->>'lat')::float8, lng = (g->>'lng')::float8, geo_source = g->>'geo_source',
                              updated_at = now()
    from jsonb_array_elements(o.details->'geo_existantes') g where s.id = (g->>'id')::uuid;
  get diagnostics n_geo = row_count;

  delete from public.organisations_sources where operation_id = o.id;
  get diagnostics n_src = row_count;
  delete from public.schools where id = any(v_ids);
  get diagnostics n_del = row_count;
  if n_del <> cardinality(v_ids) or n_geo <> jsonb_array_length(o.details->'geo_existantes') then
    raise exception 'NEXUS: rollback incomplet (% / % supprimées, % / % coordonnées)', n_del, cardinality(v_ids),
      n_geo, jsonb_array_length(o.details->'geo_existantes');
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ORGANISATIONS_ANNULEES', 'Annulation du lot 2 civil (organisations + géocodage)',
          jsonb_build_object('op', o.id, 'supprimees', n_del, 'coordonnees_restaurees', n_geo, 'correspondances', n_src),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 2 défait — % organisations supprimées, % coordonnées restaurées, % correspondances (op %)',
    n_del, n_geo, n_src, o.id;
end $rb2$;
