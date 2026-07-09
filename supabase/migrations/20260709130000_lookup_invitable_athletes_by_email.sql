-- lookup_invitable_athletes_by_email : point d'entrée unique du CTA "Inviter
-- par courriel". 3 états par match email (préfixe) :
--   1. INVITABLE — mes orphelins sans compte (email de claim) OU comptes sans
--      coach, civil OU scolaire (team invite) → PII (nom/sport/email) + has_account.
--   2. EXISTE MAIS NON-INVITABLE — rattaché à un coach (le mien ou un autre), OU
--      orphelin sans coach ni compte → flag SEUL, ZÉRO PII (Loi 25 : ne jamais
--      exposer nom/équipe/sport d'un mineur rattaché à un autre coach).
--   3. INEXISTANT — aucune ligne.
-- Gardes : is_coach() (keyée auth.uid()), length >= 4, LIMIT (anti-énumération).

create or replace function public.lookup_invitable_athletes_by_email(p_prefix text)
returns table(
  athlete_id           uuid,
  email                text,
  first_name           text,
  last_name            text,
  sport_name           text,
  has_account          boolean,
  exists_not_invitable boolean
)
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
  -- Garde longueur : anti-énumération.
  if length(v_prefix) < 4 then
    return;
  end if;

  return query
  -- Bucket 1 : MES orphelins sans compte → invitable (email de claim).
  ( select a.id, a.email, a.first_name, a.last_name, sp.nom, false, false
    from public.athletes a
    left join public.sports sp on sp.id = a.sport_id
    where a.coach_id = v_caller
      and a.user_id is null
      and a.email is not null
      and lower(a.email) like v_prefix || '%'
    order by a.email
    limit 3 )

  union all
  -- Bucket 2 : comptes SANS coach (civil OU scolaire) → invitable (team invite).
  ( select a.id, u.email, a.first_name, a.last_name, sp.nom, true, false
    from public.users u
    join public.athletes a on a.user_id = u.id
    left join public.sports sp on sp.id = a.sport_id
    where u.role = 'ATHLETE'
      and a.coach_id is null
      and u.email ilike v_prefix || '%'
    order by u.email
    limit 3 )

  union all
  -- Bucket 3 : existe mais NON-invitable → FLAG SEUL, AUCUNE PII. Une seule
  -- ligne (existence uniquement). Couvre les rattachés (coach_id NOT NULL) ET
  -- les orphelins sans coach ni compte. Exclusions NULL-safe (coalesce) pour
  -- ne pas ré-inclure les buckets 1/2.
  ( select null::uuid, null::text, null::text, null::text, null::text, null::boolean, true
    where exists (
      select 1
      from public.athletes a
      left join public.users u on u.id = a.user_id
      where lower(coalesce(a.email, u.email)) like v_prefix || '%'
        and not coalesce(a.coach_id = v_caller and a.user_id is null, false)  -- pas bucket 1
        and not (a.coach_id is null and a.user_id is not null)                -- pas bucket 2
    ) );
end;
$function$;

grant execute on function public.lookup_invitable_athletes_by_email(text) to authenticated;
