-- ════════════════════════════════════════════════════════════════════════════
-- Lot B2 cégep — ROLLBACK RÉEL EN PROD de la version @@VERSION@@. À lancer SEULEMENT sur GO BP.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b2/generer.sh <date> rollback : le rollback y est embarqué tel
-- quel (fins de ligne LF, même texte que celui du rejeu à blanc, md5 gardé).
--
-- UNE transaction : gardes AVANT (B2 est là, tel qu'appliqué) → rollback (les 256, par liste d'id,
-- repassent à NULL ; rseq_proposition_equipe reprend son corps prod d'avant) → gardes APRÈS →
-- inscription (schema_migrations « rollback_cegep_lot_b2_categorie_collegial », version = l'heure UTC
-- du lancement ; admin_operations ROLLBACK_B2_EQUIPES_CEGEP_COLLEGIAL) → COMMIT. Lancer SANS -1.
-- Les équipes que la veille aurait créées en « Collégial » depuis l'apply ne sont PAS touchées.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-rollback-lot-b2';
select now() as debut, current_user;

-- ── 0. Gardes AVANT : B2 est en place, tel qu'appliqué ───────────────────────
do $$
begin
  if extract(isodow from now() at time zone 'America/Toronto') in (2, 3)
     and extract(hour from now() at time zone 'America/Toronto') < 5 then
    raise exception 'NEXUS: pas de prod le mardi ou le mercredi avant 5 h';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_b2_categorie_collegial') then
    raise exception 'NEXUS: lot B2 @@VERSION@@ non inscrit — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'ROLLBACK_B2_EQUIPES_CEGEP_COLLEGIAL') then
    raise exception 'NEXUS: le lot B2 a déjà été retiré';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '0ab7d3953ceacfae2a2eff8493d83617'
     or md5(pg_get_functiondef('public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure))
     is distinct from '80c3399deff44d064abcc77442e3d744' then
    raise exception 'NEXUS: rseq_proposition_equipe a bougé depuis l''apply — ne pas écraser une version inconnue';
  end if;
end $$;

-- Relevé AVANT : les équipes hors des 256 ne doivent pas bouger.
create temp table _ids on commit drop as
select (jsonb_array_elements_text(details->'team_ids'))::uuid as id
  from public.admin_operations where operation = 'CATEGORIE_COLLEGIALE_256';
do $$
begin
  if (select count(*) from _ids) <> 256
     or (select md5(string_agg(id::text, ',' order by id)) from _ids) <> '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: la liste des 256 de l''apply est introuvable ou altérée';
  end if;
end $$;
create temp table _avant on commit drop as
select (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id not in (select id from _ids)) as hors256,
       (select md5(string_agg((to_jsonb(t) - 'age_group')::text, '|' order by t.id)) from public.teams t where t.id in (select id from _ids)) as les256_sans_cat;

-- ── 1. Le rollback, texte gardé par son md5 (il vérifie lui-même la liste, le corps et le compte) ─
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
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a'
     or md5(pg_get_functiondef('public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure))
     is distinct from '00766b1735952d9a5366db23e383c6bd' then
    raise exception 'NEXUS: rseq_proposition_equipe n''a pas repris son corps prod d''avant';
  end if;
  if (select proacl::text from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '{postgres=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de rseq_proposition_equipe changée';
  end if;
  if exists (select 1 from public.teams where id in (select id from _ids) and age_group is not null) then
    raise exception 'NEXUS: une des 256 garde une catégorie';
  end if;
  if (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id not in (select id from _ids))
     is distinct from (select hors256 from _avant) then
    raise exception 'NEXUS: une équipe hors des 256 a changé';
  end if;
  if (select md5(string_agg((to_jsonb(t) - 'age_group')::text, '|' order by t.id)) from public.teams t where t.id in (select id from _ids))
     is distinct from (select les256_sans_cat from _avant) then
    raise exception 'NEXUS: une des 256 a changé ailleurs que dans age_group';
  end if;
  if (select count(*) from public.admin_operations where operation = 'CATEGORIE_COLLEGIALE_256_RETIREE') <> 1 then
    raise exception 'NEXUS: ligne admin_operations CATEGORIE_COLLEGIALE_256_RETIREE absente ou en double';
  end if;
end $$;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'rollback_cegep_lot_b2_categorie_collegial', array[contenu], 'bptds22@gmail.com' from _rb;

insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_B2_EQUIPES_CEGEP_COLLEGIAL',
       'Rollback du lot B2 cégep (@@VERSION@@) sur GO BP',
       jsonb_build_object(
         'nom', 'rollback_cegep_lot_b2_categorie_collegial',
         'version', version,
         'defait', '@@VERSION@@',
         'fichier', 'supabase/rollback/@@VERSION@@_rollback_cegep_lot_b2_categorie_collegial.sql',
         'md5_fichier', '@@MD5_ROLLBACK@@',
         'voie', 'psql (session pooler)'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _rb;

select version as version_rollback_inscrite, clock_timestamp() as avant_commit from _rb;
commit;
\echo '== COMMIT fait : B2 retiré de la prod.'
