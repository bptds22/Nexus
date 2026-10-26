-- Apply PROD de 20261026210000_civil_sources_lot1 (GO BP 2026-10-26, lundi soir), par le connecteur Supabase.
-- UN SEUL bloc DO = une seule instruction : toute garde qui échoue annule TOUT (migration,
-- inscription schema_migrations, admin_operations). Migration embarquée telle que git la stocke
-- (LF), md5 vérifié avant exécution.
do $nexus_apply$
declare
  contenu text := $nexus_mig$-- 20261026210000_civil_sources_lot1
--
-- NON APPLIQUÉE EN PROD. Import civil soccer / futsal / basket 2026-27, LOT 1 : la base.
-- Rollback : supabase/rollback/20261026210000_rollback_civil_sources_lot1.sql
-- Plan des lots : docs/civil-2026/LISEZMOI.md
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Les matchs Spordle (soccer, futsal) portent un identifiant de match ; les équipes,
-- un identifiant Spordle par ligue. Sans colonne pour les garder :
--   · 5 matchs du plan (doubles programmes : même jour, mêmes équipes, même catégorie)
--     tombent sur la même clé games_identite_civile et seraient refusés ;
--   · la veille hebdomadaire n'aurait que des NOMS pour reconnaître un match ou une
--     équipe — c'est par un id qu'on la veut (règle du pont : jamais par nom).
--
-- ── CE QUE FAIT LE LOT (additif, aucune donnée écrite) ──────────────────────
--   1. games.source_match_id : l'id de match de la source civile. Unique par source.
--      games.statut_source : NULL (normal), 'REPORTE' ou 'ANNULE' — un match n'est
--      jamais supprimé (règle du pont), la veille le MARQUE.
--   2. games_identite_civile ne couvre plus que les matchs civils SANS id source
--      (football civil, NLS, basket MBL / Kreezee) : ceux qui ont un id sont tenus
--      par games_source_match_uidx. Le prédicat change — l'ON CONFLICT du script
--      football (scripts/plan-civil-football-games.mjs) est mis à jour dans le
--      même commit ; il doit tourner APRÈS cette migration.
--   3. games_source_nom_chk admet SPORDLE (soccer, futsal), MBL (PublicationSports),
--      KREEZEE (Circuit Basketball Québec, Circuit Élite).
--   4. organisations_sources / equipes_sources : la correspondance « identifiant de la
--      source → ligne Nexus ». Service_role seulement (aucune policy, RLS active).
--      ON DELETE CASCADE : supprimer une équipe ou une organisation dans l'appli ne doit
--      jamais échouer à cause de l'import ; la veille la reproposera en alerte.
--
-- Aucune colonne de teams ni de schools ne change.

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games'
              and column_name in ('source_match_id', 'statut_source')) then
    raise exception 'NEXUS: games.source_match_id / statut_source existe déjà';
  end if;
  if to_regclass('public.organisations_sources') is not null or to_regclass('public.equipes_sources') is not null then
    raise exception 'NEXUS: organisations_sources / equipes_sources existe déjà';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk') is distinct from
     'CHECK (((source_nom IS NULL) OR (source_nom = ANY (ARRAY[''RSEQ''::text, ''LFMM''::text, ''QMFL''::text, ''QBFL''::text, ''QMJFL''::text, ''NLS''::text]))))' then
    raise exception 'NEXUS: games_source_nom_chk inattendue';
  end if;
  if (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'games_identite_civile') is distinct from
     'CREATE UNIQUE INDEX games_identite_civile ON public.games USING btree (league_name, season, category, division, zone, game_date, LEAST(home_name_raw, visitor_name_raw), GREATEST(home_name_raw, visitor_name_raw)) WHERE (rseq_game_id IS NULL)' then
    raise exception 'NEXUS: games_identite_civile inattendu';
  end if;
  if not exists (select 1 from public.sports where nom = 'Futsal') then
    raise exception 'NEXUS: sport Futsal absent';
  end if;
end $garde$;

-- ── 1. games : id de match source + statut ─────────────────────────────────
alter table public.games
  add column source_match_id text,
  add column statut_source   text;

alter table public.games
  add constraint games_statut_source_chk
  check (statut_source is null or statut_source in ('REPORTE', 'ANNULE'));

alter table public.games
  add constraint games_source_match_id_chk
  check (source_match_id is null
         or (rseq_game_id is null and source_nom is not null and source_nom <> 'RSEQ'
             and length(btrim(source_match_id)) between 1 and 100));

create unique index games_source_match_uidx
  on public.games (source_nom, source_match_id)
  where source_match_id is not null;

comment on column public.games.source_match_id is
  'Identifiant du match chez la source civile (ex. gameId Spordle). Unique par source (games_source_match_uidx). NULL pour RSEQ et pour les sources sans identifiant (clé naturelle games_identite_civile).';
comment on column public.games.statut_source is
  'NULL = match normal ; REPORTE / ANNULE = marqué par la source. Un match n''est jamais supprimé : la veille le marque.';

-- ── 2. games_identite_civile : seulement les matchs civils sans id source ────
drop index public.games_identite_civile;
create unique index games_identite_civile
  on public.games (league_name, season, category, division, zone, game_date,
                   least(home_name_raw, visitor_name_raw), greatest(home_name_raw, visitor_name_raw))
  where rseq_game_id is null and source_match_id is null;

-- ── 3. Sources admises ───────────────────────────────────────────────────────
alter table public.games drop constraint games_source_nom_chk;
alter table public.games
  add constraint games_source_nom_chk
  check (source_nom is null or source_nom in ('RSEQ', 'LFMM', 'QMFL', 'QBFL', 'QMJFL', 'NLS',
                                              'SPORDLE', 'MBL', 'KREEZEE'));
comment on column public.games.source_nom is
  'Origine de la ligne : RSEQ (API de diffusion), une des 4 ligues civiles de football, NLS (basketball), SPORDLE (soccer et futsal civils), MBL (Montreal Basketball League, PublicationSports) ou KREEZEE (circuits Basketball Québec). Liste fermee par games_source_nom_chk.';

-- ── 4. Correspondances source → Nexus ───────────────────────────────────────
create table public.organisations_sources (
  id           uuid primary key default gen_random_uuid(),
  source_nom   text not null check (source_nom in ('SPORDLE', 'MBL', 'KREEZEE', 'INVENTAIRE')),
  source_cle   text not null check (length(btrim(source_cle)) between 1 and 300),
  school_id    uuid not null references public.schools(id) on delete cascade,
  operation_id uuid references public.admin_operations(id),
  created_at   timestamptz not null default now(),
  constraint organisations_sources_uniq unique (source_nom, source_cle)
);
create index organisations_sources_school_idx on public.organisations_sources (school_id);
comment on table public.organisations_sources is
  'Organisation chez une source civile (id de club Spordle, nom de club MBL / Kreezee, ou nom de l''inventaire 2026) → schools. Écrite par les lots d''import sur GO ; lue par la veille. Service_role seulement.';

create table public.equipes_sources (
  id           uuid primary key default gen_random_uuid(),
  source_nom   text not null check (source_nom in ('SPORDLE', 'MBL', 'KREEZEE')),
  source_cle   text not null check (length(btrim(source_cle)) between 1 and 300),
  team_id      uuid not null references public.teams(id) on delete cascade,
  operation_id uuid references public.admin_operations(id),
  created_at   timestamptz not null default now(),
  constraint equipes_sources_uniq unique (source_nom, source_cle)
);
create index equipes_sources_team_idx on public.equipes_sources (team_id);
comment on table public.equipes_sources is
  'Équipe chez une source civile → teams. SPORDLE : « teamId|ligue » (un même teamId peut servir dans deux ligues) ; MBL / KREEZEE : clé naturelle « ligue|division|nom ». Service_role seulement.';

alter table public.organisations_sources enable row level security;
alter table public.equipes_sources       enable row level security;
-- Les default privileges de Supabase accordent ALL à anon et authenticated sur toute
-- table neuve : on retire tout, puis on rend le nécessaire à service_role.
revoke all on public.organisations_sources from public, anon, authenticated;
revoke all on public.equipes_sources       from public, anon, authenticated;
grant select, insert, update, delete on public.organisations_sources to service_role;
grant select, insert, update, delete on public.equipes_sources       to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  t    text;
  vus  text[];
begin
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk') is distinct from
     'CHECK (((source_nom IS NULL) OR (source_nom = ANY (ARRAY[''RSEQ''::text, ''LFMM''::text, ''QMFL''::text, ''QBFL''::text, ''QMJFL''::text, ''NLS''::text, ''SPORDLE''::text, ''MBL''::text, ''KREEZEE''::text]))))' then
    raise exception 'NEXUS: games_source_nom_chk finale inattendue';
  end if;
  if (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'games_identite_civile') is distinct from
     'CREATE UNIQUE INDEX games_identite_civile ON public.games USING btree (league_name, season, category, division, zone, game_date, LEAST(home_name_raw, visitor_name_raw), GREATEST(home_name_raw, visitor_name_raw)) WHERE ((rseq_game_id IS NULL) AND (source_match_id IS NULL))' then
    raise exception 'NEXUS: games_identite_civile final inattendu';
  end if;
  if (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'games_source_match_uidx') is distinct from
     'CREATE UNIQUE INDEX games_source_match_uidx ON public.games USING btree (source_nom, source_match_id) WHERE (source_match_id IS NOT NULL)' then
    raise exception 'NEXUS: games_source_match_uidx inattendu';
  end if;
  foreach t in array array['organisations_sources', 'equipes_sources'] loop
    -- ACL : liste COMPLÈTE triée des bénéficiaires, jamais par inclusion
    select array_agg(distinct g order by g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) a
     where c.oid = ('public.' || t)::regclass;
    if vus is distinct from array['postgres', 'service_role'] then
      raise exception 'NEXUS: ACL de % = %, attendu {postgres,service_role}', t, vus;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'NEXUS: RLS inactive sur %', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception 'NEXUS: policy inattendue sur %', t;
    end if;
  end loop;
  if exists (select 1 from public.games where source_match_id is not null or statut_source is not null) then
    raise exception 'NEXUS: des matchs portent déjà un id source ou un statut';
  end if;
  raise notice 'NEXUS: lot 1 civil — base prête (aucune donnée écrite)';
end $garde$;
$nexus_mig$;
  v_max   text;
  v_avant jsonb;
  t       text;
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 5) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi avant 5 h';
  end if;
  if md5(contenu) <> '55824e9ef75d7e04801cb79459add1fd' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', md5(contenu);
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261026210000') then
    raise exception 'NEXUS: version 20261026210000 déjà inscrite';
  end if;
  select max(version) into v_max from supabase_migrations.schema_migrations;
  if v_max >= '20261026210000' then
    raise exception 'NEXUS: 20261026210000 pas après la dernière version (%)', v_max;
  end if;

  -- Relevé d'avant (agrégats).
  select jsonb_build_object('games', count(*),
                            'games_civils_sans_rseq', count(*) filter (where rseq_game_id is null),
                            'par_source', (select jsonb_object_agg(coalesce(source_nom, 'NULL'), n)
                                             from (select source_nom, count(*) n from public.games group by 1) s))
    into v_avant from public.games;

  -- La migration (ses propres gardes d'avant et d'après : contraintes, index, ACL en liste complète).
  execute contenu;

  -- Gardes d'après, en plus de celles de la migration.
  foreach t in array array['public.organisations_sources', 'public.equipes_sources'] loop
    if has_table_privilege('anon', t, 'SELECT') or has_table_privilege('authenticated', t, 'SELECT')
       or has_table_privilege('anon', t, 'INSERT') or has_table_privilege('authenticated', t, 'INSERT') then
      raise exception 'NEXUS: anon ou authenticated a un droit sur %', t;
    end if;
  end loop;
  if (select count(*) from public.games) <> (v_avant->>'games')::bigint then
    raise exception 'NEXUS: le nombre de matchs a bougé';
  end if;

  insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
  values ('20261026210000', 'civil_sources_lot1', array[contenu], 'bptds22@gmail.com');

  insert into public.admin_operations (operation, motif, details, par)
  values ('MIGRATION_CIVIL_SOURCES_LOT1',
          'Import civil 2026-27, lot 1 : games.source_match_id / statut_source, sources SPORDLE / MBL / KREEZEE, tables de correspondance (GO BP 2026-10-26)',
          jsonb_build_object(
            'version', '20261026210000',
            'fichier', 'supabase/migrations/20261026210000_civil_sources_lot1.sql',
            'rollback', 'supabase/rollback/20261026210000_rollback_civil_sources_lot1.sql',
            'md5_fichier', '55824e9ef75d7e04801cb79459add1fd',
            'md5_rollback', 'dc82911a4a7c5b0598f822f4ec2ec678',
            'voie', 'connecteur Supabase, un seul bloc DO',
            'banc_local', '2026-10-26 : 10 tests sur 10, deux cycles apply / rollback, structure identique',
            'releve_avant', v_avant),
          (select id from public.users where email = 'bptds22@gmail.com'));

  if (select count(*) from supabase_migrations.schema_migrations where version = '20261026210000') <> 1
     or (select count(*) from public.admin_operations where operation = 'MIGRATION_CIVIL_SOURCES_LOT1') <> 1 then
    raise exception 'NEXUS: inscription schema_migrations ou admin_operations absente ou en double';
  end if;
end $nexus_apply$;
