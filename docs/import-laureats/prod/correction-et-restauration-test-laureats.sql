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
-- RESTAURATION — fin du rattachement temporaire de nexus.recruteur@nexussports.ca à l'unité Lauréats × Football.
-- UN SEUL envoi, une seule transaction : une garde qui échoue annule tout. Inverse de rattachement-test-laureats.sql.
-- Valeurs à remettre : lues dans la ligne admin_operations RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS ET comparées aux
-- valeurs relevées le 2026-10-15 (inscrites ici) — les deux doivent concorder.
--  · users.school_id ← Nexus Collégial (c0110000-0000-4000-8000-000000000001), toujours ;
--  · subscriptions.tier ← 'free' SEULEMENT si l'abonnement est encore exactement dans l'état que nous avons posé
--    ('pro', même updated_at) ; sinon on n'y touche pas et l'écart est inscrit dans la ligne FIN_….
-- Les updated_at de users et subscriptions prennent l'heure de la restauration (trigger set_updated_at) : on ne peut
-- pas les remettre à l'identique, c'est noté dans la ligne FIN_….

create temp table _rs_releve as
select txid_current() as txid,
       (select id from public.users where email = 'nexus.recruteur@nexussports.ca') as compte,
       (select id from public.users where email = 'bptds22@gmail.com') as par,
       (select details from public.admin_operations where operation = 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') as avant,
       (select count(*) from public.admin_operations where operation = 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') as nb_rattachements,
       (select count(*) from public.admin_operations where operation = 'FIN_RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') as nb_fins;

-- Compteurs des tables de notifications et de journaux, avant.
create temp table _rs_suivi (t text primary key, n_avant bigint, n_apres bigint);
do $s$
declare tbl text; n bigint;
begin
  foreach tbl in array array['activity_feed','admin_notifications','athlete_notifications','cartes_prospect_journal',
    'coach_notifications','notification_preferences','notifications_unite','parent_notifications',
    'partenaire_prospects_journal','recruiter_activity_log','recruiter_contact_notifications'] loop
    execute format('select count(*) from public.%I', tbl) into n;
    insert into _rs_suivi values (tbl, n, null);
  end loop;
end $s$;

create temp table _rs_etat as
select (select tier from public.subscriptions where user_id = (select compte from _rs_releve)) as tier_actuel,
       (select updated_at from public.subscriptions where user_id = (select compte from _rs_releve)) as sub_updated_actuel,
       (select school_id from public.users where id = (select compte from _rs_releve)) as ecole_actuelle;

do $g$
declare a jsonb;
begin
  if (select txid from _rs_releve) <> txid_current() then raise exception 'NEXUS RESTAURATION: transaction non unique'; end if;
  if (select compte from _rs_releve) is null then raise exception 'NEXUS RESTAURATION: compte introuvable'; end if;
  if (select nb_rattachements from _rs_releve) <> 1 then raise exception 'NEXUS RESTAURATION: 1 ligne RATTACHEMENT attendue'; end if;
  if (select nb_fins from _rs_releve) <> 0 then raise exception 'NEXUS RESTAURATION: déjà restauré'; end if;
  a := (select avant from _rs_releve);
  -- Les valeurs d'avant enregistrées doivent être celles relevées le 2026-10-15.
  if a->>'compte' <> 'a0000000-0000-4000-8000-0000000000a1'
     or a->>'school_id_avant' <> 'c0110000-0000-4000-8000-000000000001'
     or a->>'tier_avant' <> 'free' or a->>'status_avant' <> 'active' or a->>'source_avant' <> 'stripe' then
    raise exception 'NEXUS RESTAURATION: valeurs d''avant inattendues dans admin_operations : %', a;
  end if;
  if (select compte from _rs_releve)::text <> a->>'compte' then raise exception 'NEXUS RESTAURATION: compte différent'; end if;
  if (select ecole_actuelle from _rs_etat) <> 'dfad9036-0d54-4304-906f-91f19542a882' then
    raise exception 'NEXUS RESTAURATION: le compte n''est plus aux Lauréats (%) — rien n''est fait', (select ecole_actuelle from _rs_etat);
  end if;
end $g$;

-- 1. École : toujours remise.
update public.users set school_id = 'c0110000-0000-4000-8000-000000000001'
 where id = (select compte from _rs_releve) and school_id = 'dfad9036-0d54-4304-906f-91f19542a882';

-- 2. Abonnement : remis à free SEULEMENT s'il est encore exactement dans l'état que nous avons posé.
update public.subscriptions set tier = 'free'
 where user_id = (select compte from _rs_releve)
   and tier = 'pro' and status = 'active' and tier_source = 'stripe'
   and updated_at = ((select avant from _rs_releve)->>'sub_updated_at_apres')::timestamptz;

insert into public.admin_operations (operation, motif, details, par)
select 'FIN_RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS',
       'Fin du rattachement temporaire du compte de test aux Lauréats × Football — valeurs d''avant remises — GO BP',
       jsonb_build_object(
         'compte', (select compte from _rs_releve),
         'school_id_remis', 'c0110000-0000-4000-8000-000000000001',
         'abonnement', case when (select tier from public.subscriptions where user_id = (select compte from _rs_releve)) = 'free'
                            then 'remis à free'
                            else 'NON TOUCHÉ — écart : tier ' || coalesce((select tier_actuel from _rs_etat), '∅')
                                 || ', updated_at ' || coalesce((select sub_updated_actuel from _rs_etat)::text, '∅') end,
         'note', 'updated_at de users et subscriptions = heure de la restauration (trigger set_updated_at)'),
       (select par from _rs_releve);

-- 3. Gardes finales.
do $f$
declare n int; tbl text; m bigint; a jsonb := (select avant from _rs_releve); ids uuid[]; u uuid := (select compte from _rs_releve);
begin
  if (select txid from _rs_releve) <> txid_current() then raise exception 'NEXUS RESTAURATION: transaction changée'; end if;
  if (select school_id from public.users where id = u) <> 'c0110000-0000-4000-8000-000000000001' then
    raise exception 'NEXUS RESTAURATION: école non remise — tout est annulé';
  end if;
  -- Les 16 dossiers et le reste de l'ancienne unité : mêmes nombres et même empreinte qu'avant le rattachement.
  if (select count(*) from public.recruiter_pipeline where recruiter_id = u) <> (a->>'pipeline')::int
     or (select md5(coalesce(string_agg(p::text, '|' order by p.id), '')) from public.recruiter_pipeline p where p.recruiter_id = u) <> a->>'empreinte_pipeline'
     or (select count(*) from public.recruiter_notes where recruiter_id = u) <> (a->>'notes')::int
     or (select count(*) from public.recruiter_favorites where recruiter_id = u) <> (a->>'favoris')::int
     or (select count(*) from public.recruiter_athlete_grades where recruiter_id = u) <> (a->>'grades')::int then
    raise exception 'NEXUS RESTAURATION: dossiers de l''ancienne unité différents — tout est annulé';
  end if;
  -- Aucune notification ni ligne de journal créée par la restauration.
  for tbl in select s.t from _rs_suivi s loop
    execute format('select count(*) from public.%I', tbl) into m;
    if m <> (select s.n_avant from _rs_suivi s where s.t = tbl) then
      raise exception 'NEXUS RESTAURATION: % a changé (% → %) — tout est annulé', tbl, (select s.n_avant from _rs_suivi s where s.t = tbl), m;
    end if;
  end loop;
  -- Sous son jwt, le compte relit 0 carte du lot Lauréats et retrouve ses 16 dossiers.
  select array_agg((x)::uuid) into ids from public.admin_operations o, jsonb_array_elements_text(o.details->'carte_ids') x
   where o.operation like 'IMPORT_CARTES_LAUREATS_T%';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.cartes_prospect where id = any(ids);
  if n <> 0 then execute 'reset role'; raise exception 'NEXUS RESTAURATION: le compte lit encore % carte(s) Lauréats — tout est annulé', n; end if;
  select count(*) into n from public.recruiter_pipeline where recruiter_id = u;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  if n <> (a->>'pipeline')::int then raise exception 'NEXUS RESTAURATION: sous son jwt, % dossier(s) au lieu de %', n, a->>'pipeline'; end if;
  if (select count(*) from public.admin_operations where operation = 'FIN_RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') <> 1 then
    raise exception 'NEXUS RESTAURATION: ligne FIN absente ou en double';
  end if;
end $f$;

select json_build_object(
  'compte', (select json_build_object('school_id', school_id, 'sport_id', sport_id, 'is_school_admin', is_school_admin)
               from public.users where id = (select compte from _rs_releve)),
  'abonnement', (select json_build_object('tier', tier, 'status', status, 'source', tier_source, 'updated_at', updated_at)
                   from public.subscriptions where user_id = (select compte from _rs_releve)),
  'fin', (select details from public.admin_operations where operation = 'FIN_RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS'),
  'meme_transaction', (select txid from _rs_releve) = txid_current()
) as resultat_restauration;

-- ===== partie 3/3 : gardes finales de l'ensemble =====
do $z$
declare n int; tbl text; m bigint; ids uuid[]; u uuid := (select compte from _cf_releve);
begin
  if (select txid from _cf_releve) <> txid_current() then raise exception 'NEXUS FINAL: transaction changée'; end if;
  select array_agg((x)::uuid) into ids from public.admin_operations o, jsonb_array_elements_text(o.details->'carte_ids') x
   where o.operation like 'IMPORT_CARTES_LAUREATS_T%';
  if (select count(*) from public.cartes_prospect where id = any(ids) and fusionnee_le is null) <> 952 then
    raise exception 'NEXUS FINAL: % carte(s) du lot visibles au lieu de 952', (select count(*) from public.cartes_prospect where id = any(ids) and fusionnee_le is null);
  end if;
  if (select count(*) from public.rapprochements where unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882' and statut = 'PROPOSEE') <> 28
     or (select count(*) from public.rapprochements where unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 28 then
    raise exception 'NEXUS FINAL: les 28 propositions des Lauréats ne sont pas toutes ouvertes';
  end if;
  if (select count(*) from public.recruiter_pipeline where recruiter_id = u and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 0
     or (select count(*) from public.recruiter_athlete_grades where recruiter_id = u and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 0
     or (select count(*) from public.recruiter_activity_log where recruiter_id = u and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 0
     or (select count(*) from public.recruiter_notes where recruiter_id = u and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882') <> 0 then
    raise exception 'NEXUS FINAL: le compte de test laisse une trace dans l''unité Lauréats';
  end if;
  if (select count(*) from public.recruiter_activity_log) <> (select logs_avant from _cf_releve) - 2 then
    raise exception 'NEXUS FINAL: recruiter_activity_log n''a pas perdu exactement les 2 lignes du test';
  end if;
  for tbl in select s.t from _cf_suivi s loop
    execute format('select count(*) from public.%I', tbl) into m;
    if m <> (select s.n_avant from _cf_suivi s where s.t = tbl) then
      raise exception 'NEXUS FINAL: % a changé (% → %) — tout est annulé', tbl, (select s.n_avant from _cf_suivi s where s.t = tbl), m;
    end if;
  end loop;
  if (select count(*) from public.users where id = u and school_id = 'c0110000-0000-4000-8000-000000000001'
        and sport_id = '4b859bf1-5832-4258-897c-e094062926af' and is_school_admin = false) <> 1
     or (select count(*) from public.subscriptions where user_id = u and tier = 'free' and status = 'active' and tier_source = 'stripe'
        and stripe_subscription_id is not null and stripe_customer_id is not null) <> 1 then
    raise exception 'NEXUS FINAL: le compte n''est pas revenu à Nexus Collégial / free / active / stripe';
  end if;
  -- unite_auteurs vu par S.D. et par O.G. : le compte de test n'y est plus.
  for tbl in select x from unnest(array['d45fba8a-765a-4701-bc30-c0f8f1c7d6b8','bf77282e-0e78-4512-bd54-a88c8bf49d06']) x loop
    perform set_config('request.jwt.claims', json_build_object('sub', tbl, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into n from public.unite_auteurs() where id = u;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    if n <> 0 then raise exception 'NEXUS FINAL: unite_auteurs montre encore le compte de test à %', tbl; end if;
  end loop;
end $z$;

select json_build_object(
  'correction', (select details - 'journal_retire' from public.admin_operations where operation = 'CORRECTION_FUSION_TEST_LAUREATS'),
  'journal_retire', (select details->'journal_retire' from public.admin_operations where operation = 'CORRECTION_FUSION_TEST_LAUREATS'),
  'fin', (select details from public.admin_operations where operation = 'FIN_RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS'),
  'compte', (select json_build_object('ecole', s.name, 'sport', sp.nom, 'is_school_admin', u.is_school_admin)
               from public.users u join public.schools s on s.id = u.school_id join public.sports sp on sp.id = u.sport_id
              where u.id = (select compte from _cf_releve)),
  'abonnement', (select json_build_object('tier', tier, 'status', status, 'source', tier_source,
                                          'stripe_sub', stripe_subscription_id is not null, 'stripe_cust', stripe_customer_id is not null)
                   from public.subscriptions where user_id = (select compte from _cf_releve)),
  'dossiers_ancienne_unite', json_build_object(
     'pipeline', (select count(*) from public.recruiter_pipeline where recruiter_id = (select compte from _cf_releve)),
     'notes', (select count(*) from public.recruiter_notes where recruiter_id = (select compte from _cf_releve)),
     'favoris', (select count(*) from public.recruiter_favorites where recruiter_id = (select compte from _cf_releve)),
     'grades', (select count(*) from public.recruiter_athlete_grades where recruiter_id = (select compte from _cf_releve)),
     'listes', (select count(*) from public.recruiter_lists l where (to_jsonb(l)->>'recruiter_id')::uuid = (select compte from _cf_releve)),
     'cartes', (select count(*) from public.cartes_prospect where cree_par = (select compte from _cf_releve))),
  'laureats', json_build_object(
     'cartes_lot_visibles', (select count(*) from public.cartes_prospect c where c.fusionnee_le is null and c.id in
        (select (x)::uuid from public.admin_operations o, jsonb_array_elements_text(o.details->'carte_ids') x where o.operation like 'IMPORT_CARTES_LAUREATS_T%')),
     'propositions', (select json_object_agg(statut, n) from (select statut, count(*) n from public.rapprochements
        where unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882' group by statut) x),
     'traces_compte_test', (select count(*) from public.recruiter_pipeline where recruiter_id = (select compte from _cf_releve) and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882')
        + (select count(*) from public.recruiter_athlete_grades where recruiter_id = (select compte from _cf_releve) and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882')
        + (select count(*) from public.recruiter_activity_log where recruiter_id = (select compte from _cf_releve) and unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882'),
     'fusion', (select etat from public.fusions_cartes where id = '95083c28-63c4-4b8d-9f83-28009862c3d8')),
  'meme_transaction', (select txid from _cf_releve) = txid_current()
) as resultat_correction_et_restauration;
