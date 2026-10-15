-- RATTACHEMENT TEMPORAIRE — nexus.recruteur@nexussports.ca → unité Lauréats (Cégep de Saint-Hyacinthe × Football),
-- pour que BP voie les 952 cartes dans Mon processus (décision BP 2026-10-15, BP est le RPRP). LECTURE seule pendant le test.
-- UN SEUL envoi, une seule transaction : une garde qui échoue annule tout.
--  · users.school_id : Nexus Collégial (c0110000-…) → Cégep de Saint-Hyacinthe (dfad9036-…) — sport inchangé (Football) ;
--  · subscriptions.tier : free → pro — tier_source, status et identifiants Stripe NON touchés.
-- is_school_admin non touché. Inverse : docs/import-laureats/prod/restauration-test-laureats.sql.

create temp table _rt_releve as
select txid_current() as txid,
       (select id from public.users where email = 'nexus.recruteur@nexussports.ca') as compte,
       (select id from public.users where email = 'bptds22@gmail.com') as par,
       (select count(*) from public.users where email = 'nexus.recruteur@nexussports.ca') as nb_comptes,
       (select count(*) from public.admin_operations where operation = 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') as op_deja;

create temp table _rt_avant as
select u.id, u.school_id, u.sport_id, u.role, u.is_school_admin, u.updated_at as user_updated_at,
       s.id as sub_id, s.tier, s.status, s.tier_source, s.updated_at as sub_updated_at,
       (select count(*) from public.recruiter_pipeline where recruiter_id = u.id) as pipeline,
       (select md5(coalesce(string_agg(p::text, '|' order by p.id), '')) from public.recruiter_pipeline p where p.recruiter_id = u.id) as empreinte_pipeline,
       (select count(*) from public.recruiter_notes where recruiter_id = u.id) as notes,
       (select md5(coalesce(string_agg(n::text, '|' order by n.id), '')) from public.recruiter_notes n where n.recruiter_id = u.id) as empreinte_notes,
       (select count(*) from public.recruiter_favorites where recruiter_id = u.id) as favoris,
       (select count(*) from public.recruiter_athlete_grades where recruiter_id = u.id) as grades
  from public.users u join public.subscriptions s on s.user_id = u.id
 where u.id = (select compte from _rt_releve);

create temp table _rt_suivi (t text primary key, n_avant bigint);
do $s$
declare tbl text; n bigint;
begin
  foreach tbl in array array['activity_feed','admin_notifications','athlete_notifications','cartes_prospect_journal',
    'coach_notifications','notification_preferences','notifications_unite','parent_notifications',
    'partenaire_prospects_journal','recruiter_activity_log','recruiter_contact_notifications'] loop
    execute format('select count(*) from public.%I', tbl) into n;
    insert into _rt_suivi values (tbl, n);
  end loop;
end $s$;

-- Gardes AVANT : l'état doit être exactement celui relevé le 2026-10-15.
do $g$
begin
  if (select txid from _rt_releve) <> txid_current() then raise exception 'NEXUS RATTACHEMENT: transaction non unique'; end if;
  if (select nb_comptes from _rt_releve) <> 1 or (select compte from _rt_releve) <> 'a0000000-0000-4000-8000-0000000000a1' then
    raise exception 'NEXUS RATTACHEMENT: compte introuvable ou inattendu';
  end if;
  if (select op_deja from _rt_releve) <> 0 then raise exception 'NEXUS RATTACHEMENT: déjà rattaché'; end if;
  if (select count(*) from _rt_avant) <> 1 then raise exception 'NEXUS RATTACHEMENT: 1 abonnement attendu'; end if;
  if (select school_id from _rt_avant) <> 'c0110000-0000-4000-8000-000000000001'
     or (select sport_id from _rt_avant) <> '4b859bf1-5832-4258-897c-e094062926af'
     or (select role from _rt_avant) <> 'RECRUTEUR'::public.user_role
     or (select is_school_admin from _rt_avant) is distinct from false
     or (select user_updated_at from _rt_avant) <> '2026-10-08 01:26:44.042911+00'::timestamptz then
    raise exception 'NEXUS RATTACHEMENT: la ligne users n''est plus dans l''état relevé — rien n''est fait';
  end if;
  if (select tier from _rt_avant) <> 'free' or (select status from _rt_avant) <> 'active'
     or (select tier_source from _rt_avant) <> 'stripe'
     or (select sub_updated_at from _rt_avant) <> '2026-10-13 14:50:00.336831+00'::timestamptz then
    raise exception 'NEXUS RATTACHEMENT: l''abonnement n''est plus dans l''état relevé (free/active/stripe, même updated_at) — rien n''est fait';
  end if;
  if (select pipeline from _rt_avant) <> 16 then raise exception 'NEXUS RATTACHEMENT: 16 dossiers attendus, %', (select pipeline from _rt_avant); end if;
end $g$;

update public.users set school_id = 'dfad9036-0d54-4304-906f-91f19542a882'
 where id = (select compte from _rt_releve) and school_id = 'c0110000-0000-4000-8000-000000000001';

update public.subscriptions set tier = 'pro'
 where id = (select sub_id from _rt_avant) and tier = 'free' and status = 'active' and tier_source = 'stripe';

insert into public.admin_operations (operation, motif, details, par)
select 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS',
       'Rattachement TEMPORAIRE du compte de test aux Lauréats × Football pour que BP voie les 952 cartes (lecture seule) — GO BP',
       jsonb_build_object(
         'compte', a.id, 'school_id_avant', a.school_id, 'sport_id', a.sport_id,
         'is_school_admin', a.is_school_admin, 'user_updated_at_avant', a.user_updated_at,
         'abonnement_id', a.sub_id, 'tier_avant', a.tier, 'status_avant', a.status, 'source_avant', a.tier_source,
         'sub_updated_at_avant', a.sub_updated_at,
         'sub_updated_at_apres', (select updated_at from public.subscriptions where id = a.sub_id),
         'pipeline', a.pipeline, 'empreinte_pipeline', a.empreinte_pipeline,
         'notes', a.notes, 'empreinte_notes', a.empreinte_notes, 'favoris', a.favoris, 'grades', a.grades,
         'restauration', 'docs/import-laureats/prod/restauration-test-laureats.sql'),
       (select par from _rt_releve)
  from _rt_avant a;

-- Gardes finales.
do $f$
declare n int; tbl text; m bigint; ids uuid[]; u uuid := (select compte from _rt_releve);
begin
  if (select txid from _rt_releve) <> txid_current() then raise exception 'NEXUS RATTACHEMENT: transaction changée'; end if;
  if (select count(*) from public.users where id = u and school_id = 'dfad9036-0d54-4304-906f-91f19542a882'
        and sport_id = '4b859bf1-5832-4258-897c-e094062926af' and is_school_admin = false and role = 'RECRUTEUR') <> 1 then
    raise exception 'NEXUS RATTACHEMENT: ligne users non conforme — tout est annulé';
  end if;
  if (select count(*) from public.subscriptions where id = (select sub_id from _rt_avant) and tier = 'pro'
        and status = 'active' and tier_source = 'stripe') <> 1 then
    raise exception 'NEXUS RATTACHEMENT: abonnement non conforme — tout est annulé';
  end if;
  -- Les dossiers de l'ancienne unité : inchangés.
  if (select count(*) from public.recruiter_pipeline where recruiter_id = u) <> (select pipeline from _rt_avant)
     or (select md5(coalesce(string_agg(p::text, '|' order by p.id), '')) from public.recruiter_pipeline p where p.recruiter_id = u) <> (select empreinte_pipeline from _rt_avant)
     or (select md5(coalesce(string_agg(x::text, '|' order by x.id), '')) from public.recruiter_notes x where x.recruiter_id = u) <> (select empreinte_notes from _rt_avant)
     or (select count(*) from public.recruiter_favorites where recruiter_id = u) <> (select favoris from _rt_avant)
     or (select count(*) from public.recruiter_athlete_grades where recruiter_id = u) <> (select grades from _rt_avant) then
    raise exception 'NEXUS RATTACHEMENT: dossiers de l''ancienne unité modifiés — tout est annulé';
  end if;
  -- 0 notification, 0 ligne de journal.
  for tbl in select s.t from _rt_suivi s loop
    execute format('select count(*) from public.%I', tbl) into m;
    if m <> (select s.n_avant from _rt_suivi s where s.t = tbl) then
      raise exception 'NEXUS RATTACHEMENT: % a changé (% → %) — tout est annulé', tbl, (select s.n_avant from _rt_suivi s where s.t = tbl), m;
    end if;
  end loop;
  -- Sous son jwt : le compte lit les 952 cartes du lot.
  select array_agg((x)::uuid) into ids from public.admin_operations o, jsonb_array_elements_text(o.details->'carte_ids') x
   where o.operation like 'IMPORT_CARTES_LAUREATS_T%';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.cartes_prospect where id = any(ids);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  if coalesce(array_length(ids, 1), 0) <> 952 or n <> 952 then
    raise exception 'NEXUS RATTACHEMENT: le compte lit % carte(s) du lot sur % — tout est annulé', n, coalesce(array_length(ids, 1), 0);
  end if;
  if (select count(*) from public.admin_operations where operation = 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS') <> 1 then
    raise exception 'NEXUS RATTACHEMENT: ligne admin_operations absente ou en double';
  end if;
end $f$;

select json_build_object(
  'avant', (select json_build_object('school_id', school_id, 'tier', tier, 'status', status, 'source', tier_source,
                                     'pipeline', pipeline, 'notes', notes, 'favoris', favoris, 'grades', grades) from _rt_avant),
  'apres', json_build_object(
     'school_id', (select school_id from public.users where id = (select compte from _rt_releve)),
     'ecole', (select s.name from public.users u join public.schools s on s.id = u.school_id where u.id = (select compte from _rt_releve)),
     'sport', (select sp.nom from public.users u join public.sports sp on sp.id = u.sport_id where u.id = (select compte from _rt_releve)),
     'is_school_admin', (select is_school_admin from public.users where id = (select compte from _rt_releve)),
     'abonnement', (select json_build_object('tier', tier, 'status', status, 'source', tier_source, 'stripe_sub_present', stripe_subscription_id is not null)
                      from public.subscriptions where id = (select sub_id from _rt_avant)),
     'pipeline', (select count(*) from public.recruiter_pipeline where recruiter_id = (select compte from _rt_releve))),
  'tables_suivies_inchangees', (select count(*) from _rt_suivi),
  'admin_operation', (select id from public.admin_operations where operation = 'RATTACHEMENT_TEMPORAIRE_TEST_LAUREATS'),
  'meme_transaction', (select txid from _rt_releve) = txid_current()
) as resultat_rattachement;
