CREATE INDEX idx_activities_coach ON activities(coach_id, created_at DESC);
CREATE INDEX idx_activities_athlete ON activities(athlete_id);