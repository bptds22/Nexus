-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — les 12 équipes RSEQ de cégep refusées par la proposition de la veille (GO BP 2026-10-26).
-- Opération de DONNÉES (aucun objet de schéma). rseq_creer_equipes_proposees les refuse (doublon, école
-- introuvable) : on les crée donc ici, à la main, sur décision de BP, avec un plan LITTÉRAL (aucun filtre
-- par nom ; chaque équipe est désignée par son alerte et son rseq_team_id, chaque école par son id).
--
-- 1. Deux « doublons » flag football féminin D3 : 2es équipes distinctes du même cégep, dans une autre
--    poule (Sud-Ouest C et B ; la 1re joue en Sud-Ouest A). Exception au dédoublonnage, comme Triolet le
--    8 oct. Nom distinct : « Joliette (Sud-Ouest C) », « Lionel-Groulx (Sud-Ouest B) ». La clé
--    teams_identity_unique (école, sport, nom, catégorie, division, sexe, saison, ligue, zone) n'est pas en
--    cause (ligue et nom diffèrent déjà) ; la veille relie les matchs par rseq_team_id, jamais par nom.
-- 2. Dix équipes de Basketball D2 Nord-Est CQ B, sans InstitutionId publié (ligue sans Teams[]) :
--    école établie par la correspondance de nom validée par BP, figée ici en id. Aucune école créée ni
--    modifiée. Nom = nom RSEQ.
--
-- Toutes en « Collégial » 2026-2027, division / sexe / ligue = ceux de la proposition (vérifiés égaux au
-- plan). Les côtés de match NULL sont reliés par rseq_team_id ; les 12 alertes passent à TRAITEE ;
-- admin_operations CEGEP_EQUIPES_RSEQ_12.
--
-- Gardes : 12 alertes exactes (empreinte 43e3182d…) et 12 rseq_team_id exacts (8836addd…), OUVERTE, aucun
-- déjà en base ; proposition recalculée = plan (décision, sport, division, sexe, ligue, doublon attendu) ;
-- écoles de type CEGEP ; dédoublonnage (règle 2) : basketball = aucune équipe, flag = la seule 1re équipe
-- connue ; côtés à relier équipe par équipe (total 72 domicile, 76 visiteur), puis les mêmes en sortie.
-- Rollback : scripts/cegep-equipes-12/retirer.sql (par la liste des 12 rseq_team_id).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_plan jsonb := $plan$[
    {"alerte": "ea152938-1f4e-4913-b3be-872f57cc7f36", "rid": "b7c0e77d-76f5-401e-a3ea-beacbf8d27a8", "ecole": "c8cb3c98-2744-47fa-957b-a00245dbc54d",
     "nom": "Joliette (Sud-Ouest C)", "decision": "doublon", "doublon": "d469c1ce-6262-4fec-9c49-548d1b7844ae",
     "sport": "f1c283ba-7ef2-44a5-acff-d16017562d67", "division": "D3", "gender": "Féminin",
     "league": "Flag football C F D3 Sud-Ouest C (2026-2027)", "h": 5, "v": 4},
    {"alerte": "e5bffe47-78f3-4697-bc31-97b112eb4003", "rid": "b96f844d-43a5-4854-8bb8-f08ebb6fd830", "ecole": "f7fafd77-a20b-4f96-8db5-afb999e7e4d9",
     "nom": "Lionel-Groulx (Sud-Ouest B)", "decision": "doublon", "doublon": "38e387b3-a1a9-45a8-82dc-6524765e42ae",
     "sport": "f1c283ba-7ef2-44a5-acff-d16017562d67", "division": "D3", "gender": "Féminin",
     "league": "Flag football C F D3 Sud-Ouest B (2026-2027)", "h": 5, "v": 4},
    {"alerte": "23779985-2bcd-43ca-aa2b-8f133b4da57d", "rid": "73e3a35a-e00a-41d9-828a-ac7ef5ac7214", "ecole": "85419c0f-03e8-4e4e-accb-8a30cc4b52c0",
     "nom": "Ch.-Lennoxville", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "12440459-9dcd-4b27-9e70-782b0fd3565d", "rid": "ca0983e7-85d6-4d8b-9684-89eef3418a9a", "ecole": "dfad9036-0d54-4304-906f-91f19542a882",
     "nom": "Saint-Hyacinthe", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "8d21c2df-4c97-4e74-9214-e41ef4fb808a", "rid": "8d15b218-9005-4513-b2d8-17a5ed4fbd71", "ecole": "dfad9036-0d54-4304-906f-91f19542a882",
     "nom": "Saint-Hyacinthe", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "6751645b-4986-4792-a490-74e65d11e516", "rid": "028950e6-34ca-4f08-b8b5-7337529be45c", "ecole": "7adaa8e9-015b-4d5b-869e-3646d072935a",
     "nom": "Séminaire de Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "c4e46a28-323f-44d3-91aa-281649b74a07", "rid": "931b39c9-12d8-4df9-8072-01ace9ee1ce5", "ecole": "613aaadc-0947-43fa-8f89-84f73fdaf8b0",
     "nom": "Shawinigan", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "58a59a19-a51f-4d3c-aa68-39defdd541a9", "rid": "68599a7b-b6d7-4b1b-bce7-caa55600af22", "ecole": "8a330cf7-76fa-4761-8cbd-df223e6c4cbd",
     "nom": "Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 7, "v": 6},
    {"alerte": "67487976-8c40-45c2-b39a-9725f2dfd066", "rid": "9f7f1bf2-11a8-4a56-ab47-6561f199989d", "ecole": "8a330cf7-76fa-4761-8cbd-df223e6c4cbd",
     "nom": "Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 7, "v": 6},
    {"alerte": "5e7b1333-0ae2-4a59-be39-aa2028657fa7", "rid": "8c0749c7-13a0-4d3a-928a-cba989ca65ec", "ecole": "55f424c0-d740-43e5-99f6-38a8fb73e03b",
     "nom": "Sorel-Tracy", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "9bb986ee-9923-4047-865f-1cf9195bf55a", "rid": "2a991ddd-1782-4bbb-993e-d16c67db5e84", "ecole": "61ed3f9a-f089-4983-87e9-85bab65e1693",
     "nom": "Trois-Rivières", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "26589406-a168-40fd-9b00-324a6f0824c9", "rid": "f4c5f91f-2ae4-4b71-a90d-52f160af3ef4", "ecole": "61ed3f9a-f089-4983-87e9-85bab65e1693",
     "nom": "Trois-Rivières", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7}
  ]$plan$;
  v_admin constant uuid := 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0';
  v_al uuid[]; v_rids uuid[]; v_teams uuid[]; e text; n int; nh int; nv int;
begin
  -- Le plan lui-même.
  select array_agg(p.alerte order by p.alerte), array_agg(p.rid order by p.rid) into v_al, v_rids
    from jsonb_to_recordset(v_plan) p(alerte uuid, rid uuid);
  if cardinality(v_al) <> 12
     or md5(array_to_string(v_al, ',')) <> '43e3182df9a741428ef01798b33d2707'
     or md5(array_to_string(v_rids, ',')) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: plan des 12 altéré (empreintes % / %)', md5(array_to_string(v_al, ',')), md5(array_to_string(v_rids, ','));
  end if;

  -- Alertes : les 12, ouvertes, chacune avec son rseq_team_id, proposition recalculée = plan.
  select string_agg(p.nom || ' : ' || coalesce(
           case when a.id is null then 'alerte absente ou déjà traitée'
                when j->>'decision' is distinct from p.decision then 'décision ' || coalesce(j->>'decision', '?')
                when (j->>'sport_id')::uuid is distinct from p.sport then 'sport'
                when j->>'age_group' is distinct from 'Collégial' then 'catégorie'
                when j->>'saison' is distinct from '2026-2027' then 'saison'
                when j->>'division' is distinct from p.division then 'division'
                when j->>'gender' is distinct from p.gender then 'sexe'
                when j->>'league' is distinct from p.league then 'ligue'
                when (j->>'doublon_team_id')::uuid is distinct from p.doublon then 'doublon'
                when p.decision = 'doublon' and (j->>'school_id')::uuid is distinct from p.ecole then 'école prouvée'
           end, ''), ', ') into e
    from jsonb_to_recordset(v_plan) p(alerte uuid, rid uuid, ecole uuid, nom text, decision text, doublon uuid,
                                      sport uuid, division text, gender text, league text)
    left join public.rseq_sync_alerts a
           on a.id = p.alerte and a.rseq_team_id = p.rid and a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE'
    left join lateral (select public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                                             a.rseq_league_id, a.payload->>'saison', 'Collégial') as j) x on true
   where a.id is null
      or j->>'decision' is distinct from p.decision or (j->>'sport_id')::uuid is distinct from p.sport
      or j->>'age_group' is distinct from 'Collégial' or j->>'saison' is distinct from '2026-2027'
      or j->>'division' is distinct from p.division or j->>'gender' is distinct from p.gender
      or j->>'league' is distinct from p.league or (j->>'doublon_team_id')::uuid is distinct from p.doublon
      or (p.decision = 'doublon' and (j->>'school_id')::uuid is distinct from p.ecole);
  if e is not null then raise exception 'NEXUS: alerte ou proposition hors plan — %', e; end if;

  if exists (select 1 from public.teams where rseq_team_id = any(v_rids)) then
    raise exception 'NEXUS: une des 12 équipes existe déjà';
  end if;

  -- Écoles : existent, type CEGEP. Dédoublonnage (règle 2 de la proposition) avec l'école du plan.
  select string_agg(p.nom || ' : ' ||
           case when s.id is null then 'école absente'
                when s.type::text <> 'CEGEP' then 'école ' || s.type::text
                else 'équipes existantes ' || coalesce(d.ids, '-') end, ', ') into e
    from jsonb_to_recordset(v_plan) p(ecole uuid, nom text, doublon uuid, sport uuid, division text, gender text)
    left join public.schools s on s.id = p.ecole
    left join lateral (select string_agg(t.id::text, ',' order by t.id) as ids
                         from public.teams t
                        where t.school_id = p.ecole and t.sport_id = p.sport and t.season = '2026-2027'
                          and coalesce(t.age_group, '') = 'Collégial'
                          and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd') = lower(p.division)
                          and coalesce(t.gender, '') = p.gender) d on true
   where s.id is null or s.type::text <> 'CEGEP' or d.ids is distinct from p.doublon::text;
  if e is not null then raise exception 'NEXUS: école ou dédoublonnage hors plan — %', e; end if;

  -- Côtés de match à relier, équipe par équipe.
  select string_agg(p.nom || ' ' || p.gender || ' ' || x.h || '/' || x.v || ' attendu ' || p.h || '/' || p.v, ', ') into e
    from jsonb_to_recordset(v_plan) p(rid uuid, nom text, gender text, h int, v int),
         lateral (select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p.rid) as h,
                         (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p.rid) as v) x
   where x.h <> p.h or x.v <> p.v;
  if e is not null then raise exception 'NEXUS: côtés à relier hors plan (la veille a bougé : régénérer) — %', e; end if;

  -- Les 12 équipes.
  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, league, rseq_team_id)
  select p.ecole, p.sport, p.nom, 'Collégial', p.division, p.gender, '2026-2027', p.league, p.rid
    from jsonb_to_recordset(v_plan) p(rid uuid, ecole uuid, nom text, sport uuid, division text, gender text, league text);
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % équipe(s) créée(s), attendu 12', n; end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);

  update public.games g set home_team_id = t.id
    from public.teams t
   where t.id = any(v_teams) and g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics nh = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t
   where t.id = any(v_teams) and g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics nv = row_count;
  if nh <> 72 or nv <> 76 then raise exception 'NEXUS: côtés reliés % / %, attendu 72 / 76', nh, nv; end if;

  update public.rseq_sync_alerts a
     set statut = 'TRAITEE', traite_le = now(), traite_par = v_admin,
         note = case p.decision
                  when 'doublon' then 'Équipe créée à la main : 2e équipe distincte, exception au dédoublonnage (GO BP 2026-10-26)'
                  else 'Équipe créée à la main : école établie par correspondance validée par BP (GO BP 2026-10-26)' end
    from jsonb_to_recordset(v_plan) p(alerte uuid, decision text)
   where a.id = p.alerte and a.statut = 'OUVERTE';
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % alerte(s) traitée(s), attendu 12', n; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_12',
          'Chantier cégep : les 12 équipes RSEQ de cégep refusées par la proposition, créées à la main en « Collégial » '
          || '(2 doublons flag F D3 = 2es équipes distinctes ; 10 Basketball D2 Nord-Est CQ B, école par correspondance validée) — GO BP 2026-10-26',
          jsonb_build_object('equipes', 12, 'cotes_domicile', nh, 'cotes_visiteur', nv,
                             'empreinte_alertes', '43e3182df9a741428ef01798b33d2707',
                             'empreinte_rseq_team_ids', '8836addda230b40f74d227d2af3f0f3b',
                             'alertes', to_jsonb(v_al), 'team_ids', to_jsonb(v_teams),
                             'plan', (select jsonb_agg(jsonb_build_object('rseq_team_id', p->'rid', 'school_id', p->'ecole', 'nom', p->'nom',
                                                                          'decision', p->'decision', 'doublon_de', p->'doublon'))
                                        from jsonb_array_elements(v_plan) p)),
          v_admin);
end $$;
