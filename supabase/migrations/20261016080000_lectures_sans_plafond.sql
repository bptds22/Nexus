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
