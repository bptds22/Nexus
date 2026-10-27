-- ════════════════════════════════════════════════════════════════════════════
-- Lot A cégep — APPLY RÉEL EN PROD, version @@VERSION@@ (GO BP 2026-10-25).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-a-rejeu-blanc.sh <date> apply : la migration y est
-- embarquée telle quelle (même texte que celui du rejeu à blanc du 2026-10-25, md5 gardé).
--
-- UNE transaction : gardes avant → migration → gardes après (md5, policies, preuve sous vrai
-- JWT) → inscription (schema_migrations + admin_operations) → COMMIT. Toute garde qui échoue
-- (RAISE « NEXUS: ») ou toute erreur arrête psql (ON_ERROR_STOP) AVANT le COMMIT : rien n'est
-- appliqué. Lancer SANS -1.
-- Rollback : supabase/rollback/@@VERSION@@_rollback_cegep_lot_a_base.sql, par
-- docs/cegep-lot-a/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-apply-lot-a';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
declare r record; n int; v text;
begin

  if to_regprocedure('public.athlete_est_cegepien(uuid)') is not null
     or to_regprocedure('public.peut_voir_cegepiens()') is not null
     or to_regprocedure('public.unite_voit_cegepiens(uuid)') is not null then
    raise exception 'NEXUS: une fonction-règle du lot A existe déjà';
  end if;
  select count(*) into n from pg_policies where policyname = 'cegepiens_masques_recruteurs';
  if n <> 0 then raise exception 'NEXUS: % policy(ies) cegepiens_masques_recruteurs déjà présente(s)', n; end if;

  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%)', v; end if;

  -- Corps prod des 18 fonctions touchées : ceux du rejeu (relevés 2026-10-20 et 2026-10-25).
  for r in select * from (values
    ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '1d04401fe73aed88764c0899a22d76f7'),
    ('public.recruiter_athlete_profile(uuid)', '0b58d368f76a81cd0cb066404e8d77e0'),
    ('public.recruiter_athlete_cards(uuid[])', '18ab33af6d239268c0d80e2f5ccc02c3'),
    ('public.athletes_targeting_my_cegep()', '564a2e940ad9d187b3e0b8f4c16631e0'),
    ('public.matchs_profils_nexus(uuid[])', 'b94ab615cf14a4fa104f28bce1213abf'),
    ('public.depistage_profils_match(uuid)', 'ad18404a95b8ee3713d2d2acef79d7b6'),
    ('public.rapprochement_candidats(uuid,uuid)', '7a71383b81597b9c6b21fe4530670623'),
    ('public.rapprochements_unite(uuid)', 'dd4be21b51d7f25cc7e2305137a73da0'),
    ('public.rapprochements_refuses_unite()', 'a5d84a05834fc1fd293f7ee85c9210dd'),
    ('public.fusionner_carte(uuid,uuid)', '38f4f1a78a4c6635c8f5244df033e5a1'),
    ('public.athletes_nom_proche(text,text,uuid)', '492f6f32bdd04bd5099ab706a3eb55b3'),
    ('public.athlete_nexus_par_courriel(text)', '6f4023f8437a354d3cc64c62a1a7540f'),
    ('public.agenda_flux(text)', '6c1e9e2cb301ba8db313c72a2c68a47d'),
    ('public.matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '9674fbf129c1f0f0b93d05948e2659dd'),
    ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)', 'f6c6f67a42a18711011c377bd93bb19e'),
    ('public.log_new_athlete()', '6fc96267a5d89574a305f3da137e2b24'),
    ('public.log_athlete_update()', 'cda68b5c35a432d7957f4b8fca5c9b2c'),
    ('public.log_coach_reply()', '2fe3a0ef413037a4fc13d993c2a4f601')) t(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) <> r.md5 then
      raise exception 'NEXUS: % a bougé depuis le rejeu (md5 %, attendu %)', r.sig, md5(pg_get_functiondef(r.sig::regprocedure)), r.md5;
    end if;
  end loop;
end $$;

-- Le témoin et un recruteur collégial qui avait une ligne de journal sur lui (relus avant).
select set_config('nexus.temoin', (select (details->>'athlete_id') from public.admin_operations
                                    where operation = 'RATTACHEMENT_CEGEPIEN_TEST_LOT_A' order by le desc limit 1), true) is not null as temoin_trouve;
select set_config('nexus.collegial', (select l.recruiter_id::text from public.recruiter_activity_log l
                                        join public.users u on u.id = l.recruiter_id
                                        join public.schools s on s.id = u.school_id
                                       where l.athlete_id = current_setting('nexus.temoin')::uuid
                                         and u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'CEGEP'
                                       order by l.recruiter_id limit 1), true) is not null as collegial_trouve;
select (select count(*) from public.recruiter_activity_log where athlete_id = current_setting('nexus.temoin')::uuid) as journal_temoin_avant;

-- ── 1. La migration, texte gardé par son md5 ────────────────────────────────
create temp table _lot_a on commit drop as
select '@@VERSION@@'::text as version, $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot_a) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lot_a);
  end if;
  execute (select contenu from _lot_a);
end $apply$;
select clock_timestamp() as fin_migration;

-- ── 2. Gardes APRÈS : les corps attendus (identiques au local et au rejeu prod) ─
do $$
declare r record; n int;
begin
  for r in select * from (values
    ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '0bfe461f7ef3c277796ccadc9dc4f3b4'),
    ('public.recruiter_athlete_profile(uuid)', '90dd1734451b9cd2017193fd9fba56a5'),
    ('public.recruiter_athlete_cards(uuid[])', '83edcd33fd085fb3d3750338665433d2'),
    ('public.athletes_targeting_my_cegep()', 'ddd4f17140902ccbd76318682e74de3a'),
    ('public.matchs_profils_nexus(uuid[])', 'f8404ce1015afe98912a670cf58c433b'),
    ('public.depistage_profils_match(uuid)', '01a05c483eeeb9ef40fa6bcf6ea199a5'),
    ('public.rapprochement_candidats(uuid,uuid)', 'f0f48daf500a3f12ed1aaa489406d227'),
    ('public.rapprochements_unite(uuid)', 'c9a5819e84d9bff5235443eabb60725d'),
    ('public.rapprochements_refuses_unite()', 'aaddce48d4247293b1af5c316c42db67'),
    ('public.fusionner_carte(uuid,uuid)', 'ccac55c88a0fb44dd76737562ca9dc72'),
    ('public.athletes_nom_proche(text,text,uuid)', '1ab37c3c47bbd70de790d27b7676bffa'),
    ('public.athlete_nexus_par_courriel(text)', '0c0cee48b51459649559fe0bd7f42852'),
    ('public.agenda_flux(text)', 'e66aa71a38527be3a3222a21a837f19b'),
    ('public.matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '82ac7e3aebbb103335346d8799bf596e'),
    ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)', '3402b892940b6a7049fa7ba262a5af11'),
    ('public.log_new_athlete()', 'd69c225b3fc04007d527ef0a69717d04'),
    ('public.log_athlete_update()', '7b927d3036f7ca1e6d24090c7202c672'),
    ('public.log_coach_reply()', '8d37af1940e9062e69f5170a7cf21be9'),
    ('public.athlete_est_cegepien(uuid)', '64d1f6e988444fd2fdd915beab11da2d'),
    ('public.peut_voir_cegepiens()', 'bf3463481d1b2862acc6367f2640b3b1'),
    ('public.unite_voit_cegepiens(uuid)', 'e6c978a07191e40681a89c1ebfa3d1b7')) t(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) <> r.md5 then
      raise exception 'NEXUS: après migration, % = md5 %, attendu %', r.sig, md5(pg_get_functiondef(r.sig::regprocedure)), r.md5;
    end if;
  end loop;
  select count(*) into n from pg_policies
   where schemaname = 'public' and policyname = 'cegepiens_masques_recruteurs' and permissive = 'RESTRICTIVE';
  if n <> 6 then raise exception 'NEXUS: % policy(ies) restrictive(s), attendu 6', n; end if;
end $$;

-- ── 3. Preuve sous vrai JWT, avant le COMMIT ─────────────────────────────────
-- Le recruteur collégial ne voit plus le témoin ni sa ligne de journal ; l'admin, si.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('nexus.collegial'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t uuid := current_setting('nexus.temoin')::uuid; n int;
begin
  select count(*) into n from public.athletes where id = t;
  if n <> 0 then raise exception 'NEXUS: le recruteur collégial lit encore le témoin (athletes = %)', n; end if;
  select count(*) into n from public.recruiter_search_athletes() where id = t;
  if n <> 0 then raise exception 'NEXUS: le témoin sort encore dans la recherche du collégial'; end if;
  select count(*) into n from public.recruiter_athlete_profile(t);
  if n <> 0 then raise exception 'NEXUS: la fiche du témoin s''ouvre encore au collégial'; end if;
  select count(*) into n from public.recruiter_activity_log where athlete_id = t;
  if n <> 0 then raise exception 'NEXUS: le collégial lit encore % ligne(s) de journal du témoin', n; end if;
end $$;
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t uuid := current_setting('nexus.temoin')::uuid; n int;
begin
  select count(*) into n from public.athletes where id = t;
  if n <> 1 then raise exception 'NEXUS: l''admin ne lit plus le témoin (athletes = %)', n; end if;
  select count(*) into n from public.recruiter_activity_log where athlete_id = t;
  if n <> 5 then raise exception 'NEXUS: l''admin lit % ligne(s) de journal du témoin, attendu 5', n; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
select (select count(*) from public.recruiter_activity_log where athlete_id = current_setting('nexus.temoin')::uuid) as journal_temoin_apres;

-- ── 4. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_a_base', array[contenu], 'bptds22@gmail.com' from _lot_a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_LOT_A_CEGEPIENS_MASQUES',
       'Lot A cégep : cégépiens masqués aux recruteurs collégiaux et sans école — 3 fonctions-règles, 15 RPC rebasées, 3 déclencheurs du journal filtrés, 6 policies RESTRICTIVE (GO BP 2026-10-25)',
       jsonb_build_object(
         'nom', 'cegep_lot_a_base',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_a_base.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_a_base.sql',
         'md5_fichier', '@@MD5_MIGRATION@@',
         'md5_rollback', '@@MD5_ROLLBACK@@',
         'voie', 'psql (session pooler), fichier trop gros pour le connecteur MCP',
         'rejeu_blanc', '2026-10-25 22 h : rollback 0/0 sur 1095 lignes, journal du témoin 1 -> 0 chez 5 collégiaux, admin 5',
         'preuve_avant_commit', 'collégial : témoin 0 (lecture, recherche, fiche, journal) ; admin : témoin 1, journal 5'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _lot_a;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@' and name = 'cegep_lot_a_base') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_LOT_A_CEGEPIENS_MASQUES') <> 1 then
    raise exception 'NEXUS: ligne admin_operations absente ou en double';
  end if;
end $$;

select version as version_inscrite, clock_timestamp() as avant_commit from _lot_a;
commit;
\echo '== COMMIT fait : lot A en prod.'
