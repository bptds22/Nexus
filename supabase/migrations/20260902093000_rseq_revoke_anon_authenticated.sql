-- 20260902093000_rseq_revoke_anon_authenticated.sql
-- ============================================================================
-- VEILLE RSEQ — CORRECTIF DE PRIVILÈGES.
--
-- LE DÉFAUT, CONSTATÉ APRÈS L'APPLY PROD DU 2026-09-02.
--   Les migrations 20260902090000 et 20260902090100 se terminaient par
--   `revoke all on function … from public` en croyant fermer l'accès. Ce
--   REVOKE ne retire que le privilège de PUBLIC. Supabase, lui, accorde
--   EXECUTE **explicitement** à `anon` et `authenticated` sur toute fonction
--   nouvellement créée (default privileges du rôle propriétaire) : ces deux
--   GRANTs-là ne sont pas touchés.
--
--   Vérification après l'apply — les six fonctions étaient exécutables par
--   anon ET authenticated. Le commentaire « rien n'est exposé à authenticated
--   ni à anon » était donc FAUX tel qu'écrit.
--
-- PORTÉE RÉELLE : défense en profondeur manquante, pas une brèche.
--   Les six fonctions sont SECURITY INVOKER : l'écriture s'exécute avec les
--   droits de l'appelant. Or aucune des quatre tables cibles — `games`,
--   `rseq_standings`, `rseq_sync_changes`, `rseq_sync_alerts` — n'a de policy
--   INSERT, et la RLS est active partout. Un appel anon ou authenticated
--   échouait donc sur la RLS. Ça ne rend pas le REVOKE facultatif : c'est
--   exactement la couche qui doit tenir si une policy d'écriture apparaît un
--   jour sur l'une de ces tables.
--
-- LE BON GESTE, DÉJÀ ÉTABLI DANS LE DÉPÔT.
--   Voir consume_athlete_invitation_revoke_anon, revoke_anon_on_recruiter_rpcs,
--   send_admin_message_revoke_anon, revoke_anon_execute_get_my_athlete_view_details.
--   On nomme les rôles, on ne compte pas sur PUBLIC.
-- ============================================================================

revoke execute on function public.rseq_sync_apply_games(uuid, uuid, jsonb)
  from anon, authenticated;
revoke execute on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb)
  from anon, authenticated;
revoke execute on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb)
  from anon, authenticated;
revoke execute on function public.rseq_sync_detect_familles(uuid, text)
  from anon, authenticated;
revoke execute on function public.rseq_sync_signal_ligue_muette(uuid, uuid, text, text)
  from anon, authenticated;

-- rseq_family_key GARDE `authenticated`, volontairement.
--   C'est une fonction PURE sur deux `text` — elle ne lit rien, n'écrit rien,
--   et ne peut rien divulguer. Surtout, la vue `rseq_ligues_a_appeler` est en
--   `security_invoker` et l'appelle : la révoquer à `authenticated` casserait
--   la lecture de la vue sans rien protéger. `anon`, lui, n'a aucune raison
--   d'y toucher.
revoke execute on function public.rseq_family_key(text, text) from anon;

-- Le service-role (edge function) reste le seul à pouvoir écrire.
grant execute on function public.rseq_sync_apply_games(uuid, uuid, jsonb) to service_role;
grant execute on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.rseq_sync_detect_familles(uuid, text) to service_role;
grant execute on function public.rseq_sync_signal_ligue_muette(uuid, uuid, text, text) to service_role;
