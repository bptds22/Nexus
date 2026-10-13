-- Rollback de 20261013141628_w0_is_partner_eligible_athlete_acl.sql : rend l'ACL relevée avant
-- ({=X/postgres, postgres, anon, authenticated, service_role}).

grant execute on function public.is_partner_eligible_athlete(uuid) to public, anon, authenticated, service_role;
