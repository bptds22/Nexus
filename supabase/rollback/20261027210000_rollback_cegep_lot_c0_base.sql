-- Rollback de 20261027210000_cegep_lot_c0_base : rend les écritures recruteur collégial → cégépien
-- (failles A/B/C rouvertes), retire l'interrupteur et le verrou. is_athlete_contactable reprend son
-- corps prod du 2026-10-27 (md5 fe2ea3e9…, vérifié). À ne jouer que si aucun cégépien ne peut être
-- inscrit pendant que la porte est rouverte.
do $garde$
begin
  if to_regprocedure('public.compte_voit_cegepiens(uuid)') is null then
    raise exception 'NEXUS: 20261027210000 absente, rien à annuler';
  end if;
end $garde$;

drop policy cegepiens_ecriture_recruteurs on public.recruiter_favorites;
drop policy cegepiens_ecriture_recruteurs on public.recruiter_pipeline;
drop policy cegepiens_ecriture_recruteurs on public.conversations;

create or replace function public.is_athlete_contactable(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select not public.is_messaging_blacked_out(p_athlete);
$function$;

drop trigger trg_verrou_lancement_collegial on public.athletes;
drop trigger trg_verrou_lancement_collegial on public.team_athletes;
drop function public.verrou_lancement_collegial();
drop function public.lancement_collegial_actif();
drop function public.compte_voit_cegepiens(uuid);
delete from public.app_settings where key = 'lancement_collegial';

do $garde$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.is_athlete_contactable(uuid)'::regprocedure)
     is distinct from 'fe2ea3e93c6ed4036d249b7d406d3e56' then
    raise exception 'NEXUS: is_athlete_contactable n''a pas retrouvé son corps prod';
  end if;
  if exists (select 1 from pg_policies where policyname = 'cegepiens_ecriture_recruteurs')
     or exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_collegial')
     or to_regprocedure('public.lancement_collegial_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_collegial') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: lot C0 cégep annulé';
end $garde$;
