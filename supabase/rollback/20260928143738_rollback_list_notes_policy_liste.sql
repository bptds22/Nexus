-- Rollback de 20260928143738_list_notes_policy_liste (registre §41 ; écrite 20260928150000).
-- Remet la policy FOR ALL d'origine, à l'identique (PUBLIC, recruiter_id =
-- auth.uid() en using et en check), retire les quatre policies et la fonction.
-- ⚠️ Rouvre le trou §41 : un recruteur d'un autre cégep peut de nouveau écrire
-- une note dans la liste d'une unité dont il connaît l'id.

create temp table _acl_avant on commit drop as
  select relacl::text as acl from pg_class where oid = 'public.recruiter_list_notes'::regclass;

drop policy list_notes_select on public.recruiter_list_notes;
drop policy list_notes_insert on public.recruiter_list_notes;
drop policy list_notes_update on public.recruiter_list_notes;
drop policy list_notes_delete on public.recruiter_list_notes;

create policy "Recruiters manage their own list notes" on public.recruiter_list_notes
  using (recruiter_id = (select auth.uid()))
  with check (recruiter_id = (select auth.uid()));

drop function public.liste_ouverte_a_moi(uuid);

do $$
declare
  vus text[];
  veut text[] := array['Recruiters manage their own list notes','unite_delete','unite_select','unite_update'];
begin
  select array_agg(polname::text order by polname::text) into vus
    from pg_policy where polrelid = 'public.recruiter_list_notes'::regclass;
  if vus is distinct from veut then
    raise exception 'NEXUS: policies après rollback = %, attendu %', vus, veut;
  end if;
  if (select acl from _acl_avant) is distinct from
     (select relacl::text from pg_class where oid = 'public.recruiter_list_notes'::regclass) then
    raise exception 'NEXUS: ACL de recruiter_list_notes modifiée par le rollback';
  end if;
  if exists (select 1 from pg_proc where proname = 'liste_ouverte_a_moi') then
    raise exception 'NEXUS: liste_ouverte_a_moi existe encore';
  end if;
end $$;
