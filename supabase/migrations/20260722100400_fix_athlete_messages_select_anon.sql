-- ═══════════════════════════════════════════════════════════════════════
-- Fix (smoke test prod) : athlete_messages_select doit être TO authenticated.
--
-- Sans clause de rôle, le rôle `anon` évalue aussi cette policy, qui appelle
-- is_conversation_participant() — révoqué pour anon → Postgres renvoie
-- « permission denied for function » (401) sur TOUT GET /messages en anon, au
-- lieu de [] proprement. Les utilisateurs authentifiés ne sont pas touchés
-- (ils ont EXECUTE). L'athlète est toujours authentifié ; anon n'a aucune
-- raison de lire messages. On scope la policy à authenticated (et on GARDE le
-- helper révoqué pour anon → pas d'oracle RPC).
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "athlete_messages_select" ON public.messages;
CREATE POLICY "athlete_messages_select" ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id));
