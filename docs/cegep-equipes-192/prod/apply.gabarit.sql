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
  -- Pas le mercredi avant midi : la veille RSEQ collégiale (mercredi 3 h 55, heure de Montréal)
  -- peut changer les comptes de matchs figés dans ce fichier.
  if extract(isodow from now() at time zone 'America/Toronto') = 3
     and extract(hour from now() at time zone 'America/Toronto') < 12 then
    raise exception 'NEXUS: pas le mercredi avant midi (veille RSEQ collégiale, comptes de matchs)';
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
create temp table _op on commit drop as select $nexus_op$@@OPERATION@@$nexus_op$::text as contenu;
select clock_timestamp() as debut_operation;
do $apply$
begin
  if (select md5(contenu) from _op) <> '@@MD5_OPERATION@@' then
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
