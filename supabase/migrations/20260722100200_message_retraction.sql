-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie — Lot A (3/3) : rétraction admin (soft), TOUS types confondus
--
-- Intervention admin (BP) : soft-retraction. Un message rétracté est masqué aux
-- participants (« Message retiré par Nexus »), le contenu original est PRÉSERVÉ
-- en DB à des fins légales / de sauvegarde. AUCUN hard delete. S'applique à tous
-- les types, y compris recruteur↔coach existant.
--
-- Approche (recommandée — sûre pour binaires figés, zéro changement d'app) :
--   • messages gagne retracted_at / retracted_by.
--   • L'original est copié dans public.message_retractions (lecture ADMIN only).
--   • messages.content est REMPLACÉ par le marqueur → les apps figées affichent
--     le marqueur sans changement de code (elles lisent déjà `content`).
--   • Action via RPC admin SECURITY DEFINER (copie + remplacement atomiques).
--
-- SÛRETÉ : ADDITIF (colonnes nullable + nouvelle table + RPC). Le remplacement
-- de content n'est PAS une perte : l'original vit dans message_retractions.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Marqueurs de rétraction sur messages (nullable → additif).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS retracted_at timestamptz,
  ADD COLUMN IF NOT EXISTS retracted_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Coffre du contenu original — lecture réservée à l'admin plateforme.
CREATE TABLE IF NOT EXISTS public.message_retractions (
  message_id       uuid PRIMARY KEY REFERENCES public.messages(id) ON DELETE CASCADE,
  original_content text NOT NULL,
  retracted_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  retracted_at     timestamptz NOT NULL DEFAULT now(),
  reason           text
);
ALTER TABLE public.message_retractions ENABLE ROW LEVEL SECURITY;

-- Seul l'admin plateforme lit le contenu original (sensible).
CREATE POLICY "message_retractions admin read" ON public.message_retractions
  FOR SELECT
  USING (public.is_platform_admin(auth.uid()));
-- Aucune policy INSERT/UPDATE/DELETE → écriture uniquement via le RPC DEFINER.

-- 3. RPC admin : rétracte un message (idempotent). Copie l'original, remplace le
--    contenu par le marqueur, stampe retracted_*. Garde is_platform_admin.
CREATE OR REPLACE FUNCTION public.admin_retract_message(
  p_message_id uuid, p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin   uuid := auth.uid();
  v_content text;
BEGIN
  IF NOT public.is_platform_admin(v_admin) THEN
    RAISE EXCEPTION 'Non autorisé : rétraction réservée à l''admin plateforme.';
  END IF;

  -- Verrouille + ne prend que les messages non déjà rétractés (idempotence).
  SELECT content INTO v_content
  FROM public.messages
  WHERE id = p_message_id AND retracted_at IS NULL
  FOR UPDATE;

  IF v_content IS NULL THEN
    RETURN;  -- inexistant ou déjà rétracté → no-op
  END IF;

  INSERT INTO public.message_retractions (message_id, original_content, retracted_by, reason)
  VALUES (p_message_id, v_content, v_admin, p_reason)
  ON CONFLICT (message_id) DO NOTHING;

  UPDATE public.messages
  SET content = 'Message retiré par Nexus',
      retracted_at = now(),
      retracted_by = v_admin
  WHERE id = p_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retract_message(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_retract_message(uuid, text) TO authenticated;  -- garde interne is_platform_admin

-- ── NOTE contract-breaking DIFFÉRÉE (ne PAS inclure ici) ──────────────────
-- « No hard deletes anywhere » impose de retirer la policy existante
-- `recruiter_conversations_delete` (DELETE recruteur → CASCADE messages). C'est
-- CONTRACT-BREAKING pour un éventuel bouton « supprimer » d'app figée : à traiter
-- dans une migration de CONTRACTION séparée, APRÈS vérif qu'aucun binaire livré
-- n'appelle le delete. Voir FLAG dans le rapport.
