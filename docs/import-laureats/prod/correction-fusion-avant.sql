-- CORRECTION + RESTAURATION — partie 1/3 : défaire la fusion faite par le compte de test pendant le test (GO BP 2026-10-15).
-- Le fichier envoyé = correction-fusion-avant.sql + restauration-test-laureats.sql (md5 30f041b5…, inchangé)
-- + correction-fusion-apres.sql, en UN SEUL envoi : une seule transaction, une garde qui échoue annule tout.
-- Geste à défaire (2026-10-15 20:53:20, compte de test rattaché aux Lauréats) : rapprochement 14aee626 accepté,
-- carte 645d8f94 fusionnée avec l'athlète 9fa96122 (fusion 95083c28).

create temp table _cf_releve as
select txid_current() as txid,
       (select id from public.users where email = 'nexus.recruteur@nexussports.ca') as compte,
       (select id from public.users where email = 'bptds22@gmail.com') as par,
       (select count(*) from public.recruiter_activity_log) as logs_avant,
       (select count(*) from public.notifications_unite) as notifs_unite_avant;

create temp table _cf_suivi (t text primary key, n_avant bigint);
do $s$
declare tbl text; n bigint;
begin
  foreach tbl in array array['activity_feed','admin_notifications','athlete_notifications','cartes_prospect_journal',
    'coach_notifications','notification_preferences','notifications_unite','parent_notifications',
    'partenaire_prospects_journal','recruiter_contact_notifications'] loop
    execute format('select count(*) from public.%I', tbl) into n;
    insert into _cf_suivi values (tbl, n);
  end loop;
end $s$;

-- Gardes AVANT : l'état doit être exactement celui relevé.
do $g$
begin
  if (select txid from _cf_releve) <> txid_current() then raise exception 'NEXUS CORRECTION: transaction non unique'; end if;
  if (select compte from _cf_releve) <> 'a0000000-0000-4000-8000-0000000000a1' then raise exception 'NEXUS CORRECTION: compte inattendu'; end if;
  if (select count(*) from public.fusions_cartes where id = '95083c28-63c4-4b8d-9f83-28009862c3d8' and etat = 'ACTIVE'
        and carte_id = '645d8f94-9bff-5942-9c77-d642167ea64a' and athlete_id = '9fa96122-2bb2-48f2-ac06-3faf884b04db'
        and acteur = (select compte from _cf_releve)) <> 1 then
    raise exception 'NEXUS CORRECTION: la fusion 95083c28 n''est plus dans l''état relevé';
  end if;
  if (select count(*) from public.rapprochements where id = '14aee626-2756-4441-81d9-7405afb7c6bb' and statut = 'ACCEPTEE'
        and decide_par = (select compte from _cf_releve)) <> 1 then
    raise exception 'NEXUS CORRECTION: la proposition 14aee626 n''est plus dans l''état relevé';
  end if;
  if (select count(*) from public.recruiter_activity_log where recruiter_id = (select compte from _cf_releve)
        and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 2 then
    raise exception 'NEXUS CORRECTION: 2 lignes de journal du compte de test attendues dans l''unité Lauréats';
  end if;
  if (select count(*) from public.users where id = (select compte from _cf_releve)
        and school_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 1 then
    raise exception 'NEXUS CORRECTION: le compte de test n''est plus rattaché aux Lauréats';
  end if;
end $g$;

-- 1. Annulation de la fusion par le chemin de l'app, sous le jwt du compte de test.
create temp table _cf_annulation (resultat jsonb);
grant insert on _cf_annulation to authenticated;
select set_config('request.jwt.claims',
                  json_build_object('sub', (select compte from _cf_releve), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into _cf_annulation select public.annuler_fusion('95083c28-63c4-4b8d-9f83-28009862c3d8');
reset role;
select set_config('request.jwt.claims', '', true);

-- 2. Ce que l'annulation laisse : la proposition revient ouverte, la notification non traitée, la carte au signataire.
update public.rapprochements set statut = 'PROPOSEE', decide_par = null, decide_le = null
 where id = '14aee626-2756-4441-81d9-7405afb7c6bb' and statut = 'REFUSEE' and decide_par = (select compte from _cf_releve);
update public.notifications_unite set traitee_le = null
 where id = 'e0520630-6887-4634-9773-142a5da6a3b6' and type = 'RAPPROCHEMENT';
update public.cartes_prospect set modifie_par = 'd45fba8a-765a-4701-bc30-c0f8f1c7d6b8'
 where id = '645d8f94-9bff-5942-9c77-d642167ea64a' and modifie_par = (select compte from _cf_releve);

-- 3. Les 3 lignes du fil d'activité des Lauréats écrites par le compte de test (fusion, consultation, fusion annulée).
create temp table _cf_logs_retires as
select l.* from public.recruiter_activity_log l
 where l.recruiter_id = (select compte from _cf_releve) and l.unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882';
delete from public.recruiter_activity_log
 where id in (select id from _cf_logs_retires);

do $c$
begin
  if (select count(*) from _cf_logs_retires) <> 3 then
    raise exception 'NEXUS CORRECTION: 3 lignes de journal attendues (fusion, consultation, annulation), % trouvées', (select count(*) from _cf_logs_retires);
  end if;
  if (select statut from public.rapprochements where id = '14aee626-2756-4441-81d9-7405afb7c6bb') <> 'PROPOSEE' then
    raise exception 'NEXUS CORRECTION: la proposition 14aee626 n''est pas revenue ouverte';
  end if;
  if (select fusionnee_le from public.cartes_prospect where id = '645d8f94-9bff-5942-9c77-d642167ea64a') is not null
     or (select modifie_par from public.cartes_prospect where id = '645d8f94-9bff-5942-9c77-d642167ea64a') <> 'd45fba8a-765a-4701-bc30-c0f8f1c7d6b8' then
    raise exception 'NEXUS CORRECTION: la carte 645d8f94 n''est pas revenue';
  end if;
  if (select etat from public.fusions_cartes where id = '95083c28-63c4-4b8d-9f83-28009862c3d8') <> 'ANNULEE' then
    raise exception 'NEXUS CORRECTION: la fusion n''est pas annulée';
  end if;
end $c$;

insert into public.admin_operations (operation, motif, details, par)
select 'CORRECTION_FUSION_TEST_LAUREATS',
       'Annulation de la liaison faite par BP sous le compte de test pendant le test Lauréats (lecture seule prévue) — GO BP',
       jsonb_build_object(
         'fusion_annulee', '95083c28-63c4-4b8d-9f83-28009862c3d8',
         'resultat_annuler_fusion', (select resultat from _cf_annulation),
         'carte', '645d8f94-9bff-5942-9c77-d642167ea64a', 'athlete', '9fa96122-2bb2-48f2-ac06-3faf884b04db',
         'proposition_remise_ouverte', '14aee626-2756-4441-81d9-7405afb7c6bb',
         'notification_remise_non_traitee', 'e0520630-6887-4634-9773-142a5da6a3b6',
         'carte_modifie_par_remis', 'd45fba8a-765a-4701-bc30-c0f8f1c7d6b8',
         'journal_retire', (select jsonb_agg(jsonb_build_object('id', id, 'action', action_type, 'le', created_at)) from _cf_logs_retires),
         'restent', 'updated_at de l''athlète 9fa96122 et de la carte, recruitment_status_changed_at de l''athlète ; fusions_cartes 95083c28 ANNULEE (trace)'),
       (select par from _cf_releve);

-- ===== partie 2/3 : restauration-test-laureats.sql, inchangé =====
