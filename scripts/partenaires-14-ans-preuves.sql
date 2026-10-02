-- Preuves par rôle — 20261002170000_partenaires_consentement_14_ans.
-- Local seulement, tout en transaction annulée : aucune donnée ne reste.
-- Comptes locaux : athlète 16 ans d3a00000-…-a001 (user 842da8f6-…),
-- athlète sans date 33333333-…-000a (user 22222222-…-000d).
\set ON_ERROR_STOP 1
begin;

create temp table preuves(n int, cas text, attendu text, vu text) on commit drop;
grant all on preuves to authenticated;

-- P1. 16 ans accorde lui-même → ok, opt_in vrai, journal « quatorze_ans ».
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
insert into preuves select 1, '16 ans accorde', 'ok=true', 'ok=' || (public.set_my_partner_visibility(true, '2026-08-v1') ->> 'ok');
reset role;
insert into preuves select 2, '16 ans : fiche opt_in', 'true', partner_visibility_opt_in::text
  from athletes where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 3, '16 ans : éligible partenaires', 'true',
  public.is_partner_eligible_athlete('d3a00000-0000-4000-8000-00000000a001')::text;
insert into preuves select 4, 'journal : majeur / quatorze_ans', 'false/true',
  (metadata->>'majeur') || '/' || (metadata->>'quatorze_ans')
  from consent_audit_trail where athlete_id = 'd3a00000-0000-4000-8000-00000000a001'
  order by created_at desc limit 1;

-- P5. 16 ans retire → ok, plus éligible.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
insert into preuves select 5, '16 ans retire', 'ok=true', 'ok=' || (public.set_my_partner_visibility(false, '2026-08-v1') ->> 'ok');
reset role;
insert into preuves select 6, '16 ans retiré : éligible', 'false',
  public.is_partner_eligible_athlete('d3a00000-0000-4000-8000-00000000a001')::text;

-- P7. 13 ans accorde → refus parent_required, fiche inchangée.
update athletes set date_naissance = current_date - interval '13 years'
 where id = 'd3a00000-0000-4000-8000-00000000a001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
insert into preuves select 7, '13 ans accorde', 'parent_required',
  public.set_my_partner_visibility(true, '2026-08-v1') ->> 'reason';
reset role;
insert into preuves select 8, '13 ans : fiche opt_in', 'false', partner_visibility_opt_in::text
  from athletes where id = 'd3a00000-0000-4000-8000-00000000a001';

-- P9. Pile 14 ans aujourd'hui → accordé (la borne passe).
update athletes set date_naissance = current_date - interval '14 years'
 where id = 'd3a00000-0000-4000-8000-00000000a001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
insert into preuves select 9, '14 ans pile accorde', 'ok=true', 'ok=' || (public.set_my_partner_visibility(true, '2026-08-v1') ->> 'ok');
reset role;

-- P10. 13 ans + accord parental → éligible (la voie parentale reste).
update athletes set date_naissance = current_date - interval '13 years',
       partner_visibility_opt_in = true, partner_visibility_parental_consent = true
 where id = 'd3a00000-0000-4000-8000-00000000a001';
insert into preuves select 10, '13 ans + parent : éligible', 'true',
  public.is_partner_eligible_athlete('d3a00000-0000-4000-8000-00000000a001')::text;

-- P11. Date inconnue → refus parent_required.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-0000-0000-0000-00000000000d","role":"authenticated"}', true);
insert into preuves select 11, 'date inconnue accorde', 'parent_required',
  public.set_my_partner_visibility(true, '2026-08-v1') ->> 'reason';
reset role;

-- P12. anon ne peut pas appeler la RPC.
insert into preuves select 12, 'anon EXECUTE', 'false',
  has_function_privilege('anon', 'public.set_my_partner_visibility(boolean, text)', 'EXECUTE')::text;

-- P13. Écriture directe toujours refusée par la garde de périmètre.
do $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"842da8f6-41bf-4b75-bc72-83afc68bfe1c","role":"authenticated"}', true);
  begin
    update athletes set partner_visibility_opt_in = false
     where id = 'd3a00000-0000-4000-8000-00000000a001';
    insert into preuves values (13, 'UPDATE direct opt_in', 'refusé', 'PASSÉ');
  exception when others then
    insert into preuves values (13, 'UPDATE direct opt_in', 'refusé', 'refusé');
  end;
  perform set_config('role', 'postgres', true);
end $$;

select n, cas, attendu, vu, case when attendu = vu then 'OK' else 'ÉCHEC' end as verdict
  from preuves order by n;
rollback;
