-- Rollback du lot 3 : supprime les équipes de la dernière opération CIVIL_EQUIPES_MOINS18_CREEES non annulée.
-- Refuse si UNE ligne, n'importe où, vise une de ces équipes (athlète, coach, match, code, page…),
-- y compris par une clé en cascade : on ne détruit jamais une donnée posée depuis. UN SEUL bloc DO.
do $rb3$
declare
  o     public.admin_operations;
  v_ids uuid[];
  r     record;
  n     bigint;
  n_del int;
begin
  select * into o from public.admin_operations a
   where a.operation = 'CIVIL_EQUIPES_MOINS18_CREEES'
     and not exists (select 1 from public.admin_operations b where b.operation = 'CIVIL_EQUIPES_MOINS18_CREEES_ANNULEES'
                       and b.details->>'op' = a.id::text)
   order by a.le desc limit 1;
  if not found then raise exception 'NEXUS: aucune opération du lot 3 à défaire'; end if;
  v_ids := array(select jsonb_array_elements_text(o.details->'ids')::uuid);
  for r in select c.conrelid::regclass as t, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.teams'::regclass
              and c.conrelid <> 'public.equipes_sources'::regclass loop
    execute format('select count(*) from %s where %I = any($1)', r.t, r.col) into n using v_ids;
    if n > 0 then
      raise exception 'NEXUS: % ligne(s) de % visent une équipe du lot 3 — rien n''est défait', n, r.t;
    end if;
  end loop;
  delete from public.teams where id = any(v_ids);        -- equipes_sources suit (cascade)
  get diagnostics n_del = row_count;
  if n_del <> cardinality(v_ids) then
    raise exception 'NEXUS: % équipes supprimées, attendu %', n_del, cardinality(v_ids);
  end if;
  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_EQUIPES_MOINS18_CREEES_ANNULEES', 'Annulation du lot 3 civil (équipes de moins de 18 ans)',
          jsonb_build_object('op', o.id, 'supprimees', n_del),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: lot 3 défait — % équipes supprimées (op %)', n_del, o.id;
end $rb3$;
