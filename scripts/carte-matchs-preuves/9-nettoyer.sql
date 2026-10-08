-- Nettoyage des fixtures LOCALES de la carte des matchs (lot A) :
-- cartes « Cmatchs », l'athlète masqué fictif et son suivi, et les
-- coordonnées TEMPORAIRES du cégep de preuve (remises à vide).
begin;
delete from public.cartes_prospect_invitations where carte_id in (select id from public.cartes_prospect where nom = 'Cmatchs');
delete from public.rapprochements where carte_id in (select id from public.cartes_prospect where nom = 'Cmatchs')
   or athlete_id = '77770000-0000-0000-0000-0000000000c1';
delete from public.cartes_prospect where nom = 'Cmatchs';
-- Lot A+ : athlètes « Cprofils ».
delete from public.recruiter_pipeline where athlete_id in (select id from public.athletes where last_name = 'Cprofils');
delete from public.recruiter_athlete_views where athlete_id in (select id from public.athletes where last_name = 'Cprofils');
delete from public.team_athletes where athlete_id in (select id from public.athletes where last_name = 'Cprofils');
delete from public.athletes where last_name = 'Cprofils';
delete from public.games where id = '77770000-0000-0000-0000-0000000000d1';
delete from public.recruiter_pipeline where athlete_id = '77770000-0000-0000-0000-0000000000c1';
delete from public.team_athletes where athlete_id = '77770000-0000-0000-0000-0000000000c1';
delete from public.athletes where id = '77770000-0000-0000-0000-0000000000c1';
update public.schools set lat = null, lng = null
 where id = '11111111-0000-0000-0000-000000000001' and lat = 45.5017 and lng = -73.5673;
-- Étape 2 : coordonnées TEMPORAIRES de 3 cégeps locaux (preuve « Trouve ton cégep »).
do $$ begin
  if to_regclass('public._cmatchs_coords_tmp') is not null then
    update public.schools s set lat = null, lng = null from public._cmatchs_coords_tmp t where s.id = t.id;
    drop table public._cmatchs_coords_tmp;
  end if;
end $$;
commit;
