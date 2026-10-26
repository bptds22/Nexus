-- Rollback du lot 2b : remet à vide les coordonnées posées par la dernière opération non annulée,
-- seulement si elles n'ont pas bougé depuis. UN SEUL bloc DO.
do $rb2b$
declare
  o public.admin_operations;
  n int;
begin
  select * into o from public.admin_operations a
   where a.operation = 'CIVIL_GEOCODAGE_VILLES'
     and not exists (select 1 from public.admin_operations b where b.operation = 'CIVIL_GEOCODAGE_VILLES_ANNULE'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 2b à défaire'; end if;
  if exists (select 1 from jsonb_array_elements(o.details->'poses') p join public.schools s on s.id = (p->>'id')::uuid
              where s.lat is distinct from (p->>'lat')::float8 or s.lng is distinct from (p->>'lng')::float8
                 or s.geo_source is distinct from 'approx') then
    raise exception 'NEXUS: une coordonnée du lot 2b a été modifiée depuis — rien n''est défait';
  end if;
  update public.schools s set lat = null, lng = null, geo_source = null, updated_at = now()
    from jsonb_array_elements(o.details->'poses') p where s.id = (p->>'id')::uuid;
  get diagnostics n = row_count;
  if n <> jsonb_array_length(o.details->'poses') then
    raise exception 'NEXUS: % coordonnées remises à vide, attendu %', n, jsonb_array_length(o.details->'poses');
  end if;
  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_GEOCODAGE_VILLES_ANNULE', 'Annulation du lot 2b civil (géocodage par ville)',
          jsonb_build_object('op', o.id, 'remises_a_vide', n),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 2b défait — % coordonnées remises à vide (op %)', n, o.id;
end $rb2b$;
