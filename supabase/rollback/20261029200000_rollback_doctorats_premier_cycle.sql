-- Rollback des doctorats de premier cycle (20261029200000) : retire les 64 programmes pré-remplis du lot, remet la
-- contrainte de cycle et replace_university_programs du lot E3 (vérifié par md5). Refusé si un programme utilise
-- encore 'doctorat_1er_cycle' après le retrait (ajout ou modification par une université). Fichier GÉNÉRÉ.
delete from public.university_programs
 where source = 'seed' and cycle = 'doctorat_1er_cycle'
   and id in (
     'cf7bde35-6568-4de6-8384-c1e5efba210b',
     '281a4242-58a9-4775-8557-7d8c8a59bd2a',
     'a4aa0499-4b05-44cb-83d8-1abc2386d857',
     'd3b90a88-b038-4f08-8ffa-7b9dc7b3cd61',
     'e4464331-11a9-469a-8eea-b6f245f77fa7',
     '97f72542-957e-4c7a-8b7f-50121ca8f384',
     '26d19347-a0a6-49a1-8e62-a4bbbb83cac8',
     '6b0f3e32-8148-4ab3-8a89-75845cbc4ceb',
     'de823ac5-79d9-4e9f-8568-b0e978a446a2',
     '978ac75e-1175-4f44-84de-8a6e0bd2c187',
     '301c1f8d-9bcf-46ef-8c0b-95be9579247b',
     '9be1f4f9-1034-41ba-8f22-e563ca3d8b5e',
     '14fbec46-3701-4151-8c33-681a4d465b52',
     'bd030285-c850-4493-8ac0-cf6327e33a6f',
     '1b11df89-9b09-4a26-833f-1eccd7868a2f',
     'ada41df2-69c4-4dfb-8d30-e38212abf7e7',
     '479accf2-2ab2-4eed-860e-edb6949d6401',
     'c3d489e8-74d8-4c46-822a-4200b804beb5',
     '87e855e1-0571-4f4b-869f-f27f535809b4',
     'b8fae97d-cdd6-4728-88a6-a21f1f99c8cf',
     '165d0761-aa02-46dd-8e36-52ccffb173d5',
     'db3eca1c-9bf6-4652-8bed-3a32704280df',
     '75f1bd8f-571a-4ec3-8d93-dfab4d5ba7f1',
     'cc5a2c42-75a5-4fb8-863b-363d01335cbc',
     'dc51d648-7455-4070-8451-45452793ad45',
     '0db1b0a7-7f7d-4048-81f1-a14afe91715a',
     '6339d718-86d4-4e4d-8cde-2770437d6266',
     'cc80fe3e-ccc1-41c1-8e70-8c8a18640862',
     'ef5ef0d4-a2f1-4a74-8f2b-29d3d54ebc31',
     '2ba1b605-328d-4ba9-80c6-ea91b14529fa',
     'd7a00f2a-b086-4af4-8449-7f023b8449c0',
     '922eeb7c-1778-40f1-819e-7e1a652684c5',
     'b601be8f-eefa-4d62-832e-ffb804d5339e',
     '1423da5b-7ea8-43b1-8ec2-c7e4c7af4c59',
     '45923c95-cfc7-4451-851f-e1d7e18fd441',
     '09445c72-58e4-4228-89f8-89650166c16a',
     '96ebf688-8c59-4b20-88b3-fc92c8d20924',
     '8c8e13b4-a88b-40c4-842b-349862b3a02f',
     '1c657ec5-99b2-477e-81e2-15afe6311451',
     '12e320be-aa19-4ed8-8dd5-e1f885bc3204',
     'bef19e55-615e-45e4-8883-32c926f48669',
     '958d479b-0272-40e1-8dc8-e4ea01c3e407',
     '5bab2a09-6d32-4a93-89ca-b42f0b600736',
     '9fdff840-ecb5-4694-870f-b3ba3d874f84',
     'ef4d951e-3945-4e4f-88d4-7b7f7295aa6e',
     'a920a66c-7bc5-4d54-89f2-89a0446157d3',
     'eef8e81d-de56-4252-884c-fb8a7d626fb9',
     'b95e86c3-6995-46b7-8ce9-310518be676e',
     'b8335f72-80ce-4d45-89d1-7c80c3d63ef3',
     'a4eb3005-054b-4258-8171-c96bb5b7da92',
     '8a7e497a-1d2c-40ac-8c94-0d381a6c8e07',
     'b5aa02e9-a41f-4111-8a13-12968498cbd7',
     'd2a1bcbc-ad29-4474-8700-a36ef295585e',
     'cc6a2a9b-cacd-4b25-8002-460f56db80ed',
     '36d0209b-8990-48cd-84ba-8c89cba1db14',
     'eda530e0-b1f9-4d32-8394-5c394582bdbd',
     'fd51e109-0b03-4c45-8d49-cf83eb508e0f',
     '3e32ace6-9b04-4124-8391-3e1d7825e2df',
     'c5f56c50-7786-40aa-8af2-90eaf7de5ece',
     'dd025265-798e-494c-8b68-372aa8541572',
     'd27940ff-531f-45b7-8e80-b80f9410433f',
     '4fa587d6-7cba-4878-87c1-89ff677a166e',
     '7ad67655-81af-435d-8ae3-92ef22ac3995',
     '1e02b6b1-8b91-4cbc-8ba9-cefb3264d21d');
do $$
begin
  if exists (select 1 from public.university_programs where cycle = 'doctorat_1er_cycle') then
    raise exception 'NEXUS: rollback doctorats refusé : % programme(s) utilisent encore le doctorat de 1er cycle',
      (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle');
  end if;
end $$;
alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre'));

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

do $$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> '90c99ad02f49ce901449dded595c2044' then
    raise exception 'NEXUS: rollback doctorats — corps E3 non retrouvé (md5)';
  end if;
end $$;
