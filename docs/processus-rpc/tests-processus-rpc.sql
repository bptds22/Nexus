-- BANC — migration 20261016060000_processus_cartes_rpc (Mon processus : cartes et dernières notes par fonctions).
-- Transaction ANNULÉE à la fin : données fictives seulement. Base locale migrée.
--   docker exec -i supabase_db_Nexus psql -U postgres -X -q -At < docs/processus-rpc/tests-processus-rpc.sql
-- Principe : pour CHAQUE compte local (recruteurs Pro, admins cégep, gratuit, sans cégep, coachs, athlètes…) et
-- plusieurs filtres, la fonction rend EXACTEMENT ce que la RLS rend par une lecture directe (même ensemble de
-- cartes, même dernière note) — l'accès reproduit par les fonctions DEFINER est celui des policies. Plus : volume
-- au-delà de 1000 (ni plafond ni troncature), carte fusionnée exclue, droits (anon refusé), export complet.
begin;

create temp table _t (n serial, nom text, ok boolean, detail text);

-- ── Données fictives ─────────────────────────────────────────────────────────
-- Unité A = Cégep Preuve Lot1 × football (r1 admin, r3 Pro) ; unité B = même cégep × basketball (r5 Pro).
set local session_replication_role = replica;
insert into public.cartes_prospect (id, unite_cegep_id, unite_sport_id, prenom, nom, etape, sport_athlete_id, cree_par, etape_le, derniere_activite)
select gen_random_uuid(), '11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af',
       'Banc' || g, 'ZZBANC', 'IDENTIFIE', '4b859bf1-5832-4258-897c-e094062926af', '22222222-0000-0000-0000-00000000003a',
       now() - (g || ' minutes')::interval, now()
  from generate_series(1, 1500) g;
insert into public.cartes_prospect (unite_cegep_id, unite_sport_id, prenom, nom, etape, sport_athlete_id, cree_par)
select '11111111-0000-0000-0000-000000000001', '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492', 'BancB' || g, 'ZZBANC', 'IDENTIFIE',
       '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492', '22222222-0000-0000-0000-00000000005a'
  from generate_series(1, 20) g;
-- Une carte FUSIONNÉE dans l'unité A, avec une note : ni la carte ni sa note ne doivent sortir.
insert into public.cartes_prospect (unite_cegep_id, unite_sport_id, prenom, nom, etape, sport_athlete_id, fusionnee_le)
values ('11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', 'Fusionnee', 'ZZBANCFUS', 'IDENTIFIE',
        '4b859bf1-5832-4258-897c-e094062926af', now());
insert into public.cartes_prospect_notes (carte_id, auteur, contenu, created_at)
select id, '22222222-0000-0000-0000-00000000003a', 'note de la fusionnée', now() from public.cartes_prospect where nom = 'ZZBANCFUS';
-- 1600 notes sur les cartes de A (dont 2 notes sur les 100 premières : la plus récente doit gagner).
insert into public.cartes_prospect_notes (carte_id, auteur, contenu, created_at)
select c.id, '22222222-0000-0000-0000-00000000003a', 'ancienne ' || c.rn, now() - interval '2 days'
  from (select id, row_number() over (order by id) rn from public.cartes_prospect where nom = 'ZZBANC'
          and unite_sport_id = '4b859bf1-5832-4258-897c-e094062926af') c where c.rn <= 100;
insert into public.cartes_prospect_notes (carte_id, auteur, contenu, created_at)
select c.id, '22222222-0000-0000-0000-00000000000a', 'recente ' || c.rn, now() - interval '1 hour'
  from (select id, row_number() over (order by id) rn from public.cartes_prospect where nom = 'ZZBANC'
          and unite_sport_id = '4b859bf1-5832-4258-897c-e094062926af') c;
-- Notes de dossiers (unité A) : deux sur un même athlète, la plus récente doit gagner.
insert into public.recruiter_notes (recruiter_id, athlete_id, content, created_at, unite_cegep_id, unite_sport_id)
select '22222222-0000-0000-0000-00000000003a', p.athlete_id, v.contenu, now() - v.age, '11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af'
  from (select athlete_id from public.recruiter_pipeline where unite_cegep_id = '11111111-0000-0000-0000-000000000001'
          and unite_sport_id = '4b859bf1-5832-4258-897c-e094062926af' order by athlete_id limit 1) p,
       (values ('dossier ancienne', interval '3 days'), ('dossier recente', interval '5 minutes')) v(contenu, age);
set local session_replication_role = origin;

-- ── 1. Équivalence fonction ⇔ RLS, pour chaque compte et chaque filtre ───────
do $$
declare
  u record; p record;
  f_ids text; r_ids text; f_n int; r_n int; f_notes text; r_notes text; f_dos text; r_dos text;
  ecarts int := 0; cas int := 0; vus_non_vides int := 0; exemple text;
begin
  for u in select id, school_id, sport_id, role::text as role from public.users order by id loop
    for p in select * from (values
               (u.school_id, null::uuid, false), (u.school_id, u.sport_id, false), (u.school_id, null::uuid, true),
               (null::uuid, null::uuid, false), ('11111111-0000-0000-0000-000000000001'::uuid, '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492'::uuid, false)
             ) as x(cegep, sport, tout) loop
      perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select md5(coalesce(string_agg(e->>'id', ',' order by e->>'id'), '')), count(*) into f_ids, f_n
        from jsonb_array_elements(public.processus_cartes(p.cegep, p.sport, p.tout)) e;
      select md5(coalesce(string_agg(c.id::text, ',' order by c.id::text), '')), count(*) into r_ids, r_n
        from public.cartes_prospect c
       where (p.cegep is null or c.unite_cegep_id = p.cegep) and (p.tout or p.sport is null or c.unite_sport_id = p.sport);
      select md5(coalesce(string_agg(k || '=' || (v->>'created_at') || (v->>'content'), ',' order by k), ''))
        into f_notes from jsonb_each(public.processus_dernieres_notes(p.cegep, p.sport, p.tout)->'cartes') as j(k, v);
      select md5(coalesce(string_agg(d.carte_id::text || '=' || (to_jsonb(d.created_at)#>>'{}') || d.contenu, ',' order by d.carte_id::text), ''))
        into r_notes
        from (select distinct on (n.carte_id) n.carte_id, n.created_at, n.contenu
                from public.cartes_prospect_notes n join public.cartes_prospect c on c.id = n.carte_id
               where (p.cegep is null or c.unite_cegep_id = p.cegep) and (p.tout or p.sport is null or c.unite_sport_id = p.sport)
               order by n.carte_id, n.created_at desc, n.id desc) d;
      select md5(coalesce(string_agg(k || '=' || (v->>'content'), ',' order by k), ''))
        into f_dos from jsonb_each(public.processus_dernieres_notes(p.cegep, p.sport, p.tout)->'dossiers') as j(k, v);
      select md5(coalesce(string_agg(d.athlete_id::text || '=' || d.content, ',' order by d.athlete_id::text), ''))
        into r_dos
        from (select distinct on (r.athlete_id) r.athlete_id, r.content from public.recruiter_notes r
               where r.athlete_id in (select a.athlete_id from public.unite_pipeline(p.sport, p.tout) a)
               order by r.athlete_id, r.created_at desc nulls last, r.id desc) d;
      perform set_config('role', 'none', true);
      cas := cas + 1;
      if f_n > 0 then vus_non_vides := vus_non_vides + 1; end if;
      if f_ids <> r_ids or f_n <> r_n or f_notes <> r_notes or f_dos <> r_dos then
        ecarts := ecarts + 1;
        exemple := coalesce(exemple, u.role || ' ' || u.id || ' cartes ' || f_n || '/' || r_n || ' notes ' || (f_notes = r_notes) || ' dossiers ' || (f_dos = r_dos));
      end if;
    end loop;
  end loop;
  insert into _t (nom, ok, detail) values
    ('équivalence fonction = RLS, tous comptes × 5 filtres', ecarts = 0, cas || ' cas, ' || ecarts || ' écarts ' || coalesce(exemple, '')),
    ('des cas non vides ont bien été comparés', vus_non_vides >= 10, vus_non_vides || ' cas avec cartes');
end $$;

-- ── 2. Cas précis (r3, Pro de l'unité A ; r5 Pro de B ; r4 autre cégep ; r6 gratuit) ──
do $$
declare
  v jsonb; n int; notes jsonb;
begin
  -- r3 : unité A, plus de 1000 cartes, aucune troncature, pas la fusionnée.
  perform set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000003a","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  v := public.processus_cartes('11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', false);
  notes := public.processus_dernieres_notes('11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', false);
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values
    ('r3 : plus de 1000 cartes, une seule valeur', jsonb_array_length(v) >= 1501, jsonb_array_length(v)::text),
    ('r3 : la carte fusionnée n''apparaît pas', not exists (select 1 from jsonb_array_elements(v) e where e->>'nom' = 'ZZBANCFUS'), ''),
    ('r3 : aucune carte d''une autre unité', not exists (select 1 from jsonb_array_elements(v) e
        where e->>'unite_sport_id' <> '4b859bf1-5832-4258-897c-e094062926af'), ''),
    ('r3 : tri etape_le décroissant', (select bool_and(a >= b) from (select (e->>'etape_le')::timestamptz a,
        lead((e->>'etape_le')::timestamptz) over (order by o) b from jsonb_array_elements(v) with ordinality t(e, o)) s where b is not null), ''),
    ('r3 : format imbriqué (teams, etablissement, positions présents)', (v->0) ?& array['teams', 'etablissement', 'positions', 'telephone', 'sport_athlete_id'], ''),
    ('r3 : 1500 dernières notes de cartes (plus de 1000)', (select count(*) from jsonb_object_keys(notes->'cartes')) >= 1500,
        (select count(*) from jsonb_object_keys(notes->'cartes'))::text),
    ('r3 : la plus récente gagne', not exists (select 1 from jsonb_each(notes->'cartes') j(k, x) where x->>'content' like 'ancienne%'), ''),
    ('r3 : note de la fusionnée absente', not exists (select 1 from jsonb_each(notes->'cartes') j(k, x) where x->>'content' = 'note de la fusionnée'), ''),
    ('r3 : dernière note de dossier = la plus récente', exists (select 1 from jsonb_each(notes->'dossiers') j(k, x) where x->>'content' = 'dossier recente')
        and not exists (select 1 from jsonb_each(notes->'dossiers') j(k, x) where x->>'content' = 'dossier ancienne'), '');

  -- r3 sur l'unité B (autre sport, non admin) : rien.
  perform set_config('role', 'authenticated', true);
  n := jsonb_array_length(public.processus_cartes('11111111-0000-0000-0000-000000000001', '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492', false));
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values ('r3 (non admin) ne lit pas l''unité B', n = 0, n::text);

  -- r1 admin du cégep : tout le cégep = A + B.
  perform set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  n := jsonb_array_length(public.processus_cartes('11111111-0000-0000-0000-000000000001', null, true));
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values ('r1 (admin) : tout le cégep = A + B', n >= 1521, n::text);

  -- r4 autre cégep, r6 gratuit : rien de l'unité A.
  perform set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000004a","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  n := jsonb_array_length(public.processus_cartes('11111111-0000-0000-0000-000000000001', null, true));
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values ('r4 (autre cégep) : aucune carte de A', n = 0, n::text);
  perform set_config('request.jwt.claims', '{"sub":"a6000000-0000-0000-0000-0000000000b6","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  n := jsonb_array_length(public.processus_cartes('11111111-0000-0000-0000-000000000001', '4b859bf1-5832-4258-897c-e094062926af', false));
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values ('r6 (gratuit) : aucune carte', n = 0, n::text);

  -- Sans identité (auth.uid() nul) : rien.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  n := jsonb_array_length(public.processus_cartes(null, null, true));
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values ('sans identité : aucune carte', n = 0, n::text);
end $$;

-- ── 3. Export : toutes les notes demandées, sous la RLS de l'appelant ────────
do $$
declare
  ids uuid[]; v jsonb; attendu int; v4 jsonb;
begin
  select array_agg(id) into ids from public.cartes_prospect where nom = 'ZZBANC' and unite_sport_id = '4b859bf1-5832-4258-897c-e094062926af';
  select count(*) into attendu from public.cartes_prospect_notes where carte_id = any(ids);
  perform set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000003a","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  v := public.processus_notes_export(array[]::uuid[], ids);
  perform set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000004a","role":"authenticated"}', true);
  v4 := public.processus_notes_export(array[]::uuid[], ids);
  perform set_config('role', 'none', true);
  insert into _t (nom, ok, detail) values
    ('export r3 : les 1600 notes (plus de 1000), aucune perdue', jsonb_array_length(v->'cartes') = attendu and attendu = 1600, jsonb_array_length(v->'cartes') || '/' || attendu),
    ('export : du plus ancien au plus récent', (select bool_and(a <= b) from (select (e->>'created_at')::timestamptz a,
        lead((e->>'created_at')::timestamptz) over (order by o) b from jsonb_array_elements(v->'cartes') with ordinality t(e, o)) s where b is not null), ''),
    ('export r4 (autre cégep) : aucune note', jsonb_array_length(v4->'cartes') = 0, jsonb_array_length(v4->'cartes')::text),
    ('export : tableaux vides ou nuls → listes vides', public.processus_notes_export(null, null) = '{"cartes": [], "dossiers": []}'::jsonb, '');
end $$;

-- ── 4. Droits ────────────────────────────────────────────────────────────────
insert into _t (nom, ok, detail)
select 'anon ne peut exécuter ' || f, not has_function_privilege('anon', f, 'execute'), ''
  from unnest(array['public.processus_cartes(uuid, uuid, boolean)', 'public.processus_dernieres_notes_cartes(uuid, uuid, boolean)',
                    'public.processus_dernieres_notes(uuid, uuid, boolean)', 'public.processus_notes_export(uuid[], uuid[])']) f
union all
select 'authenticated peut exécuter ' || f, has_function_privilege('authenticated', f, 'execute'), ''
  from unnest(array['public.processus_cartes(uuid, uuid, boolean)', 'public.processus_dernieres_notes(uuid, uuid, boolean)',
                    'public.processus_notes_export(uuid[], uuid[])']) f;

select n || '|' || case when ok then 'OK' else 'ÉCHEC' end || '|' || nom || case when detail <> '' then ' — ' || detail else '' end from _t order by n;
select count(*) filter (where ok) || '|' || count(*) filter (where not ok) from _t;
rollback;
