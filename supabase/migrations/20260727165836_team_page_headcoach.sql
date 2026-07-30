-- ============================================================================
-- « Page équipe » — désignation de l'ENTRAÎNEUR-CHEF (éditorial, pas de droits)
--
-- Pourquoi pas team_coaches : cette table est une table de PERMISSIONS
-- (coach_can_manage_athlete, _messageable_staff_ids, send_broadcast, RLS sur
-- team_athletes / team_invitations). Y écrire depuis l'éditeur donnerait à la
-- personne désignée la gestion du roster, la messagerie et les broadcasts.
-- De plus coach_id est une FK vers users : impossible d'y loger un coach sans
-- compte Nexus — le cas MAJORITAIRE au lancement (Grasset : 0 compte COACH).
--
-- Ordre de lecture à l'affichage :
--   headcoach_user_id (désignation explicite, nom lu sur users = source de
--   vérité) → headcoach_name (repli manuel) → team_coaches.head_coach (auto).
--
-- Miroir VERSION-EXACTE de la migration appliquée (ledger 20260727165836).
-- ============================================================================

ALTER TABLE public.team_page_content
  ADD COLUMN IF NOT EXISTS headcoach_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS headcoach_name    text CHECK (char_length(headcoach_name) <= 60);

COMMENT ON COLUMN public.team_page_content.headcoach_user_id IS
  'Entraîneur-chef DÉSIGNÉ pour la page publique (compte COACH du collège). Purement éditorial : n''accorde AUCUN droit — les droits restent dans team_coaches. ON DELETE SET NULL : un compte supprimé fait retomber la page sur le nom manuel.';
COMMENT ON COLUMN public.team_page_content.headcoach_name IS
  'Repli quand l''entraîneur-chef n''a pas de compte Nexus (cas majoritaire au lancement). Ignoré si headcoach_user_id est renseigné.';
