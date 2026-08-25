-- ═══════════════════════════════════════════════════════════════
-- T1 (fin) — fermeture des deux ouvertures signalées par les
-- advisors APRÈS la pose des tables. Les deux sont de mon fait.
--
-- ① refresh_cegep_program_label_counts() — LE VRAI PROBLÈME
-- Elle est SECURITY DEFINER et ÉCRIT dans la table de référence.
-- Créée sans GRANT explicite, elle héritait du GRANT EXECUTE par
-- défaut à PUBLIC : n'importe quel compte signé — et même `anon` —
-- pouvait la déclencher via /rest/v1/rpc/. Une fonction d'écriture
-- sur une donnée partagée par 61 cégeps, appelable sans être
-- connecté. Fermée à service_role : les imports de catalogue
-- passent par migration, jamais par un client.
--
-- ② anon SELECT sur les deux tables de référence
-- Les policies sont bien TO authenticated, donc `anon` lit ZÉRO
-- ligne. Mais le GRANT de table par défaut le laisse voir les deux
-- objets dans le schéma GraphQL. Sans gravité — ce sont des noms de
-- programmes publics — mais le projet a une convention explicite de
-- révocation (revoke_anon_on_definer_views, revoke_anon_on_recruiter_rpcs,
-- consume_athlete_invitation_revoke_anon…). On la suit.
-- ═══════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.refresh_cegep_program_label_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_cegep_program_label_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_cegep_program_label_counts() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_cegep_program_label_counts() TO service_role;

REVOKE SELECT ON TABLE public.cegep_programs        FROM anon;
REVOKE SELECT ON TABLE public.cegep_program_labels  FROM anon;
