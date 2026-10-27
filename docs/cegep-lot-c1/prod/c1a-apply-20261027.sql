-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1a cégep — APPLY RÉEL EN PROD, version 20261027230000 (valeur auto_cegep de
-- verification_method). À lancer SEULEMENT sur GO BP, après le rejeu à blanc C1a. Fichier GÉNÉRÉ par
-- scripts/cegep-lot-c1/generer.sh c1a <date> apply (migration embarquée, LF, md5 gardé).
--
-- UNE transaction : gardes → migration → inscription (schema_migrations + admin_operations
-- MIGRATION_CEGEP_LOT_C1A_METHODE) → COMMIT ; puis, hors transaction, la valeur est lue comme un vrai
-- verification_method. Pas de rollback : une valeur d'enum ne se retire pas, elle reste inerte tant
-- que C1b n'est pas appliquée. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-c1a';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230000') then
    raise exception 'NEXUS: version 20261027230000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261027230000' then raise exception 'NEXUS: version 20261027230000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_C1A_METHODE') then
    raise exception 'NEXUS: le lot C1a a déjà laissé une trace dans admin_operations';
  end if;
end $$;

create temp table _c1a on commit drop as
select '20261027230000'::text as version, $nexus_mig$-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C1a (GO BP 2026-10-27, décision 4) : la valeur
-- « auto_cegep » de l'enum verification_method, pour reconnaître les cégépiens vérifiés
-- automatiquement et pouvoir les remettre en gris le jour où le coach collégial existera.
--
-- Migration À PART de C1b (le trigger qui s'en sert) : une valeur ajoutée à un enum ne peut pas être
-- utilisée dans la transaction qui l'ajoute. C1b ne peut donc être rejouée à blanc qu'une fois C1a
-- en prod.
--
-- Aucune ligne n'est écrite ; aucune fonction, policy ni trigger ne change. Une valeur d'enum ne se
-- retire pas sans réécrire le type : pas de rollback, la valeur reste inerte tant que C1b n'est pas
-- appliquée (aucune ligne ne la porte).

do $garde$
begin
  if exists (select 1 from pg_enum where enumtypid = 'public.verification_method'::regtype
                                     and enumlabel = 'auto_cegep') then
    raise exception 'NEXUS: 20261027230000 déjà appliquée (auto_cegep existe)';
  end if;
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur' then
    raise exception 'NEXUS: verification_method n''a pas les trois valeurs relevées le 2026-10-27';
  end if;
end $garde$;

alter type public.verification_method add value 'auto_cegep';

do $garde$
begin
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur,auto_cegep' then
    raise exception 'NEXUS: auto_cegep absente après la migration';
  end if;
  raise notice 'NEXUS: lot C1a cégep — valeur auto_cegep ajoutée à verification_method';
end $garde$;
$nexus_mig$::text as contenu;
do $apply$
begin
  if (select md5(contenu) from _c1a) <> '3cfa1d46d1dbe918f3a103d31a6dec6a' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _c1a);
  end if;
  execute (select contenu from _c1a);
end $apply$;
set local search_path = public, extensions;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_c1a_methode_auto_cegep', array[contenu], 'bptds22@gmail.com' from _c1a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_C1A_METHODE',
       'Chantier cégep, lot C1a : valeur auto_cegep de verification_method (préalable de la vérification automatique des cégépiens, C1b) (GO BP 2026-10-27)',
       jsonb_build_object(
         'nom', 'cegep_lot_c1a_methode_auto_cegep',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_c1a_methode_auto_cegep.sql',
         'md5_fichier', '3cfa1d46d1dbe918f3a103d31a6dec6a',
         'rollback', 'aucun (valeur d''enum inerte)',
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _c1a;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261027230000' and name = 'cegep_lot_c1a_methode_auto_cegep') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_C1A_METHODE') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_CEGEP_LOT_C1A_METHODE absente ou en double';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _c1a;
commit;

-- Hors transaction : la valeur est utilisable (ce que C1b demandera).
select 'auto_cegep'::public.verification_method as valeur_utilisable,
       (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
         where enumtypid = 'public.verification_method'::regtype) as valeurs,
       (select count(*) from public.athletes where verification_method = 'auto_cegep') as fiches_auto_cegep;
\echo '== COMMIT fait : lot C1a cégep en prod (valeur auto_cegep, inerte).'
