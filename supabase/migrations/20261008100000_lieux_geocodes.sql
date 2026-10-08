-- 20261008100000_lieux_geocodes (LOCALE — à renommer à sa version prod au moment de l'apply)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE DES MATCHS, LOT B — 1/3 : LIEUX GÉOCODÉS (BP 2026-10-07, décision 8).
--
-- Les matchs civils (LFMM, QBFL, QMFL, QMJFL) n'ont pas de coordonnées. On les
-- géocode à part, terrain par terrain, après revue de BP — et on ne les écrit
-- JAMAIS dans games : la synchro RSEQ et les scripts civils en restent les
-- seuls auteurs. La carte lit games d'abord, puis cette table par nom
-- normalisé (matchs_recherche, migration 3/3).
--
--   · lieu_normalise(text) : la clé. Minuscules, accents retirés, « (Main) »
--     retiré, tout ce qui n'est ni lettre ni chiffre → une espace. Le script de
--     géocodage (scripts/carte-matchs-lot-b/) applique la MÊME règle ; la
--     preuve compare les deux sur les terrains réels.
--   · lieux_geocodes : lecture par tout utilisateur connecté (des noms de parcs
--     et leurs coordonnées publiques), AUCUNE écriture client. Les lignes
--     arrivent par une transaction gardée (runbook), avec admin_operations.
--
-- Rollback : supabase/rollback/20261008100000_rollback_lieux_geocodes.sql
-- ════════════════════════════════════════════════════════════════════════════

create function public.lieu_normalise(p_nom text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select nullif(btrim(regexp_replace(
           regexp_replace(
             lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_nom, ''))),
             '\(main\)', ' ', 'g'),
           '[^a-z0-9]+', ' ', 'g')), '')
$$;

comment on function public.lieu_normalise(text) is
  'Clé de terrain : minuscules, sans accents, sans « (Main) », ponctuation → espace. Même règle que scripts/carte-matchs-lot-b/geocoder-terrains.mjs.';

create table public.lieux_geocodes (
  nom_normalise text primary key check (nom_normalise = public.lieu_normalise(nom_normalise)),
  nom_affiche   text not null,
  lat           double precision not null check (lat between -90 and 90),
  lon           double precision not null check (lon between -180 and 180),
  source        text not null check (source in ('nominatim', 'maptiler', 'manuel')),
  revu_par      uuid references public.users(id) on delete set null,
  revu_le       timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.lieux_geocodes is
  'Carte des matchs : coordonnées des terrains sans GPS dans games (civils), par nom normalisé. Écrites après revue de BP, jamais par le client.';

alter table public.lieux_geocodes enable row level security;

create policy lieux_geocodes_lecture on public.lieux_geocodes
  for select to authenticated using (true);

-- Aucune écriture client : on retire aussi ce que les default privileges
-- de Supabase accordent sur toute nouvelle table.
revoke all on table public.lieux_geocodes from public, anon, authenticated;
grant select on table public.lieux_geocodes to authenticated;

-- ACL de la fonction — liste COMPLÈTE triée.
revoke all on function public.lieu_normalise(text) from public, anon;
grant execute on function public.lieu_normalise(text) to authenticated;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.lieu_normalise(text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de lieu_normalise = %, attendu {authenticated,postgres,service_role}', vus;
  end if;

  -- Table : authenticated en lecture seule, anon rien.
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'lieux_geocodes'
                and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type <> 'SELECT'))) then
    raise exception 'NEXUS: lieux_geocodes accorde plus que SELECT à authenticated, ou quelque chose à anon';
  end if;
end $$;
