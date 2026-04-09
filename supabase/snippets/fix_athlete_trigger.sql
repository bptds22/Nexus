CREATE OR REPLACE FUNCTION log_athlete_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url
    OR OLD.verified IS DISTINCT FROM NEW.verified
    OR OLD.cote_globale_entraineur IS DISTINCT FROM NEW.cote_globale_entraineur THEN
    INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
    SELECT rf.recruiter_id, NEW.id,
      CASE
        WHEN OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url AND NEW.video_faits_saillants_url IS NOT NULL THEN 'VIDEO_ADDED'
        WHEN OLD.verified IS DISTINCT FROM NEW.verified AND NEW.verified = true THEN 'ATHLETE_VERIFIED'
        ELSE 'PROFILE_UPDATED'
      END,
      jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name)
    FROM recruiter_favorites rf
    WHERE rf.athlete_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_athlete_update AFTER UPDATE ON athletes FOR EACH ROW EXECUTE FUNCTION log_athlete_update();
