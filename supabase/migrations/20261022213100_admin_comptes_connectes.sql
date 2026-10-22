-- ════════════════════════════════════════════════════════════════════════════
-- admin_comptes_connectes(p_de, p_a) : comptes connectés dans une fenêtre, par
-- rôle — DES NOMBRES SEULEMENT (décision BP, 2026-10-22 — QG admin, lot 1)
--
-- Source : auth.users.last_sign_in_at (la DERNIÈRE connexion du compte).
-- Rôle : public.users.role ; un compte auth sans ligne public.users compte
-- sous « SANS_ROLE ». Fenêtre demi-ouverte [p_de, p_a).
--
-- Rendu : {"total": n, "par_role": {"ATHLETE": n, "COACH": n, …}} — aucune
-- ligne de personne, aucun identifiant, aucun courriel.
--
-- Accès : SECURITY DEFINER, search_path fixé, réservé à is_admin() (sinon
-- exception). EXECUTE à authenticated (la garde is_admin() trie) et
-- service_role ; anon et PUBLIC révoqués — y compris ce que les default
-- privileges de Supabase accordent à la création.
--
-- ADDITIVE : fonction nouvelle, rien d'autre ne change.
-- Rollback : supabase/rollback/20261022213100_rollback_admin_comptes_connectes.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.admin_comptes_connectes(timestamptz, timestamptz)') is not null then
    raise exception 'NEXUS: 20261022213100 déjà appliquée';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'NEXUS: is_admin() manque';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc where oid = 'public.is_admin()'::regprocedure)
     is distinct from '02d64a24902204adf8a9a79a71c4fdc8' then
    raise exception 'NEXUS: is_admin() a changé — relire sa définition avant d''appliquer';
  end if;
end $$;

create function public.admin_comptes_connectes(p_de timestamptz, p_a timestamptz)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin';
  end if;
  if p_de is null or p_a is null or p_a <= p_de then
    raise exception 'NEXUS: fenêtre invalide';
  end if;
  select jsonb_build_object(
    'total',    coalesce(sum(n), 0),
    'par_role', coalesce(jsonb_object_agg(r, n), '{}'::jsonb)
  ) into v
  from (
    select coalesce(pu.role::text, 'SANS_ROLE') as r, count(*) as n
      from auth.users au
      left join public.users pu on pu.id = au.id
     where au.last_sign_in_at >= p_de
       and au.last_sign_in_at <  p_a
     group by 1
  ) t;
  return v;
end $$;

comment on function public.admin_comptes_connectes(timestamptz, timestamptz) is
  'QG admin : comptes dont la dernière connexion (auth.users.last_sign_in_at) tombe dans [p_de, p_a), par rôle. Nombres seulement. Réservé à is_admin().';

revoke all on function public.admin_comptes_connectes(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_comptes_connectes(timestamptz, timestamptz) to authenticated, service_role;

-- ── Garde d'après : ACL complète, jamais par inclusion ──────────────────────
do $$
declare
  vus text[];
  f   oid := 'public.admin_comptes_connectes(timestamptz, timestamptz)'::regprocedure;
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL admin_comptes_connectes = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = f)
     or (select proconfig from pg_proc where oid = f) is distinct from array['search_path=public', 'row_security=off'] then
    raise exception 'NEXUS: admin_comptes_connectes doit être SECURITY DEFINER avec search_path=public';
  end if;
end $$;
