-- LOT PROD grades D+/E — généré par docs/import-laureats/prod/construire-lot-grades.mjs — VARIANTE DE PREUVE (garde finale fausse)
-- Fichier : supabase/migrations/20261015130353_grades_d_plus_e.sql — md5 3d96deb849e1ad160e68ee807c20450c
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _gr_releve as
select txid_current() as txid,
       (select count(*) from public.cartes_prospect) as cartes,
       (select count(*) from public.recruiter_athlete_grades) as grades_recruteurs,
       md5(coalesce((select string_agg(id::text || '|' || coalesce(grade, ''), ',' order by id) from public.cartes_prospect), '')) || md5(coalesce((select string_agg(recruiter_id::text || '|' || athlete_id::text || '|' || grade, ',' order by recruiter_id, athlete_id) from public.recruiter_athlete_grades), '')) as empreinte_grades,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261015130353') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _gr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _gr_releve) <> 0 then
    raise exception 'NEXUS LOT: grades D+/E déjà présents — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261015130353_grades_d_plus_e.sql =====
-- Grades D+ et E — échelle à 9 crans (décision BP 2026-10-15, chantier import Lauréats).
--
-- Du meilleur au moins bon : A+, A, B+, B, C+, C, D+, D, E.
-- Migration ADDITIVE : on élargit les deux CHECK qui portent le grade privé recruteur.
--  · public.cartes_prospect.grade          (grade IS NULL OR grade IN (...))
--  · public.recruiter_athlete_grades.grade (grade IN (...))
-- Aucune ligne existante n'est modifiée : les 7 anciennes valeurs restent valides.
-- Contrat avec le web : lib/config/grades.ts (GRADES) — les deux listes changent ensemble.
-- L'appli mobile publiée ne connaît que 7 valeurs : elle affiche D+ et E comme « sans grade »
-- (isGrade les refuse) jusqu'au lot mobile. Elle n'écrit jamais ces valeurs.
-- Rollback : docs/import-laureats/rollback-grades.sql (refuse s'il reste une ligne en D+ ou E).

do $$
begin
  -- Les deux CHECK doivent être EXACTEMENT ceux relevés en prod le 2026-10-15 (7 valeurs).
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.cartes_prospect'::regclass and conname = 'cartes_prospect_grade_check')
     is distinct from
     'CHECK (((grade IS NULL) OR (grade = ANY (ARRAY[''A+''::text, ''A''::text, ''B+''::text, ''B''::text, ''C+''::text, ''C''::text, ''D''::text]))))' then
    raise exception 'NEXUS: cartes_prospect_grade_check ne correspond pas au relevé (7 valeurs) — rien n''est appliqué';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.recruiter_athlete_grades'::regclass and conname = 'recruiter_athlete_grades_grade_check')
     is distinct from
     'CHECK (((grade)::text = ANY ((ARRAY[''A+''::character varying, ''A''::character varying, ''B+''::character varying, ''B''::character varying, ''C+''::character varying, ''C''::character varying, ''D''::character varying])::text[])))' then
    raise exception 'NEXUS: recruiter_athlete_grades_grade_check ne correspond pas au relevé (7 valeurs) — rien n''est appliqué';
  end if;
  -- Une seule contrainte de grade par table : pas de second CHECK oublié qui refuserait D+/E.
  if (select count(*) from pg_constraint
       where contype = 'c' and conrelid in ('public.cartes_prospect'::regclass, 'public.recruiter_athlete_grades'::regclass)
         and pg_get_constraintdef(oid) ilike '%grade%') <> 2 then
    raise exception 'NEXUS: plus d''un CHECK de grade relevé — revoir la migration';
  end if;
end $$;

alter table public.cartes_prospect drop constraint cartes_prospect_grade_check;
alter table public.cartes_prospect add constraint cartes_prospect_grade_check
  check (grade is null or grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'));

alter table public.recruiter_athlete_grades drop constraint recruiter_athlete_grades_grade_check;
alter table public.recruiter_athlete_grades add constraint recruiter_athlete_grades_grade_check
  check (grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'));

-- ===== FIN 20261015130353_grades_d_plus_e.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _gr_texte as select $GRMIG$-- Grades D+ et E — échelle à 9 crans (décision BP 2026-10-15, chantier import Lauréats).
--
-- Du meilleur au moins bon : A+, A, B+, B, C+, C, D+, D, E.
-- Migration ADDITIVE : on élargit les deux CHECK qui portent le grade privé recruteur.
--  · public.cartes_prospect.grade          (grade IS NULL OR grade IN (...))
--  · public.recruiter_athlete_grades.grade (grade IN (...))
-- Aucune ligne existante n'est modifiée : les 7 anciennes valeurs restent valides.
-- Contrat avec le web : lib/config/grades.ts (GRADES) — les deux listes changent ensemble.
-- L'appli mobile publiée ne connaît que 7 valeurs : elle affiche D+ et E comme « sans grade »
-- (isGrade les refuse) jusqu'au lot mobile. Elle n'écrit jamais ces valeurs.
-- Rollback : docs/import-laureats/rollback-grades.sql (refuse s'il reste une ligne en D+ ou E).

do $$
begin
  -- Les deux CHECK doivent être EXACTEMENT ceux relevés en prod le 2026-10-15 (7 valeurs).
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.cartes_prospect'::regclass and conname = 'cartes_prospect_grade_check')
     is distinct from
     'CHECK (((grade IS NULL) OR (grade = ANY (ARRAY[''A+''::text, ''A''::text, ''B+''::text, ''B''::text, ''C+''::text, ''C''::text, ''D''::text]))))' then
    raise exception 'NEXUS: cartes_prospect_grade_check ne correspond pas au relevé (7 valeurs) — rien n''est appliqué';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.recruiter_athlete_grades'::regclass and conname = 'recruiter_athlete_grades_grade_check')
     is distinct from
     'CHECK (((grade)::text = ANY ((ARRAY[''A+''::character varying, ''A''::character varying, ''B+''::character varying, ''B''::character varying, ''C+''::character varying, ''C''::character varying, ''D''::character varying])::text[])))' then
    raise exception 'NEXUS: recruiter_athlete_grades_grade_check ne correspond pas au relevé (7 valeurs) — rien n''est appliqué';
  end if;
  -- Une seule contrainte de grade par table : pas de second CHECK oublié qui refuserait D+/E.
  if (select count(*) from pg_constraint
       where contype = 'c' and conrelid in ('public.cartes_prospect'::regclass, 'public.recruiter_athlete_grades'::regclass)
         and pg_get_constraintdef(oid) ilike '%grade%') <> 2 then
    raise exception 'NEXUS: plus d''un CHECK de grade relevé — revoir la migration';
  end if;
end $$;

alter table public.cartes_prospect drop constraint cartes_prospect_grade_check;
alter table public.cartes_prospect add constraint cartes_prospect_grade_check
  check (grade is null or grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'));

alter table public.recruiter_athlete_grades drop constraint recruiter_athlete_grades_grade_check;
alter table public.recruiter_athlete_grades add constraint recruiter_athlete_grades_grade_check
  check (grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'));
$GRMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _gr_texte' using '20261015130353', 'grades_d_plus_e', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _gr_texte' using '20261015130353', 'grades_d_plus_e';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
begin
  if (select txid from _gr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015130353')
     is distinct from '3d96deb849e1ad160e68ee807c20450c' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.cartes_prospect'::regclass
        and conname = 'cartes_prospect_grade_check') is distinct from 'CHECK (((grade IS NULL) OR (grade = ANY (ARRAY[''A+''::text, ''A''::text, ''B+''::text, ''B''::text, ''C+''::text, ''C''::text, ''D+''::text, ''D''::text, ''E''::text]))))' then
    raise exception 'NEXUS LOT: CHECK de cartes_prospect différent de celui testé en local — tout est annulé';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.recruiter_athlete_grades'::regclass
        and conname = 'recruiter_athlete_grades_grade_check') is distinct from 'CHECK (faux)' then
    raise exception 'NEXUS LOT: CHECK de recruiter_athlete_grades différent de celui testé en local — tout est annulé';
  end if;
  if (select count(*) from public.cartes_prospect) <> (select cartes from _gr_releve)
     or (select count(*) from public.recruiter_athlete_grades) <> (select grades_recruteurs from _gr_releve)
     or md5(coalesce((select string_agg(id::text || '|' || coalesce(grade, ''), ',' order by id) from public.cartes_prospect), '')) || md5(coalesce((select string_agg(recruiter_id::text || '|' || athlete_id::text || '|' || grade, ',' order by recruiter_id, athlete_id) from public.recruiter_athlete_grades), '')) <> (select empreinte_grades from _gr_releve) then
    raise exception 'NEXUS LOT: une ligne de grade a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select cartes, grades_recruteurs, version_deja, derniere_version from _gr_releve) r),
  'apres', json_build_object(
     'cartes', (select count(*) from public.cartes_prospect),
     'grades_recruteurs', (select count(*) from public.recruiter_athlete_grades),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261015130353'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015130353'),
     'meme_transaction', (select txid from _gr_releve) = txid_current())
) as resultat_lot_grades;
