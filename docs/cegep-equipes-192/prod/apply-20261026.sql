-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — APPLY RÉEL EN PROD : les 192 équipes RSEQ de cégep (GO BP après le rejeu à blanc).
-- Fichier GÉNÉRÉ par scripts/cegep-equipes-192/generer.sh <date> apply : l'opération (creer.sql) y est
-- embarquée telle quelle (LF, même texte que celui du rejeu, md5 gardé).
--
-- UNE transaction : gardes AVANT → opération (elle vérifie elle-même les 192 exactes, les côtés à
-- relier et sa sortie, et écrit admin_operations CEGEP_EQUIPES_RSEQ_192) → gardes APRÈS (rien d'autre
-- n'a bougé) → COMMIT. Toute garde qui échoue arrête psql AVANT le COMMIT : rien n'est appliqué.
-- Opération de données : pas d'inscription dans schema_migrations. Lancer SANS -1.
-- Rollback : docs/cegep-equipes-192/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-192';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
begin
  -- Jamais le mardi ; jamais le mercredi matin (veille RSEQ collégiale à 3 h 55, heure de Montréal).
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 12) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi matin';
  end if;
  if exists (select 1 from public.admin_operations
              where operation in ('CEGEP_EQUIPES_RSEQ_192', 'CEGEP_EQUIPES_RSEQ_192_RETIREES')) then
    raise exception 'NEXUS: les 192 ont déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- Relevés AVANT : tout ce qui ne doit pas bouger.
create temp table _avant on commit drop as
select (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t) as equipes,
       (select count(*) from public.teams) as nb_equipes,
       (select md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from public.games g) as matchs_sans_liaison,
       (select md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.rseq_standings s) as classements,
       (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) from public.athletes a) as athletes,
       (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.team_athletes x) as team_athletes,
       (select md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.schools s) as ecoles,
       (select count(*) from public.rseq_sync_alerts where type = 'NOUVELLE_EQUIPE' and statut = 'OUVERTE') as alertes_ouvertes;
select nb_equipes, alertes_ouvertes from _avant;

-- ── 1. L'opération, texte gardé par son md5 ─────────────────────────────────
create temp table _op on commit drop as select $nexus_op$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — les 192 équipes RSEQ de cégep proposées par la veille (GO BP 2026-10-26).
-- Opération de DONNÉES (aucun objet de schéma) : rseq_creer_equipes_proposees, fonction existante,
-- appelée sous l'identité de l'admin, avec EXACTEMENT les 192 alertes NOUVELLE_EQUIPE ouvertes dont la
-- proposition est « a_creer » (catégorie « Collégial » depuis B2). Les 12 refus (2 doublons, 10 écoles
-- introuvables) ne sont pas passés à la fonction : leurs alertes restent OUVERTE, intactes.
--
-- La fonction : recalcule la proposition, crée les équipes, relie les côtés de match NULL par
-- rseq_team_id, écrit admin_operations EQUIPES_RSEQ_CREEES, passe les alertes à TRAITEE ; nombres exacts
-- ou rien. Elle ne crée aucune école, ne touche ni athlètes, ni classements (la veille relie
-- rseq_standings.team_id à son passage suivant).
--
-- Gardes : 192 alertes exactes (empreinte d081e67c…) et 192 rseq_team_id exacts (5834ba79…), aucun
-- déjà en base, 1 462 côtés domicile + 1 454 visiteur à relier, puis les mêmes nombres en sortie.
-- Rollback : scripts/cegep-equipes-192/retirer.sql (par la liste des 192 rseq_team_id).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_al uuid[]; v_rids uuid[]; v_teams uuid[]; r jsonb; n int; nh int; nv int;
begin
  with p as (
    select a.id, a.rseq_team_id,
           public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                          a.rseq_league_id, a.payload->>'saison', 'Collégial') as j
      from public.rseq_sync_alerts a
     where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE')
  select array_agg(p.id order by p.id), array_agg(p.rseq_team_id order by p.rseq_team_id)
    into v_al, v_rids
    from p where p.j->>'decision' = 'a_creer' and p.j->>'age_group' = 'Collégial';

  if coalesce(cardinality(v_al), 0) <> 192
     or md5(array_to_string(v_al, ',')) <> 'd081e67cc269edf1921a88e5f7cecbd9'
     or md5(array_to_string(v_rids, ',')) <> '5834ba7981ca91638a8970541dc42117' then
    raise exception 'NEXUS: les 192 alertes ont bougé (% alerte(s), empreintes % / %)',
      coalesce(cardinality(v_al), 0), md5(array_to_string(v_al, ',')), md5(array_to_string(v_rids, ','));
  end if;
  if exists (select 1 from public.teams where rseq_team_id = any(v_rids)) then
    raise exception 'NEXUS: une des 192 équipes existe déjà';
  end if;
  select count(*) into nh from public.games where home_team_id is null and home_rseq_team_id = any(v_rids);
  select count(*) into nv from public.games where visitor_team_id is null and visitor_rseq_team_id = any(v_rids);
  if nh <> 1462 or nv <> 1454 then
    raise exception 'NEXUS: côtés à relier % / %, attendu 1462 / 1454 (la veille a bougé : régénérer)', nh, nv;
  end if;

  -- L'admin (is_admin() lit auth.uid()) : l'identité de BP, comme les lots RSEQ.
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'role', 'authenticated')::text, true);
  r := public.rseq_creer_equipes_proposees(v_al);
  perform set_config('request.jwt.claims', '', true);

  if (r->>'equipes_creees')::int <> 192 or (r->>'cotes_domicile')::int <> 1462 or (r->>'cotes_visiteur')::int <> 1454
     or jsonb_array_length(r->'refusees') <> 0 then
    raise exception 'NEXUS: sortie inattendue de rseq_creer_equipes_proposees : %', r;
  end if;

  select array_agg(t.id order by t.id) into v_teams
    from public.teams t join public.schools s on s.id = t.school_id
   where t.rseq_team_id = any(v_rids) and s.type::text = 'CEGEP'
     and t.age_group = 'Collégial' and t.season = '2026-2027';
  if coalesce(cardinality(v_teams), 0) <> 192 then
    raise exception 'NEXUS: % équipe(s) créée(s) conforme(s), attendu 192', coalesce(cardinality(v_teams), 0);
  end if;
  select count(*) into n from public.rseq_sync_alerts where id = any(v_al) and statut = 'TRAITEE';
  if n <> 192 then raise exception 'NEXUS: % alerte(s) traitée(s), attendu 192', n; end if;
  select count(*) into n from public.games where home_team_id = any(v_teams);
  select count(*) into nh from public.games where visitor_team_id = any(v_teams);
  if n <> 1462 or nh <> 1454 then
    raise exception 'NEXUS: côtés reliés % / %, attendu 1462 / 1454', n, nh;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_192',
          'Chantier cégep : les 192 équipes RSEQ de cégep proposées par la veille, créées en « Collégial » (GO BP 2026-10-26)',
          jsonb_build_object('equipes', 192, 'cotes_domicile', 1462, 'cotes_visiteur', 1454,
                             'empreinte_alertes', 'd081e67cc269edf1921a88e5f7cecbd9',
                             'empreinte_rseq_team_ids', '5834ba7981ca91638a8970541dc42117',
                             'alertes', to_jsonb(v_al), 'team_ids', to_jsonb(v_teams)),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
$nexus_op$::text as contenu;
select clock_timestamp() as debut_operation;
do $apply$
begin
  if (select md5(contenu) from _op) <> '7c2d244bdbbaf7e52eb0b853c6e6e8ec' then
    raise exception 'NEXUS: texte de l''opération altéré (md5 %)', (select md5(contenu) from _op);
  end if;
  execute (select contenu from _op);
end $apply$;
select clock_timestamp() as fin_operation;

-- ── 2. Gardes APRÈS ──────────────────────────────────────────────────────────
do $$
declare v_teams uuid[]; v_al uuid[]; n int;
begin
  select array(select jsonb_array_elements_text(details->'team_ids')::uuid), array(select jsonb_array_elements_text(details->'alertes')::uuid)
    into v_teams, v_al
    from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_192';
  if coalesce(cardinality(v_teams), 0) <> 192 or coalesce(cardinality(v_al), 0) <> 192 then
    raise exception 'NEXUS: ligne admin_operations CEGEP_EQUIPES_RSEQ_192 incomplète';
  end if;
  if (select count(*) from public.teams) <> (select nb_equipes from _avant) + 192 then
    raise exception 'NEXUS: nombre d''équipes inattendu';
  end if;
  if (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t where t.id <> all(v_teams))
     is distinct from (select equipes from _avant) then
    raise exception 'NEXUS: une équipe existante a changé';
  end if;
  if (select md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from public.games g)
     is distinct from (select matchs_sans_liaison from _avant) then
    raise exception 'NEXUS: un match a changé ailleurs que dans ses liaisons';
  end if;
  select count(*) into n from public.games where home_team_id = any(v_teams);
  if n <> 1462 then raise exception 'NEXUS: % côtés domicile reliés, attendu 1462', n; end if;
  select count(*) into n from public.games where visitor_team_id = any(v_teams);
  if n <> 1454 then raise exception 'NEXUS: % côtés visiteur reliés, attendu 1454', n; end if;
  if (select md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.rseq_standings s) is distinct from (select classements from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) from public.athletes a) is distinct from (select athletes from _avant)
     or (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.team_athletes x) is distinct from (select team_athletes from _avant)
     or (select md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.schools s) is distinct from (select ecoles from _avant) then
    raise exception 'NEXUS: classements, athlètes, rattachements ou écoles ont bougé';
  end if;
  if (select count(*) from public.rseq_sync_alerts where type = 'NOUVELLE_EQUIPE' and statut = 'OUVERTE')
     <> (select alertes_ouvertes from _avant) - 192 then
    raise exception 'NEXUS: alertes ouvertes inattendues (les 12 refus doivent rester ouverts)';
  end if;
  if (select count(*) from public.admin_operations where operation = 'EQUIPES_RSEQ_CREEES' and le = now()) <> 1
     or (select count(*) from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_192') <> 1 then
    raise exception 'NEXUS: lignes admin_operations absentes ou en double';
  end if;
end $$;

select (select count(*) from public.teams t, public.admin_operations o
         where o.operation = 'CEGEP_EQUIPES_RSEQ_192' and t.id in (select jsonb_array_elements_text(o.details->'team_ids')::uuid)
           and t.age_group = 'Collégial') as equipes_collegial,
       (select count(*) from public.rseq_sync_alerts where type = 'NOUVELLE_EQUIPE' and statut = 'OUVERTE') as refus_restes_ouverts,
       clock_timestamp() as avant_commit;
commit;
\echo '== COMMIT fait : 192 équipes cégep en prod.'
