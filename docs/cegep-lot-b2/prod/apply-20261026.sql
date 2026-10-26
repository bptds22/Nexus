-- ════════════════════════════════════════════════════════════════════════════
-- Lot B2 cégep — APPLY RÉEL EN PROD, version 20261026140000 (GO BP après le rejeu à blanc du 20261026 :
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

  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261026140000') then
    raise exception 'NEXUS: version 20261026140000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261026140000' then raise exception 'NEXUS: version 20261026140000 pas après la dernière (%)', v; end if;
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
select '20261026140000'::text as version, $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B2 « données » : catégorie « Collégial » (décisions BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement.
--
-- 1. rseq_proposition_equipe : une équipe collégiale proposée par la veille RSEQ porte
--    age_group = 'Collégial' au lieu de NULL (seule la ligne v_age change ; corps prod gardé
--    par md5(prosrc) avant remplacement). Sans ce correctif, chaque alerte NOUVELLE_EQUIPE
--    traitée crée une équipe sans catégorie, et la règle de dédoublonnage n° 2 (même école +
--    sport + catégorie + division + sexe + saison) cesse de reconnaître les équipes
--    « Collégial » existantes.
-- 2. Les 256 équipes rattachées à une école de type CEGEP, age_group NULL, passent en
--    « Collégial ». Garde : schools.type = 'CEGEP' ET age_group IS NULL, compte exact 256 et
--    empreinte exacte de l'ensemble (md5 des id triés, relevé prod 2026-10-26). JAMAIS de
--    filtre par nom : « Cégep régional de Lanaudière à L'Assomption » (CEGEP) en fait partie,
--    « Collège de l'Assomption » (SECONDAIRE) n'est pas touché.
--    Ne fait partir aucun déclencheur : sur teams, trg_porte_coach_cegep regarde
--    UPDATE OF school_id et teams_resync_athlete_sport_id_trg UPDATE OF sport_id.
-- 3. Une ligne admin_operations CATEGORIE_COLLEGIALE_256 avec la liste des id.
--
-- Hors lot (décisions BP) : Champlain Cavaliers, Champlain Regional College, les 194 alertes
-- cégep ouvertes, les athlètes au cégep tapé à la main.
--
-- Rollback : supabase/rollback/20261026140000_rollback_cegep_lot_b2_categorie_collegial.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes ────────────────────────────────────────────────────────────────
do $$
declare n int; e text;
begin
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas le corps prod relevé le 2026-10-26';
  end if;
  select count(*), md5(string_agg(t.id::text, ',' order by t.id)) into n, e
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;
  if n <> 256 or e is distinct from '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: % équipe(s) CEGEP sans catégorie (empreinte %), attendu 256 (8d08926f…)', n, e;
  end if;
end $$;

-- ── 1. rseq_proposition_equipe : collégial → « Collégial » ──────────────────
create or replace function public.rseq_proposition_equipe(
  p_rseq_team_id uuid, p_institution uuid, p_team_name text, p_league_id uuid, p_saison text, p_secteur text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sport text; v_cat text; v_div text; v_sexe text; v_ligue text;
  v_sport_nexus text; v_sport_id uuid;
  v_n_ecoles int; v_ecole uuid; v_ecole_nom text;
  v_age text; v_gender text; v_league text;
  v_deja uuid; v_doublon uuid; v_doublon_nom text; v_cotes int; v_decision text;
begin
  select l.sport, l.category, l.division, l.sex_type, l.league_name
    into v_sport, v_cat, v_div, v_sexe, v_ligue
    from public.rseq_ligues_a_appeler l where l.rseq_league_id = p_league_id limit 1;
  if v_sport is null then
    select g.sport, g.category, g.division, g.sex_type, g.league_name
      into v_sport, v_cat, v_div, v_sexe, v_ligue
      from public.games g where g.rseq_league_id = p_league_id limit 1;
  end if;

  v_sport_nexus := case v_sport when 'Ultimate' then 'Ultimate frisbee' else v_sport end;
  select s.id into v_sport_id from public.sports s where s.nom = v_sport_nexus;

  select count(*), min(sc.id::text)::uuid, min(sc.name) into v_n_ecoles, v_ecole, v_ecole_nom
    from public.schools sc
   where p_institution is not null and sc.rseq_institution_id = p_institution
     and sc.type = case p_secteur when 'Collégial' then 'CEGEP' else 'SECONDAIRE' end;
  if v_n_ecoles <> 1 then v_ecole := null; v_ecole_nom := null; end if;

  v_gender := case v_sexe when 'Garçons' then 'Masculin' when 'Filles' then 'Féminin' else nullif(v_sexe, '') end;
  -- Lot B2 (2026-10-26) : une équipe collégiale porte la catégorie « Collégial », comme les 398 déjà en base.
  v_age    := case when p_secteur = 'Collégial' then 'Collégial' else nullif(v_cat, '') end;
  v_div    := nullif(v_div, '');
  v_league := case when p_secteur = 'Collégial' and v_ligue is not null then v_ligue || ' (' || p_saison || ')' end;

  select t.id into v_deja from public.teams t where t.rseq_team_id = p_rseq_team_id;
  if v_ecole is not null and v_sport_id is not null then
    select t.id, t.name into v_doublon, v_doublon_nom
      from public.teams t
     where t.school_id = v_ecole and t.sport_id = v_sport_id and t.season = p_saison
       and coalesce(t.age_group, '') = coalesce(v_age, '')
       and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd')
         = regexp_replace(lower(coalesce(v_div, '')), '^division\s*', 'd')
       and coalesce(t.gender, '') = coalesce(v_gender, '')
     order by t.created_at limit 1;
  end if;
  select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p_rseq_team_id)
       + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p_rseq_team_id)
    into v_cotes;

  v_decision := case
    when v_deja is not null    then 'deja_en_base'
    when v_sport_id is null    then 'sport_absent'
    when v_ecole is null       then 'ecole_introuvable'
    when v_doublon is not null then 'doublon'
    else 'a_creer' end;

  return jsonb_build_object(
    'decision', v_decision, 'rseq_team_id', p_rseq_team_id, 'nom', p_team_name, 'saison', p_saison,
    'secteur', p_secteur, 'school_id', v_ecole, 'ecole', v_ecole_nom, 'ecoles_candidates', v_n_ecoles,
    'sport', v_sport_nexus, 'sport_id', v_sport_id, 'age_group', v_age, 'division', v_div, 'gender', v_gender,
    'league', v_league, 'equipe_existante', v_deja, 'doublon_team_id', v_doublon, 'doublon_nom', v_doublon_nom,
    'cotes_a_relier', v_cotes,
    'confiance', case when v_ecole is not null then 'haute (InstitutionId)' else 'introuvable' end);
end;
$function$;

-- ── 2. Les 256 équipes → « Collégial » ──────────────────────────────────────
do $$
declare v_ids uuid[]; n int;
begin
  select array_agg(t.id order by t.id) into v_ids
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;

  update public.teams t set age_group = 'Collégial'
   where t.id = any(v_ids) and t.age_group is null;
  get diagnostics n = row_count;
  if n <> 256 then
    raise exception 'NEXUS: % équipe(s) mise(s) à jour, attendu 256 — rien écrit', n;
  end if;
  if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
              where s.type::text = 'CEGEP' and t.age_group is null) then
    raise exception 'NEXUS: il reste une équipe CEGEP sans catégorie — rien écrit';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CATEGORIE_COLLEGIALE_256',
          'Lot B2 cégep : équipes d''école CEGEP sans catégorie passées en « Collégial » (décision BP 2026-10-26)',
          jsonb_build_object('equipes', n, 'age_group_avant', null, 'age_group_apres', 'Collégial',
                             'empreinte_ids', md5(array_to_string(v_ids, ',')),
                             'team_ids', to_jsonb(v_ids)),
          auth.uid());
end $$;
$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot_b2) <> '0d8d3f694ffbb1d265f5eec53ec93de6' then
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
         'md5_fichier', '0d8d3f694ffbb1d265f5eec53ec93de6',
         'md5_rollback', '6a62c459d91168d9beded95ef32e7905',
         'empreinte_256', '8d08926f78d851bf9bbd3003c5b52ec9',
         'voie', 'psql (session pooler)',
         'rejeu_blanc', 'VERDICT tout à 0, t13 non_cegepiens = 0, rollback 0/0/0, seule rseq_proposition_equipe change au schéma'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _lot_b2;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261026140000' and name = 'cegep_lot_b2_categorie_collegial') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_B2_EQUIPES_CEGEP_COLLEGIAL absente ou en double';
  end if;
end $$;

select version as version_inscrite, clock_timestamp() as avant_commit from _lot_b2;
commit;
\echo '== COMMIT fait : B2 en prod.'
