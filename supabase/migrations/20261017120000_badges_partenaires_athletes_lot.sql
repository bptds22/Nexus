-- Badges partenaire sur les CARTES (recherche, favoris, listes, processus) — lecture par LOT.
-- Demande BP 1.4.5 (R3) : « pas de requête par carte, pas de plafond de 1 000 ».
--
--  · badges_partenaires_athletes(uuid[]) : les badges partenaire d'un lot d'athlètes, une ligne
--    par pose, avec athlete_id. SECURITY INVOKER : délègue athlète par athlète à
--    badges_partenaires_athlete() — aucune règle propre, aucun nouvel accès. Tout ce que la
--    fiche cache (badge masqué, opt-in partenaire retiré — Loi 25, lecteur sans droit) reste
--    caché ici, par construction. Même patron que cotes_partenaires_athletes(uuid[]).
--  · Le client l'appelle PAR PAQUETS d'environ 50 athlètes, seulement pour les cartes affichées, au fil
--    du défilement (PartenaireCartesProvider) — jamais pour tous les résultats d'un coup — et lit toutes
--    les pages de chaque paquet (lireTout, .order("id").range()) : jamais « les 1000 premières ».
--
-- Rien d'autre n'est touché. Rollback :
--   supabase/rollback/20261017120000_rollback_badges_partenaires_athletes_lot.sql

do $$
begin
  if to_regprocedure('public.badges_partenaires_athletes(uuid[])') is not null then
    raise exception 'NEXUS: lot 20261017120000 déjà appliqué';
  end if;
  if to_regprocedure('public.badges_partenaires_athlete(uuid)') is null then
    raise exception 'NEXUS: badges_partenaires_athlete(uuid) absente — la lecture par lot n''a rien à déléguer';
  end if;
  -- La délégation n'est sûre que si la fonction de base fait elle-même la garde (DEFINER + lecteur).
  if not (select prosecdef from pg_proc where oid = 'public.badges_partenaires_athlete(uuid)'::regprocedure) then
    raise exception 'NEXUS: badges_partenaires_athlete doit rester SECURITY DEFINER (garde de lecture)';
  end if;
end $$;

create function public.badges_partenaires_athletes(p_athlete_ids uuid[])
returns table (
  athlete_id uuid, id uuid, badge_id uuid, libelle text, icone_path text, organisation text,
  created_at timestamptz, est_masque boolean, est_le_mien boolean, peut_masquer boolean,
  badge_code text, est_nexus boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.athlete_id, b.id, b.badge_id, b.libelle, b.icone_path, b.organisation, b.created_at,
         b.est_masque, b.est_le_mien, b.peut_masquer, b.badge_code, b.est_nexus
    from (select distinct x as athlete_id from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null) i
    cross join lateral public.badges_partenaires_athlete(i.athlete_id) b
$$;

comment on function public.badges_partenaires_athletes(uuid[]) is
  'Cartes : badges partenaire d''un lot d''athlètes. INVOKER : délègue à badges_partenaires_athlete(), aucune règle propre (masquage et Loi 25 inclus).';

revoke all on function public.badges_partenaires_athletes(uuid[]) from public, anon, authenticated;
grant execute on function public.badges_partenaires_athletes(uuid[]) to authenticated, service_role;

-- GATE — ACL complète, triée, jamais par inclusion (CLAUDE.MD) ; SECURITY INVOKER.
do $$
declare
  f    regprocedure := 'public.badges_partenaires_athletes(uuid[])'::regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de badges_partenaires_athletes = %, attendu %', vus, veut;
  end if;
  if (select prosecdef from pg_proc where oid = f) then
    raise exception 'NEXUS: badges_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
end $$;
