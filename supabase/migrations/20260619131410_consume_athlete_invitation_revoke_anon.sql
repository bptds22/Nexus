-- consume_athlete_invitation_revoke_anon
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Retire l'accès anon à la RPC de consommation d'invitation athlète.
revoke execute on function public.consume_athlete_invitation(text, uuid) from anon;
