begin;
-- Lot 07 — Baseball : 15 équipe(s) RSEQ 2026 (secondaire), 90 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- Transaction gardée : exactement 15 équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := 15;
  cotes_releves constant int := 90;  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
    ('047af42f-bfe6-4ff5-b558-5a6f034665fe'::uuid, '8866285d-392b-4c8d-ac36-c11fd4d6b905'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Philemon Wright', 'Juvénile', 'D3', 'Mixte'),
    ('04c3296e-6b67-4a8a-8bf4-db76fe7b8080'::uuid, '4ff23758-f846-4e3a-b99e-fc1809ab7875'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Nouvelles Frontières', 'Benjamin', 'D3', 'Mixte'),
    ('16f75bb9-5fdd-4ba1-b24e-a312cfb691a2'::uuid, 'a5829a18-e8b1-4d8d-8aec-09c7e26798e7'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Pontiac D4', 'Benjamin', 'D3', 'Mixte'),
    ('1e845758-236e-4669-be4f-ba9a61b915d1'::uuid, '9ba37454-7ef4-4576-98db-099cba1a2a9b'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Grande-Rivière', 'Benjamin', 'D3', 'Mixte'),
    ('2c695741-f28d-4a80-b03d-3313d6c88a9e'::uuid, '9ba37454-7ef4-4576-98db-099cba1a2a9b'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Pontiac D4', 'Juvénile', 'D3', 'Mixte'),
    ('5a3a2797-dd01-4c22-a838-ab361571aced'::uuid, 'cd897593-d53a-4394-9f76-11f8ad7b929b'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Nouvelles Frontières', 'Benjamin', 'D3', 'Mixte'),
    ('64c5e9bd-9789-4441-a7c8-c1e880cb21ea'::uuid, 'b13c9087-012c-41a1-b6bc-f00294d48302'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'É.S. Nouvelle-Ère D4', 'Benjamin', 'D3', 'Mixte'),
    ('8281ef6b-29a5-474c-b5e7-6a70b1c8e768'::uuid, '76564f55-9eda-46c1-9c51-5e6e0ed89a4d'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'St-Michael''s D4', 'Benjamin', 'D3', 'Mixte'),
    ('8d88b52c-3f0c-4ca3-ad17-6b86b3e49836'::uuid, '340e1305-f065-49a5-8675-a700df1ceff3'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Nouvelles Frontières', 'Benjamin', 'D3', 'Mixte'),
    ('ce59066f-0de3-4e57-a0ec-aa755a4c1556'::uuid, '340e1305-f065-49a5-8675-a700df1ceff3'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'D''Arcy McGee', 'Juvénile', 'D3', 'Mixte'),
    ('cee2a792-a44b-43d5-9afa-e5ba2fc63417'::uuid, '4ff23758-f846-4e3a-b99e-fc1809ab7875'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'D''Arcy McGee D4', 'Benjamin', 'D3', 'Mixte'),
    ('dda1449e-b482-4b31-9cb7-bc64ca613f18'::uuid, 'a5829a18-e8b1-4d8d-8aec-09c7e26798e7'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'St-Michael''s D4', 'Juvénile', 'D3', 'Mixte'),
    ('e51220b4-3b46-4a82-83c8-db4a228a5d55'::uuid, '313b8c82-8c87-4757-a997-bd94039de104'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'É.S. Nouvelle-Ère D4', 'Benjamin', 'D3', 'Mixte'),
    ('edfb006f-90df-41b1-a056-44ff75d9ac56'::uuid, '76564f55-9eda-46c1-9c51-5e6e0ed89a4d'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'Grande-Rivière', 'Juvénile', 'D3', 'Mixte'),
    ('fb4ecfd4-2718-4960-9ab8-f59282221048'::uuid, '4ff23758-f846-4e3a-b99e-fc1809ab7875'::uuid, '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b'::uuid, 'St-Michael''s D4', 'Juvénile', 'D3', 'Mixte');

  -- Gardes (dédoublonnage du Pont RSEQ)
  if (select count(*) from _lot) <> n_attendu then
    raise exception 'NEXUS: lot de % ligne(s), attendu %', (select count(*) from _lot), n_attendu; end if;
  if exists (select 1 from public.teams t join _lot l using (rseq_team_id)) then
    raise exception 'NEXUS: % rseq_team_id du lot déjà en base — régénérer',
      (select count(*) from public.teams t join _lot l using (rseq_team_id)); end if;
  if exists (select 1 from _lot l left join public.schools s on s.id = l.school_id
              where s.id is null or s.type <> 'SECONDAIRE') then
    raise exception 'NEXUS: école absente ou non SECONDAIRE dans le lot'; end if;
  if exists (select 1 from _lot l join public.teams t
               on t.school_id = l.school_id and t.sport_id = l.sport_id and t.season = '2026-2027'
              and coalesce(t.age_group, '') = coalesce(l.age_group, '')
              and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd') = regexp_replace(lower(coalesce(l.division, '')), '^division\s*', 'd')
             where l.rseq_team_id <> all (array[]::uuid[])) then
    raise exception 'NEXUS: doublon école + sport + catégorie + division + saison non tranché par BP'; end if;

  select count(*) into n_h0 from public.games g join _lot l on l.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null;
  select count(*) into n_v0 from public.games g join _lot l on l.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null;
  if n_h0 + n_v0 <> cotes_releves then
    raise exception 'NEXUS: % côté(s) de match à relier aujourd''hui, % au relevé — la veille a bougé, régénérer',
      n_h0 + n_v0, cotes_releves; end if;
  select count(*) into n_ops0 from public.admin_operations;
  select count(*) into n_teams0 from public.teams;

  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, rseq_team_id)
  select school_id, sport_id, name, age_group, division, gender, '2026-2027', rseq_team_id from _lot;
  get diagnostics n_ins = row_count;

  update public.games g set home_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics n_v = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_2026_CREEES',
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot 07 Baseball (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '07-baseball', 'sport', 'Baseball', 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot 07 Baseball : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;

-- CONTRÔLE DE SIGNATURE (ajouté autour du lot, même transaction) : les équipes créées par ce lot doivent
-- reproduire exactement le contenu du fichier 07-baseball.sql (md5 du fichier abc4cafdc70cad66248498dfe1c6731c).
do $ctl$
declare n int; s text;
begin
  select count(*), md5(string_agg(t.rseq_team_id || '|' || t.school_id || '|' || t.sport_id || '|' || t.name || '|'
           || coalesce(t.age_group, '') || '|' || coalesce(t.division, '') || '|' || coalesce(t.gender, ''), ';' order by t.rseq_team_id))
    into n, s
    from public.teams t
    join (select distinct (jsonb_array_elements_text(details -> 'rseq_team_ids'))::uuid r
            from public.admin_operations
           where operation = 'EQUIPES_RSEQ_2026_CREEES' and details ->> 'lot' = '07-baseball') a on a.r = t.rseq_team_id
   where t.season = '2026-2027';
  if n <> 15 or s is distinct from '1b55df09e63c2fe3e6c35c3b133e7b17' then
    raise exception 'NEXUS: signature de contenu du lot 07-baseball : % équipe(s), signature %, attendu 15 / 1b55df09e63c2fe3e6c35c3b133e7b17 — transaction annulée', n, s;
  end if;
end $ctl$;
commit;
