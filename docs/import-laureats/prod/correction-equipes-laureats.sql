-- LOT PROD A — Correction des équipes Juvénile football 2026-2027 des Lauréats (décision BP 2026-10-15).
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.
--  1. Les 372 cartes Lauréats posées sur nos 14 équipes du 15 octobre passent sur l'équipe « pérenne » de la même
--     école (celle qui porte le rseq_team_id 2026-2027 et les matchs).
--  2. Les 14 équipes, devenues vides, sont SUPPRIMÉES. Exception écrite de BP à la règle « pas de DELETE », limitée
--     à ces 14 id : refusé si une seule ligne d'une seule table les référence encore.
--  3. École Mitchell - Montcalm (525725a2) : rseq_team_id fabb590e (« É.S. Montcalm », J M D3 Mineur 9 joueurs,
--     confirmé par BP), division D3, et les 7 côtés de match orphelins + la ligne de classement reliés, comme le
--     ferait la synchro (résolution par teams.rseq_team_id).
-- Effets des triggers, attendus et vérifiés : pour chacune des 372 cartes, une ligne MODIFIEE au journal (acteur
-- NULL, comme l'import), une entrée « carte_modifiee » dans rapprochement_file (une seule par carte : index unique),
-- updated_at et derniere_activite = now().
-- Aucune autre colonne des cartes ne change (garde md5). Prévision prod : 0 nouvelle proposition de rapprochement
-- (les 7 paires même équipe sont déjà proposées).
-- Rollback : docs/import-grasset/prod/rollback-correction-equipes-laureats.sql (recrée les 14 équipes à l'identique
-- depuis admin_operations, y remet les cartes, défait Mitchell).

create temp table _ca_plan (dup uuid primary key, per uuid not null unique, per_rseq uuid not null, cartes int not null);
insert into _ca_plan values
 ('b23b46e1-3bbb-4488-8b86-f3c91f8cba83','c1273ae7-0935-4e36-9dce-07c62ba7e22b','25d26b2c-39b1-4376-9ba4-4e94077c2004',28),
 ('9a7ee739-4c66-40c4-a86b-eff77a4ca16d','daa3e61a-a9fc-4454-8978-f531a1d78374','52e4e7ef-7fe6-4cea-abe7-c8c3a88e5d35',30),
 ('a5faab0b-7c8a-415b-a5da-48f92ce99f83','3c03d322-adaa-4172-9cd8-af86220c81e1','107581fc-f4a6-4b1b-9993-e51ff93f6e60',19),
 ('66f527f9-dff7-400a-8e9a-2ed0eb845fc5','aa7db663-f1b6-4ef5-82f5-61448b962ace','9110afe1-b46a-47f3-929c-f84b37fbe199',16),
 ('f7fe9a38-7192-4081-8744-fbfb238aadff','1e6feaf0-112f-41aa-b941-25ab5003f6f6','7008b2d4-d380-419c-b285-898b06b5ccbe',30),
 ('5dac9a66-e503-4fe2-95f5-80ee5b027664','928d1cbf-667e-4a8e-94ce-eea9502af1dc','70a81348-a5d3-49fc-ae61-95c9de230aa4',29),
 ('d40ffddf-1019-4389-a278-d2ca32dee0b1','9ad20107-21ce-4f67-8301-f1e457ff45cd','07f7fa1b-6c8b-4ac5-8531-f228dc0f8b06',24),
 ('a03beb90-ca2d-4fdc-b6b9-d0c46980591d','9f461dbe-32e4-48c0-af56-0e008f3a0476','b6a669dd-8580-4d2d-a472-f65cf8cf26d7',33),
 ('2cbb4aa6-8a8d-4c98-bfa0-97c9653992fa','4d556883-959a-4d56-8f0d-123879ea2c6a','abcbf7c6-0109-44bd-9cc3-942195753b5a',10),
 ('3a68b77a-44fd-492a-98cc-b4595bebaa8d','7fccb403-c667-49a1-9a08-1bf9452db3f2','fdfb31b1-cd0e-46b1-840b-acb0879411da',24),
 ('aea474f6-d5a5-4239-a495-093ed43921bb','e3a385ea-ad37-4c76-aa87-605442583f57','4bcfc5e3-d29b-4578-912b-290b1069f06a',35),
 ('81279b35-f4e1-4a1c-b684-db616664f724','f6caa2ed-764a-4694-9d6e-9914fae8ad25','653274f0-0267-4097-9760-0a1bd5044734',26),
 ('ffcad021-cb9b-4286-bdfb-7528494040e0','71b06238-1459-4af5-95cd-329accbaf14a','76ebbb54-b2b4-4dff-ab55-ff7f9662e7c8',37),
 ('12e706b6-febd-47cb-81b6-f18ffebfda89','e42d6352-63fb-4365-992e-d182a56a89ad','46e2cce4-3ffc-4f4b-a9bd-b6ac4c5498e0',31);

-- Cartes du lot Lauréats (les 10 tranches) et cartes à déplacer
create temp table _ca_lot as
select (x)::uuid as id from public.admin_operations o, jsonb_array_elements_text(o.details->'carte_ids') x
 where o.operation like 'IMPORT_CARTES_LAUREATS_T%';
create temp table _ca_cartes as
select c.id, c.team_id as dup, p.per from public.cartes_prospect c join _ca_plan p on p.dup = c.team_id;

-- Empreinte des cartes à déplacer, hors team_id / updated_at / derniere_activite (les seules colonnes qui bougent)
create temp table _ca_releve as
select txid_current() as txid,
       (select count(*) from public.teams) as teams,
       (select count(*) from public.cartes_prospect) as cartes,
       (select count(*) from public.admin_operations where operation = 'CORRECTION_EQUIPES_JUVENILE_LAUREATS')
     - (select count(*) from public.admin_operations where operation = 'ROLLBACK_CORRECTION_EQUIPES_JUVENILE_LAUREATS') as op_actives,
       (select md5(string_agg((to_jsonb(c) - 'team_id' - 'updated_at' - 'derniere_activite')::text, '|' order by c.id))
          from public.cartes_prospect c where c.id in (select id from _ca_cartes)) as empreinte,
       (select count(*) from public.cartes_prospect_journal where carte_id in (select id from _ca_cartes)) as journal,
       (select count(*) from public.rapprochement_file where carte_id in (select id from _ca_cartes)) as file,
       (select count(*) from public.rapprochements where carte_id in (select id from _ca_cartes)) as rapprochements,
       (select count(*) from public.cartes_prospect_notes where carte_id in (select id from _ca_cartes)) as notes,
       (select id from public.users where email = 'bptds22@gmail.com') as par,
       (select id from public.sports where nom = 'Football') as football,
       now() as debut;

-- 1. Gardes AVANT toute écriture
do $g$
declare n int; r record;
begin
  if (select txid from _ca_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select op_actives from _ca_releve) <> 0 then
    raise exception 'NEXUS LOT: correction déjà appliquée (admin_operations) — rien n''est fait';
  end if;
  if (select par from _ca_releve) is null or (select football from _ca_releve) is null then
    raise exception 'NEXUS LOT: compte admin ou sport Football introuvable';
  end if;
  -- Fonctions des triggers qui s'exécutent : celles relevées en prod et testées en local.
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and
    (p.proname, md5(pg_get_functiondef(p.oid))) in (
      ('cartes_prospect_avant_update','936954689b3deabfe8aff58a3ce792d5'),
      ('cartes_prospect_journaliser','7fa9d737481cdc8c75c1c780bdc73e43'),
      ('rapprochement_sur_carte','5dc928917d2fca821ea9afceb71df9bf'),
      ('rapprochement_enfiler','3db6cdf7a1834d8c7b988d59bdace00c'),
      ('carte_fusion_garde','3a99c71080f9c8a4030fe21c8d1f5c48'),
      ('carte_invitation_garde','78fa02648bb4527b3c799edf21ad2fbf'));
  if n <> 6 then raise exception 'NEXUS LOT: % fonction(s) de trigger sur 6 seulement identiques à celles testées', n; end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.cartes_prospect'::regclass and not tgisinternal) <> 12
     or (select count(*) from pg_trigger where tgrelid = 'public.teams'::regclass and not tgisinternal) <> 1
     or (select count(*) from pg_trigger where tgrelid in ('public.games'::regclass, 'public.rseq_standings'::regclass) and not tgisinternal) <> 0 then
    raise exception 'NEXUS LOT: les triggers de cartes_prospect / teams / games / rseq_standings ne sont plus ceux testés';
  end if;
  -- Les 14 doublons : tels que créés le 15 octobre, même école / sport / catégorie / genre que leur pérenne.
  select count(*) into n from _ca_plan p join public.teams d on d.id = p.dup join public.teams e on e.id = p.per
   where d.rseq_team_id is null and d.season = '2026-2027' and d.created_at::date = date '2026-10-15'
     and d.sport_id = (select football from _ca_releve) and d.age_group = 'Juvénile'
     and e.rseq_team_id = p.per_rseq and e.is_active
     and e.school_id = d.school_id and e.sport_id = d.sport_id and e.age_group = d.age_group and e.gender = d.gender
     and e.division is not distinct from d.division;
  if n <> 14 then raise exception 'NEXUS LOT: % paire(s) doublon / pérenne sur 14 seulement correspondent au relevé', n; end if;
  -- Chaque pérenne a des matchs.
  select count(*) into n from _ca_plan p
   where exists (select 1 from public.games g where g.home_team_id = p.per or g.visitor_team_id = p.per);
  if n <> 14 then raise exception 'NEXUS LOT: % pérenne(s) sur 14 seulement ont des matchs', n; end if;
  -- Les cartes : le compte relevé par équipe, toutes du lot Lauréats, aucune fusionnée.
  for r in select p.dup, p.cartes, (select count(*) from _ca_cartes c where c.dup = p.dup) as n from _ca_plan p loop
    if r.n <> r.cartes then raise exception 'NEXUS LOT: % carte(s) sur l''équipe % au lieu de %', r.n, r.dup, r.cartes; end if;
  end loop;
  if (select count(*) from _ca_cartes) <> 372
     or (select count(*) from _ca_cartes where id not in (select id from _ca_lot)) <> 0
     or (select count(*) from public.cartes_prospect where id in (select id from _ca_cartes)
           and (fusionnee_le is not null or unite_cegep_id <> 'dfad9036-0d54-4304-906f-91f19542a882'
                or unite_sport_id <> (select football from _ca_releve))) <> 0
     or (select count(*) from _ca_lot) <> 952 then
    raise exception 'NEXUS LOT: les cartes à déplacer ne sont pas exactement 372 cartes visibles du lot Lauréats (952)';
  end if;
  -- Hors cartes, rien ne référence les 14 doublons.
  select (select count(*) from public.athletes where equipe_id in (select dup from _ca_plan) or league_team_id in (select dup from _ca_plan))
       + (select count(*) from public.users where primary_team_id in (select dup from _ca_plan))
       + (select count(*) from public.games where home_team_id in (select dup from _ca_plan) or visitor_team_id in (select dup from _ca_plan))
       + (select count(*) from public.ambassadeur_revendications where team_id in (select dup from _ca_plan))
       + (select count(*) from public.partenaire_prospects where team_id in (select dup from _ca_plan))
       + (select count(*) from public.rseq_standings where team_id in (select dup from _ca_plan))
       + (select count(*) from public.rseq_sync_alerts where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_athletes where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_coaches where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_events where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_invitations where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_join_tokens where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_page_content where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_pennants where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_position_needs where team_id in (select dup from _ca_plan))
       + (select count(*) from public.athlete_coaches where team_id in (select dup from _ca_plan))
       + (select count(*) from public.conversations where group_team_id in (select dup from _ca_plan))
    into n;
  if n <> 0 then raise exception 'NEXUS LOT: % ligne(s) hors cartes référencent les doublons — rien n''est fait', n; end if;
  -- Les FK vers teams sont exactement les 16 vérifiées ici (une nouvelle table annulerait tout).
  if (select count(*) from pg_constraint where contype = 'f' and confrelid = 'public.teams'::regclass) <> 16 then
    raise exception 'NEXUS LOT: le nombre de clés étrangères vers teams n''est plus 16';
  end if;
  -- Mitchell - Montcalm : équipe telle que créée, identifiant RSEQ libre, 7 côtés orphelins, 1 classement orphelin.
  if (select count(*) from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee' and rseq_team_id is null
        and division is null and school_id = '5c7076bb-1b2c-4376-90ed-f1a323a5e6f4' and age_group = 'Juvénile'
        and season = '2026-2027' and sport_id = (select football from _ca_releve)) <> 1 then
    raise exception 'NEXUS LOT: l''équipe Mitchell - Montcalm n''est plus celle relevée';
  end if;
  if exists (select 1 from public.teams where rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102') then
    raise exception 'NEXUS LOT: fabb590e est déjà posé sur une équipe';
  end if;
  if (select count(*) from public.games where home_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and home_team_id is null)
   + (select count(*) from public.games where visitor_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and visitor_team_id is null) <> 7
     or (select count(*) from public.games where home_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102'
                                              or visitor_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102') <> 7
     or (select count(*) from public.rseq_standings where rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and team_id is null) <> 1 then
    raise exception 'NEXUS LOT: Montcalm n''a plus exactement 7 côtés de match et 1 classement orphelins';
  end if;
end $g$;

-- 2. Sauvegarde, pour le rollback, de ce qui va changer
create temp table _ca_sauve as
select (select jsonb_agg(to_jsonb(t) order by t.id) from public.teams t where t.id in (select dup from _ca_plan)) as equipes,
       (select to_jsonb(t) from public.teams t where t.id = '525725a2-d9bc-44b9-8978-e108918676ee') as mitchell_avant,
       (select jsonb_agg(id order by id) from public.games where home_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and home_team_id is null) as matchs_domicile,
       (select jsonb_agg(id order by id) from public.games where visitor_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and visitor_team_id is null) as matchs_visiteur,
       (select jsonb_agg(id order by id) from public.rseq_standings where rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and team_id is null) as classements;

-- 3. Déplacement des cartes
update public.cartes_prospect c set team_id = x.per from _ca_cartes x where x.id = c.id and c.team_id = x.dup;

-- 4. Suppression des 14 doublons, après une nouvelle garde « plus rien ne les référence »
do $s$
declare n int;
begin
  select (select count(*) from public.cartes_prospect where team_id in (select dup from _ca_plan))
       + (select count(*) from public.athletes where equipe_id in (select dup from _ca_plan) or league_team_id in (select dup from _ca_plan))
       + (select count(*) from public.users where primary_team_id in (select dup from _ca_plan))
       + (select count(*) from public.games where home_team_id in (select dup from _ca_plan) or visitor_team_id in (select dup from _ca_plan))
       + (select count(*) from public.ambassadeur_revendications where team_id in (select dup from _ca_plan))
       + (select count(*) from public.partenaire_prospects where team_id in (select dup from _ca_plan))
       + (select count(*) from public.rseq_standings where team_id in (select dup from _ca_plan))
       + (select count(*) from public.rseq_sync_alerts where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_athletes where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_coaches where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_events where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_invitations where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_join_tokens where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_page_content where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_pennants where team_id in (select dup from _ca_plan))
       + (select count(*) from public.team_position_needs where team_id in (select dup from _ca_plan))
       + (select count(*) from public.athlete_coaches where team_id in (select dup from _ca_plan))
       + (select count(*) from public.conversations where group_team_id in (select dup from _ca_plan))
    into n;
  if n <> 0 then raise exception 'NEXUS LOT: % ligne(s) référencent encore les doublons — tout est annulé', n; end if;
end $s$;

delete from public.teams where id in (select dup from _ca_plan);

-- 5. Mitchell - Montcalm
update public.teams set rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102', division = 'D3'
 where id = '525725a2-d9bc-44b9-8978-e108918676ee';
update public.games set home_team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
 where id in (select (x)::uuid from _ca_sauve, jsonb_array_elements_text(matchs_domicile) x);
update public.games set visitor_team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
 where id in (select (x)::uuid from _ca_sauve, jsonb_array_elements_text(matchs_visiteur) x);
update public.rseq_standings set team_id = '525725a2-d9bc-44b9-8978-e108918676ee'
 where id in (select (x)::uuid from _ca_sauve, jsonb_array_elements_text(classements) x);

-- 6. Trace
insert into public.admin_operations (operation, motif, details, par)
select 'CORRECTION_EQUIPES_JUVENILE_LAUREATS',
       'Cartes Lauréats déplacées vers la Juvénile pérenne synchronisée ; 14 doublons du 15 oct. supprimés (exception BP) ; Mitchell-Montcalm relié à fabb590e',
       jsonb_build_object(
         'deplacements', (select jsonb_agg(jsonb_build_object('de', p.dup, 'vers', p.per,
                            'carte_ids', (select jsonb_agg(c.id order by c.id) from _ca_cartes c where c.dup = p.dup)) order by p.dup) from _ca_plan p),
         'equipes_supprimees', s.equipes,
         'mitchell', jsonb_build_object('avant', s.mitchell_avant,
                       'apres', (select to_jsonb(t) from public.teams t where t.id = '525725a2-d9bc-44b9-8978-e108918676ee'),
                       'matchs_domicile', s.matchs_domicile, 'matchs_visiteur', s.matchs_visiteur, 'classements', s.classements)),
       (select par from _ca_releve)
  from _ca_sauve s;

-- 7. Gardes finales
do $f$
declare n int;
begin
  if (select txid from _ca_releve) <> txid_current() then raise exception 'NEXUS LOT: transaction changée'; end if;
  if (select count(*) from public.teams) <> (select teams from _ca_releve) - 14
     or exists (select 1 from public.teams where id in (select dup from _ca_plan)) then
    raise exception 'NEXUS LOT: teams n''a pas perdu exactement les 14 doublons — tout est annulé';
  end if;
  if (select count(*) from public.cartes_prospect) <> (select cartes from _ca_releve) then
    raise exception 'NEXUS LOT: le nombre de cartes a changé — tout est annulé';
  end if;
  select count(*) into n from public.cartes_prospect c join _ca_cartes x on x.id = c.id where c.team_id = x.per;
  if n <> 372 then raise exception 'NEXUS LOT: % carte(s) sur 372 seulement sont sur leur pérenne', n; end if;
  if (select md5(string_agg((to_jsonb(c) - 'team_id' - 'updated_at' - 'derniere_activite')::text, '|' order by c.id))
        from public.cartes_prospect c where c.id in (select id from _ca_cartes)) <> (select empreinte from _ca_releve) then
    raise exception 'NEXUS LOT: une autre colonne des cartes a changé (école, unité, fusion, invitation…) — tout est annulé';
  end if;
  if (select count(*) from public.cartes_prospect_journal where carte_id in (select id from _ca_cartes)) <> (select journal from _ca_releve) + 372
     or (select count(*) from public.cartes_prospect_journal where carte_id in (select id from _ca_cartes)
           and action = 'MODIFIEE' and acteur is null and created_at >= (select debut from _ca_releve)) <> 372 then
    raise exception 'NEXUS LOT: le journal n''a pas reçu exactement 372 lignes MODIFIEE — tout est annulé';
  end if;
  -- Une seule entrée par carte dans la file (index unique) : chaque carte déplacée y est, en attente du cron.
  if (select count(distinct carte_id) from public.rapprochement_file where carte_id in (select id from _ca_cartes)) <> 372 then
    raise exception 'NEXUS LOT: les 372 cartes ne sont pas toutes dans la file de rapprochement — tout est annulé';
  end if;
  if (select count(*) from public.rapprochements where carte_id in (select id from _ca_cartes)) <> (select rapprochements from _ca_releve)
     or (select count(*) from public.cartes_prospect_notes where carte_id in (select id from _ca_cartes)) <> (select notes from _ca_releve) then
    raise exception 'NEXUS LOT: rapprochements ou notes des cartes ont changé — tout est annulé';
  end if;
  -- Mitchell
  if (select count(*) from public.teams where id = '525725a2-d9bc-44b9-8978-e108918676ee'
        and rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and division = 'D3') <> 1
     or (select count(*) from public.games where (home_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and home_team_id = '525725a2-d9bc-44b9-8978-e108918676ee')
                                              or (visitor_rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and visitor_team_id = '525725a2-d9bc-44b9-8978-e108918676ee')) <> 7
     or (select count(*) from public.rseq_standings where rseq_team_id = 'fabb590e-cdc3-499e-98dc-e5580e091102' and team_id = '525725a2-d9bc-44b9-8978-e108918676ee') <> 1 then
    raise exception 'NEXUS LOT: Mitchell - Montcalm n''est pas relié comme prévu — tout est annulé';
  end if;
  -- Les 952 cartes du lot sont sur une équipe qui a des matchs.
  select count(*) into n from public.cartes_prospect c
   where c.id in (select id from _ca_lot) and c.fusionnee_le is null
     and exists (select 1 from public.games g where g.home_team_id = c.team_id or g.visitor_team_id = c.team_id);
  if n <> 952 then raise exception 'NEXUS LOT: % carte(s) du lot sur 952 seulement sont sur une équipe avec matchs', n; end if;
  if (select count(*) from public.admin_operations where operation = 'CORRECTION_EQUIPES_JUVENILE_LAUREATS') <> (select op_actives from _ca_releve)
       + (select count(*) from public.admin_operations where operation = 'ROLLBACK_CORRECTION_EQUIPES_JUVENILE_LAUREATS') + 1 then
    raise exception 'NEXUS LOT: trace admin_operations absente';
  end if;
end $f$;

select json_build_object(
  'teams', json_build_object('avant', (select teams from _ca_releve), 'apres', (select count(*) from public.teams)),
  'cartes_deplacees', (select count(*) from public.cartes_prospect c join _ca_cartes x on x.id = c.id where c.team_id = x.per),
  'par_pérenne', (select json_object_agg(t.name, n) from (select x.per, count(*) n from _ca_cartes x group by x.per) y join public.teams t on t.id = y.per),
  'journal_modifiee', (select count(*) from public.cartes_prospect_journal where carte_id in (select id from _ca_cartes) and action = 'MODIFIEE' and created_at >= (select debut from _ca_releve)),
  'file_rapprochement', (select count(*) from public.rapprochement_file where carte_id in (select id from _ca_cartes)),
  'mitchell', (select json_build_object('rseq', rseq_team_id, 'division', division,
                 'matchs', (select count(*) from public.games g where g.home_team_id = t.id or g.visitor_team_id = t.id),
                 'classements', (select count(*) from public.rseq_standings s where s.team_id = t.id))
                 from public.teams t where t.id = '525725a2-d9bc-44b9-8978-e108918676ee'),
  'lot_sur_equipe_avec_matchs', (select count(*) from public.cartes_prospect c where c.id in (select id from _ca_lot) and c.fusionnee_le is null
                 and exists (select 1 from public.games g where g.home_team_id = c.team_id or g.visitor_team_id = c.team_id)),
  'operation', (select id from public.admin_operations where operation = 'CORRECTION_EQUIPES_JUVENILE_LAUREATS' order by le desc limit 1),
  'meme_transaction', (select txid from _ca_releve) = txid_current()
) as resultat_correction_a;
