-- Rollback 3/4 : remet rseq_ligues_a_appeler à sa définition d'avant (relevée en prod le 2026-10-08,
-- md5 pg_get_viewdef f6c8bc2ab2eb491b762a1df1ee95949a). Les colonnes tranche_passe et matchs_connus ne peuvent pas être retirées par
-- CREATE OR REPLACE : DROP puis CREATE, donc l'ACL est reposée à l'identique (relevé prod :
-- anon, authenticated, postgres, service_role — tous privilèges) et vérifiée en liste complète triée.
-- La fonction v2 de rseq-weekly-sync lit tranche_passe et matchs_connus : la remettre en v1 AVANT ce rollback.
begin;
drop view if exists public.rseq_ligues_a_appeler;
create view public.rseq_ligues_a_appeler with (security_invoker = true) as
 WITH courante AS (
         SELECT
                CASE
                    WHEN (EXTRACT(month FROM CURRENT_DATE) >= (7)::numeric) THEN (((EXTRACT(year FROM CURRENT_DATE))::integer || '-'::text) || ((EXTRACT(year FROM CURRENT_DATE))::integer + 1))
                    ELSE ((((EXTRACT(year FROM CURRENT_DATE))::integer - 1) || '-'::text) || (EXTRACT(year FROM CURRENT_DATE))::integer)
                END AS saison
        ), sources AS (
         SELECT 1 AS priorite,
            'catalogue'::text AS origine,
            c.rseq_league_id,
            c.saison,
            c.secteur AS sector,
            c.sport,
            c.region,
            c.division,
            c.category,
            c.sex_type,
            c.league_name
           FROM (rseq_ligues_publiees c
             JOIN courante k ON ((k.saison = c.saison)))
        UNION ALL
         SELECT 2,
            'games',
            g.rseq_league_id,
            g.season,
            g.sector,
            g.sport,
            g.region,
            g.division,
            g.category,
            g.sex_type,
            g.league_name
           FROM (games g
             JOIN courante k ON ((k.saison = g.season)))
          WHERE (g.rseq_league_id IS NOT NULL)
        )
 SELECT DISTINCT ON (rseq_league_id) rseq_league_id,
    saison,
    sector,
    sport,
    region,
    division,
    category,
    sex_type,
    league_name,
    rseq_family_key(sector, sport, division) AS family_key,
    origine
   FROM sources s
  WHERE ((sector = ANY (ARRAY['Collégial'::text, 'Secondaire'::text])) AND (lower(COALESCE(sport, ''::text)) <> ALL (ARRAY['natation'::text, 'cross-country'::text])))
  ORDER BY rseq_league_id, priorite, league_name;
revoke all on public.rseq_ligues_a_appeler from public;
grant all on public.rseq_ligues_a_appeler to anon, authenticated, service_role;

do $gate$
declare vus text[];
begin
  select array_agg(g order by g) into vus
    from (select distinct coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
            from unnest((select relacl from pg_class where oid = 'public.rseq_ligues_a_appeler'::regclass)::text[]) x) t;
  if vus is distinct from array['anon', 'authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL rollback rseq_ligues_a_appeler = %', vus;
  end if;
  if md5(pg_get_viewdef('public.rseq_ligues_a_appeler'::regclass)) <> 'f6c8bc2ab2eb491b762a1df1ee95949a' then
    raise exception 'NEXUS: définition remise ≠ définition prod d''avant (md5 %)', md5(pg_get_viewdef('public.rseq_ligues_a_appeler'::regclass));
  end if;
end $gate$;
commit;
