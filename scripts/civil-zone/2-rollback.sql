-- Rollback de 1-corriger.sql : repose division et zone À L'IDENTIQUE, depuis l'état AVANT
-- gardé dans la DERNIÈRE opération CIVIL_ZONE_CORRIGEE non encore annulée.
-- Gardé : chaque ligne doit être encore dans l'état que la correction lui a donné, sinon
-- exception (quelqu'un l'a modifiée depuis : on ne l'écrase pas à l'aveugle).
-- À jouer AVANT tout rollback de la migration 20261010120000 (la colonne zone doit exister).
begin;

do $$
declare
  admin uuid;
  op record;
  n_eq int; n_m int; attendu_eq int; attendu_m int;
begin
  select id into admin from public.users where email = 'bptds22@gmail.com';
  if admin is null then raise exception 'NEXUS: compte admin introuvable'; end if;

  select o.* into op from public.admin_operations o
   where o.operation = 'CIVIL_ZONE_CORRIGEE'
     and not exists (select 1 from public.admin_operations r
                      where r.operation = 'CIVIL_ZONE_ANNULEE' and r.details->>'annule' = o.id::text)
   order by o.le desc limit 1;
  if op.id is null then raise exception 'NEXUS: aucune correction CIVIL_ZONE_CORRIGEE à annuler'; end if;

  create temp table _eq on commit drop as
  select (x->>'id')::uuid as id, x->>'division' as division, x->>'zone' as zone
    from jsonb_array_elements(op.details->'avant_equipes') x;
  create temp table _m on commit drop as
  select (x->>'id')::uuid as id, x->>'division' as division, x->>'zone' as zone
    from jsonb_array_elements(op.details->'avant_matchs') x;
  attendu_eq := (op.details->>'equipes')::int;
  attendu_m := (op.details->>'matchs')::int;
  if (select count(*) from _eq) <> attendu_eq or (select count(*) from _m) <> attendu_m then
    raise exception 'NEXUS: état AVANT incomplet dans l''opération %', op.id;
  end if;

  -- GARDE : aucune ligne ne doit avoir quitté le format corrigé (division sans libellé
  -- fusionné, zone dans la liste fermée) ni disparu.
  if (select count(*) from public.teams t join _eq e on e.id = t.id) <> attendu_eq
     or (select count(*) from public.games g join _m m on m.id = g.id) <> attendu_m then
    raise exception 'NEXUS: des lignes corrigées ont disparu depuis la correction';
  end if;
  if exists (select 1 from public.teams t join _eq e on e.id = t.id where t.division ~* 'division|nord|sud|élite')
     or exists (select 1 from public.games g join _m m on m.id = g.id where g.division ~* 'division|nord|sud') then
    raise exception 'NEXUS: des lignes ont été modifiées depuis la correction — rollback refusé';
  end if;

  update public.teams t set division = e.division, zone = e.zone from _eq e where t.id = e.id;
  get diagnostics n_eq = row_count;
  update public.games g set division = m.division, zone = m.zone from _m m where g.id = m.id;
  get diagnostics n_m = row_count;
  if n_eq <> attendu_eq or n_m <> attendu_m then
    raise exception 'NEXUS: rollback % équipes / % matchs, attendu % / %', n_eq, n_m, attendu_eq, attendu_m;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ZONE_ANNULEE', 'Rollback de la correction catégorie / division / zone civile',
          jsonb_build_object('annule', op.id, 'equipes', n_eq, 'matchs', n_m), admin);
  raise notice 'NEXUS: rollback — % équipes, % matchs reposés', n_eq, n_m;
end $$;

commit;
