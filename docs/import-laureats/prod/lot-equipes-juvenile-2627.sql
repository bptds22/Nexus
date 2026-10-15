-- LOT PROD — Juvénile football 2026-2027 pour 15 écoles (chantier import Lauréats, option B, décision BP 2026-10-15)
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.
-- Aucun DELETE, aucune école créée, aucune autre colonne d'une équipe existante touchée.
--  · 14 écoles : on recopie name / division / gender de LEUR Juvénile football 2025-2026 (équipe source nommée par id,
--    et dont le contenu est vérifié contre le relevé prod du 2026-10-15).
--  · École Mitchell - Montcalm : aucune Juvénile football en base, toutes saisons → « Juvénile Masculin », division NULL.
-- league NULL et rseq_team_id NULL, comme les équipes RSEQ 2026-2027 déjà en base ; zone = '' (défaut).
-- Le seul trigger de teams (teams_resync_athlete_sport_id_trg) est AFTER UPDATE OF sport_id : inerte à l'INSERT.
-- Rollback : docs/import-laureats/prod/rollback-equipes-juvenile-2627.sql (supprime exactement ces 15 id).

create temp table _eq_plan (
  nouvel_id uuid primary key, school_id uuid not null, ecole text not null,
  source_id uuid, nom text not null, division text, genre text not null
);

insert into _eq_plan values
 ('b23b46e1-3bbb-4488-8b86-f3c91f8cba83','84cc3b3b-8582-48e8-9eb0-a7c917bf058f','Académie les Estacades','c1273ae7-0935-4e36-9dce-07c62ba7e22b','Académie les Estacades','D2','Masculin'),
 ('9a7ee739-4c66-40c4-a86b-eff77a4ca16d','2c79f18c-9e49-411e-ace9-7bb54dc68438','Académie Saint-Louis','daa3e61a-a9fc-4454-8978-f531a1d78374','Académie Saint-Louis','D1','Masculin'),
 ('a5faab0b-7c8a-415b-a5da-48f92ce99f83','a2350c7e-b58f-48eb-841b-8d2249b50c05','Collège Bourget','3c03d322-adaa-4172-9cd8-af86220c81e1','Collège Bourget','D1','Masculin'),
 ('66f527f9-dff7-400a-8e9a-2ed0eb845fc5','7a577203-fe75-4f57-b569-ec9c05be9ffd','Collège Charles-Lemoyne','aa7db663-f1b6-4ef5-82f5-61448b962ace','Collège Charles-Lemoyne','D1','Masculin'),
 ('f7fe9a38-7192-4081-8744-fbfb238aadff','3f45cb94-5625-4d9a-91db-06bc5d2aa574','Collège de Lévis','1e6feaf0-112f-41aa-b941-25ab5003f6f6','Collège de Lévis','D2','Masculin'),
 ('5dac9a66-e503-4fe2-95f5-80ee5b027664','ea11a9e0-aad9-4294-8ac2-2a6302317e0c','Collège Jean-Eudes','928d1cbf-667e-4a8e-94ce-eea9502af1dc','Collège Jean-Eudes','D2','Masculin'),
 ('d40ffddf-1019-4389-a278-d2ca32dee0b1','f7a54b0e-698f-4bc2-9bba-5ee28c91ede6','Collège Notre-Dame','9ad20107-21ce-4f67-8301-f1e457ff45cd','Collège Notre-Dame','D1','Masculin'),
 ('a03beb90-ca2d-4fdc-b6b9-d0c46980591d','24ee7ebf-fede-47dd-b666-bd1530b303ad','Collège St-Jean-Vianney','9f461dbe-32e4-48c0-af56-0e008f3a0476','Collège St-Jean-Vianney','D2','Masculin'),
 ('2cbb4aa6-8a8d-4c98-bfa0-97c9653992fa','3ba46ee6-bec7-43b4-becd-dde3d36306dc','École Curé-Antoine-Labelle','4d556883-959a-4d56-8f0d-123879ea2c6a','É. sec. Curé-Antoine-Labelle','D1','Masculin'),
 ('3a68b77a-44fd-492a-98cc-b4595bebaa8d','7d59545c-415c-48d1-8a1e-3e02554247f0','École du Triolet','7fccb403-c667-49a1-9a08-1bf9452db3f2','É. sec. du Triolet','D2','Masculin'),
 ('aea474f6-d5a5-4239-a495-093ed43921bb','73c7943f-d396-4c37-b2b7-070fab6bcb8e','École secondaire Roger-Comtois','e3a385ea-ad37-4c76-aa87-605442583f57','É. sec. Roger-Comtois','D2','Masculin'),
 ('81279b35-f4e1-4a1c-b684-db616664f724','103914fd-0126-4927-99de-f029cafe2d43','Polyvalente Deux-Montagnes','f6caa2ed-764a-4694-9d6e-9914fae8ad25','Poly. Deux-Montagnes','D2','Masculin'),
 ('ffcad021-cb9b-4286-bdfb-7528494040e0','4f0e52ad-e9c7-4797-9b7b-92b25ed1307b','Saint-Jean-Eudes','71b06238-1459-4af5-95cd-329accbaf14a','Saint-Jean-Eudes','D1','Masculin'),
 ('12e706b6-febd-47cb-81b6-f18ffebfda89','aad2a33e-ece0-4db1-9c96-66a5918f6679','Séminaire Saint-François','e42d6352-63fb-4365-992e-d182a56a89ad','Séminaire Saint-François','D1','Masculin'),
 ('525725a2-d9bc-44b9-8978-e108918676ee','5c7076bb-1b2c-4376-90ed-f1a323a5e6f4','École Mitchell - Montcalm',null,'É.S. Mitchell',null,'Masculin');

-- 1. Relevé avant (dans la transaction)
create temp table _eq_releve as
select txid_current() as txid,
       (select count(*) from public.teams) as teams,
       (select count(*) from public.schools) as schools,
       (select count(*) from public.admin_operations where operation = 'CREATION_EQUIPES_JUVENILE_FB_2627') as op_deja,
       (select id from public.sports where nom = 'Football') as football,
       (select id from public.users where email = 'bptds22@gmail.com') as par;

-- 2. Gardes AVANT toute écriture
do $g$
declare n int;
begin
  if (select txid from _eq_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select op_deja from _eq_releve) <> 0 then
    raise exception 'NEXUS LOT: lot déjà appliqué (admin_operations) — rien n''est fait';
  end if;
  if (select football from _eq_releve) is null or (select par from _eq_releve) is null then
    raise exception 'NEXUS LOT: sport Football ou compte admin introuvable';
  end if;
  if (select count(*) from _eq_plan) <> 15 then
    raise exception 'NEXUS LOT: le plan ne compte pas 15 équipes';
  end if;
  -- Les 15 écoles existent, sous le nom relevé, au secondaire.
  select count(*) into n from _eq_plan p join public.schools s on s.id = p.school_id and s.name = p.ecole and s.type = 'SECONDAIRE';
  if n <> 15 then raise exception 'NEXUS LOT: % école(s) sur 15 seulement correspondent au relevé', n; end if;
  -- Les 14 équipes sources sont bien la Juvénile football 2025-2026 de leur école, avec le contenu relevé.
  select count(*) into n from _eq_plan p join public.teams t on t.id = p.source_id
   where t.school_id = p.school_id and t.sport_id = (select football from _eq_releve)
     and t.age_group = 'Juvénile' and t.season = '2025-2026'
     and t.name = p.nom and t.division is not distinct from p.division and t.gender = p.genre;
  if n <> 14 then raise exception 'NEXUS LOT: % équipe(s) source sur 14 seulement correspondent au relevé', n; end if;
  -- Mitchell : aucune Juvénile football, toutes saisons.
  if exists (select 1 from public.teams where school_id = '5c7076bb-1b2c-4376-90ed-f1a323a5e6f4'
              and sport_id = (select football from _eq_releve) and age_group = 'Juvénile') then
    raise exception 'NEXUS LOT: une Juvénile football existe déjà pour Mitchell-Montcalm';
  end if;
  -- Dédoublonnage : aucune Juvénile football 2026-2027 pour ces écoles (tous genres confondus — plus strict que
  -- la règle école+sport+catégorie+genre+saison).
  select count(*) into n from public.teams t join _eq_plan p on p.school_id = t.school_id
   where t.sport_id = (select football from _eq_releve) and t.age_group = 'Juvénile' and t.season = '2026-2027';
  if n <> 0 then raise exception 'NEXUS LOT: % Juvénile football 2026-2027 existe(nt) déjà pour ces écoles', n; end if;
  if exists (select 1 from public.teams t join _eq_plan p on p.nouvel_id = t.id) then
    raise exception 'NEXUS LOT: un des id prévus existe déjà';
  end if;
end $g$;

-- 3. Insertions
insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender, rseq_team_id, zone)
select p.nouvel_id, p.school_id, (select football from _eq_releve), p.nom, p.division, null, '2026-2027', true, 'Juvénile', p.genre, null, ''
  from _eq_plan p;

insert into public.admin_operations (operation, motif, details, par)
select 'CREATION_EQUIPES_JUVENILE_FB_2627',
       'Juvénile football 2026-2027 pour 15 écoles de la liste des Lauréats (option B) — GO BP 2026-10-15',
       jsonb_build_object(
         'team_ids', (select jsonb_agg(nouvel_id order by ecole) from _eq_plan),
         'equipes', (select jsonb_agg(jsonb_build_object('id', nouvel_id, 'ecole', ecole, 'nom', nom, 'division', division,
                                                         'genre', genre, 'source', source_id) order by ecole) from _eq_plan),
         'saison', '2026-2027',
         'rollback', 'docs/import-laureats/prod/rollback-equipes-juvenile-2627.sql'),
       (select par from _eq_releve);

-- 4. Gardes finales
do $f$
declare n int;
begin
  if (select txid from _eq_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select count(*) from public.teams) <> (select teams from _eq_releve) + 15 then
    raise exception 'NEXUS LOT: teams n''a pas grandi d''exactement 15 — tout est annulé';
  end if;
  if (select count(*) from public.schools) <> (select schools from _eq_releve) then
    raise exception 'NEXUS LOT: schools a changé — tout est annulé';
  end if;
  select count(*) into n from public.teams t join _eq_plan p on p.nouvel_id = t.id
   where t.school_id = p.school_id and t.sport_id = (select football from _eq_releve) and t.season = '2026-2027'
     and t.age_group = 'Juvénile' and t.name = p.nom and t.division is not distinct from p.division and t.gender = p.genre
     and t.league is null and t.rseq_team_id is null and t.is_active;
  if n <> 15 then raise exception 'NEXUS LOT: % équipe(s) conforme(s) sur 15 — tout est annulé', n; end if;
  if (select count(*) from public.admin_operations where operation = 'CREATION_EQUIPES_JUVENILE_FB_2627') <> 1 then
    raise exception 'NEXUS LOT: ligne admin_operations absente ou en double — tout est annulé';
  end if;
end $f$;

-- 5. Résultat
select json_build_object(
  'avant', (select json_build_object('teams', teams, 'schools', schools) from _eq_releve),
  'apres', json_build_object('teams', (select count(*) from public.teams), 'schools', (select count(*) from public.schools)),
  'equipes', (select json_agg(json_build_object('id', t.id, 'ecole', s.name, 'nom', t.name, 'division', t.division,
                                                'genre', t.gender, 'categorie', t.age_group, 'saison', t.season) order by s.name)
                from public.teams t join public.schools s on s.id = t.school_id join _eq_plan p on p.nouvel_id = t.id),
  'admin_operation', (select id from public.admin_operations where operation = 'CREATION_EQUIPES_JUVENILE_FB_2627'),
  'meme_transaction', (select txid from _eq_releve) = txid_current()
) as resultat_lot_equipes;
