-- ROLLBACK du LOT A (correction-equipes-laureats.sql). UN SEUL envoi, une seule transaction.
-- Recrée les 14 équipes supprimées, À L'IDENTIQUE (mêmes id, mêmes colonnes) depuis admin_operations, y remet les
-- 372 cartes, et défait Mitchell - Montcalm (rseq_team_id et division NULL, 7 côtés de match et le classement
-- détachés). Refuse si une carte n'est plus sur sa pérenne ou si Mitchell a changé depuis.
-- Note : le retour des cartes ajoute à son tour 372 lignes MODIFIEE au journal et remet les 372 cartes dans la file
-- de rapprochement (triggers ; une entrée par carte au plus).

create temp table _rc_op as
select o.id, o.details from public.admin_operations o
 where o.operation = 'CORRECTION_EQUIPES_JUVENILE_LAUREATS'
   and not exists (select 1 from public.admin_operations r where r.operation = 'ROLLBACK_CORRECTION_EQUIPES_JUVENILE_LAUREATS'
                     and r.details->>'correction' = o.id::text);

create temp table _rc_cartes as
select (c)::uuid as id, (d->>'de')::uuid as dup, (d->>'vers')::uuid as per
  from _rc_op o, jsonb_array_elements(o.details->'deplacements') d, jsonb_array_elements_text(d->'carte_ids') c;

create temp table _rc_releve as
select txid_current() as txid, (select count(*) from public.teams) as teams,
       (select count(*) from _rc_op) as ops,
       (select id from public.users where email = 'bptds22@gmail.com') as par;

do $g$
begin
  if (select txid from _rc_releve) <> txid_current() then
    raise exception 'NEXUS ROLLBACK: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select ops from _rc_releve) <> 1 then
    raise exception 'NEXUS ROLLBACK: % correction(s) active(s) au lieu d''une — rien n''est fait', (select ops from _rc_releve);
  end if;
  if (select count(*) from _rc_cartes) <> 372 or (select count(distinct dup) from _rc_cartes) <> 14 then
    raise exception 'NEXUS ROLLBACK: la trace ne décrit pas 372 cartes sur 14 équipes';
  end if;
  if exists (select 1 from public.teams where id in (select dup from _rc_cartes)) then
    raise exception 'NEXUS ROLLBACK: une des 14 équipes existe déjà';
  end if;
  if (select count(*) from public.cartes_prospect c join _rc_cartes x on x.id = c.id where c.team_id = x.per) <> 372 then
    raise exception 'NEXUS ROLLBACK: les 372 cartes ne sont plus toutes sur leur pérenne — rien n''est fait';
  end if;
  if (select count(*) from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee'
        and rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and division = 'D3') <> 1 then
    raise exception 'NEXUS ROLLBACK: Mitchell - Montcalm a changé depuis la correction — rien n''est fait';
  end if;
end $g$;

-- 1. Les 14 équipes, à l'identique
insert into public.teams
select (jsonb_populate_record(null::public.teams, e)).*
  from _rc_op o, jsonb_array_elements(o.details->'equipes_supprimees') e;

-- 2. Les cartes y retournent
update public.cartes_prospect c set team_id = x.dup from _rc_cartes x where x.id = c.id and c.team_id = x.per;

-- 3. Mitchell - Montcalm
update public.games set home_team_id = null
 where home_team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
   and id in (select (x)::uuid from _rc_op o, jsonb_array_elements_text(o.details->'mitchell'->'matchs_domicile') x);
update public.games set visitor_team_id = null
 where visitor_team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
   and id in (select (x)::uuid from _rc_op o, jsonb_array_elements_text(o.details->'mitchell'->'matchs_visiteur') x);
update public.rseq_standings set team_id = null
 where team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
   and id in (select (x)::uuid from _rc_op o, jsonb_array_elements_text(o.details->'mitchell'->'classements') x);
-- Le nom aussi : le renommage « É.S. Montcalm » (renommer-equipe-montcalm.sql) est défait avec la correction.
update public.teams t set rseq_team_id = null, division = (o.details->'mitchell'->'avant'->>'division'),
                          name = (o.details->'mitchell'->'avant'->>'name')
  from _rc_op o where t.id = '525725a2-d9bc-44b9-8978-e108918676ee';

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_CORRECTION_EQUIPES_JUVENILE_LAUREATS', 'Retour à l''état d''avant la correction A',
       jsonb_build_object('correction', o.id), (select par from _rc_releve)
  from _rc_op o;

do $f$
begin
  if (select txid from _rc_releve) <> txid_current() then raise exception 'NEXUS ROLLBACK: transaction changée'; end if;
  if (select count(*) from public.teams) <> (select teams from _rc_releve) + 14 then
    raise exception 'NEXUS ROLLBACK: teams n''a pas regagné exactement 14 équipes — tout est annulé';
  end if;
  if (select count(*) from public.cartes_prospect c join _rc_cartes x on x.id = c.id where c.team_id = x.dup) <> 372 then
    raise exception 'NEXUS ROLLBACK: les 372 cartes ne sont pas revenues — tout est annulé';
  end if;
  if (select count(*) from public.teams t, _rc_op o, jsonb_array_elements(o.details->'equipes_supprimees') e
       where t.id = (e->>'id')::uuid and to_jsonb(t) = e) <> 14 then
    raise exception 'NEXUS ROLLBACK: les 14 équipes recréées ne sont pas identiques — tout est annulé';
  end if;
  if (select to_jsonb(t) from public.teams t where t.id = '525725a2-d9bc-44b9-8978-e108918676ee')
       <> (select o.details->'mitchell'->'avant' from _rc_op o)
     or exists (select 1 from public.games where home_team_id = '525725a2-d9bc-44b9-8978-e108918676ee' or visitor_team_id = '525725a2-d9bc-44b9-8978-e108918676ee')
     or exists (select 1 from public.rseq_standings where team_id = '525725a2-d9bc-44b9-8978-e108918676ee') then
    raise exception 'NEXUS ROLLBACK: Mitchell - Montcalm n''est pas revenu à l''identique — tout est annulé';
  end if;
end $f$;

select json_build_object('teams_avant', (select teams from _rc_releve), 'teams_apres', (select count(*) from public.teams),
  'cartes_revenues', (select count(*) from public.cartes_prospect c join _rc_cartes x on x.id = c.id where c.team_id = x.dup),
  'meme_transaction', (select txid from _rc_releve) = txid_current()) as resultat_rollback_a;
