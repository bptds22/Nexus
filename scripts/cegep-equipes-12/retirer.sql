-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK des 12 équipes RSEQ de cégep (scripts/cegep-equipes-12/creer.sql), par la LISTE des 12
-- rseq_team_id (relevé prod 2026-10-26, empreinte 8836addd…).
-- Refuse si une des 12 a reçu un dépendant (athlète, coach, page, fanion, événement, besoin de position,
-- jeton, invitation, carte prospect, prospect partenaire, revendication d'ambassadeur, équipe principale
-- d'un compte). Sinon : remet à NULL les côtés de match, rseq_standings.team_id et rseq_sync_alerts.team_id
-- qui pointent ces équipes (aucun match supprimé), supprime les 12 équipes, rouvre les 12 alertes dans
-- leur état d'avant (OUVERTE, sans note ni traitement), écrit admin_operations CEGEP_EQUIPES_RSEQ_12_RETIREES.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_rids uuid[] := array[
    '028950e6-34ca-4f08-b8b5-7337529be45c',
    '2a991ddd-1782-4bbb-993e-d16c67db5e84',
    '68599a7b-b6d7-4b1b-bce7-caa55600af22',
    '73e3a35a-e00a-41d9-828a-ac7ef5ac7214',
    '8c0749c7-13a0-4d3a-928a-cba989ca65ec',
    '8d15b218-9005-4513-b2d8-17a5ed4fbd71',
    '931b39c9-12d8-4df9-8072-01ace9ee1ce5',
    '9f7f1bf2-11a8-4a56-ab47-6561f199989d',
    'b7c0e77d-76f5-401e-a3ea-beacbf8d27a8',
    'b96f844d-43a5-4854-8bb8-f08ebb6fd830',
    'ca0983e7-85d6-4d8b-9684-89eef3418a9a',
    'f4c5f91f-2ae4-4b71-a90d-52f160af3ef4'
  ]::uuid[];
  v_teams uuid[]; n int; nh int; nv int; ns int; na int;
begin
  if cardinality(v_rids) <> 12
     or md5(array_to_string(array(select x from unnest(v_rids) x order by x), ',')) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: liste des 12 altérée';
  end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);
  if coalesce(cardinality(v_teams), 0) <> 12 then
    raise exception 'NEXUS: % des 12 équipes en base, attendu 12 — rien écrit', coalesce(cardinality(v_teams), 0);
  end if;

  if exists (select 1 from public.team_athletes where team_id = any(v_teams))
     or exists (select 1 from public.team_coaches where team_id = any(v_teams))
     or exists (select 1 from public.team_events where team_id = any(v_teams))
     or exists (select 1 from public.team_invitations where team_id = any(v_teams))
     or exists (select 1 from public.team_join_tokens where team_id = any(v_teams))
     or exists (select 1 from public.team_page_content where team_id = any(v_teams))
     or exists (select 1 from public.team_pennants where team_id = any(v_teams))
     or exists (select 1 from public.team_position_needs where team_id = any(v_teams))
     or exists (select 1 from public.cartes_prospect where team_id = any(v_teams))
     or exists (select 1 from public.partenaire_prospects where team_id = any(v_teams))
     or exists (select 1 from public.ambassadeur_revendications where team_id = any(v_teams))
     or exists (select 1 from public.users where primary_team_id = any(v_teams)) then
    raise exception 'NEXUS: une des 12 équipes a reçu un dépendant — rollback refusé, rien écrit';
  end if;

  update public.games set home_team_id = null where home_team_id = any(v_teams);
  get diagnostics nh = row_count;
  update public.games set visitor_team_id = null where visitor_team_id = any(v_teams);
  get diagnostics nv = row_count;
  update public.rseq_standings set team_id = null where team_id = any(v_teams);
  get diagnostics ns = row_count;
  update public.rseq_sync_alerts set team_id = null where team_id = any(v_teams);

  delete from public.teams where id = any(v_teams);
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % équipe(s) supprimée(s), attendu 12 — rien écrit', n; end if;

  update public.rseq_sync_alerts
     set statut = 'OUVERTE', traite_le = null, traite_par = null, note = null
   where type = 'NOUVELLE_EQUIPE' and statut = 'TRAITEE' and rseq_team_id = any(v_rids);
  get diagnostics na = row_count;
  if na <> 12 then raise exception 'NEXUS: % alerte(s) rouverte(s), attendu 12 — rien écrit', na; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_12_RETIREES', 'Rollback des 12 équipes RSEQ de cégep',
          jsonb_build_object('equipes', n, 'cotes_domicile', nh, 'cotes_visiteur', nv, 'classements', ns,
                             'alertes_rouvertes', na, 'empreinte_rseq_team_ids', '8836addda230b40f74d227d2af3f0f3b'),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
