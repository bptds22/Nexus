-- ROLLBACK — Juvénile football 2026-2027 (lot-equipes-juvenile-2627.sql). UN SEUL envoi, une seule transaction.
-- Supprime EXACTEMENT les 15 équipes créées par le lot, rien d'autre. Refuse si une seule ligne les référence
-- (cartes prospect, athlètes, matchs, coachs, etc.) : retirer d'abord ce qui s'y est accroché (rollback des cartes).

create temp table _rb_ids (id uuid primary key);
insert into _rb_ids values
 ('b23b46e1-3bbb-4488-8b86-f3c91f8cba83'),('9a7ee739-4c66-40c4-a86b-eff77a4ca16d'),('a5faab0b-7c8a-415b-a5da-48f92ce99f83'),
 ('66f527f9-dff7-400a-8e9a-2ed0eb845fc5'),('f7fe9a38-7192-4081-8744-fbfb238aadff'),('5dac9a66-e503-4fe2-95f5-80ee5b027664'),
 ('d40ffddf-1019-4389-a278-d2ca32dee0b1'),('a03beb90-ca2d-4fdc-b6b9-d0c46980591d'),('2cbb4aa6-8a8d-4c98-bfa0-97c9653992fa'),
 ('3a68b77a-44fd-492a-98cc-b4595bebaa8d'),('aea474f6-d5a5-4239-a495-093ed43921bb'),('81279b35-f4e1-4a1c-b684-db616664f724'),
 ('ffcad021-cb9b-4286-bdfb-7528494040e0'),('12e706b6-febd-47cb-81b6-f18ffebfda89'),('525725a2-d9bc-44b9-8978-e108918676ee');

create temp table _rb_releve as
select txid_current() as txid, (select count(*) from public.teams) as teams,
       (select id from public.users where email = 'bptds22@gmail.com') as par;

do $g$
declare n int;
begin
  if (select count(*) from public.teams t join _rb_ids i on i.id = t.id) <> 15 then
    raise exception 'NEXUS ROLLBACK: les 15 équipes ne sont pas toutes présentes — rien n''est supprimé';
  end if;
  select (select count(*) from public.cartes_prospect where team_id in (select id from _rb_ids))
       + (select count(*) from public.athletes where equipe_id in (select id from _rb_ids))
       + (select count(*) from public.users where primary_team_id in (select id from _rb_ids))
       + (select count(*) from public.games where home_team_id in (select id from _rb_ids) or visitor_team_id in (select id from _rb_ids))
       + (select count(*) from public.ambassadeur_revendications where team_id in (select id from _rb_ids))
       + (select count(*) from public.partenaire_prospects where team_id in (select id from _rb_ids))
       + (select count(*) from public.rseq_standings where team_id in (select id from _rb_ids))
       + (select count(*) from public.rseq_sync_alerts where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_athletes where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_coaches where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_events where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_invitations where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_join_tokens where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_page_content where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_pennants where team_id in (select id from _rb_ids))
       + (select count(*) from public.team_position_needs where team_id in (select id from _rb_ids))
    into n;
  if n <> 0 then
    raise exception 'NEXUS ROLLBACK: % ligne(s) référencent encore ces équipes — rien n''est supprimé', n;
  end if;
end $g$;

delete from public.teams where id in (select id from _rb_ids);

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_EQUIPES_JUVENILE_FB_2627', 'Retrait des 15 Juvénile football 2026-2027 du lot Lauréats',
       jsonb_build_object('team_ids', (select jsonb_agg(id order by id) from _rb_ids)), (select par from _rb_releve);

do $f$
begin
  if (select txid from _rb_releve) <> txid_current() then raise exception 'NEXUS ROLLBACK: transaction changée'; end if;
  if (select count(*) from public.teams) <> (select teams from _rb_releve) - 15 then
    raise exception 'NEXUS ROLLBACK: teams n''a pas diminué d''exactement 15 — tout est annulé';
  end if;
end $f$;

select json_build_object('avant', (select teams from _rb_releve), 'apres', (select count(*) from public.teams),
                         'restants', (select count(*) from public.teams t join _rb_ids i on i.id = t.id)) as resultat_rollback;
