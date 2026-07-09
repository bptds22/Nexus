-- lookup_my_orphans_by_email : autocomplete des orphelins DU coach appelant,
-- par préfixe email.
--
-- Cible : les orphelins que LE coach a créés et qui n'ont PAS encore réclamé
-- leur compte (coach_id = auth.uid() AND user_id IS NULL). C'est exactement la
-- population que create_athlete_invitation peut inviter par email.
--
-- Complément de lookup_civil_unclaimed_by_email (qui vise l'INVERSE : athlètes
-- AVEC compte SANS coach → team_invitations in-app). Les deux ensembles sont
-- disjoints ; le CTA/wizard interrogent les deux et routent par présence de compte.
--
-- Mêmes gardes que le lookup existant : is_coach() (keyée auth.uid(), jamais le
-- definer), min 4 chars + LIMIT 3 (anti-énumération), colonnes minimales
-- (AUCUNE PII : ni DOB, ni parent, ni téléphone).

create or replace function public.lookup_my_orphans_by_email(p_prefix text)
returns table(athlete_id uuid, email text, first_name text, last_name text, sport_name text)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
declare
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
  v_caller uuid := auth.uid();
begin
  -- Garde rôle : seuls les coachs (auth.uid() = appelant, jamais le definer).
  if not public.is_coach() then
    return;
  end if;
  -- Garde longueur : anti-énumération (miroir du minimum côté TS).
  if length(v_prefix) < 4 then
    return;
  end if;

  return query
  select a.id, a.email, a.first_name, a.last_name, sp.nom
  from public.athletes a
  left join public.sports sp on sp.id = a.sport_id
  where a.coach_id = v_caller        -- MES orphelins uniquement
    and a.user_id is null            -- pas encore réclamés (invitables par email)
    and a.email is not null
    and lower(a.email) like v_prefix || '%'
  order by a.email
  limit 3;
end;
$function$;

grant execute on function public.lookup_my_orphans_by_email(text) to authenticated;
