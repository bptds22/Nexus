-- Lot D5a cégep, étape 2 — programmes d'études universitaires (décisions BP 2026-10-28 : Q2 nom, cycle, faculté et
-- lien facultatifs ; pré-remplis depuis le site officiel de chaque université, premier cycle seulement ; ensuite
-- l'université ajoute, retire et modifie elle-même).
-- Table dédiée : school_programs reste le domaine des DEC (type préuniversitaire / technique, code MEQ, catalogue).
--   1. public.university_programs : école UNIVERSITÉ seulement (déclencheur), cycle baccalauréat ou certificat,
--      faculté et lien facultatifs (lien en https), source 'seed' (pré-remplissage, avec son URL) ou 'manuel'.
--   2. Lecture : l'admin, et le recruteur universitaire de SA université sous ON (nexus_prive.mon_universite()).
--      La page publique lira par la clé service (D5b). Rien pour anon.
--   3. Écriture : can_edit_school_page(school_id) (D5a étape 1 : admin, ou le recruteur universitaire de sa page
--      sous ON), par la RPC transactionnelle replace_university_programs, sur le modèle de replace_school_programs.
--      Une ligne pré-remplie que l'université modifie devient 'manuel'.

create table public.university_programs (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 200),
  cycle        text not null check (cycle in ('baccalaureat', 'certificat')),
  faculte      text check (faculte is null or length(btrim(faculte)) between 1 and 150),
  lien         text check (lien is null or (lien ~ '^https://' and length(lien) <= 500)),
  is_displayed boolean not null default true,
  position     integer not null default 0,
  source       text not null default 'manuel' check (source in ('seed', 'manuel')),
  source_url   text check (source_url is null or length(source_url) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index university_programs_unique on public.university_programs (school_id, lower(btrim(name)), cycle);
create index university_programs_school on public.university_programs (school_id, position);

create function nexus_prive.university_programs_ecole_universite() returns trigger
  language plpgsql security definer set search_path = public set row_security = off
as $function$
begin
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
    raise exception 'NEXUS: un programme universitaire doit appartenir à une université' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $function$;
revoke all on function nexus_prive.university_programs_ecole_universite() from public, anon, authenticated;
create trigger university_programs_ecole_universite before insert or update on public.university_programs
  for each row execute function nexus_prive.university_programs_ecole_universite();

alter table public.university_programs enable row level security;
revoke all on public.university_programs from anon, authenticated;
grant select, insert, update, delete on public.university_programs to authenticated;
grant all on public.university_programs to service_role;

create policy university_programs_read on public.university_programs for select to authenticated
  using ((select public.is_admin()) or school_id = (select nexus_prive.mon_universite()));
create policy university_programs_write on public.university_programs for all to authenticated
  using (public.can_edit_school_page(school_id))
  with check (public.can_edit_school_page(school_id));

-- Remplacement atomique de la liste d'une université. p_rows : [{id?, name, cycle, faculte?, lien?, is_displayed?}]
-- dans l'ordre d'affichage. Ligne avec id = conservée (modifiée si son contenu change) ; sans id = ajout manuel ;
-- absente = retirée.
create function public.replace_university_programs(p_school_id uuid, p_rows jsonb, p_autoriser_vide boolean default false)
  returns integer
  language plpgsql
  set search_path = public
as $function$
declare
  v_garde uuid[];
  v_n     integer;
begin
  if p_school_id is null then
    raise exception 'NEXUS: Aucune université ciblée — rien n''a été modifié.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'NEXUS: Liste de programmes illisible — rien n''a été modifié.';
  end if;
  if not public.can_edit_school_page(p_school_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette université.' using errcode = '42501';
  end if;
  if jsonb_array_length(p_rows) > 800 then
    raise exception 'NEXUS: Trop de programmes (800 au plus) — rien n''a été modifié.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r
              where coalesce(btrim(r->>'name'), '') = '' or coalesce(r->>'cycle', '') not in ('baccalaureat', 'certificat')
                 or (nullif(btrim(r->>'lien'), '') is not null and btrim(r->>'lien') !~ '^https://')) then
    raise exception 'NEXUS: Chaque programme a besoin d''un nom, d''un cycle (baccalauréat ou certificat) et d''un lien en https:// s''il y en a un.';
  end if;
  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide
     and exists (select 1 from public.university_programs where school_id = p_school_id) then
    raise exception 'NEXUS: Aucun programme reçu — la liste n''a pas été effacée.';
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}') into v_garde
    from jsonb_array_elements(p_rows) r where r->>'id' is not null;

  delete from public.university_programs where school_id = p_school_id and id <> all (v_garde);

  update public.university_programs up
     set name = btrim(r->>'name'),
         cycle = r->>'cycle',
         faculte = nullif(btrim(r->>'faculte'), ''),
         lien = nullif(btrim(r->>'lien'), ''),
         is_displayed = coalesce((r->>'is_displayed')::boolean, true),
         position = (i - 1)::int,
         source = case when (up.name, up.cycle, up.faculte, up.lien)
                            is distinct from (btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''))
                       then 'manuel' else up.source end
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where up.school_id = p_school_id and r->>'id' is not null and up.id = (r->>'id')::uuid;

  insert into public.university_programs (school_id, name, cycle, faculte, lien, is_displayed, position, source)
  select p_school_id, btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''),
         coalesce((r->>'is_displayed')::boolean, true), (i - 1)::int, 'manuel'
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where r->>'id' is null;

  select count(*) into v_n from public.university_programs where school_id = p_school_id;
  return v_n;
end $function$;
revoke all on function public.replace_university_programs(uuid, jsonb, boolean) from public, anon;
grant execute on function public.replace_university_programs(uuid, jsonb, boolean) to authenticated, service_role;
