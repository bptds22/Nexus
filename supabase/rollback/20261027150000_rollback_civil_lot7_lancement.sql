-- Rollback de 20261027150000_civil_lot7_lancement : retire le verrou et l'interrupteur.
-- Sans le verrou, une équipe importée redevient joignable par tous les chemins : à ne jouer
-- que si les lots 3 à 5 ne sont PAS en prod, ou après les avoir annulés.
do $garde$
begin
  if to_regprocedure('public.verrou_lancement_civil()') is null then
    raise exception 'NEXUS: 20261027150000 absente, rien à annuler';
  end if;
end $garde$;

drop trigger trg_verrou_lancement_civil on public.team_athletes;
drop trigger trg_verrou_lancement_civil on public.team_coaches;
drop function public.verrou_lancement_civil();
drop function public.lancement_civil_actif();
delete from public.app_settings where key = 'lancement_civil';

do $garde$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil')
     or to_regprocedure('public.lancement_civil_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: lot 7 civil annulé (verrou et interrupteur retirés)';
end $garde$;
