-- Phase 0.6: Drop deprecated prospect_* tables
-- Replaced by recruiter_lists and recruiter_list_members
-- Both were empty and unreferenced at the time of drop

DROP TABLE IF EXISTS prospect_list_athletes CASCADE;
DROP TABLE IF EXISTS prospect_lists CASCADE;
