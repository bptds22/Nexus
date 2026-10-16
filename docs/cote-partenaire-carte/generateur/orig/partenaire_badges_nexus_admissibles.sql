CREATE OR REPLACE FUNCTION public.partenaire_badges_nexus_admissibles(p_athlete_id uuid)
 RETURNS TABLE(badge_id uuid, code text, libelle text, famille text, deja_par text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_sport  uuid;
  v_mp     uuid;
begin
  select a.sport_id into v_sport from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    select mp.id into v_mp from public.media_partners mp where mp.user_id = auth.uid();
    if v_mp is null or not public.partenaire_peut_evaluer(v_mp, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  return query
  select b.id, b.code, b.libelle, b.famille,
         case
           when exists (select 1 from public.athlete_badges ab
                         where ab.athlete_id = p_athlete_id and ab.badge_id = b.id and ab.retire_le is null)
             then 'son coach'
           else (select coalesce(mp.organization_name, 'un partenaire')
                   from public.partner_athlete_badges x
                   join public.media_partners mp on mp.id = x.partner_id
                  where x.athlete_id = p_athlete_id and x.badge_id = b.id and x.retire_le is null
                  limit 1)
         end
    from public.badges b
   where b.actif
     and b.famille in ('universel', 'sport')
     and not b.requiert_contexte
     and (b.famille = 'universel'
          or exists (select 1 from public.badge_sports bs where bs.badge_id = b.id and bs.sport_id = v_sport))
   order by case b.famille when 'universel' then 0 else 1 end, b.ordre, b.libelle;
end $function$

