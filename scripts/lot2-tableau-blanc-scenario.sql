-- Scénario LOCAL des preuves du lot 2 (tableau blanc mobile).
-- Rémi (r3, Pro) agit sous sa VRAIE identité JWT, par les fonctions d'unité :
-- un dossier En discussion, une note signée, un favori, une liste avec Liam.
-- Robin (r1, All Star, même unité) doit tout voir sur l'app.
-- Nettoyage : scripts/lot2-tableau-blanc-nettoyage.sql.
\set ON_ERROR_STOP 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000003a","role":"authenticated"}', true);

select public.unite_ecrire_dossier('ffffffff-0000-0000-0000-000000000006', '{"stage":"EN_DISCUSSION"}'::jsonb);
insert into public.recruiter_notes (recruiter_id, athlete_id, content)
  values ('22222222-0000-0000-0000-00000000003a', 'ffffffff-0000-0000-0000-000000000006', 'Note de Rémi — preuve lot 2');
insert into public.recruiter_favorites (recruiter_id, athlete_id)
  values ('22222222-0000-0000-0000-00000000003a', 'ffffffff-0000-0000-0000-000000000006');
with l as (
  insert into public.recruiter_lists (recruiter_id, name, description)
  values ('22222222-0000-0000-0000-00000000003a', 'Liste de Rémi — preuve lot 2', 'Créée par un collègue')
  returning id
)
insert into public.recruiter_list_members (list_id, athlete_id)
  select id, 'ffffffff-0000-0000-0000-000000000006' from l;
commit;

select 'pipeline' t, recruiter_id::text, stage from recruiter_pipeline where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
union all select 'favori', recruiter_id::text, null from recruiter_favorites where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
union all select 'liste', recruiter_id::text, name from recruiter_lists where name like 'Liste de Rémi%';
