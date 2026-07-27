-- ============================================================================
-- INDEX REDUNDANCY AUDIT — run BEFORE applying the FK-index half of
-- 20260727130000_rls_initplan_and_fk_indexes.sql, on EVERY target database
-- (local AND prod). Prod's index set is not guaranteed to match local's.
--
-- WHY: `CREATE INDEX IF NOT EXISTS <name>` only tests the NAME. An index on
-- the same column under a DIFFERENT name (e.g. idx_athletes_coach vs the
-- proposed idx_athletes_coach_id), or one that already leads with that column
-- in a composite (idx_activity_log_athlete (athlete_id, created_at DESC)),
-- does NOT stop the duplicate from being created. Redundant indexes cost write
-- amplification, bloat and autovacuum — and add another path for the planner
-- to consider, working directly against a pass whose goal is to cut PLANNING
-- time.
--
-- READING THE OUTPUT:
--   verdict = 'REDUNDANT — skip'  -> an existing index already leads with that
--                                    column; do NOT create the proposed one.
--   verdict = 'CREATE'            -> genuinely missing; create it.
-- On local (2026-07-27) this returned 11 REDUNDANT / 9 CREATE, and the
-- migration was trimmed to the 9. Re-run on prod and reconcile before apply.
-- ============================================================================
\pset pager off

with proposed(idx_name, tbl, col) as (
  values
    ('idx_school_coaches_coach_id',           'school_coaches',         'coach_id'),
    ('idx_school_coaches_school_id',          'school_coaches',         'school_id'),
    ('idx_conversations_coach_id',            'conversations',          'coach_id'),
    ('idx_conversations_coach_b_id',          'conversations',          'coach_b_id'),
    ('idx_conversations_recruiter_id',        'conversations',          'recruiter_id'),
    ('idx_conversations_parent_id',           'conversations',          'parent_id'),
    ('idx_conversations_athlete_id',          'conversations',          'athlete_id'),
    ('idx_athletes_coach_id',                 'athletes',               'coach_id'),
    ('idx_athletes_school_id',                'athletes',               'school_id'),
    ('idx_athletes_user_id',                  'athletes',               'user_id'),
    ('idx_evaluations_athlete_id',            'evaluations',            'athlete_id'),
    ('idx_evaluations_coach_id',              'evaluations',            'coach_id'),
    ('idx_messages_conversation_id',          'messages',               'conversation_id'),
    ('idx_messages_sender_id',                'messages',               'sender_id'),
    ('idx_recruiter_favorites_athlete_id',    'recruiter_favorites',    'athlete_id'),
    ('idx_recruiter_pipeline_athlete_id',     'recruiter_pipeline',     'athlete_id'),
    ('idx_recruiter_activity_log_athlete_id', 'recruiter_activity_log', 'athlete_id'),
    ('idx_athlete_notifications_athlete_id',  'athlete_notifications',  'athlete_id'),
    ('idx_team_athletes_athlete_id',          'team_athletes',          'athlete_id'),
    ('idx_team_athletes_team_id',             'team_athletes',          'team_id')
),
-- Every existing index, with the name of its FIRST (leading) key column.
-- A partial index (indpred not null) is NOT counted as covering: it only
-- serves queries matching its predicate.
existing as (
  select
    t.relname::text  as tbl,
    i.relname::text  as idx_name,
    a.attname::text  as lead_col,
    ix.indpred is not null as is_partial,
    pg_get_indexdef(ix.indexrelid) as def
  from pg_index ix
  join pg_class  i on i.oid = ix.indexrelid
  join pg_class  t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = ix.indkey[0]
)
select
  p.idx_name             as proposed_index,
  p.tbl                  as table_name,
  p.col                  as column_name,
  case when e.idx_name is null then 'CREATE' else 'REDUNDANT - skip' end as verdict,
  e.idx_name             as already_covered_by,
  e.def                  as covering_definition
from proposed p
left join lateral (
  select * from existing e
  where e.tbl = p.tbl and e.lead_col = p.col and not e.is_partial
  order by e.idx_name limit 1
) e on true
order by verdict, p.tbl, p.idx_name;

\echo ''
\echo '---- tally ----'
with proposed(idx_name, tbl, col) as (
  values
    ('idx_school_coaches_coach_id','school_coaches','coach_id'),
    ('idx_school_coaches_school_id','school_coaches','school_id'),
    ('idx_conversations_coach_id','conversations','coach_id'),
    ('idx_conversations_coach_b_id','conversations','coach_b_id'),
    ('idx_conversations_recruiter_id','conversations','recruiter_id'),
    ('idx_conversations_parent_id','conversations','parent_id'),
    ('idx_conversations_athlete_id','conversations','athlete_id'),
    ('idx_athletes_coach_id','athletes','coach_id'),
    ('idx_athletes_school_id','athletes','school_id'),
    ('idx_athletes_user_id','athletes','user_id'),
    ('idx_evaluations_athlete_id','evaluations','athlete_id'),
    ('idx_evaluations_coach_id','evaluations','coach_id'),
    ('idx_messages_conversation_id','messages','conversation_id'),
    ('idx_messages_sender_id','messages','sender_id'),
    ('idx_recruiter_favorites_athlete_id','recruiter_favorites','athlete_id'),
    ('idx_recruiter_pipeline_athlete_id','recruiter_pipeline','athlete_id'),
    ('idx_recruiter_activity_log_athlete_id','recruiter_activity_log','athlete_id'),
    ('idx_athlete_notifications_athlete_id','athlete_notifications','athlete_id'),
    ('idx_team_athletes_athlete_id','team_athletes','athlete_id'),
    ('idx_team_athletes_team_id','team_athletes','team_id')
),
existing as (
  select t.relname::text as tbl, i.relname::text as idx_name, a.attname::text as lead_col,
         ix.indpred is not null as is_partial
  from pg_index ix
  join pg_class i on i.oid = ix.indexrelid
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace and n.nspname='public'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = ix.indkey[0]
)
select
  count(*) filter (where e.idx_name is null)     as to_create,
  count(*) filter (where e.idx_name is not null) as redundant,
  count(*)                                       as proposed_total
from proposed p
left join lateral (
  select * from existing e
  where e.tbl = p.tbl and e.lead_col = p.col and not e.is_partial
  limit 1
) e on true;
