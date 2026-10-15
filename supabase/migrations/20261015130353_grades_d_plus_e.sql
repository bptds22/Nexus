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
