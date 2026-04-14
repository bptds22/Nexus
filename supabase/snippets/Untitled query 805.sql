-- 1. TRIGGER: school_coaches INSERT/UPDATE → sync users.school_id
CREATE OR REPLACE FUNCTION sync_user_school_from_coaches()
RETURNS TRIGGER AS $$
BEGIN
  -- When a coach is added/moved to a school, update their users.school_id
  UPDATE users 
  SET school_id = NEW.school_id 
  WHERE id = NEW.coach_id 
  AND (school_id IS DISTINCT FROM NEW.school_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_school_on_coach_change ON school_coaches;
CREATE TRIGGER trg_sync_user_school_on_coach_change
AFTER INSERT OR UPDATE ON school_coaches
FOR EACH ROW
EXECUTE FUNCTION sync_user_school_from_coaches();


-- 2. TRIGGER: school_coaches DELETE → clear users.school_id
CREATE OR REPLACE FUNCTION sync_user_school_on_coach_remove()
RETURNS TRIGGER AS $$
BEGIN
  -- When a coach is removed, clear their school_id 
  -- (only if they don't have another school_coaches record)
  IF NOT EXISTS (
    SELECT 1 FROM school_coaches 
    WHERE coach_id = OLD.coach_id AND id != OLD.id
  ) THEN
    UPDATE users 
    SET school_id = NULL, is_school_admin = false
    WHERE id = OLD.coach_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_school_on_coach_remove ON school_coaches;
CREATE TRIGGER trg_sync_user_school_on_coach_remove
AFTER DELETE ON school_coaches
FOR EACH ROW
EXECUTE FUNCTION sync_user_school_on_coach_remove();


-- 3. TRIGGER: school_coaches role change → sync is_school_admin
CREATE OR REPLACE FUNCTION sync_user_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET is_school_admin = (NEW.role = 'DIRECTEUR')
  WHERE id = NEW.coach_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_admin_flag ON school_coaches;
CREATE TRIGGER trg_sync_admin_flag
AFTER INSERT OR UPDATE OF role ON school_coaches
FOR EACH ROW
EXECUTE FUNCTION sync_user_admin_flag();


-- Verify triggers exist
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_sync_user%' OR trigger_name LIKE 'trg_sync_admin%';