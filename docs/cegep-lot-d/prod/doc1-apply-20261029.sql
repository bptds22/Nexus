-- ════════════════════════════════════════════════════════════════════════════
-- Doctorats de premier cycle au catalogue des programmes universitaires (demande BP 2026-10-29) — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc),
-- version 20261029200000. Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> doc1 (migration
-- et rollback embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → empreinte des programmes AVANT → migration → programmes existants identiques, attendu =
-- obtenu par université → essais avec un recruteur universitaire témoin (compte neuf, Université Laval) et l'admin,
-- chaque essai défait aussitôt (NX000) → inscription (schema_migrations + admin_operations) → COMMIT. Aucun nom de personne affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-doctorats-1er-cycle';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029200000') then
    raise exception 'NEXUS: version 20261029200000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261029200000' then raise exception 'NEXUS: version 20261029200000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_DOCTORATS_1ER_CYCLE', 'ROLLBACK_DOCTORATS_1ER_CYCLE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028150000') then
    raise exception 'NEXUS: préalable E3 (cycle libre) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

create temp table _t on commit drop as
select (select s.id from public.schools s where s.name = 'Université Laval' and s.type = 'UNIVERSITE') as univ,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d0c01'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
alter table _t add column v_seed uuid;
do $$ begin
  if exists (select 1 from _t where univ is null or u_adm is null) then raise exception 'NEXUS: un témoin manque'; end if;
end $$;

create temp table _avant on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(cycle_libelle, '') || coalesce(faculte, '')
                                  || coalesce(lien, '') || source || position || is_displayed, ',' order by id)) empreinte
  from public.university_programs;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '20261029200000'::text as version,
       $nexus_mig$-- Doctorats de premier cycle au catalogue des programmes universitaires (demande BP du 2026-10-29).
--   1. university_programs.cycle accepte 'doctorat_1er_cycle' (affiché « Doctorat de 1er cycle »).
--   2. replace_university_programs accepte ce cycle (corps E3, seule la liste des cycles et le message changent).
--   3. 64 programmes pré-remplis (source 'seed', uuid stables) : médecine, médecine dentaire, pharmacie, médecine
--      vétérinaire, optométrie, chiropratique, podiatrie, et Juris Doctor (common law), relevés le 2026-10-29 sur les
--      sites officiels (source citée par ligne, docs/cegep-lot-d/doctorats-1er-cycle.json, données 1d6f6c74dd355efcda47e21374c91060).
--      Ajoutés à la fin de la liste de chaque université ; rien n'est supprimé ni modifié.
-- Lecture et écriture : policies D5a / E1 inchangées. Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-doctorats.mjs.

do $garde$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> '90c99ad02f49ce901449dded595c2044' then
    raise exception 'NEXUS: doctorats — replace_university_programs a changé depuis le relevé ; régénérer';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'university_programs_cycle_check'))
       <> 'CHECK ((cycle = ANY (ARRAY[''baccalaureat''::text, ''certificat''::text, ''maitrise''::text, ''doctorat''::text, ''autre''::text])))' then
    raise exception 'NEXUS: doctorats — la contrainte de cycle a changé ; relire';
  end if;
end $garde$;

alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'doctorat_1er_cycle', 'autre'));

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
                 or coalesce(r->>'cycle', '') not in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'doctorat_1er_cycle', 'autre')
                 or ((r->>'cycle') = 'autre') is distinct from (nullif(btrim(r->>'cycle_libelle'), '') is not null)
                 or length(btrim(coalesce(r->>'cycle_libelle', ''))) > 60
                 or (nullif(btrim(r->>'lien'), '') is not null and btrim(r->>'lien') !~ '^https://')) then
    raise exception 'NEXUS: Chaque programme a besoin d''un nom, d''un cycle (baccalauréat, certificat, maîtrise, doctorat, doctorat de 1er cycle, ou « autre » avec son libellé) et d''un lien en https:// s''il y en a un.';
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

create temp table _doc1 (id uuid primary key, universite text not null, name text not null, faculte text,
                         lien text not null, rang int not null) on commit drop;
insert into _doc1 values
  ('cf7bde35-6568-4de6-8384-c1e5efba210b', 'Université Laval', 'Doctorat en médecine (M.D.)', 'Faculté de médecine', 'https://www.ulaval.ca/etudes/programmes/doctorat-en-medecine', 0),
  ('281a4242-58a9-4775-8557-7d8c8a59bd2a', 'Université Laval', 'Doctorat en médecine dentaire (D.M.D.)', 'Faculté de médecine dentaire', 'https://www.ulaval.ca/etudes/programmes/doctorat-en-medecine-dentaire', 1),
  ('a4aa0499-4b05-44cb-83d8-1abc2386d857', 'Université Laval', 'Doctorat de premier cycle en pharmacie (Pharm. D.)', 'Faculté de pharmacie', 'https://www.ulaval.ca/etudes/programmes/doctorat-de-premier-cycle-en-pharmacie', 2),
  ('d3b90a88-b038-4f08-8ffa-7b9dc7b3cd61', 'Université de Montréal', 'Doctorat de 1er cycle en médecine (M.D.)', 'Faculté de médecine', 'https://admission.umontreal.ca/programmes/doctorat-de-1er-cycle-en-medecine/', 0),
  ('e4464331-11a9-469a-8eea-b6f245f77fa7', 'Université de Montréal', 'Doctorat de 1er cycle en médecine dentaire (D.M.D.)', 'Faculté de médecine dentaire', 'https://admission.umontreal.ca/programmes/doctorat-de-1er-cycle-en-medecine-dentaire/', 1),
  ('97f72542-957e-4c7a-8b7f-50121ca8f384', 'Université de Montréal', 'Doctorat de 1er cycle en médecine vétérinaire (D.M.V.)', 'Faculté de médecine vétérinaire', 'https://admission.umontreal.ca/programmes/doctorat-de-1er-cycle-en-medecine-veterinaire/', 2),
  ('26d19347-a0a6-49a1-8e62-a4bbbb83cac8', 'Université de Montréal', 'Doctorat de 1er cycle en optométrie (O.D.)', 'École d''optométrie', 'https://admission.umontreal.ca/programmes/doctorat-de-1er-cycle-en-optometrie/', 3),
  ('6b0f3e32-8148-4ab3-8a89-75845cbc4ceb', 'Université de Montréal', 'Doctorat de 1er cycle en pharmacie (Pharm. D.)', 'Faculté de pharmacie', 'https://admission.umontreal.ca/programmes/doctorat-de-1er-cycle-en-pharmacie/', 4),
  ('de823ac5-79d9-4e9f-8568-b0e978a446a2', 'Université de Sherbrooke', 'Doctorat en médecine (M.D.)', 'Faculté de médecine et des sciences de la santé', 'https://www.usherbrooke.ca/admission/programme/238/doctorat-en-medecine/', 0),
  ('978ac75e-1175-4f44-84de-8a6e0bd2c187', 'Université McGill', 'Medicine (MDCM)', 'Faculty of Medicine and Health Sciences', 'https://www.mcgill.ca/medadmissions/programs/mdcm', 0),
  ('301c1f8d-9bcf-46ef-8c0b-95be9579247b', 'Université McGill', 'Doctor of Dental Medicine (DMD)', 'Faculty of Dental Medicine and Oral Health Sciences', 'https://www.mcgill.ca/dentistry/4-year-dmd-program', 1),
  ('9be1f4f9-1034-41ba-8f22-e563ca3d8b5e', 'Université du Québec à Trois-Rivières', 'Doctorat de premier cycle en chiropratique (D.C.)', 'Département de chiropratique', 'https://oraprdnt.uqtr.uquebec.ca/portail/triw082.afficher?owa_cd_pgm=7025', 0),
  ('14fbec46-3701-4151-8c33-681a4d465b52', 'Université du Québec à Trois-Rivières', 'Doctorat de premier cycle en médecine podiatrique (D.P.M.)', 'Département des sciences de l''activité physique', 'https://oraprdnt.uqtr.uquebec.ca/portail/triw082.afficher?owa_cd_pgm=7017', 1),
  ('bd030285-c850-4493-8ac0-cf6327e33a6f', 'University of Toronto', 'Doctor of Medicine (MD)', 'Temerty Faculty of Medicine', 'https://md.utoronto.ca/', 0),
  ('1b11df89-9b09-4a26-833f-1eccd7868a2f', 'University of Toronto', 'Doctor of Dental Surgery (DDS)', 'Faculty of Dentistry', 'https://www.dentistry.utoronto.ca/prospective-students/undergraduate/DDS', 1),
  ('ada41df2-69c4-4dfb-8d30-e38212abf7e7', 'University of Toronto', 'Doctor of Pharmacy (PharmD)', 'Leslie Dan Faculty of Pharmacy', 'https://www.pharmacy.utoronto.ca/programs/doctor-pharmacy-pharmd', 2),
  ('479accf2-2ab2-4eed-860e-edb6949d6401', 'University of Toronto', 'Juris Doctor (JD)', 'Faculty of Law', 'https://jackmanlaw.utoronto.ca/jd-program', 3),
  ('c3d489e8-74d8-4c46-822a-4200b804beb5', 'McMaster University', 'Doctor of Medicine (MD)', 'Michael G. DeGroote School of Medicine', 'https://future.mcmaster.ca/programs/medicine/', 0),
  ('87e855e1-0571-4f4b-869f-f27f535809b4', 'Western University', 'Doctor of Medicine (MD)', 'Schulich School of Medicine & Dentistry', 'https://www.schulich.uwo.ca/medicine/undergraduate/', 0),
  ('b8fae97d-cdd6-4728-88a6-a21f1f99c8cf', 'Western University', 'Doctor of Dental Surgery (DDS)', 'Schulich School of Medicine & Dentistry', 'https://www.schulich.uwo.ca/med-dent-admissions/dentistry/index.html', 1),
  ('165d0761-aa02-46dd-8e36-52ccffb173d5', 'Western University', 'Juris Doctor (JD)', 'Faculty of Law', 'https://law.uwo.ca/future_students/jd_academic_programs/index.html', 2),
  ('db3eca1c-9bf6-4652-8bed-3a32704280df', 'Queen''s University', 'Doctor of Medicine (MD)', 'Faculty of Health Sciences', 'https://meds.queensu.ca/academics/mdprogram/', 0),
  ('75f1bd8f-571a-4ec3-8d93-dfab4d5ba7f1', 'Queen''s University', 'Juris Doctor (JD)', 'Faculty of Law', 'https://law.queensu.ca/programs/jd', 1),
  ('cc5a2c42-75a5-4fb8-863b-363d01335cbc', 'Université d''Ottawa', 'Doctorat en médecine (M.D.)', 'Faculté de médecine', 'https://www.uottawa.ca/faculte-medecine/etudes-medicales-premier-cycle/a-propos-admissions', 0),
  ('dc51d648-7455-4070-8451-45452793ad45', 'Université d''Ottawa', 'Juris Doctor (J.D.), en français ou en anglais', 'Faculté de droit, Section de common law', 'https://www.uottawa.ca/faculte-droit/common-law/programmes', 1),
  ('0db1b0a7-7f7d-4048-81f1-a14afe91715a', 'Toronto Metropolitan University', 'Doctor of Medicine (MD)', 'School of Medicine', 'https://www.torontomu.ca/school-of-medicine/programs/md/', 0),
  ('6339d718-86d4-4e4d-8cde-2770437d6266', 'Toronto Metropolitan University', 'Juris Doctor (JD)', 'Lincoln Alexander School of Law', 'https://www.torontomu.ca/law/programs/juris-doctor/', 1),
  ('cc80fe3e-ccc1-41c1-8e70-8c8a18640862', 'University of Waterloo', 'Doctor of Pharmacy (PharmD)', 'School of Pharmacy', 'https://uwaterloo.ca/pharmacy/doctor-pharmacy-pharmd', 0),
  ('ef5ef0d4-a2f1-4a74-8f2b-29d3d54ebc31', 'University of Waterloo', 'Doctor of Optometry (OD)', 'School of Optometry and Vision Science', 'https://uwaterloo.ca/optometry-vision-science/future-optometry-students', 1),
  ('2ba1b605-328d-4ba9-80c6-ea91b14529fa', 'University of Guelph', 'Doctor of Veterinary Medicine (DVM)', 'Ontario Veterinary College', 'https://www.uoguelph.ca/programs/doctor-veterinary-medicine', 0),
  ('d7a00f2a-b086-4af4-8449-7f023b8449c0', 'York University', 'Juris Doctor (JD)', 'Osgoode Hall Law School', 'https://www.osgoode.yorku.ca/programs/juris-doctor/', 0),
  ('922eeb7c-1778-40f1-819e-7e1a652684c5', 'University of Windsor', 'Juris Doctor (JD)', 'Faculty of Law', 'https://www.uwindsor.ca/law/376/prospective-law-students', 0),
  ('b601be8f-eefa-4d62-832e-ffb804d5339e', 'Lakehead University', 'Juris Doctor (JD)', 'Bora Laskin Faculty of Law', 'https://www.lakeheadu.ca/programs/undergraduate-programs/law', 0),
  ('1423da5b-7ea8-43b1-8ec2-c7e4c7af4c59', 'University of British Columbia', 'Doctor of Medicine (MD)', 'Faculty of Medicine', 'https://mdprogram.med.ubc.ca/', 0),
  ('45923c95-cfc7-4451-851f-e1d7e18fd441', 'University of British Columbia', 'Doctor of Dental Medicine (DMD)', 'Faculty of Dentistry', 'https://you.ubc.ca/programs/dentistry/', 1),
  ('09445c72-58e4-4228-89f8-89650166c16a', 'University of British Columbia', 'Entry-to-Practice Doctor of Pharmacy (PharmD)', 'Faculty of Pharmaceutical Sciences', 'https://pharmsci.ubc.ca/programs/entry-practice-pharmd-degree', 2),
  ('96ebf688-8c59-4b20-88b3-fc92c8d20924', 'University of British Columbia', 'Juris Doctor (JD)', 'Peter A. Allard School of Law', 'https://allard.ubc.ca/programs/juris-doctor-jd-program', 3),
  ('8c8e13b4-a88b-40c4-842b-349862b3a02f', 'University of Victoria', 'Juris Doctor (JD)', 'Faculty of Law', 'https://www.uvic.ca/law/admissions/first-year/index.php', 0),
  ('1c657ec5-99b2-477e-81e2-15afe6311451', 'Thompson Rivers University', 'Juris Doctor (JD)', 'Faculty of Law', 'https://www.tru.ca/law/jd-program.html', 0),
  ('12e320be-aa19-4ed8-8dd5-e1f885bc3204', 'University of Alberta', 'Doctor of Medicine (MD)', 'Faculty of Medicine & Dentistry', 'https://www.ualberta.ca/en/medicine/programs/md/index.html', 0),
  ('bef19e55-615e-45e4-8883-32c926f48669', 'University of Alberta', 'Doctor of Dental Surgery (DDS)', 'Mike Petryk School of Dentistry', 'https://www.ualberta.ca/en/school-of-dentistry/programs-and-admissions/dentistry/dds-doctor-of-dental-surgery.html', 1),
  ('958d479b-0272-40e1-8dc8-e4ea01c3e407', 'University of Alberta', 'Doctor of Pharmacy (PharmD), entry-to-practice', 'Faculty of Pharmacy and Pharmaceutical Sciences', 'https://www.ualberta.ca/en/undergraduate-programs/doctor-of-pharmacy-pharmacy-entry-to-practice.html', 2),
  ('5bab2a09-6d32-4a93-89ca-b42f0b600736', 'University of Alberta', 'Juris Doctor (JD)', 'Faculty of Law', 'https://www.ualberta.ca/en/law/programs/juris-doctor/index.html', 3),
  ('9fdff840-ecb5-4694-870f-b3ba3d874f84', 'University of Calgary', 'Doctor of Medicine (MD)', 'Cumming School of Medicine', 'https://cumming.ucalgary.ca/mdprogram', 0),
  ('ef4d951e-3945-4e4f-88d4-7b7f7295aa6e', 'University of Calgary', 'Doctor of Veterinary Medicine (DVM)', 'Faculty of Veterinary Medicine', 'https://vet.ucalgary.ca/future-students/dvm-students-undergraduate-program', 1),
  ('a920a66c-7bc5-4d54-89f2-89a0446157d3', 'University of Calgary', 'Juris Doctor (JD)', 'Faculty of Law', 'https://law.ucalgary.ca/future-students/how-apply-jd-programs/how-to-apply', 2),
  ('eef8e81d-de56-4252-884c-fb8a7d626fb9', 'University of Saskatchewan', 'Doctor of Medicine (M.D.)', 'College of Medicine', 'https://admissions.usask.ca/medicine.php', 0),
  ('b95e86c3-6995-46b7-8ce9-310518be676e', 'University of Saskatchewan', 'Doctor of Dental Medicine (D.M.D.)', 'College of Dentistry', 'https://admissions.usask.ca/dentistry.php', 1),
  ('b8335f72-80ce-4d45-89d1-7c80c3d63ef3', 'University of Saskatchewan', 'Doctor of Pharmacy (Pharm.D.)', 'College of Pharmacy and Nutrition', 'https://admissions.usask.ca/pharmacy.php', 2),
  ('a4eb3005-054b-4258-8171-c96bb5b7da92', 'University of Saskatchewan', 'Doctor of Veterinary Medicine (D.V.M.)', 'Western College of Veterinary Medicine', 'https://admissions.usask.ca/veterinary-medicine.php', 3),
  ('8a7e497a-1d2c-40ac-8c94-0d381a6c8e07', 'University of Saskatchewan', 'Juris Doctor (JD)', 'College of Law', 'https://law.usask.ca/future-students/undergraduate/applying-to-law.php', 4),
  ('b5aa02e9-a41f-4111-8a13-12968498cbd7', 'University of Manitoba', 'Doctor of Medicine (MD)', 'Max Rady College of Medicine', 'https://www.umanitoba.ca/explore/undergraduate-admissions/requirements/medicine', 0),
  ('d2a1bcbc-ad29-4474-8700-a36ef295585e', 'University of Manitoba', 'Doctor of Dental Medicine (DMD)', 'Dr. Gerald Niznick College of Dentistry', 'https://umanitoba.ca/explore/programs-of-study/dentistry-dmd', 1),
  ('cc6a2a9b-cacd-4b25-8002-460f56db80ed', 'University of Manitoba', 'Doctor of Pharmacy (PharmD)', 'College of Pharmacy', 'https://umanitoba.ca/explore/programs-of-study/pharmacy-pharmd', 2),
  ('36d0209b-8990-48cd-84ba-8c89cba1db14', 'University of Manitoba', 'Juris Doctor (JD)', 'Faculty of Law', 'https://umanitoba.ca/explore/programs-of-study/juris-doctor-jd', 3),
  ('eda530e0-b1f9-4d32-8394-5c394582bdbd', 'Dalhousie University', 'Doctor of Medicine (MD)', 'Faculty of Medicine', 'https://medicine.dal.ca/departments/core-units/undergraduate.html', 0),
  ('fd51e109-0b03-4c45-8d49-cf83eb508e0f', 'Dalhousie University', 'Doctor of Dental Surgery (DDS)', 'Faculty of Dentistry', 'https://www.dal.ca/study/programs/graduate-professional/dentistry-dds.html', 1),
  ('3e32ace6-9b04-4124-8391-3e1d7825e2df', 'Dalhousie University', 'Doctor of Pharmacy (PharmD)', 'College of Pharmacy', 'https://www.dal.ca/faculty/health/pharmacy/programs/undergraduate-program/pharmd.html', 2),
  ('c5f56c50-7786-40aa-8af2-90eaf7de5ece', 'Dalhousie University', 'Juris Doctor (JD)', 'Schulich School of Law', 'https://www.dal.ca/faculty/law/programs/jd-admissions.html', 3),
  ('dd025265-798e-494c-8b68-372aa8541572', 'Memorial University of Newfoundland', 'Doctor of Medicine (MD)', 'Faculty of Medicine', 'https://www.mun.ca/medicine/admissions/', 0),
  ('d27940ff-531f-45b7-8e80-b80f9410433f', 'Memorial University of Newfoundland', 'Doctor of Pharmacy, Entry-to-Practice (PharmD)', 'School of Pharmacy', 'https://www.mun.ca/pharmacy/programs-and-admissions/doctor-of-pharmacy-entry-to-practice-pharmd/', 1),
  ('4fa587d6-7cba-4878-87c1-89ff677a166e', 'University of Prince Edward Island', 'Doctor of Veterinary Medicine (DVM)', 'Atlantic Veterinary College', 'https://www.upei.ca/programs/doctor-veterinary-medicine', 0),
  ('7ad67655-81af-435d-8ae3-92ef22ac3995', 'University of New Brunswick', 'Juris Doctor (JD)', 'Faculty of Law', 'https://www.unb.ca/fredericton/law/future/programs/index.html', 0),
  ('1e02b6b1-8b91-4cbc-8ba9-cefb3264d21d', 'Université de Moncton', 'Juris Doctor (J.D.) en common law', 'Faculté de droit', 'https://www.umoncton.ca/umcm-droit/node/9', 0);

do $donnees$
begin
  if exists (select 1 from (select distinct universite from _doc1) u
              where (select count(*) from public.schools s where s.name = u.universite and s.type = 'UNIVERSITE') <> 1) then
    raise exception 'NEXUS: doctorats — université introuvable ou ambiguë : %',
      (select string_agg(u.universite, ', ') from (select distinct universite from _doc1) u
        where (select count(*) from public.schools s where s.name = u.universite and s.type = 'UNIVERSITE') <> 1);
  end if;
  if exists (select 1 from public.university_programs where id in (select id from _doc1)) then
    raise exception 'NEXUS: doctorats — une clé du lot existe déjà';
  end if;
  if exists (select 1 from _doc1 d join public.schools s on s.name = d.universite and s.type = 'UNIVERSITE'
               join public.university_programs up on up.school_id = s.id and lower(btrim(up.name)) = lower(d.name)) then
    raise exception 'NEXUS: doctorats — un programme du lot existe déjà sous ce nom';
  end if;
end $donnees$;

insert into public.university_programs (id, school_id, name, cycle, faculte, lien, is_displayed, position, source, source_url)
select d.id, s.id, d.name, 'doctorat_1er_cycle', d.faculte, d.lien, true,
       coalesce((select max(up.position) + 1 from public.university_programs up where up.school_id = s.id), 0) + d.rang,
       'seed', d.lien
  from _doc1 d join public.schools s on s.name = d.universite and s.type = 'UNIVERSITE';

do $verif$
begin
  if (select count(*) from public.university_programs where id in (select id from _doc1) and cycle = 'doctorat_1er_cycle' and source = 'seed') <> 64 then
    raise exception 'NEXUS: doctorats — nombre de programmes insérés différent de 64';
  end if;
end $verif$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback des doctorats de premier cycle (20261029200000) : retire les 64 programmes pré-remplis du lot, remet la
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
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '558811337a88072df46f1e7c7cdb2b67' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> '2479a348f31c5c0fe3c1ea0ef64966ce' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

-- Les programmes d'avant n'ont pas bougé (le lot est retiré de l'empreinte).
create temp table _apres on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(cycle_libelle, '') || coalesce(faculte, '')
                                  || coalesce(lien, '') || source || position || is_displayed, ',' order by id)) empreinte
  from public.university_programs where id not in (select id from _doc1);
select a.n as programmes_avant, p.n as autres_programmes_apres, a.empreinte = p.empreinte as identiques,
       (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle') as doctorats_1er_cycle
  from _avant a, _apres p;

-- Attendu (relevé) contre obtenu (base), par université.
create temp table _o on commit drop as
select d.universite, count(*) as attendus,
       (select count(*) from public.university_programs up join public.schools s on s.id = up.school_id
         where s.name = d.universite and s.type = 'UNIVERSITE' and up.cycle = 'doctorat_1er_cycle' and up.source = 'seed') as obtenus
  from _doc1 d group by d.universite;
select universite, attendus, obtenus, case when attendus = obtenus then 'ok' else 'ÉCART' end as "?" from _o order by universite;
update _t set v_seed = (select up.id from public.university_programs up where up.school_id = univ and up.cycle = 'doctorat_1er_cycle'
                         and up.id in (select id from _doc1) order by up.id limit 1);

-- ── Essais ───────────────────────────────────────────────────────────────────
create function pg_temp.essai(p_on boolean, p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare t record; v text; n int;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'doc1-temoin@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = t.neuf;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'garde un doctorat pré-rempli, en ajoute un' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', (select name from public.university_programs where id = t.v_seed),
                                  'cycle', 'doctorat_1er_cycle',
                                  'faculte', (select faculte from public.university_programs where id = t.v_seed),
                                  'lien', (select lien from public.university_programs where id = t.v_seed)),
               jsonb_build_object('name', 'Doctorat essai', 'cycle', 'doctorat_1er_cycle')), true);
        v := n || ' ; seed gardé ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = 'doctorat pré-rempli renommé' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', 'Doctorat renommé', 'cycle', 'doctorat_1er_cycle')), true);
        v := n || ' ; devient ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = 'cycle inconnu' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'doctorat_2e_cycle')), true);
        v := n::text;
      elsif p_quoi = 'écriture directe doctorat 1er cycle avec libellé' then
        insert into public.university_programs (school_id, name, cycle, cycle_libelle) values (t.univ, 'Direct', 'doctorat_1er_cycle', 'X');
        v := 'écrit';
      elsif p_quoi = 'écriture directe doctorat 1er cycle' then
        insert into public.university_programs (school_id, name, cycle) values (t.univ, 'Direct', 'doctorat_1er_cycle');
        v := 'écrit';
      end if;
    exception
      when insufficient_privilege then v := 'refusé 42501';
      when check_violation then v := 'refusé 23514';
      when raise_exception then v := 'refusé P0001';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, appelant, geste, attendu, pg_temp.essai(interrupteur = 'ON', uid, geste) as obtenu
  from (select x.*, row_number() over () as o from _t t, lateral (values
    ('ON',  'recruteur universitaire', t.neuf,  'garde un doctorat pré-rempli, en ajoute un',      '2 ; seed gardé seed'),
    ('ON',  'recruteur universitaire', t.neuf,  'doctorat pré-rempli renommé',                     '1 ; devient manuel'),
    ('ON',  'recruteur universitaire', t.neuf,  'cycle inconnu',                                   'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'écriture directe doctorat 1er cycle',             'écrit'),
    ('OFF', 'recruteur universitaire', t.neuf,  'garde un doctorat pré-rempli, en ajoute un',      'refusé 42501'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe doctorat 1er cycle avec libellé', 'refusé 23514'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe doctorat 1er cycle',             'écrit')
  ) x(interrupteur, appelant, uid, geste, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if exists (select 1 from _o where attendus <> obtenus) then
    raise exception 'NEXUS: écart attendu / obtenu pour %', (select string_agg(universite, ', ') from _o where attendus <> obtenus);
  end if;
  if (select empreinte from _avant) is distinct from (select empreinte from _apres) then
    raise exception 'NEXUS: les programmes existants ont bougé';
  end if;
  if (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle') <> (select count(*) from _doc1) then
    raise exception 'NEXUS: nombre de doctorats de 1er cycle différent du relevé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT doctorats — cycle « doctorat de 1er cycle » ajouté, % programmes pré-remplis, attendu = obtenu, programmes existants intacts',
    (select count(*) from _doc1);
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'doctorats_premier_cycle', array[contenu], 'bptds22@gmail.com' from _m;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_DOCTORATS_1ER_CYCLE',
       'Catalogue universitaire : cycle « doctorat de 1er cycle » et doctorats professionnels pré-remplis, sources citées (GO BP)',
       jsonb_build_object('nom', 'doctorats_premier_cycle', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_doctorats_premier_cycle.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_doctorats_premier_cycle.sql',
         'sources', 'docs/cegep-lot-d/doctorats-1er-cycle.json', 'programmes', (select count(*) from _doc1),
         'md5_fichier', '558811337a88072df46f1e7c7cdb2b67', 'md5_rollback', '2479a348f31c5c0fe3c1ea0ef64966ce', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _m;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029200000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _m;
commit;
\echo '== COMMIT fait : doctorats de premier cycle au catalogue en prod (interrupteur OFF).'
