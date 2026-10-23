-- ════════════════════════════════════════════════════════════════════════════
-- Correctif — récursion RLS de school_coaches (42P17), décision BP 2026-10-22.
-- ⚠️ APPLIQUÉE PUIS ANNULÉE (incident §101, docs/fast-follow-1.4.2.md).
--   Prod : appliquée 20261022195319 (19:53:19 UTC), annulée par 20261022195927 (19:59:27 UTC).
--   La branche (α) laissait tout compte connecté s'insérer lui-même, y compris DIRECTEUR.
--   NE PAS RÉAPPLIQUER telle quelle. Conservée comme trace d'incident.
--
-- Symptôme (prod) : tout INSERT/UPSERT client dans school_coaches échoue en
--   42P17 infinite recursion detected in policy for relation "school_coaches".
-- Conséquence : sur le WEB, le coach SCOLAIRE est bloqué à l'étape École
-- (app/onboarding/page.tsx, upsert L582, erreur bloquante). Le mobile et les RPC
-- finish_coach_*_onboarding (SECURITY DEFINER, row_security off) ne sont pas touchés.
--
-- Cause : la policy « Coaches insert school_coaches » relit school_coaches dans un
-- EXISTS (branche « un directeur ajoute un coach », 20260512140000). Pour cette
-- relecture, Postgres développe les policies SELECT de school_coaches ; coach_read_own
-- y porte une sous-requête « ( SELECT auth.uid() ) » (posée hors migration, entre le
-- 2026-07-27 et le 2026-10-02) → Postgres redéveloppe school_coaches pendant qu'il
-- le développe déjà → 42P17.
--
-- Correctif : la relecture passe par une fonction SECURITY DEFINER (row_security off),
-- qui ne déclenche aucune policy. Même règle, mot pour mot :
--   (α) un coach s'insère lui-même ;
--   (β) un DIRECTEUR / DIRECTEUR_INTERIM de la même école insère un coach.
-- Seule la policy « Coaches insert school_coaches » change. Aucune autre.
--
-- Rollback : supabase/migrations/20261022195927_rollback_school_coaches_insert_sans_recursion.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes et relevé AVANT ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.coach_dirige_ecole(uuid)') is not null then
    raise exception 'NEXUS: 20261022193000 déjà appliquée (coach_dirige_ecole existe)';
  end if;
  if (select md5(with_check) from pg_policies
       where schemaname = 'public' and tablename = 'school_coaches'
         and policyname = 'Coaches insert school_coaches' and cmd = 'INSERT')
     is distinct from '75fa4edc9dc17d0008ec1e88d9146c66' then
    raise exception 'NEXUS: with_check de « Coaches insert school_coaches » n''est pas celui relevé en prod le 2026-10-22';
  end if;
end $$;

create temp table _sc_polices_avant as
select tablename, policyname, cmd, permissive, roles::text as roles,
       md5(coalesce(qual, '')) as q, md5(coalesce(with_check, '')) as w
  from pg_policies
 where schemaname = 'public'
   and not (tablename = 'school_coaches' and policyname = 'Coaches insert school_coaches');

-- ── 1. La fonction ─────────────────────────────────────────────────────────
create function public.coach_dirige_ecole(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $function$
  -- Vrai si l'appelant est DIRECTEUR ou DIRECTEUR_INTERIM de cette école (school_coaches).
  -- SECURITY DEFINER + row_security off : la relecture de school_coaches ne repasse pas
  -- par ses policies — c'est ce qui casse la récursion de « Coaches insert school_coaches ».
  select exists (
    select 1 from public.school_coaches sc
     where sc.coach_id = (select auth.uid())
       and sc.school_id = p_school_id
       and sc.role in ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  );
$function$;

comment on function public.coach_dirige_ecole(uuid) is
  'Vrai si l''appelant dirige (DIRECTEUR / DIRECTEUR_INTERIM) cette école. Utilisée par la policy « Coaches insert school_coaches » (sans récursion RLS).';

revoke all on function public.coach_dirige_ecole(uuid) from public, anon;
grant execute on function public.coach_dirige_ecole(uuid) to authenticated, service_role;

-- ── 2. La policy ───────────────────────────────────────────────────────────
alter policy "Coaches insert school_coaches" on public.school_coaches
  with check (coach_id = (select auth.uid()) or public.coach_dirige_ecole(school_id));

-- ── 3. Gates ───────────────────────────────────────────────────────────────
do $$
declare
  vus text[];
  n   int;
  wc  text;
begin
  -- ACL de la fonction : liste complète triée.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.coach_dirige_ecole(uuid)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de coach_dirige_ecole = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not exists (select 1 from pg_proc
                  where oid = 'public.coach_dirige_ecole(uuid)'::regprocedure
                    and prosecdef and provolatile = 's'
                    and proconfig @> array['search_path=public', 'row_security=off']) then
    raise exception 'NEXUS: coach_dirige_ecole mal réglée';
  end if;

  -- La policy corrigée : plus aucune relecture directe de school_coaches.
  select with_check into wc from pg_policies
   where schemaname = 'public' and tablename = 'school_coaches'
     and policyname = 'Coaches insert school_coaches' and cmd = 'INSERT'
     and roles::text = '{authenticated}' and permissive = 'PERMISSIVE';
  if wc is null or wc !~ 'coach_dirige_ecole\(school_id\)' or wc ~* 'from\s+school_coaches' then
    raise exception 'NEXUS: policy « Coaches insert school_coaches » inattendue après correctif : %', wc;
  end if;

  -- Toutes les autres policies : inchangées, ni retirées ni ajoutées.
  select count(*) into n
    from _sc_polices_avant a
    left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tablename and p.policyname = a.policyname
   where p.policyname is null or p.cmd <> a.cmd or p.permissive <> a.permissive or p.roles::text <> a.roles
      or md5(coalesce(p.qual, '')) <> a.q or md5(coalesce(p.with_check, '')) <> a.w;
  if n <> 0 then raise exception 'NEXUS: % autre(s) policy(ies) modifiée(s)', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public';
  if n <> (select count(*) from _sc_polices_avant) + 1 then
    raise exception 'NEXUS: nombre de policies inattendu (%)', n;
  end if;
end $$;

drop table _sc_polices_avant;
