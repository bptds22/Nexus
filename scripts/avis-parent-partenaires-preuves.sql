-- Preuves — avis au parent (20261002172656 §3b). Local seulement, transaction
-- annulée. Le Vault local n'a pas PARENT_NOTICE_SECRET : chaque avis s'arrête
-- à SANS_SECRET, AUCUN appel réseau. On compte les lignes du journal.
-- Athlète local d3a00000-…-a001 (user 842da8f6-…), 16 ans.
\set ON_ERROR_STOP 1
begin;
create temp table preuves(n int, cas text, attendu text, vu text) on commit drop;
grant all on preuves to authenticated;

update athletes set date_naissance = current_date - interval '16 years',
       partner_visibility_opt_in = false, partner_visibility_parental_consent = false,
       parent_email = 'parent.preuve@preuve.local'
 where id = 'd3a00000-0000-4000-8000-00000000a001';
delete from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';
delete from parent_courriel_desabonnements where courriel_sha256 = courriel_sha256('parent.preuve@preuve.local');

-- A1. 16 ans accorde lui-même → 1 avis.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
select public.set_my_partner_visibility(true, '2026-10-v1');
reset role;
insert into preuves select 1, '16 ans accorde → avis', '1 SANS_SECRET',
  count(*)::text || ' ' || coalesce(max(statut), '-') from avis_parent_partenaires
  where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A2. Retire puis réaccorde dans les 24 h → pas de second avis.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
select public.set_my_partner_visibility(false, '2026-10-v1');
select public.set_my_partner_visibility(true, '2026-10-v1');
reset role;
insert into preuves select 2, 'réaccord < 24 h → pas de 2e avis', '1',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A3. Un avis vieux de 25 h → le réaccord en crée un nouveau.
update avis_parent_partenaires set cree_le = now() - interval '25 hours'
 where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = false where id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = true  where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 3, 'réaccord > 24 h → nouvel avis', '2',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A4. Accord PARENTAL (parental_consent vrai) → aucun avis.
delete from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = false where id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = true, partner_visibility_parental_consent = true
 where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 4, 'accord du parent → aucun avis', '0',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A5. 18 ans → aucun avis.
update athletes set partner_visibility_opt_in = false, partner_visibility_parental_consent = false,
       date_naissance = current_date - interval '18 years'
 where id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = true where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 5, '18 ans → aucun avis', '0',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A6. Parent désabonné → aucun avis.
update athletes set partner_visibility_opt_in = false, date_naissance = current_date - interval '16 years'
 where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into parent_courriel_desabonnements (courriel_sha256, source)
  values (courriel_sha256('parent.preuve@preuve.local'), 'admin');
update athletes set partner_visibility_opt_in = true where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 6, 'parent désabonné → aucun avis', '0',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A7. Sans courriel parent → aucun avis.
delete from parent_courriel_desabonnements where courriel_sha256 = courriel_sha256('parent.preuve@preuve.local');
update athletes set partner_visibility_opt_in = false, parent_email = null
 where id = 'd3a00000-0000-4000-8000-00000000a001';
update athletes set partner_visibility_opt_in = true where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 7, 'sans courriel parent → aucun avis', '0',
  count(*)::text from avis_parent_partenaires where athlete_id = 'd3a00000-0000-4000-8000-00000000a001';

-- A8. Le journal est fermé aux clients.
insert into preuves select 8, 'authenticated lit le journal', 'false',
  has_table_privilege('authenticated', 'public.avis_parent_partenaires', 'SELECT')::text;
insert into preuves select 9, 'authenticated exécute le trigger', 'false',
  has_function_privilege('authenticated', 'public.aviser_parent_partenaires()', 'EXECUTE')::text;

select n, cas, attendu, vu, case when attendu = vu then 'OK' else 'ÉCHEC' end as verdict
  from preuves order by n;
rollback;
