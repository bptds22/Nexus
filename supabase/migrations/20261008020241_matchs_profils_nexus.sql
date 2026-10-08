-- 20261008020241_matchs_profils_nexus (appliquée en prod le 2026-10-08, 02:02 UTC, GO BP ; ex-20261008021500 en local)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE DES MATCHS, LOT A+ — « PROFILS NEXUS DANS CE MATCH » (BP 2026-10-07).
--
-- Sur chaque match de la carte, les joueurs des DEUX équipes qui ont un profil
-- Nexus, suivis ou non par l'unité du recruteur. Une promotion de nos joueurs.
--
-- Pourquoi une fonction : les policies de team_athletes ne laissent un
-- recruteur lire que les lignes des athlètes suivis par son unité ou VÉRIFIÉS.
-- Un comptage côté client ignorerait presque tous les profils. On ne touche
-- PAS à ces policies : la fonction rend un sous-ensemble fermé de colonnes.
--
-- Règles (décisions BP) :
--   · status = 'ACTIF' ET athlete_identity_ok(date_naissance,
--     consentement_parental) — vérifiés ou non. Un mineur sans consentement
--     n'apparaît NI dans le compte NI dans la liste ;
--   · appelant RECRUTEUR avec accès Pro — MÊME test que les écritures de
--     « Mon processus » (policy recruiter_pipeline_insert : rôle RECRUTEUR
--     + user_has_pro()) ; sinon 42501 ;
--   · 500 matchs au plus par appel (le lot B l'appellera sur « tous les
--     matchs » d'une journée : la fonction ne sait rien du mode « suivis ») ;
--   · colonnes rendues : rien d'autre que match, athlète, prénom, nom,
--     position, promotion, côté. Ni courriel, ni téléphone, ni date de
--     naissance, ni coordonnée.
--
-- Rollback : supabase/rollback/20261008020241_rollback_matchs_profils_nexus.sql
-- ════════════════════════════════════════════════════════════════════════════

create function public.matchs_profils_nexus(p_games uuid[])
returns table (
  game_id uuid,
  athlete_id uuid,
  prenom text,
  nom text,
  "position" text,
  promotion int,
  cote text
)
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
  if coalesce(cardinality(p_games), 0) > 500 then
    raise exception 'NEXUS: 500 matchs au plus par appel (reçu %)', cardinality(p_games) using errcode = '22023';
  end if;

  return query
  select distinct on (x.game_id, a.id)
         x.game_id, a.id, a.first_name, a.last_name,
         coalesce(nullif(btrim(p.abreviation), ''), p.nom),
         a.annee_diplomation, x.cote
    from (
      select g.id as game_id, g.home_team_id as team_id, 'DOMICILE'::text as cote
        from public.games g where g.id = any (p_games) and g.home_team_id is not null
      union all
      select g.id, g.visitor_team_id, 'VISITEUR'
        from public.games g where g.id = any (p_games) and g.visitor_team_id is not null
    ) x
    join public.team_athletes ta on ta.team_id = x.team_id
    join public.athletes a on a.id = ta.athlete_id
    left join public.positions p on p.id = a.position_id
   where a.status = 'ACTIF'
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by x.game_id, a.id, x.cote;
end $$;

comment on function public.matchs_profils_nexus(uuid[]) is
  'Carte des matchs : profils Nexus (ACTIF + identité visible) des deux équipes de chaque match. Recruteur Pro seulement, 500 matchs max.';

-- ACL — liste COMPLÈTE triée (CLAUDE.md, 2026-09-07) : PUBLIC et anon retirés.
revoke all on function public.matchs_profils_nexus(uuid[]) from public, anon;
grant execute on function public.matchs_profils_nexus(uuid[]) to authenticated;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_profils_nexus(uuid[])'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de matchs_profils_nexus = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
end $$;
