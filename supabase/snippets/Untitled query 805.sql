CREATE OR REPLACE FUNCTION check_recruiter_email_domain()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_domain TEXT;
  domain_match BOOLEAN;
  school_name TEXT;
BEGIN
  IF NEW.role::text != 'RECRUTEUR' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  user_domain := split_part(user_email, '@', 2);

  SELECT EXISTS(
    SELECT 1 FROM cegep_email_domains WHERE domain = user_domain
  ) INTO domain_match;

  IF NEW.school_id IS NOT NULL THEN
    SELECT name INTO school_name FROM schools WHERE id = NEW.school_id;
  END IF;

  IF domain_match THEN
    NEW.verified := true;
  ELSE
    NEW.verified := false;
    
    INSERT INTO admin_notifications (type, title, message, related_user_id)
    VALUES (
      'RECRUITER_VERIFICATION',
      'Nouveau recruteur a verifier',
      'Le recruteur ' || COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') || 
      ' (' || COALESCE(user_email, 'email inconnu') || ')' ||
      ' s est inscrit comme recruteur' ||
      CASE WHEN school_name IS NOT NULL THEN ' pour ' || school_name ELSE '' END ||
      '. Verification manuelle requise.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_recruiter_domain ON users;
CREATE TRIGGER trg_check_recruiter_domain
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION check_recruiter_email_domain();