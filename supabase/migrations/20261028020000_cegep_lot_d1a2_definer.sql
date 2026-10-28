-- Lot D1a2 cégep — les fonctions SECURITY DEFINER ne rendent rien d'universitaire.
-- Audit du 2026-10-28 (docs/cegep-lot-d/D1-AUDIT-DEFINER.md) : aucune fonction DEFINER ne cherche les
-- universités d'elle-même, mais plusieurs affichent le nom de l'école ou de l'équipe pointée par une ligne
-- qu'un client écrit (carte prospect, engagement, invitation, jeton…). Il suffisait de connaître l'identifiant
-- d'une université, et public.ids_universites() (D1a) le donnait à tout le monde par /rpc.
--   1. ids_universites() quitte l'API : schéma nexus_prive, que ni PostgREST ni pg_graphql n'exposent. Les
--      policies universites_masquees la lisent là. Plus aucun client ne peut connaître l'id d'une université.
--   2. Verrou par référence : aucune ligne écrite par un client ne peut pointer une université ou une équipe
--      universitaire dans les colonnes que ces fonctions affichent. Admin et service (auth.uid() nul) exemptés.
--      D2 relâchera ce qui doit l'être pour le recruteur universitaire, sous lancement_universitaire.

create schema if not exists nexus_prive;
revoke all on schema nexus_prive from public;
grant usage on schema nexus_prive to anon, authenticated, service_role;

create function nexus_prive.ids_universites() returns uuid[]
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;
revoke all on function nexus_prive.ids_universites() from public;
grant execute on function nexus_prive.ids_universites() to anon, authenticated, service_role;

alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));

drop function public.ids_universites();

create function public.verrou_reference_universite() returns trigger
  language plpgsql security definer
  set search_path = public
as $function$
declare
  v_col text;
  v_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  foreach v_col in array tg_argv loop
    v_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_id is null
       or (tg_op = 'UPDATE' and (to_jsonb(old) ->> v_col)::uuid is not distinct from v_id) then
      continue;
    end if;
    if exists (select 1 from public.schools s where s.id = v_id and s.type = 'UNIVERSITE')
       or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                   where t.id = v_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$function$;
revoke all on function public.verrou_reference_universite() from public, anon, authenticated;

create trigger trg_verrou_reference_universite before insert or update of committed_school_id on public.athletes
  for each row execute function public.verrou_reference_universite('committed_school_id');
create trigger trg_verrou_reference_universite before insert or update of primary_team_id on public.users
  for each row execute function public.verrou_reference_universite('primary_team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id, team_id on public.cartes_prospect
  for each row execute function public.verrou_reference_universite('school_id', 'team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id, team_id on public.partenaire_prospects
  for each row execute function public.verrou_reference_universite('school_id', 'team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.commitment_requests
  for each row execute function public.verrou_reference_universite('school_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.invitations
  for each row execute function public.verrou_reference_universite('school_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_invitations
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_join_tokens
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_coaches
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.school_coaches
  for each row execute function public.verrou_reference_universite('school_id');
