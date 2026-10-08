-- Réparation UNIQUE des identifiants RSEQ de côtés de match (générée le 2026-10-08T20:53:13.759Z).
-- Ne réécrit QUE games.home_rseq_team_id / visitor_rseq_team_id, sur la valeur que le RSEQ sert aujourd'hui, et
-- seulement là où cette valeur est déjà celle de l'équipe reliée (catégorie a). Aucun *_team_id n'est touché.
-- Catégories b et c : listées dans reparation-prod.liste.csv, rien écrit.
-- Transaction gardée : exactement 18 côté(s) réaligné(s) et 1 ligne admin_operations, sinon RIEN.
do $$
declare v_bp uuid; n_att constant int := 18; n_h int := 0; n_v int := 0; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  select count(*) into n_ops0 from public.admin_operations;
  with v(game_id, cote, ancien, nouveau, team_id) as (values
      ('048207c1-70e1-43b8-a19d-805b48f3ee34'::uuid, 'home', '5ef3b2ee-c335-4365-a804-efb00568c031'::uuid, '5a500f5f-8d18-4880-aeab-05392b0699b8'::uuid, '9274efd7-3130-491b-8f37-680544650fc8'::uuid),
      ('0fb0eb2b-2582-4ce2-80a3-df3a1ccc4e3d'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('10a47a62-47d3-4d9e-9155-0fb9896997db'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '90da7b99-cc36-4cc9-88f1-579731f84a65'::uuid, 'df631f47-7d86-4814-8a93-8394b341a8f3'::uuid),
      ('6b954e1d-50fe-457f-b13c-e75410ef58da'::uuid, 'home', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'a8e4e0cd-1e79-4e60-9321-f0024ad740c0'::uuid, 'b1b00ba1-ba59-47ca-977d-94da486df8d8'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'b91eb083-dd03-4a92-a57d-a094ec0bd85e'::uuid, '0c361f10-7462-4d3a-a945-160f4c023997'::uuid),
      ('85ffe914-04bb-4b4e-ae35-ee436d6502cc'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'f693cc3e-ea74-49a2-b727-4a4e563e5a32'::uuid, '37db89e7-cf71-49e8-b4f9-de5dddfcbe1d'::uuid),
      ('8716041d-53b3-4654-bae5-c4d97041c2c0'::uuid, 'visitor', '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, '2ee616e4-fe89-4132-898c-fc81845a5529'::uuid, 'aa142930-25e6-4ba9-ba16-39974a9730d6'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '1cb04277-7aad-46b1-99aa-4629297795d2'::uuid, 'ad300fce-10db-4fa5-a2ef-d8f809168433'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'aa0a5b89-d9aa-4be4-8906-863dad14ef19'::uuid, '1f320599-51b0-4d25-ad96-2244ec46f8c0'::uuid),
      ('b80e5857-9ed1-4165-abb3-784211d7e03c'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'e898d8d7-6d74-4ba0-89cf-c714822388ab'::uuid, '3dc8c9ac-1de6-4418-8a4d-662471c42efe'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9be97f39-aba3-4ee6-bdf4-220ec07e3913'::uuid, '688697a0-f47a-466d-9dac-68260b0ba3bb'::uuid),
      ('cc253e0c-0ee6-4a71-bd92-3d240f669788'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'ddac2475-988c-4617-b729-9f86249bff1a'::uuid, 'a6ac4e8f-2af8-44ff-b0c5-69a2bbd611c7'::uuid),
      ('d14ff3be-ece1-41c5-8437-7d4b0df78a03'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '6e971a78-5e2b-498c-8373-193aa66a39be'::uuid, 'db4f75a3-208d-489f-873e-72f539d4a33e'::uuid),
      ('da944828-3480-4fae-8dae-bc663d61fe60'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, 'd97aec12-e039-4a77-bb60-6b95c57d1e47'::uuid, '459f5d82-0977-4472-8458-f5791e99af40'::uuid),
      ('ebffc0ed-dc75-491a-be15-b9ad79a8bbfd'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9642311d-1337-4558-9cd4-2bb457cfadc2'::uuid, '3490fa45-d2be-4f4f-aeaf-60c795ee9cdd'::uuid),
      ('fae4a3a6-075e-49fe-a87b-e7cd9c92d60b'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '0dd006a2-b3aa-43b0-aef6-a9fb0d81ec02'::uuid, '69ecbba0-33d5-4e94-a564-150a9767f528'::uuid)), u as (
    update public.games g set home_rseq_team_id = v.nouveau
      from v where v.cote = 'home' and g.id = v.game_id
       and g.home_rseq_team_id is not distinct from v.ancien and g.home_team_id = v.team_id
    returning 1)
  select count(*) into n_h from u;
  with v(game_id, cote, ancien, nouveau, team_id) as (values
      ('048207c1-70e1-43b8-a19d-805b48f3ee34'::uuid, 'home', '5ef3b2ee-c335-4365-a804-efb00568c031'::uuid, '5a500f5f-8d18-4880-aeab-05392b0699b8'::uuid, '9274efd7-3130-491b-8f37-680544650fc8'::uuid),
      ('0fb0eb2b-2582-4ce2-80a3-df3a1ccc4e3d'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('10a47a62-47d3-4d9e-9155-0fb9896997db'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '90da7b99-cc36-4cc9-88f1-579731f84a65'::uuid, 'df631f47-7d86-4814-8a93-8394b341a8f3'::uuid),
      ('6b954e1d-50fe-457f-b13c-e75410ef58da'::uuid, 'home', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'a8e4e0cd-1e79-4e60-9321-f0024ad740c0'::uuid, 'b1b00ba1-ba59-47ca-977d-94da486df8d8'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'b91eb083-dd03-4a92-a57d-a094ec0bd85e'::uuid, '0c361f10-7462-4d3a-a945-160f4c023997'::uuid),
      ('85ffe914-04bb-4b4e-ae35-ee436d6502cc'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'f693cc3e-ea74-49a2-b727-4a4e563e5a32'::uuid, '37db89e7-cf71-49e8-b4f9-de5dddfcbe1d'::uuid),
      ('8716041d-53b3-4654-bae5-c4d97041c2c0'::uuid, 'visitor', '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, '2ee616e4-fe89-4132-898c-fc81845a5529'::uuid, 'aa142930-25e6-4ba9-ba16-39974a9730d6'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '1cb04277-7aad-46b1-99aa-4629297795d2'::uuid, 'ad300fce-10db-4fa5-a2ef-d8f809168433'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'aa0a5b89-d9aa-4be4-8906-863dad14ef19'::uuid, '1f320599-51b0-4d25-ad96-2244ec46f8c0'::uuid),
      ('b80e5857-9ed1-4165-abb3-784211d7e03c'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'e898d8d7-6d74-4ba0-89cf-c714822388ab'::uuid, '3dc8c9ac-1de6-4418-8a4d-662471c42efe'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9be97f39-aba3-4ee6-bdf4-220ec07e3913'::uuid, '688697a0-f47a-466d-9dac-68260b0ba3bb'::uuid),
      ('cc253e0c-0ee6-4a71-bd92-3d240f669788'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'ddac2475-988c-4617-b729-9f86249bff1a'::uuid, 'a6ac4e8f-2af8-44ff-b0c5-69a2bbd611c7'::uuid),
      ('d14ff3be-ece1-41c5-8437-7d4b0df78a03'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '6e971a78-5e2b-498c-8373-193aa66a39be'::uuid, 'db4f75a3-208d-489f-873e-72f539d4a33e'::uuid),
      ('da944828-3480-4fae-8dae-bc663d61fe60'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, 'd97aec12-e039-4a77-bb60-6b95c57d1e47'::uuid, '459f5d82-0977-4472-8458-f5791e99af40'::uuid),
      ('ebffc0ed-dc75-491a-be15-b9ad79a8bbfd'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9642311d-1337-4558-9cd4-2bb457cfadc2'::uuid, '3490fa45-d2be-4f4f-aeaf-60c795ee9cdd'::uuid),
      ('fae4a3a6-075e-49fe-a87b-e7cd9c92d60b'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '0dd006a2-b3aa-43b0-aef6-a9fb0d81ec02'::uuid, '69ecbba0-33d5-4e94-a564-150a9767f528'::uuid)), u as (
    update public.games g set visitor_rseq_team_id = v.nouveau
      from v where v.cote = 'visitor' and g.id = v.game_id
       and g.visitor_rseq_team_id is not distinct from v.ancien and g.visitor_team_id = v.team_id
    returning 1)
  select count(*) into n_v from u;
  insert into public.admin_operations (operation, motif, details, par)
  values ('REPARATION_RSEQ_IDS_COTES', 'Réalignement unique de games.*_rseq_team_id sur la valeur servie par le RSEQ (équipe reliée inchangée)',
          jsonb_build_object('cotes', n_h + n_v, 'domicile', n_h, 'visiteur', n_v,
            'listes_non_touchees', jsonb_build_object('b_autre_equipe_servie', 0, 'c_plus_servi', 0),
            'changements', (select jsonb_agg(jsonb_build_object('game_id', game_id, 'cote', cote, 'ancien', ancien, 'nouveau', nouveau)) from (values
      ('048207c1-70e1-43b8-a19d-805b48f3ee34'::uuid, 'home', '5ef3b2ee-c335-4365-a804-efb00568c031'::uuid, '5a500f5f-8d18-4880-aeab-05392b0699b8'::uuid, '9274efd7-3130-491b-8f37-680544650fc8'::uuid),
      ('0fb0eb2b-2582-4ce2-80a3-df3a1ccc4e3d'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('10a47a62-47d3-4d9e-9155-0fb9896997db'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '90da7b99-cc36-4cc9-88f1-579731f84a65'::uuid, 'df631f47-7d86-4814-8a93-8394b341a8f3'::uuid),
      ('6b954e1d-50fe-457f-b13c-e75410ef58da'::uuid, 'home', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'a8e4e0cd-1e79-4e60-9321-f0024ad740c0'::uuid, 'b1b00ba1-ba59-47ca-977d-94da486df8d8'::uuid),
      ('6bcdf665-b3ed-4b5a-bf88-e17b0055645f'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'b91eb083-dd03-4a92-a57d-a094ec0bd85e'::uuid, '0c361f10-7462-4d3a-a945-160f4c023997'::uuid),
      ('85ffe914-04bb-4b4e-ae35-ee436d6502cc'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'f693cc3e-ea74-49a2-b727-4a4e563e5a32'::uuid, '37db89e7-cf71-49e8-b4f9-de5dddfcbe1d'::uuid),
      ('8716041d-53b3-4654-bae5-c4d97041c2c0'::uuid, 'visitor', '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, '2ee616e4-fe89-4132-898c-fc81845a5529'::uuid, 'aa142930-25e6-4ba9-ba16-39974a9730d6'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '1cb04277-7aad-46b1-99aa-4629297795d2'::uuid, 'ad300fce-10db-4fa5-a2ef-d8f809168433'::uuid),
      ('9170e74e-56a2-4ee3-9a6e-cf0992953278'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, 'aa0a5b89-d9aa-4be4-8906-863dad14ef19'::uuid, '1f320599-51b0-4d25-ad96-2244ec46f8c0'::uuid),
      ('b80e5857-9ed1-4165-abb3-784211d7e03c'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, '6a197f5d-163b-4c05-928b-aa9d9af26142'::uuid, 'ef74d8cb-7361-4fe6-8036-08a964bbb9cc'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'e898d8d7-6d74-4ba0-89cf-c714822388ab'::uuid, '3dc8c9ac-1de6-4418-8a4d-662471c42efe'::uuid),
      ('bb2127ee-10bc-4a3d-95be-9958b2b44b11'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9be97f39-aba3-4ee6-bdf4-220ec07e3913'::uuid, '688697a0-f47a-466d-9dac-68260b0ba3bb'::uuid),
      ('cc253e0c-0ee6-4a71-bd92-3d240f669788'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, 'ddac2475-988c-4617-b729-9f86249bff1a'::uuid, 'a6ac4e8f-2af8-44ff-b0c5-69a2bbd611c7'::uuid),
      ('d14ff3be-ece1-41c5-8437-7d4b0df78a03'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '6e971a78-5e2b-498c-8373-193aa66a39be'::uuid, 'db4f75a3-208d-489f-873e-72f539d4a33e'::uuid),
      ('da944828-3480-4fae-8dae-bc663d61fe60'::uuid, 'visitor', '662f98a0-1737-41fe-a01a-71bf4b66c4ea'::uuid, 'd97aec12-e039-4a77-bb60-6b95c57d1e47'::uuid, '459f5d82-0977-4472-8458-f5791e99af40'::uuid),
      ('ebffc0ed-dc75-491a-be15-b9ad79a8bbfd'::uuid, 'visitor', '00000000-0000-0000-0000-000000000000'::uuid, '9642311d-1337-4558-9cd4-2bb457cfadc2'::uuid, '3490fa45-d2be-4f4f-aeaf-60c795ee9cdd'::uuid),
      ('fae4a3a6-075e-49fe-a87b-e7cd9c92d60b'::uuid, 'home', '00000000-0000-0000-0000-000000000000'::uuid, '0dd006a2-b3aa-43b0-aef6-a9fb0d81ec02'::uuid, '69ecbba0-33d5-4e94-a564-150a9767f528'::uuid)) x(game_id, cote, ancien, nouveau, team_id))),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_h + n_v <> n_att or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (réalignés %, attendu %, ops +%) — rien écrit', n_h + n_v, n_att, n_ops1 - n_ops0;
  end if;
  raise notice 'OK réparation : % côté(s) réaligné(s) (% domicile, % visiteur), 1 ligne admin_operations', n_h + n_v, n_h, n_v;
end $$;
