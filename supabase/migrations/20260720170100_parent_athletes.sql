-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a. Migration 2/5 : liaison parent→athlète 1:1
-- + helper anti-récursion is_parent_of().
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.parent_athletes (
  id              uuid primary key default gen_random_uuid(),
  parent_user_id  uuid not null references public.users(id)    on delete cascade,
  athlete_id      uuid not null references public.athletes(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (athlete_id)   -- UN (1) parent par athlète — décision produit ferme.
);
create index if not exists idx_parent_athletes_parent
  on public.parent_athletes(parent_user_id);

alter table public.parent_athletes enable row level security;

-- Le parent lit UNIQUEMENT sa propre ligne de liaison.
drop policy if exists "parent reads own link" on public.parent_athletes;
create policy "parent reads own link" on public.parent_athletes
  for select using (parent_user_id = auth.uid());

-- Admin lecture (cohérent avec le reste du schéma).
drop policy if exists "admins read parent_athletes" on public.parent_athletes;
create policy "admins read parent_athletes" on public.parent_athletes
  for select using (public.is_admin());

-- PAS de policy INSERT/UPDATE/DELETE : l'écriture passe UNIQUEMENT par le RPC
-- SECURITY DEFINER claim_parent_invitation() (aucun insert client direct).

-- Helper anti-récursion — idiome existant (coach_can_manage_athlete / is_coach) :
-- SECURITY DEFINER + row_security=off pour lire parent_athletes sans re-déclencher
-- la RLS (évite les cycles athletes↔users corrigés par les migrations 20260516-0617).
create or replace function public.is_parent_of(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1 from public.parent_athletes pa
    where pa.athlete_id = p_athlete_id
      and pa.parent_user_id = auth.uid()
  );
$$;

grant execute on function public.is_parent_of(uuid) to authenticated;

-- GRANT explicite : la RLS gate les LIGNES, mais l'accès table exige le grant.
-- Le parent lit sa propre ligne (policy "parent reads own link"). Pas d'INSERT/
-- UPDATE/DELETE au client (écriture via RPC SECURITY DEFINER uniquement).
grant select on public.parent_athletes to authenticated;
