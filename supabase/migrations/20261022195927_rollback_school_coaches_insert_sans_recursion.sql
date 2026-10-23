-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK du correctif school_coaches (20261022195319_school_coaches_insert_sans_recursion.sql).
-- ⚠️ APPLIQUÉ en prod 20261022195927 (19:59:27 UTC) — incident §101 : le correctif ouvrait
--   school_coaches à tout compte connecté. Rangé dans migrations/ (et non rollback/) parce que la
--   prod l'a enregistré comme migration : la pile locale reproduit ainsi la prod (policy qui boucle).
-- Remet le with_check d'origine de « Coaches insert school_coaches » À L'OCTET
-- (md5 75fa4edc9dc17d0008ec1e88d9146c66 — celui qui provoque la récursion 42P17) et
-- supprime coach_dirige_ecole(uuid). Aucune autre policy touchée.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.coach_dirige_ecole(uuid)') is null then
    raise exception 'NEXUS: correctif school_coaches absent — rien à défaire';
  end if;
end $$;

create temp table _scr_polices_avant as
select tablename, policyname, cmd, permissive, roles::text as roles,
       md5(coalesce(qual, '')) as q, md5(coalesce(with_check, '')) as w
  from pg_policies
 where schemaname = 'public'
   and not (tablename = 'school_coaches' and policyname = 'Coaches insert school_coaches');

alter policy "Coaches insert school_coaches" on public.school_coaches
  with check (
    (coach_id = (select auth.uid()))
    or (exists (select 1
                  from school_coaches sc_dir
                 where ((sc_dir.coach_id = (select auth.uid()))
                        and (sc_dir.school_id = school_coaches.school_id)
                        and (sc_dir.role = any (array['DIRECTEUR'::coach_school_role, 'DIRECTEUR_INTERIM'::coach_school_role]))))));

drop function public.coach_dirige_ecole(uuid);

do $$
declare n int;
begin
  if (select md5(with_check) from pg_policies
       where schemaname = 'public' and tablename = 'school_coaches'
         and policyname = 'Coaches insert school_coaches' and cmd = 'INSERT')
     is distinct from '75fa4edc9dc17d0008ec1e88d9146c66' then
    raise exception 'NEXUS: with_check pas revenu à l''octet (md5 attendu 75fa4edc9dc17d0008ec1e88d9146c66)';
  end if;
  if to_regprocedure('public.coach_dirige_ecole(uuid)') is not null then
    raise exception 'NEXUS: coach_dirige_ecole encore présente';
  end if;
  select count(*) into n
    from _scr_polices_avant a
    left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tablename and p.policyname = a.policyname
   where p.policyname is null or p.cmd <> a.cmd or p.permissive <> a.permissive or p.roles::text <> a.roles
      or md5(coalesce(p.qual, '')) <> a.q or md5(coalesce(p.with_check, '')) <> a.w;
  if n <> 0 then raise exception 'NEXUS: % autre(s) policy(ies) modifiée(s) par le rollback', n; end if;
end $$;

drop table _scr_polices_avant;
