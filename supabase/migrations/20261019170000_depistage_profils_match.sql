-- ════════════════════════════════════════════════════════════════════════════
-- Dépistage — les profils Nexus d'un match, ÉLARGIS à l'école (BP 2026-10-19 : un joueur de
-- l'École Jacques-Rousseau, n° 1, sur Nexus, jamais reconnu au match).
--
-- matchs_profils_nexus ne rend que les athlètes INSCRITS dans l'une des deux équipes du match
-- (team_athletes). Deux cas réels lui échappent :
--   · un profil Nexus SANS équipe (rien dans team_athletes), de cette école et de ce sport ;
--   · une équipe EN DOUBLE de la même école (deux « Jacques-Rousseau Juvénile ») : les joueurs
--     inscrits dans l'autre ne sortent pas.
-- depistage_profils_match(p_game) rend, pour CHAQUE côté du match :
--   1. les inscrits de l'équipe du match (comme avant) ;
--   2. les inscrits d'une AUTRE équipe de la même école, du même sport et du même groupe d'âge ;
--   3. les athlètes de cette école et de ce sport qui n'ont AUCUNE équipe.
-- Mêmes règles que matchs_profils_nexus : recruteur Pro (sinon 42501), ACTIF, identité permise
-- (athlete_identity_ok), colonnes fermées (aucune coordonnée). matchs_profils_nexus est INCHANGÉE.
-- Un athlète qui joue pour LES DEUX côtés (rare) sort une fois par côté.
--
-- Rollback : supabase/rollback/20261019170000_rollback_depistage_profils_match.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.depistage_profils_match(uuid)') is not null then
    raise exception 'NEXUS: 20261019170000 déjà appliquée';
  end if;
  if to_regprocedure('public.athlete_identity_ok(date,boolean)') is null or to_regprocedure('public.user_has_pro(uuid)') is null then
    raise exception 'NEXUS: préalables absents';
  end if;
end $$;

create function public.depistage_profils_match(p_game uuid)
returns table (athlete_id uuid, prenom text, nom text, cote text, source text)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     or not public.user_has_pro() then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;

  return query
  with cotes as (
    select g.home_team_id as team_id, 'DOMICILE'::text as cote from public.games g where g.id = p_game and g.home_team_id is not null
    union all
    select g.visitor_team_id, 'VISITEUR' from public.games g where g.id = p_game and g.visitor_team_id is not null
  ), mt as (
    select c.cote, t.id as team_id, t.school_id, t.sport_id, coalesce(t.age_group, '') as groupe
      from cotes c join public.teams t on t.id = c.team_id
  ), candidats as (
    -- 1 et 2 : inscrits de l'équipe du match, ou d'une équipe sœur (même école, sport, groupe d'âge).
    select mt.cote, ta.athlete_id, case when t2.id = mt.team_id then 'EQUIPE' else 'EQUIPE_SOEUR' end as source
      from mt
      join public.teams t2 on t2.school_id = mt.school_id and t2.sport_id = mt.sport_id
                          and (t2.id = mt.team_id or coalesce(t2.age_group, '') = mt.groupe)
      join public.team_athletes ta on ta.team_id = t2.id
    union all
    -- 3 : de l'école et du sport, sans aucune équipe.
    select mt.cote, a.id, 'ECOLE'
      from mt
      join public.athletes a on a.school_id = mt.school_id and a.sport_id = mt.sport_id
     where not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
  )
  select distinct on (x.cote, a.id) a.id, a.first_name, a.last_name, x.cote, x.source
    from candidats x
    join public.athletes a on a.id = x.athlete_id
   where a.status = 'ACTIF'
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by x.cote, a.id, case x.source when 'EQUIPE' then 0 when 'EQUIPE_SOEUR' then 1 else 2 end
   limit 400;
end $$;

revoke all on function public.depistage_profils_match(uuid) from public, anon, authenticated;
grant execute on function public.depistage_profils_match(uuid) to authenticated, service_role;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.depistage_profils_match(uuid)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de depistage_profils_match = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
end $$;
