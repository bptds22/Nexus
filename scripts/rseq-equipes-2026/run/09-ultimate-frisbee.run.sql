begin;
-- Lot 09 — Ultimate frisbee : 7 équipe(s) RSEQ 2026 (secondaire), 60 côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».
-- Transaction gardée : exactement 7 équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := 7;
  cotes_releves constant int := 60;  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
    ('43f5bb6f-eacd-4eae-841d-cf66afe5b97f'::uuid, '18df8b81-eb33-454e-9de8-87636cd4896f'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'Bishop''s College School', 'Juvénile', 'D4', 'Mixte'),
    ('4c31c836-460c-4d95-978e-7cab43ae34fa'::uuid, '5051a5f3-1529-40ea-8a9a-403f670e42a1'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'Salésien', 'Juvénile', 'D3', 'Mixte'),
    ('944c79f8-27bc-4c1a-be1b-d167554f88f8'::uuid, '3b518908-dab6-4bf4-a0b5-4c05d62b86c3'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'Stanstead College', 'Juvénile', 'D4', 'Mixte'),
    ('b24069cd-e8df-497c-bd63-f8c544421a87'::uuid, '18df8b81-eb33-454e-9de8-87636cd4896f'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'Bishop''s College School', 'Juvénile', 'D4', 'Mixte'),
    ('d9af89c8-f758-4c72-840b-590b13770c6a'::uuid, 'bb8fc4fc-0a43-4fc2-b606-bd3e6d389c44'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'É.S. Bromptonville', 'Juvénile', 'D3', 'Mixte'),
    ('dcaf3e35-713e-4b00-abd5-b50bc371c336'::uuid, '5051a5f3-1529-40ea-8a9a-403f670e42a1'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'Bishop''s College School', 'Juvénile', 'D4', 'Mixte'),
    ('eb5300a0-a2ad-4fb6-8d8c-d23a3ac96d83'::uuid, '7d59545c-415c-48d1-8a1e-3e02554247f0'::uuid, '0f3d4984-605a-4af1-86a9-432499ab8fd9'::uuid, 'É.S. du Triolet', 'Juvénile', 'D3', 'Mixte');

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
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot 09 Ultimate frisbee (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '09-ultimate-frisbee', 'sport', 'Ultimate frisbee', 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot 09 Ultimate frisbee : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;

-- CONTRÔLE DE SIGNATURE (ajouté autour du lot, même transaction) : les équipes créées par ce lot doivent
-- reproduire exactement le contenu du fichier 09-ultimate-frisbee.sql (md5 du fichier f51da263ee696698cc9e6e701674dd7f).
do $ctl$
declare n int; s text;
begin
  select count(*), md5(string_agg(t.rseq_team_id || '|' || t.school_id || '|' || t.sport_id || '|' || t.name || '|'
           || coalesce(t.age_group, '') || '|' || coalesce(t.division, '') || '|' || coalesce(t.gender, ''), ';' order by t.rseq_team_id))
    into n, s
    from public.teams t
    join (select distinct (jsonb_array_elements_text(details -> 'rseq_team_ids'))::uuid r
            from public.admin_operations
           where operation = 'EQUIPES_RSEQ_2026_CREEES' and details ->> 'lot' = '09-ultimate-frisbee') a on a.r = t.rseq_team_id
   where t.season = '2026-2027';
  if n <> 7 or s is distinct from 'c4ddd0ffbceedb2bc7a1414742e36dcd' then
    raise exception 'NEXUS: signature de contenu du lot 09-ultimate-frisbee : % équipe(s), signature %, attendu 7 / c4ddd0ffbceedb2bc7a1414742e36dcd — transaction annulée', n, s;
  end if;
end $ctl$;
commit;
