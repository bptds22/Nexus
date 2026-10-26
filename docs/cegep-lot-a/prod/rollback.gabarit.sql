-- ════════════════════════════════════════════════════════════════════════════
-- Lot A cégep — ROLLBACK RÉEL EN PROD de la version @@VERSION@@. À lancer SEULEMENT sur GO BP.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-a-rejeu-blanc.sh <date> rollback : le rollback y est
-- embarqué tel quel (même texte que celui du rejeu à blanc du 2026-10-25, md5 gardé).
--
-- UNE transaction : gardes avant (le lot A est là, tel qu'appliqué) → rollback → gardes après
-- (les 18 corps prod d'avant, aucune policy, aucune fonction-règle) → inscription
-- (schema_migrations « rollback_cegep_lot_a_base », version = l'heure UTC du lancement, comme le
-- 2026-10-22 ; admin_operations ROLLBACK_LOT_A_CEGEPIENS_MASQUES) → COMMIT. Rien n'est effacé du
-- journal : les lignes masquées redeviennent lisibles. Lancer SANS -1.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-rollback-lot-a';
select now() as debut, current_user;

-- ── 0. Gardes AVANT : le lot A est en place, tel qu'appliqué ─────────────────
do $$
declare r record; n int;
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@' and name = 'cegep_lot_a_base') then
    raise exception 'NEXUS: lot A @@VERSION@@ non inscrit — rien à défaire';
  end if;
  select count(*) into n from pg_policies where policyname = 'cegepiens_masques_recruteurs';
  if n <> 6 then raise exception 'NEXUS: % policy(ies) cegepiens_masques_recruteurs, attendu 6', n; end if;
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
    ('public.log_coach_reply()', '8d37af1940e9062e69f5170a7cf21be9')) t(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) <> r.md5 then
      raise exception 'NEXUS: % a bougé depuis l''apply (md5 %) — ne pas écraser une version inconnue', r.sig, md5(pg_get_functiondef(r.sig::regprocedure));
    end if;
  end loop;
end $$;

-- ── 1. Le rollback, texte gardé par son md5 (il vérifie lui-même md5 et ACL d'arrivée) ─
create temp table _rb on commit drop as
select to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS') as version,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as contenu;

do $rb$
begin
  if (select md5(contenu) from _rb) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(contenu) from _rb);
  end if;
  if (select version from _rb) <= '@@VERSION@@' then
    raise exception 'NEXUS: version du rollback pas après @@VERSION@@';
  end if;
  execute (select contenu from _rb);
end $rb$;

-- ── 2. Gardes APRÈS ──────────────────────────────────────────────────────────
do $$
declare n int;
begin
  if to_regprocedure('public.athlete_est_cegepien(uuid)') is not null
     or to_regprocedure('public.peut_voir_cegepiens()') is not null
     or to_regprocedure('public.unite_voit_cegepiens(uuid)') is not null then
    raise exception 'NEXUS: une fonction-règle reste après le rollback';
  end if;
  select count(*) into n from pg_policies where policyname = 'cegepiens_masques_recruteurs';
  if n <> 0 then raise exception 'NEXUS: % policy(ies) restante(s)', n; end if;
  if md5(pg_get_functiondef('public.log_new_athlete()'::regprocedure)) <> '6fc96267a5d89574a305f3da137e2b24'
     or md5(pg_get_functiondef('public.log_athlete_update()'::regprocedure)) <> 'cda68b5c35a432d7957f4b8fca5c9b2c'
     or md5(pg_get_functiondef('public.log_coach_reply()'::regprocedure)) <> '2fe3a0ef413037a4fc13d993c2a4f601'
     or md5(pg_get_functiondef('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'::regprocedure)) <> '1d04401fe73aed88764c0899a22d76f7' then
    raise exception 'NEXUS: corps prod d''avant non retrouvés';
  end if;
end $$;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'rollback_cegep_lot_a_base', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_LOT_A_CEGEPIENS_MASQUES',
       'Rollback du lot A cégep (@@VERSION@@) sur GO BP',
       jsonb_build_object(
         'nom', 'rollback_cegep_lot_a_base',
         'version', version,
         'defait', '@@VERSION@@',
         'fichier', 'supabase/rollback/@@VERSION@@_rollback_cegep_lot_a_base.sql',
         'md5_fichier', '@@MD5_ROLLBACK@@',
         'voie', 'psql (session pooler)'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _rb;

select version as version_rollback_inscrite from _rb;
commit;
\echo '== COMMIT fait : lot A retiré de la prod.'
