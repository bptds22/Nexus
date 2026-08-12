-- ============================================================================
-- EQUIVALENCE PROOF #2 — normalized POLICY-BODY snapshot, before vs after.
--
-- WHY THIS EXISTS (added by CC-Windows, author of the 22 messaging migrations):
-- the per-role visibility matrix only exercises the READ path (SELECT counts).
-- The migration also rewrites INSERT/UPDATE WITH CHECK clauses, policy roles
-- and commands — a regression there is INVISIBLE to a row-count matrix.
--
-- This snapshot compares the ACTUAL predicate text of all 272 public policies,
-- with `( SELECT auth.uid() AS uid)` normalized back to `auth.uid()`. Since the
-- migration is claimed to be a pure mechanical substitution, the normalized
-- text must be BYTE-IDENTICAL before and after. Any diff line = a real semantic
-- change (dropped WITH CHECK, changed role, changed command, altered predicate)
-- and is an immediate STOP.
--
-- HOW TO USE:
--   psql -f this_file > policies-before.txt   (before the migration)
--   psql -f this_file > policies-after.txt    (after)
--   diff policies-before.txt policies-after.txt  -> MUST be empty.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off
\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on

select
  tablename,
  policyname,
  cmd,
  permissive,
  array_to_string(roles, ',') as roles,
  -- normalize the initplan wrapper back to the bare call so a pure mechanical
  -- rewrite collapses to zero diff; any OTHER edit still shows up.
  replace(coalesce(qual, '<null>'),       '( SELECT auth.uid() AS uid)', 'auth.uid()') as qual_norm,
  replace(coalesce(with_check, '<null>'), '( SELECT auth.uid() AS uid)', 'auth.uid()') as check_norm
from pg_policies
where schemaname = 'public'
order by tablename, policyname, cmd;
