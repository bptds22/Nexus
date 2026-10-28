-- Lot E3 cégep — cycle libre des programmes universitaires (retour du test de bout en bout de BP, 2026-10-28 : A3 ;
-- Q2 : liste fermée baccalauréat, certificat, maîtrise, doctorat, plus « autre » avec un texte libre).
--   1. university_programs.cycle : 'baccalaureat', 'certificat', 'maitrise', 'doctorat' ou 'autre' ; nouvelle colonne
--      cycle_libelle (1 à 60 caractères), OBLIGATOIRE pour 'autre' et INTERDITE sinon (contrainte).
--   2. replace_university_programs : accepte et contrôle les nouveaux cycles et cycle_libelle ; une ligne pré-remplie
--      dont le cycle ou le libellé change devient 'manuel', comme pour le nom.
-- Les lignes pré-remplies (baccalauréat, certificat) restent valides. Lecture et écriture : policies D5a / E1
-- inchangées. Corps de départ de la RPC gardé par md5.

do $garde$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> 'd358ffa4b42ff57b85f59b80f8a8c8cc' then
    raise exception 'NEXUS: E3 — replace_university_programs a changé depuis le relevé ; régénérer';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'university_programs_cycle_check'))
       <> 'CHECK ((cycle = ANY (ARRAY[''baccalaureat''::text, ''certificat''::text])))' then
    raise exception 'NEXUS: E3 — la contrainte de cycle a changé ; relire';
  end if;
end $garde$;

alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre')),
  add column cycle_libelle text,
  add constraint university_programs_cycle_libelle_check check (
    (cycle = 'autre') = (cycle_libelle is not null)
    and (cycle_libelle is null or length(btrim(cycle_libelle)) between 1 and 60));

create or replace function public.replace_university_programs(p_school_id uuid, p_rows jsonb, p_autoriser_vide boolean default false)
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
              where coalesce(btrim(r->>'name'), '') = ''
                 or coalesce(r->>'cycle', '') not in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre')
                 or ((r->>'cycle') = 'autre') is distinct from (nullif(btrim(r->>'cycle_libelle'), '') is not null)
                 or length(btrim(coalesce(r->>'cycle_libelle', ''))) > 60
                 or (nullif(btrim(r->>'lien'), '') is not null and btrim(r->>'lien') !~ '^https://')) then
    raise exception 'NEXUS: Chaque programme a besoin d''un nom, d''un cycle (baccalauréat, certificat, maîtrise, doctorat, ou « autre » avec son libellé) et d''un lien en https:// s''il y en a un.';
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
         cycle_libelle = nullif(btrim(r->>'cycle_libelle'), ''),
         faculte = nullif(btrim(r->>'faculte'), ''),
         lien = nullif(btrim(r->>'lien'), ''),
         is_displayed = coalesce((r->>'is_displayed')::boolean, true),
         position = (i - 1)::int,
         source = case when (up.name, up.cycle, up.cycle_libelle, up.faculte, up.lien)
                            is distinct from (btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'cycle_libelle'), ''),
                                              nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''))
                       then 'manuel' else up.source end
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where up.school_id = p_school_id and r->>'id' is not null and up.id = (r->>'id')::uuid;

  insert into public.university_programs (school_id, name, cycle, cycle_libelle, faculte, lien, is_displayed, position, source)
  select p_school_id, btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'cycle_libelle'), ''), nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''),
         coalesce((r->>'is_displayed')::boolean, true), (i - 1)::int, 'manuel'
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where r->>'id' is null;

  select count(*) into v_n from public.university_programs where school_id = p_school_id;
  return v_n;
end $function$;
