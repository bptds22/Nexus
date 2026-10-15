-- Rollback de 20261015130353_grades_d_plus_e.sql — remet les deux CHECK à 7 valeurs.
-- Refuse s'il existe une ligne en D+ ou E (on ne réécrit jamais un grade posé par un recruteur :
-- c'est à BP de décider quoi en faire avant de revenir en arrière).
-- À lancer en UNE transaction (psql -1, ou un seul envoi au connecteur).

do $$
begin
  if exists (select 1 from public.cartes_prospect where grade in ('D+', 'E'))
     or exists (select 1 from public.recruiter_athlete_grades where grade in ('D+', 'E')) then
    raise exception 'NEXUS: des grades D+ ou E existent — rollback refusé, rien n''est modifié';
  end if;
end $$;

alter table public.cartes_prospect drop constraint cartes_prospect_grade_check;
alter table public.cartes_prospect add constraint cartes_prospect_grade_check
  check (grade is null or grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D'));

alter table public.recruiter_athlete_grades drop constraint recruiter_athlete_grades_grade_check;
alter table public.recruiter_athlete_grades add constraint recruiter_athlete_grades_grade_check
  check (grade in ('A+','A','B+','B','C+','C','D'));  -- forme d'origine (20260904022136) : même définition rendue

delete from supabase_migrations.schema_migrations where version = '20261015130353';
