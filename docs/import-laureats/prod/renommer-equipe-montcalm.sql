-- LOT PROD A-bis — renomme notre Juvénile 525725a2 en « É.S. Montcalm » (nom RSEQ de fabb590e ; décision BP 2026-10-15).
-- À envoyer APRÈS correction-equipes-laureats.sql, en UN SEUL appel. Seule la colonne name de 525725a2 change.
-- La Benjamin « É.S. Mitchell » (656e79d2 / 4a40fde0) n'est pas touchée.
-- Rollback : rollback-correction-equipes-laureats.sql rend aussi le nom d'origine (« É.S. Mitchell »).

create temp table _rm_releve as
select txid_current() as txid,
       (select name from public.teams where id = '4a40fde0-47be-4e47-9329-21a8486f8f35') as benjamin,
       (select id from public.users where email = 'bptds22@gmail.com') as par;

do $g$
begin
  if (select txid from _rm_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select count(*) from public.admin_operations where operation = 'CORRECTION_EQUIPES_JUVENILE_LAUREATS')
   - (select count(*) from public.admin_operations where operation = 'ROLLBACK_CORRECTION_EQUIPES_JUVENILE_LAUREATS') <> 1 then
    raise exception 'NEXUS LOT: la correction A n''est pas appliquée — rien n''est fait';
  end if;
  if (select count(*) from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee' and name = 'É.S. Mitchell'
        and rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and division = 'D3') <> 1 then
    raise exception 'NEXUS LOT: 525725a2 n''est pas « É.S. Mitchell » reliée à fabb590e — rien n''est fait';
  end if;
  if (select count(*) from public.teams where id = '4a40fde0-47be-4e47-9329-21a8486f8f35' and name = 'É.S. Mitchell'
        and rseq_team_id = '656e79d2-69d8-4b7a-97cf-24eebaa78bf8') <> 1 then
    raise exception 'NEXUS LOT: la Benjamin É.S. Mitchell n''est plus celle relevée';
  end if;
end $g$;

update public.teams set name = 'É.S. Montcalm' where id = '525725a2-d9bc-44b9-8978-e108918676ee';

insert into public.admin_operations (operation, motif, details, par)
select 'RENOMMAGE_EQUIPE_MONTCALM', 'Juvénile 525725a2 renommée au nom RSEQ de fabb590e',
       jsonb_build_object('team_id', '525725a2-d9bc-44b9-8978-e108918676ee', 'avant', 'É.S. Mitchell', 'apres', 'É.S. Montcalm'),
       (select par from _rm_releve);

do $f$
begin
  if (select txid from _rm_releve) <> txid_current() then raise exception 'NEXUS LOT: transaction changée'; end if;
  if (select count(*) from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee' and name = 'É.S. Montcalm') <> 1
     or (select name from public.teams where id = '4a40fde0-47be-4e47-9329-21a8486f8f35') <> (select benjamin from _rm_releve) then
    raise exception 'NEXUS LOT: renommage non conforme — tout est annulé';
  end if;
end $f$;

select json_build_object('equipe', (select name from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee'),
  'benjamin', (select name from public.teams where id = '4a40fde0-47be-4e47-9329-21a8486f8f35'),
  'meme_transaction', (select txid from _rm_releve) = txid_current()) as resultat_renommage;
