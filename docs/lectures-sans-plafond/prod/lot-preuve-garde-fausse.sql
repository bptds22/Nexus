-- LOT PROD lectures sans plafond (identifiants dans le corps, aucune coupure à 1000) — généré par docs/lectures-sans-plafond/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261016080000_lectures_sans_plafond.sql — md5 ddb85453dda3ba998225e6bc0b0b808b
-- État de départ attendu des objets : 21280015fba68a00183647d59c52eb48 ; empreinte attendue après : 00000000000000000000000000000000
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _lsp_releve as
select txid_current() as txid,
       (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.athletes)
       || '|' || (select count(*) from public.users) || '|' || (select count(*) from public.team_athletes)
       || '|' || (select count(*) from public.recruiter_pipeline) as donnees,
       (select e.etat from (
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok',
                       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
                       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes',
                       'athlete_suggestions_par_athletes', 'recruiter_activity_log_par_athletes', 'teams_par_ids',
                       'games_par_ids', 'games_des_equipes', 'cartes_par_ids', 'users_par_ids', 'schools_par_ids',
                       'messages_par_conversations', 'team_athletes_par_equipes', 'team_coaches_par_equipes')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t
       ) e) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261016080000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $glsp$
begin
  if (select txid from _lsp_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _lsp_releve) <> 0 then
    raise exception 'NEXUS LOT: migration lectures_sans_plafond déjà présente — rien n''est appliqué';
  end if;
  if (select etat_objets from _lsp_releve) is distinct from '21280015fba68a00183647d59c52eb48' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _lsp_releve);
  end if;
end $glsp$;

-- 3. ===== DÉBUT 20261016080000_lectures_sans_plafond.sql =====
-- Lectures sans plafond ni liste d'identifiants dans l'adresse (décision BP du 2026-10-16, suite du correctif
-- processus-rpc) : calendrier recruteur, Mes listes, statistiques Mon cégep, côté coach, pages admin.
--
-- Le défaut, le même partout : supabase-js met un filtre .in(colonne, ids) dans l'ADRESSE (≈ 37 octets par
-- identifiant ; refus 414/400 au-delà de ~8 Ko en local, soit ~220 identifiants), et PostgREST coupe toute
-- lecture à 1000 lignes (max-rows) sans le dire.
--
-- Le correctif, en deux outils :
--  · des fonctions « par identifiants » : les identifiants voyagent dans le CORPS de l'appel (tableau uuid[]),
--    plus dans l'adresse. Elles rendent les lignes de la table telles quelles (SETOF), donc le client garde
--    ses colonnes, ses tables imbriquées, ses filtres et son tri ; il lit TOUTES les pages (lireTout, côté
--    client) — aucun plafond. SECURITY INVOKER : la RLS de l'appelant décide, exactement comme avant ;
--  · cartes_par_ids : les cartes prospect d'une liste, au format de processus_cartes, une seule valeur jsonb,
--    même règle d'accès (une fois par unité) — SECURITY DEFINER, comme processus_cartes.
--
-- Aucune donnée écrite, aucune fonction existante modifiée, aucun droit nouveau sur les données.

do $$
declare
  v_pol text;
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in (
       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
       'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
       'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
       'team_coaches_par_equipes')) then
    raise exception 'NEXUS: migration déjà appliquée (lectures sans plafond)';
  end if;
  if to_regprocedure('public.processus_cartes(uuid, uuid, boolean)') is null then
    raise exception 'NEXUS: processus_cartes absente (migration 20261016060000 requise avant)';
  end if;
  -- cartes_par_ids reproduit la règle de lecture des cartes : mêmes policies que celles relevées pour
  -- processus_cartes (20261016060000).
  select string_agg(polname || '|' || polcmd::text || '|' || polpermissive::text || '|' || coalesce(pg_get_expr(polqual, polrelid), ''),
                    ';' order by polname)
    into v_pol
    from pg_policy
   where polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
     and polcmd in ('r', '*');
  if v_pol is distinct from 'cartes_non_fusionnees|*|false|(fusionnee_le IS NULL);'
                            'cartes_notes_select|r|true|carte_lecture_ok(carte_id);'
                            'cartes_select|r|true|acces_carte_lecture(unite_cegep_id, unite_sport_id)' then
    raise exception 'NEXUS: policies de lecture des cartes ≠ relevé (%)', v_pol;
  end if;
end $$;

-- ── Par identifiants : les lignes de la table, sous la RLS de l'appelant ────

create function public.athletes_par_ids(p_ids uuid[])
returns setof public.athletes language sql stable security invoker set search_path = public
as $$ select a.* from public.athletes a where a.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_athletes_par_athletes(p_ids uuid[])
returns setof public.team_athletes language sql stable security invoker set search_path = public
as $$ select t.* from public.team_athletes t where t.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_favorites_par_athletes(p_ids uuid[])
returns setof public.recruiter_favorites language sql stable security invoker set search_path = public
as $$ select f.* from public.recruiter_favorites f where f.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_athlete_views_par_athletes(p_ids uuid[])
returns setof public.recruiter_athlete_views language sql stable security invoker set search_path = public
as $$ select v.* from public.recruiter_athlete_views v where v.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.conversations_par_athletes(p_ids uuid[])
returns setof public.conversations language sql stable security invoker set search_path = public
as $$ select c.* from public.conversations c where c.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.athlete_suggestions_par_athletes(p_ids uuid[])
returns setof public.athlete_suggestions language sql stable security invoker set search_path = public
as $$ select s.* from public.athlete_suggestions s where s.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_activity_log_par_athletes(p_ids uuid[])
returns setof public.recruiter_activity_log language sql stable security invoker set search_path = public
as $$ select l.* from public.recruiter_activity_log l where l.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.teams_par_ids(p_ids uuid[])
returns setof public.teams language sql stable security invoker set search_path = public
as $$ select t.* from public.teams t where t.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.games_par_ids(p_ids uuid[])
returns setof public.games language sql stable security invoker set search_path = public
as $$ select g.* from public.games g where g.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.users_par_ids(p_ids uuid[])
returns setof public.users language sql stable security invoker set search_path = public
as $$ select u.* from public.users u where u.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.schools_par_ids(p_ids uuid[])
returns setof public.schools language sql stable security invoker set search_path = public
as $$ select s.* from public.schools s where s.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.messages_par_conversations(p_ids uuid[])
returns setof public.messages language sql stable security invoker set search_path = public
as $$ select m.* from public.messages m where m.conversation_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_athletes_par_equipes(p_ids uuid[])
returns setof public.team_athletes language sql stable security invoker set search_path = public
as $$ select t.* from public.team_athletes t where t.team_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_coaches_par_equipes(p_ids uuid[])
returns setof public.team_coaches language sql stable security invoker set search_path = public
as $$ select t.* from public.team_coaches t where t.team_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

-- Les matchs d'un ensemble d'équipes (à domicile OU en visite), à partir d'une date.
create function public.games_des_equipes(p_equipes uuid[], p_depuis date)
returns setof public.games language sql stable security invoker set search_path = public
as $$
  select g.* from public.games g
   where g.game_date >= p_depuis
     and (g.home_team_id = any(coalesce(p_equipes, '{}'::uuid[])) or g.visitor_team_id = any(coalesce(p_equipes, '{}'::uuid[])))
$$;

-- ── Cartes prospect par identifiants (membres d'une liste), une seule valeur ─

create function public.cartes_par_ids(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  -- Même règle que processus_cartes (policies cartes_select + cartes_non_fusionnees), évaluée une fois par
  -- UNITÉ (MATERIALIZED : jamais poussée ligne à ligne).
  with demandees as materialized (
         select c.* from public.cartes_prospect c where c.id = any(coalesce(p_ids, '{}'::uuid[]))),
       unites as materialized (
         select distinct d.unite_cegep_id, d.unite_sport_id from demandees d),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_agg(to_jsonb(x) order by x.etape_le desc, x.id), '[]'::jsonb)
    from (
      select c.id, c.unite_cegep_id, c.unite_sport_id, c.cree_par, c.prenom, c.nom, c.team_id, c.position_id,
             c.numero, c.promotion, c.taille_pieds, c.taille_pouces, c.poids_lbs, c.lien_video, c.courriel,
             c.telephone, c.parent_nom, c.parent_courriel, c.etape, c.grade, c.relance_le, c.relance_note,
             c.visite_le, c.drapeau, c.invitee_le, c.invitation_etat, c.renvois_invitation, c.dernier_renvoi_le,
             c.etape_le, c.derniere_activite, c.created_at, c.school_id, c.sport_athlete_id,
             case when t.id is null then null else jsonb_build_object(
               'name', t.name, 'division', t.division, 'league', t.league, 'age_group', t.age_group,
               'gender', t.gender, 'zone', t.zone, 'season', t.season, 'rseq_team_id', t.rseq_team_id,
               'schools', case when ts.id is null then null
                               else jsonb_build_object('name', ts.name, 'region', ts.region, 'type', ts.type) end)
             end as teams,
             case when e.id is null then null
                  else jsonb_build_object('name', e.name, 'region', e.region, 'type', e.type) end as etablissement,
             case when p.id is null then null else jsonb_build_object('abreviation', p.abreviation) end as positions
        from demandees c
        join lisibles l              on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
        left join public.teams t     on t.id = c.team_id
        left join public.schools ts  on ts.id = t.school_id
        left join public.schools e   on e.id = c.school_id
        left join public.positions p on p.id = c.position_id
       where c.fusionnee_le is null
    ) x
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'athletes_par_ids(uuid[])', 'team_athletes_par_athletes(uuid[])', 'recruiter_favorites_par_athletes(uuid[])',
    'recruiter_athlete_views_par_athletes(uuid[])', 'conversations_par_athletes(uuid[])',
    'athlete_suggestions_par_athletes(uuid[])', 'recruiter_activity_log_par_athletes(uuid[])', 'teams_par_ids(uuid[])',
    'games_par_ids(uuid[])', 'games_des_equipes(uuid[], date)', 'cartes_par_ids(uuid[])', 'users_par_ids(uuid[])',
    'schools_par_ids(uuid[])', 'messages_par_conversations(uuid[])', 'team_athletes_par_equipes(uuid[])',
    'team_coaches_par_equipes(uuid[])']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
        'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
        'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
        'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
        'team_coaches_par_equipes')) <> 16 then
    raise exception 'NEXUS: fonctions de lecture manquantes';
  end if;
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in (
              'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
              'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
              'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
              'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
              'team_coaches_par_equipes')
  loop
    -- Seule cartes_par_ids est DEFINER (règle des cartes reproduite) ; toutes les autres restent sous la RLS.
    if r.prosecdef <> (r.proname = 'cartes_par_ids') then
      raise exception 'NEXUS: mode de sécurité inattendu pour %', r.proname;
    end if;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select position('acces_carte_lecture(' in prosrc) > 0 and position('fusionnee_le is null' in prosrc) > 0
        from pg_proc where oid = 'public.cartes_par_ids(uuid[])'::regprocedure) is not true then
    raise exception 'NEXUS: cartes_par_ids ne reproduit pas la règle des policies';
  end if;
  raise notice 'NEXUS lectures sans plafond : 16 fonctions (identifiants dans le corps, RLS de l''appelant) — OK';
end $$;

-- ===== FIN 20261016080000_lectures_sans_plafond.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _lsp_texte as select $LSPMIG$-- Lectures sans plafond ni liste d'identifiants dans l'adresse (décision BP du 2026-10-16, suite du correctif
-- processus-rpc) : calendrier recruteur, Mes listes, statistiques Mon cégep, côté coach, pages admin.
--
-- Le défaut, le même partout : supabase-js met un filtre .in(colonne, ids) dans l'ADRESSE (≈ 37 octets par
-- identifiant ; refus 414/400 au-delà de ~8 Ko en local, soit ~220 identifiants), et PostgREST coupe toute
-- lecture à 1000 lignes (max-rows) sans le dire.
--
-- Le correctif, en deux outils :
--  · des fonctions « par identifiants » : les identifiants voyagent dans le CORPS de l'appel (tableau uuid[]),
--    plus dans l'adresse. Elles rendent les lignes de la table telles quelles (SETOF), donc le client garde
--    ses colonnes, ses tables imbriquées, ses filtres et son tri ; il lit TOUTES les pages (lireTout, côté
--    client) — aucun plafond. SECURITY INVOKER : la RLS de l'appelant décide, exactement comme avant ;
--  · cartes_par_ids : les cartes prospect d'une liste, au format de processus_cartes, une seule valeur jsonb,
--    même règle d'accès (une fois par unité) — SECURITY DEFINER, comme processus_cartes.
--
-- Aucune donnée écrite, aucune fonction existante modifiée, aucun droit nouveau sur les données.

do $$
declare
  v_pol text;
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in (
       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
       'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
       'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
       'team_coaches_par_equipes')) then
    raise exception 'NEXUS: migration déjà appliquée (lectures sans plafond)';
  end if;
  if to_regprocedure('public.processus_cartes(uuid, uuid, boolean)') is null then
    raise exception 'NEXUS: processus_cartes absente (migration 20261016060000 requise avant)';
  end if;
  -- cartes_par_ids reproduit la règle de lecture des cartes : mêmes policies que celles relevées pour
  -- processus_cartes (20261016060000).
  select string_agg(polname || '|' || polcmd::text || '|' || polpermissive::text || '|' || coalesce(pg_get_expr(polqual, polrelid), ''),
                    ';' order by polname)
    into v_pol
    from pg_policy
   where polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
     and polcmd in ('r', '*');
  if v_pol is distinct from 'cartes_non_fusionnees|*|false|(fusionnee_le IS NULL);'
                            'cartes_notes_select|r|true|carte_lecture_ok(carte_id);'
                            'cartes_select|r|true|acces_carte_lecture(unite_cegep_id, unite_sport_id)' then
    raise exception 'NEXUS: policies de lecture des cartes ≠ relevé (%)', v_pol;
  end if;
end $$;

-- ── Par identifiants : les lignes de la table, sous la RLS de l'appelant ────

create function public.athletes_par_ids(p_ids uuid[])
returns setof public.athletes language sql stable security invoker set search_path = public
as $$ select a.* from public.athletes a where a.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_athletes_par_athletes(p_ids uuid[])
returns setof public.team_athletes language sql stable security invoker set search_path = public
as $$ select t.* from public.team_athletes t where t.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_favorites_par_athletes(p_ids uuid[])
returns setof public.recruiter_favorites language sql stable security invoker set search_path = public
as $$ select f.* from public.recruiter_favorites f where f.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_athlete_views_par_athletes(p_ids uuid[])
returns setof public.recruiter_athlete_views language sql stable security invoker set search_path = public
as $$ select v.* from public.recruiter_athlete_views v where v.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.conversations_par_athletes(p_ids uuid[])
returns setof public.conversations language sql stable security invoker set search_path = public
as $$ select c.* from public.conversations c where c.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.athlete_suggestions_par_athletes(p_ids uuid[])
returns setof public.athlete_suggestions language sql stable security invoker set search_path = public
as $$ select s.* from public.athlete_suggestions s where s.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.recruiter_activity_log_par_athletes(p_ids uuid[])
returns setof public.recruiter_activity_log language sql stable security invoker set search_path = public
as $$ select l.* from public.recruiter_activity_log l where l.athlete_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.teams_par_ids(p_ids uuid[])
returns setof public.teams language sql stable security invoker set search_path = public
as $$ select t.* from public.teams t where t.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.games_par_ids(p_ids uuid[])
returns setof public.games language sql stable security invoker set search_path = public
as $$ select g.* from public.games g where g.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.users_par_ids(p_ids uuid[])
returns setof public.users language sql stable security invoker set search_path = public
as $$ select u.* from public.users u where u.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.schools_par_ids(p_ids uuid[])
returns setof public.schools language sql stable security invoker set search_path = public
as $$ select s.* from public.schools s where s.id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.messages_par_conversations(p_ids uuid[])
returns setof public.messages language sql stable security invoker set search_path = public
as $$ select m.* from public.messages m where m.conversation_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_athletes_par_equipes(p_ids uuid[])
returns setof public.team_athletes language sql stable security invoker set search_path = public
as $$ select t.* from public.team_athletes t where t.team_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

create function public.team_coaches_par_equipes(p_ids uuid[])
returns setof public.team_coaches language sql stable security invoker set search_path = public
as $$ select t.* from public.team_coaches t where t.team_id = any(coalesce(p_ids, '{}'::uuid[])) $$;

-- Les matchs d'un ensemble d'équipes (à domicile OU en visite), à partir d'une date.
create function public.games_des_equipes(p_equipes uuid[], p_depuis date)
returns setof public.games language sql stable security invoker set search_path = public
as $$
  select g.* from public.games g
   where g.game_date >= p_depuis
     and (g.home_team_id = any(coalesce(p_equipes, '{}'::uuid[])) or g.visitor_team_id = any(coalesce(p_equipes, '{}'::uuid[])))
$$;

-- ── Cartes prospect par identifiants (membres d'une liste), une seule valeur ─

create function public.cartes_par_ids(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  -- Même règle que processus_cartes (policies cartes_select + cartes_non_fusionnees), évaluée une fois par
  -- UNITÉ (MATERIALIZED : jamais poussée ligne à ligne).
  with demandees as materialized (
         select c.* from public.cartes_prospect c where c.id = any(coalesce(p_ids, '{}'::uuid[]))),
       unites as materialized (
         select distinct d.unite_cegep_id, d.unite_sport_id from demandees d),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_agg(to_jsonb(x) order by x.etape_le desc, x.id), '[]'::jsonb)
    from (
      select c.id, c.unite_cegep_id, c.unite_sport_id, c.cree_par, c.prenom, c.nom, c.team_id, c.position_id,
             c.numero, c.promotion, c.taille_pieds, c.taille_pouces, c.poids_lbs, c.lien_video, c.courriel,
             c.telephone, c.parent_nom, c.parent_courriel, c.etape, c.grade, c.relance_le, c.relance_note,
             c.visite_le, c.drapeau, c.invitee_le, c.invitation_etat, c.renvois_invitation, c.dernier_renvoi_le,
             c.etape_le, c.derniere_activite, c.created_at, c.school_id, c.sport_athlete_id,
             case when t.id is null then null else jsonb_build_object(
               'name', t.name, 'division', t.division, 'league', t.league, 'age_group', t.age_group,
               'gender', t.gender, 'zone', t.zone, 'season', t.season, 'rseq_team_id', t.rseq_team_id,
               'schools', case when ts.id is null then null
                               else jsonb_build_object('name', ts.name, 'region', ts.region, 'type', ts.type) end)
             end as teams,
             case when e.id is null then null
                  else jsonb_build_object('name', e.name, 'region', e.region, 'type', e.type) end as etablissement,
             case when p.id is null then null else jsonb_build_object('abreviation', p.abreviation) end as positions
        from demandees c
        join lisibles l              on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
        left join public.teams t     on t.id = c.team_id
        left join public.schools ts  on ts.id = t.school_id
        left join public.schools e   on e.id = c.school_id
        left join public.positions p on p.id = c.position_id
       where c.fusionnee_le is null
    ) x
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  foreach f in array array[
    'athletes_par_ids(uuid[])', 'team_athletes_par_athletes(uuid[])', 'recruiter_favorites_par_athletes(uuid[])',
    'recruiter_athlete_views_par_athletes(uuid[])', 'conversations_par_athletes(uuid[])',
    'athlete_suggestions_par_athletes(uuid[])', 'recruiter_activity_log_par_athletes(uuid[])', 'teams_par_ids(uuid[])',
    'games_par_ids(uuid[])', 'games_des_equipes(uuid[], date)', 'cartes_par_ids(uuid[])', 'users_par_ids(uuid[])',
    'schools_par_ids(uuid[])', 'messages_par_conversations(uuid[])', 'team_athletes_par_equipes(uuid[])',
    'team_coaches_par_equipes(uuid[])']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
        'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
        'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
        'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
        'team_coaches_par_equipes')) <> 16 then
    raise exception 'NEXUS: fonctions de lecture manquantes';
  end if;
  for r in select p.oid, p.proname, p.prosecdef from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in (
              'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
              'recruiter_athlete_views_par_athletes', 'conversations_par_athletes', 'athlete_suggestions_par_athletes',
              'recruiter_activity_log_par_athletes', 'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
              'users_par_ids', 'schools_par_ids', 'messages_par_conversations', 'team_athletes_par_equipes',
              'team_coaches_par_equipes')
  loop
    -- Seule cartes_par_ids est DEFINER (règle des cartes reproduite) ; toutes les autres restent sous la RLS.
    if r.prosecdef <> (r.proname = 'cartes_par_ids') then
      raise exception 'NEXUS: mode de sécurité inattendu pour %', r.proname;
    end if;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select position('acces_carte_lecture(' in prosrc) > 0 and position('fusionnee_le is null' in prosrc) > 0
        from pg_proc where oid = 'public.cartes_par_ids(uuid[])'::regprocedure) is not true then
    raise exception 'NEXUS: cartes_par_ids ne reproduit pas la règle des policies';
  end if;
  raise notice 'NEXUS lectures sans plafond : 16 fonctions (identifiants dans le corps, RLS de l''appelant) — OK';
end $$;
$LSPMIG$::text as t;
do $elsp$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _lsp_texte' using '20261016080000', 'lectures_sans_plafond', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _lsp_texte' using '20261016080000', 'lectures_sans_plafond';
  end if;
end $elsp$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_LECTURES_SANS_PLAFOND',
       'Lectures sans plafond : calendrier recruteur, Mes listes, Mon cégep, côté coach, pages admin — identifiants dans le corps, aucune coupure à 1000 lignes (suite du correctif processus-rpc, GO BP)',
       jsonb_build_object('version', '20261016080000', 'md5_fichier', 'ddb85453dda3ba998225e6bc0b0b808b', 'etat_depart', '21280015fba68a00183647d59c52eb48',
                          'empreinte_objets', '00000000000000000000000000000000'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $flsp$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _lsp_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016080000')
     is distinct from 'ddb85453dda3ba998225e6bc0b0b808b' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else p.prosrc end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok',
                       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
                       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes',
                       'athlete_suggestions_par_athletes', 'recruiter_activity_log_par_athletes', 'teams_par_ids',
                       'games_par_ids', 'games_des_equipes', 'cartes_par_ids', 'users_par_ids', 'schools_par_ids',
                       'messages_par_conversations', 'team_athletes_par_equipes', 'team_coaches_par_equipes')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t
  ) e;
  if v_empreinte is distinct from '00000000000000000000000000000000' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.athletes)
       || '|' || (select count(*) from public.users) || '|' || (select count(*) from public.team_athletes)
       || '|' || (select count(*) from public.recruiter_pipeline) <> (select donnees from _lsp_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _lsp_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $flsp$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _lsp_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.athletes)
       || '|' || (select count(*) from public.users) || '|' || (select count(*) from public.team_athletes)
       || '|' || (select count(*) from public.recruiter_pipeline),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016080000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016080000'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_LECTURES_SANS_PLAFOND' order by le desc limit 1),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                     and proname in ('athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
                                     'recruiter_athlete_views_par_athletes', 'conversations_par_athletes',
                                     'athlete_suggestions_par_athletes', 'recruiter_activity_log_par_athletes',
                                     'teams_par_ids', 'games_par_ids', 'games_des_equipes', 'cartes_par_ids',
                                     'users_par_ids', 'schools_par_ids', 'messages_par_conversations',
                                     'team_athletes_par_equipes', 'team_coaches_par_equipes')),
     'meme_transaction', (select txid from _lsp_releve) = txid_current())
) as resultat_lot_lectures_sans_plafond;
