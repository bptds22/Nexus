-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN_OPERATIONS — le registre des opérations d'admin plateforme faites à la
-- main en base (décision BP 2026-10-01).
--
-- Une ligne par opération : déménagement de comptes, suppression d'un compte
-- de test, remise à zéro… avec le motif, le détail (comptes par table, ids,
-- sauvegardes) et l'admin qui l'a demandée.
--
--   · SERVEUR SEULEMENT : RLS active, aucune policy, aucun droit pour anon ni
--     authenticated (lecture par l'admin en SQL, comme rapprochement_file) ;
--   · EN AJOUT SEULEMENT : un trigger refuse toute modification et toute
--     suppression — un registre d'audit ne se réécrit pas ;
--   · `par` → users ON DELETE SET NULL : la ligne survit au départ de l'admin.
--
-- ADDITIVE : une table, une fonction, un trigger. Rien d'existant touché.
-- Rollback : supabase/rollback/20261001152154_rollback_admin_operations.sql
-- ════════════════════════════════════════════════════════════════════════════

create table public.admin_operations (
  id        uuid primary key default gen_random_uuid(),
  operation text not null check (operation ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  motif     text not null check (char_length(btrim(motif)) between 3 and 500),
  details   jsonb not null default '{}'::jsonb,
  par       uuid references public.users(id) on delete set null,
  le        timestamptz not null default now()
);
create index admin_operations_le_idx on public.admin_operations (le desc);
comment on table public.admin_operations is
  'Registre des opérations d''admin plateforme faites en base (déménagement, suppression de compte de test…). Serveur seulement, en ajout seulement.';

alter table public.admin_operations enable row level security;
revoke all on public.admin_operations from public, anon, authenticated;

create function public.admin_operations_immuable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'NEXUS: admin_operations est en ajout seulement (% refusé)', tg_op using errcode = '42501';
end $$;
revoke all on function public.admin_operations_immuable() from public, anon, authenticated;

create trigger trg_admin_operations_immuable before update or delete on public.admin_operations
  for each row execute function public.admin_operations_immuable();

-- GATES — listes complètes.
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_class c, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.admin_operations'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de admin_operations = %, attendu {postgres,service_role}', vus;
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc p, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(p.proacl::text[]) as x) t
   where p.oid = 'public.admin_operations_immuable()'::regprocedure;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de admin_operations_immuable = %, attendu {postgres,service_role}', vus;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.admin_operations'::regclass) then
    raise exception 'NEXUS: RLS absente sur admin_operations';
  end if;
  if exists (select 1 from pg_policy where polrelid = 'public.admin_operations'::regclass) then
    raise exception 'NEXUS: admin_operations ne doit porter aucune policy';
  end if;
end $$;
