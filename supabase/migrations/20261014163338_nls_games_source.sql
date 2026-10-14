-- 20261014163338_nls_games_source
--
-- APPLIQUÉE en PROD le 2026-10-14 (mercredi, 12 h 3x) via MCP apply_migration, sur
-- GO de BP. Nom de fichier aligné sur la version RÉELLE assignée par MCP
-- (rédigée sous 20261014143000). Rollback :
-- supabase/rollback/20261014163338_rollback_nls_games_source.sql
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Import hebdomadaire des matchs NLS Premier League S02 (basketball). Source
-- (décision BP 2026-10-14) : chaque mercredi, BP enregistre en PDF la page
-- Schedule des 10 divisions d'Exposure Events ; un lecteur en tire un JSON
-- normalisé. JAMAIS de lecture automatique du site (robots.txt + conditions
-- d'utilisation d'Exposure).
--
-- Un seul changement : 'NLS' entre dans la liste fermée games_source_nom_chk.
--
-- ── LA CLÉ D'UN MATCH NLS, ET POURQUOI AUCUN INDEX N'EST AJOUTÉ ─────────────
-- Le PDF ne porte AUCUN identifiant de match. Clé naturelle (BP) :
--   (source NLS, saison, division Exposure, date, équipe domicile, équipe
--    visiteur) — la division Exposure se lit en base comme
--   (category, division, sex_type).
-- Le seul index unique qui couvre ces lignes, games_identite_civile
--   (league_name, season, category, division, zone, game_date,
--    LEAST(noms), GREATEST(noms)) WHERE rseq_game_id IS NULL,
-- ne la CONTREDIT PAS : il est plus strict sur deux points, qui ne mordent
-- pas sur le lot du 2026-10-14 (relevé : 0 collision) —
--   · la paire n'y est pas orientée : deux matchs le même jour entre les
--     mêmes équipes, domicile inversé, y seraient un doublon ;
--   · le sexe n'y figure pas : JUVÉNILE F et JUVÉNILE M partagent
--     (Juvénile, Diamond|Gold). Les noms Exposure portent JF / JM, sauf
--     « GD ELITE » et « ARGO ELITE » (masculins, sans homonyme féminin).
-- L'import le vérifie avant d'écrire et s'arrête sur une collision.

alter table public.games drop constraint games_source_nom_chk;
alter table public.games
  add constraint games_source_nom_chk
  check (source_nom is null or source_nom in ('RSEQ', 'LFMM', 'QMFL', 'QBFL', 'QMJFL', 'NLS'));

comment on column public.games.source_nom is
  'Origine de la ligne : RSEQ (API de diffusion), une des 4 ligues civiles de football, ou NLS (No Limits Showcases, basketball). Liste fermee par games_source_nom_chk.';

-- ── GATE ─────────────────────────────────────────────────────────────────────
do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk';
  if v_def is distinct from
     'CHECK (((source_nom IS NULL) OR (source_nom = ANY (ARRAY[''RSEQ''::text, ''LFMM''::text, ''QMFL''::text, ''QBFL''::text, ''QMJFL''::text, ''NLS''::text]))))' then
    raise exception 'NEXUS: games_source_nom_chk inattendue : %', v_def;
  end if;
  raise notice 'NEXUS: source NLS admise';
end $$;
