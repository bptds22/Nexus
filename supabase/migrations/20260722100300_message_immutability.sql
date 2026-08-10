-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie — Lot A (4/4) : immuabilité du contenu + RPC mark-read
--
-- Décision BP : registre IMMUABLE (protection légale — le coffre de rétraction
-- n'a de valeur que si le contenu ne peut PAS être édité silencieusement).
--   • « Pas de delete » côté athlete↔coach est déjà assuré par l'ABSENCE de
--     policy DELETE (RLS refuse). Le hard-delete recruteur reste différé (ledger).
--   • Le trou restant : RLS ne filtre pas les colonnes → une policy UPDATE
--     (mark-read) autorisait techniquement l'édition de `content`. On ferme via
--     un trigger BEFORE UPDATE qui interdit toute modif de `content` SAUF la
--     transition de rétraction. Vaut pour TOUS les types (recruteur↔coach
--     inclus — le contenu n'a jamais été éditable en UI).
--   • RPC mark-read (DEFINER) = chemin propre pour l'athlète (read_at +
--     unread_count) sans policy UPDATE large. Les apps figées recruteur/coach
--     gardent leur UPDATE direct existant (règle binaire figé) — le trigger
--     laisse passer read_at (content inchangé).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Immuabilité du contenu (tous types).
CREATE OR REPLACE FUNCTION public.enforce_message_content_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    -- Seule transition autorisée : la rétraction (content → marqueur + stamp).
    IF NOT (OLD.retracted_at IS NULL AND NEW.retracted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Contenu de message immuable : édition interdite (message %).', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_content_immutable ON public.messages;
CREATE TRIGGER trg_message_content_immutable
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_message_content_immutable();

-- 2. RPC mark-read : marque lus les messages ENTRANTS d'une conversation dont
--    l'appelant est participant + remet son compteur à zéro. Garde participant.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conv uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conv, auth.uid()) THEN
    RAISE EXCEPTION 'Non autorisé : pas participant de la conversation.';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = p_conv
    AND sender_id <> auth.uid()
    AND read_at IS NULL;

  UPDATE public.conversations
  SET unread_count = 0
  WHERE id = p_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
