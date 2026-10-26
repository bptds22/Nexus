-- ════════════════════════════════════════════════════════════════════════════
-- Lot B2 cégep — APPLY RÉEL EN PROD, version @@VERSION@@ (GO BP après le rejeu à blanc du @@DATE@@ :
-- VERDICT tout à 0, t13 non_cegepiens = 0, rollback 0/0/0, seule rseq_proposition_equipe change).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b2/generer.sh <date> apply : la migration y est embarquée telle
-- quelle (fins de ligne LF, même texte que celui du rejeu à blanc, md5 gardé).
--
-- UNE transaction : gardes AVANT → migration → gardes APRÈS → inscription (schema_migrations +
-- admin_operations MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL) → COMMIT. Toute garde qui échoue
-- (RAISE « NEXUS: ») ou toute erreur arrête psql (ON_ERROR_STOP) AVANT le COMMIT : rien n'est appliqué.
-- Lancer SANS -1.
-- Rollback : docs/cegep-lot-b2/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-lot-b2';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
declare n int; e text; v text;
begin
  -- Jamais le mardi ou le mercredi avant 5 h (heure de Montréal).
  if extract(isodow from now() at time zone 'America/Toronto') in (2, 3)
     and extract(hour from now() at time zone 'America/Toronto') < 5 then
    raise exception 'NEXUS: pas d''apply le mardi ou le mercredi avant 5 h';
  end if;

  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%)', v; end if;
  if exists (select 1 from public.admin_operations
              where operation in ('CATEGORIE_COLLEGIALE_256', 'MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL')) then
    raise exception 'NEXUS: le lot B2 a déjà laissé une trace dans admin_operations';
  end if;

  -- Corps prod de rseq_proposition_equipe : celui du rejeu (texte, définition, ACL, réglages).
  if (select md5(prosrc) from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a'
     or md5(pg_get_functiondef('public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure))
     is distinct from '00766b1735952d9a5366db23e383c6bd' then
    raise exception 'NEXUS: rseq_proposition_equipe a bougé depuis le rejeu à blanc';
  end if;
  if (select proacl::text from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '{postgres=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de rseq_proposition_equipe inattendue';
  end if;

  -- Les 256, exactes.
  select count(*), md5(string_agg(t.id::text, ',' order by t.id)) into n, e
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;
  if n <> 256 or e is distinct from '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: % équipe(s) CEGEP sans catégorie (empreinte %), attendu 256 (8d08926f…)', n, e;
  end if;

  -- Déclencheurs de teams : les deux du rejeu, aucun autre (l'UPDATE de age_group n'en fait partir aucun).
  if (select string_agg(t.tgname || ':' || pg_get_triggerdef(t.oid), ' | ' order by t.tgname)
        from pg_trigger t where t.tgrelid = 'public.teams'::regclass and not t.tgisinternal)
     is distinct from
     'teams_resync_athlete_sport_id_trg:CREATE TRIGGER teams_resync_athlete_sport_id_trg AFTER UPDATE OF sport_id ON public.teams FOR EACH ROW WHEN ((old.sport_id IS DISTINCT FROM new.sport_id)) EXECUTE FUNCTION teams_resync_athlete_sport_id()'
     || ' | trg_porte_coach_cegep:CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF school_id ON public.teams FOR EACH ROW WHEN ((new.school_id IS NOT NULL)) EXECUTE FUNCTION porte_coach_cegep()' then
    raise exception 'NEXUS: déclencheurs de teams différents de ceux du rejeu';
  end if;

  -- t13 du rejeu : aucun athlète NON cégépien ACTIF sur une équipe sœur « Collégial » (sinon le dépistage
  -- des matchs des 256 changerait pour les recruteurs).
  select count(*) into n
    from public.team_athletes ta join public.teams t on t.id = ta.team_id join public.athletes a on a.id = ta.athlete_id
   where a.status = 'ACTIF' and t.age_group = 'Collégial' and not public.athlete_est_cegepien(a.id)
     and exists (select 1 from public.teams v join public.schools s on s.id = v.school_id
                  where s.type::text = 'CEGEP' and v.age_group is null and v.school_id = t.school_id and v.sport_id = t.sport_id);
  if n <> 0 then
    raise exception 'NEXUS: % athlète(s) non cégépien(s) sur une équipe sœur « Collégial » — t13 a bougé depuis le rejeu', n;
  end if;
end $$;

-- Relevés AVANT, comparés après la migration.
create temp table _v on commit drop as
select t.id from public.teams t join public.schools s on s.id = t.school_id
 where s.type::text = 'CEGEP' and t.age_group is null;
create temp table _avant on commit drop as
select (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id not in (select id from _v)) as hors256,
       (select md5(string_agg((to_jsonb(t) - 'age_group')::text, '|' order by t.id)) from public.teams t where t.id in (select id from _v)) as les256_sans_cat,
       (select count(*) from public.games g where g.home_team_id in (select id from _v) or g.visitor_team_id in (select id from _v)) as matchs_des_256;
create temp table _p on commit drop as
select 'avant'::text as phase, a.id as alerte, j->>'decision' as decision, j->>'doublon_team_id' as doublon, j->>'age_group' as age_group
  from public.rseq_sync_alerts a,
       lateral public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name', a.rseq_league_id,
                                              a.payload->>'saison', 'Collégial') j
 where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE';
select (select count(*) from _v) as les_256, (select matchs_des_256 from _avant) as matchs_des_256,
       (select count(*) from _p) as alertes_ouvertes,
       (select string_agg(decision || ':' || n, ', ' order by decision) from (select decision, count(*) n from _p group by 1) z) as decisions;

-- ── 1. La migration, texte gardé par son md5 ────────────────────────────────
create temp table _lot_b2 on commit drop as
select '@@VERSION@@'::text as version, $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot_b2) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lot_b2);
  end if;
  execute (select contenu from _lot_b2);
end $apply$;
select clock_timestamp() as fin_migration;

-- ── 2. Gardes APRÈS ──────────────────────────────────────────────────────────
insert into _p
select 'apres', a.id, j->>'decision', j->>'doublon_team_id', j->>'age_group'
  from public.rseq_sync_alerts a,
       lateral public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name', a.rseq_league_id,
                                              a.payload->>'saison', 'Collégial') j
 where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE';

do $$
declare n int;
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '0ab7d3953ceacfae2a2eff8493d83617'
     or md5(pg_get_functiondef('public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure))
     is distinct from '80c3399deff44d064abcc77442e3d744' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas la version B2 du rejeu';
  end if;
  if (select proacl::text from pg_proc where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '{postgres=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de rseq_proposition_equipe changée';
  end if;

  select count(*) into n from public.teams where id in (select id from _v) and age_group = 'Collégial';
  if n <> 256 then raise exception 'NEXUS: % des 256 en « Collégial », attendu 256', n; end if;
  if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
              where s.type::text = 'CEGEP' and t.age_group is null) then
    raise exception 'NEXUS: il reste une équipe CEGEP sans catégorie';
  end if;
  if (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id not in (select id from _v))
     is distinct from (select hors256 from _avant) then
    raise exception 'NEXUS: une équipe hors des 256 a changé';
  end if;
  if (select md5(string_agg((to_jsonb(t) - 'age_group')::text, '|' order by t.id)) from public.teams t where t.id in (select id from _v))
     is distinct from (select les256_sans_cat from _avant) then
    raise exception 'NEXUS: une des 256 a changé ailleurs que dans age_group';
  end if;
  if (select count(*) from public.games g where g.home_team_id in (select id from _v) or g.visitor_team_id in (select id from _v))
     <> (select matchs_des_256 from _avant) then
    raise exception 'NEXUS: le nombre de matchs des 256 a changé';
  end if;

  -- Veille : mêmes décisions, même équipe visée pour un doublon ; catégorie proposée « Collégial ».
  select count(*) into n from _p a join _p b on b.alerte = a.alerte and b.phase = 'apres'
   where a.phase = 'avant' and (a.decision is distinct from b.decision or a.doublon is distinct from b.doublon);
  if n <> 0 then raise exception 'NEXUS: % alerte(s) changent de décision ou de doublon', n; end if;
  if exists (select 1 from _p where phase = 'apres' and age_group is distinct from 'Collégial') then
    raise exception 'NEXUS: une proposition collégiale ne porte pas « Collégial »';
  end if;

  if (select count(*) from public.admin_operations where operation = 'CATEGORIE_COLLEGIALE_256') <> 1 then
    raise exception 'NEXUS: ligne admin_operations CATEGORIE_COLLEGIALE_256 absente ou en double';
  end if;
end $$;

select (select count(*) from public.teams where id in (select id from _v) and age_group = 'Collégial') as les_256_en_collegial,
       (select count(*) from public.teams t join public.schools s on s.id = t.school_id
         where s.type::text = 'SECONDAIRE' and t.age_group = 'Collégial') as secondaire_en_collegial_inchange,
       (select count(*) from public.teams where age_group = 'cegep') as champlain_cavaliers_inchange,
       (select string_agg(decision || ':' || n, ', ' order by decision)
          from (select decision, count(*) n from _p where phase = 'apres' group by 1) z) as decisions_apres;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_b2_categorie_collegial', array[contenu], 'bptds22@gmail.com' from _lot_b2;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL',
       'Lot B2 cégep : les 256 équipes d''école CEGEP sans catégorie passent en « Collégial », et la veille RSEQ propose « Collégial » pour une équipe collégiale (GO BP 2026-10-26)',
       jsonb_build_object(
         'nom', 'cegep_lot_b2_categorie_collegial',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_b2_categorie_collegial.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_b2_categorie_collegial.sql',
         'md5_fichier', '@@MD5_MIGRATION@@',
         'md5_rollback', '@@MD5_ROLLBACK@@',
         'empreinte_256', '8d08926f78d851bf9bbd3003c5b52ec9',
         'voie', 'psql (session pooler)',
         'rejeu_blanc', 'VERDICT tout à 0, t13 non_cegepiens = 0, rollback 0/0/0, seule rseq_proposition_equipe change au schéma'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _lot_b2;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '@@VERSION@@' and name = 'cegep_lot_b2_categorie_collegial') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL absente ou en double';
  end if;
end $$;

select version as version_inscrite, clock_timestamp() as avant_commit from _lot_b2;
commit;
\echo '== COMMIT fait : B2 en prod.'
