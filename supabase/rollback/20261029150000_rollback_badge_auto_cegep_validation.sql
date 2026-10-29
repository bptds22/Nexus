-- Rollback de 20261029150000_badge_auto_cegep_validation : corps C1b d'origine (md5 f987bdbe8ec4fadf9ff174364ce0635c) et dates du
-- rattrapage retirées (fiches auto_cegep dont la date vaut exactement verified_at, ce que pose aussi la
-- nouvelle fonction : une vérification faite entre l'apply et le rollback perd donc sa date, comme avant).

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from '69e278f765c30134b31f523a85477e7f' then
    raise exception 'NEXUS: verification_auto_cegep n''est pas le corps de 20261029150000';
  end if;
end $$;

create or replace function public.verification_auto_cegep()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Seul un NOUVEL ancrage est regardé, comme le verrou du lot C0 : une ligne qui garde son école
  -- passe telle quelle.
  if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
    return new;
  end if;
  if new.school_id is not null
     and exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP') then
    if not coalesce(new.verified, false) then
      new.verified := true;
      new.verification_method := 'auto_cegep';
      new.verified_at := now();
      new.verified_by := null;
    end if;
  elsif tg_op = 'UPDATE' and old.verification_method = 'auto_cegep' then
    -- Le crochet ne valait que pour le cégep : il ne suit pas l'athlète ailleurs.
    new.verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$function$;

update public.athletes
   set last_profile_validation = null
 where verification_method = 'auto_cegep'
   and last_profile_validation = verified_at;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from 'f987bdbe8ec4fadf9ff174364ce0635c' then
    raise exception 'NEXUS: corps C1b non restauré';
  end if;
end $$;
