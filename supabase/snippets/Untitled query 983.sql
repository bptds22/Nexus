-- When a new user signs up, auto-link to existing athlete profile if email matches
CREATE OR REPLACE FUNCTION link_athlete_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE athletes 
  SET user_id = NEW.id
  WHERE email = NEW.email 
    AND user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_link_athlete
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION link_athlete_on_signup();