-- teams_identity_unique predated multi-team-per-school; a school's boys' and girls'
-- teams in the same sport/category/division are DISTINCT teams. Add gender to the key.
ALTER TABLE public.teams DROP CONSTRAINT teams_identity_unique;
ALTER TABLE public.teams ADD CONSTRAINT teams_identity_unique
  UNIQUE (school_id, sport_id, name, age_group, division, gender, season);
