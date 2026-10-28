-- Rollback du lot D1a2 cégep : retire le verrou par référence et remet ids_universites() dans public (état D1a).
drop trigger if exists trg_verrou_reference_universite on public.athletes;
drop trigger if exists trg_verrou_reference_universite on public.users;
drop trigger if exists trg_verrou_reference_universite on public.cartes_prospect;
drop trigger if exists trg_verrou_reference_universite on public.partenaire_prospects;
drop trigger if exists trg_verrou_reference_universite on public.commitment_requests;
drop trigger if exists trg_verrou_reference_universite on public.invitations;
drop trigger if exists trg_verrou_reference_universite on public.team_invitations;
drop trigger if exists trg_verrou_reference_universite on public.team_join_tokens;
drop trigger if exists trg_verrou_reference_universite on public.team_coaches;
drop trigger if exists trg_verrou_reference_universite on public.school_coaches;
drop function if exists public.verrou_reference_universite();

create function public.ids_universites() returns uuid[]
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;
revoke all on function public.ids_universites() from public;
grant execute on function public.ids_universites() to anon, authenticated, service_role;

alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or not (school_id = any ((select public.ids_universites())::uuid[])));

drop function nexus_prive.ids_universites();
drop schema nexus_prive;
