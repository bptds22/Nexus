-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a. Migration 4/5 : lecture identité enfant.
--
-- Décision produit (Option B) : PAS de policy SELECT large sur athletes.
-- L'identité passe par un RPC SECURITY DEFINER colonne-restreint → garantit
-- « pas tout le profil » au niveau DB (une policy RLS ne peut pas borner les
-- colonnes). Colonnes exposées : first_name, last_name, photo_url, sport, école.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_my_children()
returns table (
  athlete_id uuid,
  first_name text,
  last_name  text,
  photo_url  text,
  sport      text,
  school     text
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select a.id, a.first_name, a.last_name, a.photo_url,
         s.nom  as sport,
         sc.name as school
  from public.athletes a
  left join public.sports  s  on s.id  = a.sport_id
  left join public.schools sc on sc.id = a.school_id
  where public.is_parent_of(a.id);
$$;

grant execute on function public.get_my_children() to authenticated;
