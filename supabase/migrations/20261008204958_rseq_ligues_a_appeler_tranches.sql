-- Veille RSEQ, correctif de découverte — 3/4 : ce que la passe appelle (vue rseq_ligues_a_appeler).
-- (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP — fichier renommé depuis sa version locale 2026100821x00)
-- (LOCAL — non appliquée en prod ; plan § 3.)
--
-- Inchangé : union catalogue (priorité 1) + games de la saison courante (priorité 2), secteurs Collégial et
-- Secondaire, une ligne par rseq_league_id.
-- Nouveau :
--   * sports SANS MATCH exclus — liste ÉCRITE, pas déduite (audit 2026-10-08 : 0 match dans ces sports, sauf
--     Improvisation, 3 matchs, sport absent de Nexus). Natation et cross-country l'étaient déjà ;
--   * une ligne du CATALOGUE n'est appelée que si team_count > 0 (une ligue vide n'a rien à servir ; audit :
--     aucune ligue avec matchs n'annonce 0 équipe). Une ligue déjà présente dans games reste appelée ;
--   * colonne tranche_passe (1 à 4) : quart ÉQUILIBRÉ des ligues pour la passe secondaire (décision BP
--     2026-10-08 : mer/jeu/ven/sam), par hachage stable de rseq_league_id (premier octet du md5, modulo 4). Un découpage par RÉGION (celui de la
--     découverte) est trop déséquilibré pour la passe : 243 / 448 / 265 ligues au 2026-10-08, et la tranche 2
--     (448 ligues ≈ 370 s) dépasse le fusible de 330 s — mesuré en local, passe arrêtée en PARTIAL ;
--   * colonne matchs_connus : la ligue a-t-elle déjà au moins un match en base ? Une ligue du catalogue SANS
--     match connu qui répond sans calendrier attend la publication de son calendrier — ce n'est pas une ligue
--     muette (mesuré en local : 566 fausses alertes LIGUE_MUETTE sans cette distinction).
-- PIÈGE CONNU (CLAUDE.md, règle 10) : CREATE OR REPLACE VIEW efface les reloptions non reformulées.
-- security_invoker = true est donc REFORMULÉ ici, et vérifié par le gate. L'ACL de la vue est conservée par
-- CREATE OR REPLACE ; le gate la compare en liste complète triée à celle relevée AVANT.

do $avant$
begin
  create temp table _acl_avant as
    select array_agg(g order by g) as acl
      from (select distinct coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
              from unnest((select relacl from pg_class where oid = 'public.rseq_ligues_a_appeler'::regclass)::text[]) x) t;
end $avant$;

create or replace view public.rseq_ligues_a_appeler with (security_invoker = true) as
with courante as (
  select case when extract(month from current_date) >= 7
              then extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1)
              else (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
         end as saison
), sources as (
  select 1 as priorite, 'catalogue'::text as origine, c.rseq_league_id, c.saison, c.secteur as sector, c.sport,
         c.region, c.division, c.category, c.sex_type, c.league_name
    from public.rseq_ligues_publiees c
    join courante k on k.saison = c.saison
   where coalesce(c.team_count, 0) > 0
  union all
  select 2, 'games'::text, g.rseq_league_id, g.season, g.sector, g.sport,
         g.region, g.division, g.category, g.sex_type, g.league_name
    from public.games g
    join courante k on k.saison = g.season
   where g.rseq_league_id is not null
)
select distinct on (s.rseq_league_id)
       s.rseq_league_id, s.saison, s.sector, s.sport, s.region, s.division, s.category, s.sex_type, s.league_name,
       public.rseq_family_key(s.sector, s.sport, s.division) as family_key,
       s.origine,
       (get_byte(decode(md5(s.rseq_league_id::text), 'hex'), 0) % 4 + 1)::smallint as tranche_passe,
       exists (select 1 from public.games gm where gm.rseq_league_id = s.rseq_league_id) as matchs_connus
  from sources s
 where s.sector = any (array['Collégial', 'Secondaire'])
   and lower(coalesce(s.sport, '')) <> all (array[
         'natation', 'cross-country', 'athlétisme', 'golf', 'échecs', 'improvisation', 'cheerleading',
         'courses halo', 'course à pied', 'pentathlon', 'curling', 'lutte', 'escrime', 'pétanque', 'footgolf',
         'rx1 nation'])
 order by s.rseq_league_id, s.priorite, s.league_name;

do $gate$
declare vus text[]; avant text[];
begin
  select acl into avant from _acl_avant;
  select array_agg(g order by g) into vus
    from (select distinct coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
            from unnest((select relacl from pg_class where oid = 'public.rseq_ligues_a_appeler'::regclass)::text[]) x) t;
  if vus is distinct from avant then
    raise exception 'NEXUS: ACL de rseq_ligues_a_appeler = %, avant %', vus, avant;
  end if;
  if (select reloptions from pg_class where oid = 'public.rseq_ligues_a_appeler'::regclass)
       is distinct from array['security_invoker=true'] then
    raise exception 'NEXUS: rseq_ligues_a_appeler a perdu security_invoker';
  end if;
  drop table _acl_avant;
end $gate$;
