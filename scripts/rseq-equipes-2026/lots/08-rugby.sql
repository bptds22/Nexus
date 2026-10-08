-- Lot 08 — Rugby : 6 équipe(s) RSEQ 2026 (secondaire), 48 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- Transaction gardée : exactement 6 équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := 6;
  cotes_releves constant int := 48;  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
    ('0692d466-62e8-45e7-a9ae-b55b977fb871'::uuid, '88113563-8a1f-4ca3-b4ef-68a102cf1494'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'Chateauguay Valley', 'Cadet', 'D4', 'Féminin'),
    ('23c7f41d-99e8-4cb0-bb16-86c8be93175b'::uuid, '88113563-8a1f-4ca3-b4ef-68a102cf1494'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'Chateauguay Valley', 'Juvénile', 'D4', 'Féminin'),
    ('2d8e0275-6e31-4598-b7bd-66eae3f14fc4'::uuid, '9ba37454-7ef4-4576-98db-099cba1a2a9b'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'Pontiac 2', 'Juvénile', 'D3', 'Féminin'),
    ('46e6c761-e8e2-49bc-bfce-5846146816d8'::uuid, '76564f55-9eda-46c1-9c51-5e6e0ed89a4d'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'St-Michael''s', 'Juvénile', 'D3', 'Féminin'),
    ('9aab2b1e-0e61-4e24-a60a-7c312ca02f1f'::uuid, '88113563-8a1f-4ca3-b4ef-68a102cf1494'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'Chateauguay Valley 2', 'Cadet', 'D4', 'Féminin'),
    ('dbb3971e-fd75-4ab0-a439-7f2fb0f6d3d6'::uuid, '12e2819f-0f85-4af0-875a-990ce00b4735'::uuid, '8480c09c-1d30-46eb-a819-67ded94c8390'::uuid, 'Saint-Joseph', 'Juvénile', 'D4', 'Féminin');

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
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot 08 Rugby (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '08-rugby', 'sport', 'Rugby', 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot 08 Rugby : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;
