-- Veille RSEQ, correctif de découverte — 1/4 : liste des codes de sport interrogés par la grille.
-- (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP — fichier renommé depuis sa version locale 2026100821x00)
-- (LOCAL — non appliquée en prod ; plan : docs/rseq-audit-20261008/PLAN-VEILLE.md § 1.)
--
-- La découverte ne se fie plus aux menus du site (GetRegionSports) : elle interroge chaque région 0–14 ×
-- chaque code de cette table. Semis : les 61 codes de l'audit du 2026-10-08 (union de GetRegionSports sur
-- 12 saisons × 15 régions = 58 codes, plus la plage 0–60). La fonction AJOUTE les codes nouveaux qu'elle
-- voit (jamais de retrait) et lève une alerte NOUVEAU_CODE_SPORT.
-- Lecture et écriture : service_role seulement (la veille). Aucun accès client.

create table if not exists public.rseq_codes_sport (
  code     integer primary key check (code >= 0),
  nom      text not null default '',
  source   text not null,
  vu_le    timestamptz not null default now()
);
alter table public.rseq_codes_sport enable row level security;
revoke all on table public.rseq_codes_sport from public, anon, authenticated;
grant select, insert, update on table public.rseq_codes_sport to service_role;

insert into public.rseq_codes_sport (code, nom, source) values
  (0, 'Athlétisme', 'GetRegionSports'),
  (1, 'Basketball', 'GetRegionSports'),
  (2, 'Cheerleading', 'GetRegionSports'),
  (3, 'Cross-country', 'GetRegionSports'),
  (4, 'Flag football', 'GetRegionSports'),
  (5, 'Football', 'GetRegionSports'),
  (6, 'Golf', 'GetRegionSports'),
  (7, 'Hockey cosom', 'GetRegionSports'),
  (8, 'Hockey sans contact', 'GetRegionSports'),
  (9, 'Hockey', 'GetRegionSports'),
  (10, 'Natation', 'GetRegionSports'),
  (11, 'Rugby', 'GetRegionSports'),
  (12, 'Soccer intérieur', 'GetRegionSports'),
  (13, 'Soccer', 'GetRegionSports'),
  (14, 'Soccer en gymnase', 'GetRegionSports'),
  (15, 'Touch football', 'GetRegionSports'),
  (16, 'Volleyball', 'GetRegionSports'),
  (17, 'Volleyball de plage', 'GetRegionSports'),
  (18, 'Badminton', 'GetRegionSports'),
  (19, 'Crosse', 'GetRegionSports'),
  (20, 'Haltérophilie', 'GetRegionSports'),
  (21, 'Ski', 'GetRegionSports'),
  (22, '', 'plage 0-60'),
  (23, 'Baseball', 'GetRegionSports'),
  (24, 'Handball', 'GetRegionSports'),
  (25, 'Ultimate', 'GetRegionSports'),
  (26, 'Échecs', 'GetRegionSports'),
  (27, 'Improvisation', 'GetRegionSports'),
  (28, 'Crosse au champ', 'GetRegionSports'),
  (29, 'Tennis', 'GetRegionSports'),
  (30, 'Futsal', 'GetRegionSports'),
  (31, 'Course à pied', 'GetRegionSports'),
  (32, 'Kinball', 'GetRegionSports'),
  (33, 'Flag rugby', 'GetRegionSports'),
  (34, 'Footgolf', 'GetRegionSports'),
  (35, 'Tchoukball', 'GetRegionSports'),
  (36, 'Kickball', 'GetRegionSports'),
  (37, 'Ballon sur glace', 'GetRegionSports'),
  (38, 'RX1 Nation', 'GetRegionSports'),
  (39, 'Curling', 'GetRegionSports'),
  (40, 'Balle molle', 'GetRegionSports'),
  (41, 'Lutte', 'GetRegionSports'),
  (42, 'Rugby 7s', 'GetRegionSports'),
  (43, 'Rugby 10s', 'GetRegionSports'),
  (44, 'Rugby 15s', 'GetRegionSports'),
  (45, 'Escrime', 'GetRegionSports'),
  (46, 'Pentathlon', 'GetRegionSports'),
  (47, 'Tennis de table', 'GetRegionSports'),
  (48, 'Ski de fond', 'GetRegionSports'),
  (49, '100% filles', 'GetRegionSports'),
  (50, '100% gars', 'GetRegionSports'),
  (51, 'Sport électronique', 'GetRegionSports'),
  (52, 'Courses HALO', 'GetRegionSports'),
  (53, 'Dek Hockey', 'GetRegionSports'),
  (54, 'Water Polo', 'GetRegionSports'),
  (55, 'Pickleball', 'GetRegionSports'),
  (56, 'Ringuette', 'GetRegionSports'),
  (57, '', 'plage 0-60'),
  (58, 'Pétanque', 'GetRegionSports'),
  (59, '', 'GetRegionSports'),
  (60, '', 'plage 0-60')
on conflict (code) do nothing;

-- Gate : ACL de la table en liste COMPLÈTE triée (jamais par inclusion), et 61 codes semés.
do $gate$
declare vus text[];
begin
  select array_agg(g order by g) into vus
    from (select distinct coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
            from unnest((select relacl from pg_class where oid = 'public.rseq_codes_sport'::regclass)::text[]) x) t;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL rseq_codes_sport = %, attendu {postgres,service_role}', vus;
  end if;
  if (select count(*) from public.rseq_codes_sport) < 61 then
    raise exception 'NEXUS: rseq_codes_sport semée avec % code(s), attendu au moins 61', (select count(*) from public.rseq_codes_sport);
  end if;
end $gate$;
