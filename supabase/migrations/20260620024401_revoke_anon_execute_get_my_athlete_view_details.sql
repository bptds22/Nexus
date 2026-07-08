-- revoke_anon_execute_get_my_athlete_view_details
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Retire l'accès anon à la RPC tier-gée d'accès aux détails de visibilité athlète.
revoke execute on function public.get_my_athlete_view_details() from anon;
