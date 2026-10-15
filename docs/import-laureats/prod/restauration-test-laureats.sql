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
