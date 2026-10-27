-- Lot C0 cégep — met la base LOCALE dans l'état de la prod pour ce que C0 lit : les trois
-- fonctions-règles du lot A (texte exact de 20261026030400, md5 prod vérifiés à la fin) et un
-- cégépien témoin (un athlète local ACTIF, sans équipe, ancré à un cégep, comme le témoin prod).
-- LOCAL SEULEMENT : refuse de tourner sur la prod. Écrit en base locale, et y reste.
\set ON_ERROR_STOP 1
do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — alignement local refusé';
  end if;
end $$;
begin;
do $a$
begin
  if to_regprocedure('public.unite_voit_cegepiens(uuid)') is null then
    execute $f$
create function public.unite_voit_cegepiens(p_ecole uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.schools s
                  where s.id = p_ecole and s.type::text = 'UNIVERSITE')
$$;$f$;
  end if;
  if to_regprocedure('public.athlete_est_cegepien(uuid)') is null then
    execute $f$
create function public.athlete_est_cegepien(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.athletes a
                   join public.schools s on s.id = a.school_id
                  where a.id = p_athlete and s.type::text = 'CEGEP')
$$;$f$;
  end if;
  if to_regprocedure('public.peut_voir_cegepiens()') is null then
    execute $f$
create function public.peut_voir_cegepiens()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.is_admin()
      or exists (select 1 from public.users u
                  where u.id = auth.uid()
                    and (u.role = 'PARTNER'::public.user_role
                         or (u.role = 'RECRUTEUR'::public.user_role
                             and public.unite_voit_cegepiens(u.school_id))))
$$;$f$;
  end if;
end $a$;
revoke all on function public.athlete_est_cegepien(uuid) from public, anon, authenticated;
revoke all on function public.peut_voir_cegepiens()      from public, anon, authenticated;
revoke all on function public.unite_voit_cegepiens(uuid) from public, anon, authenticated;
grant execute on function public.athlete_est_cegepien(uuid) to authenticated, service_role;
grant execute on function public.peut_voir_cegepiens()      to authenticated, service_role;
grant execute on function public.unite_voit_cegepiens(uuid) to service_role;

-- Le cégépien témoin local (s'il n'y en a pas déjà un HORS période d'interdiction des messages :
-- sinon le fil direct ne peut pas être éprouvé).
update public.athletes a
   set school_id = (select s.id from public.schools s where s.type::text = 'CEGEP' order by s.name limit 1)
 where a.id = (select a2.id from public.athletes a2
                where a2.status = 'ACTIF'
                  and not exists (select 1 from public.team_athletes ta where ta.athlete_id = a2.id)
                  and not public.is_messaging_blacked_out(a2.id)
                  and not public.athlete_est_cegepien(a2.id)
                order by a2.id desc limit 1)
   and not exists (select 1 from public.athletes x join public.schools s on s.id = x.school_id
                    where s.type::text = 'CEGEP' and x.status = 'ACTIF' and not public.is_messaging_blacked_out(x.id));

do $$
begin
  if (select string_agg(md5(prosrc), ',' order by proname) from pg_proc
       where proname in ('athlete_est_cegepien', 'peut_voir_cegepiens', 'unite_voit_cegepiens')
         and pronamespace = 'public'::regnamespace)
     is distinct from '3cd1745052266b3f187dba02ed77d16b,65353c9fbd5a0780cd9de0593c5f04be,1a5be0be556789bfd3874e571231fc0a' then
    raise exception 'NEXUS: fonctions-règles locales ≠ prod';
  end if;
end $$;
select 'cégépiens ACTIF locaux : ' || count(*) from public.athletes a join public.schools s on s.id = a.school_id
 where s.type::text = 'CEGEP' and a.status = 'ACTIF';
commit;
