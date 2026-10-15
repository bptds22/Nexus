
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
