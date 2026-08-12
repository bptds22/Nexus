-- ═══════════════════════════════════════════════════════════════
-- Phase A — Groupe chat réel (remplace le broadcast). MIGRATION 1/3 : ENUM.
--
-- `ALTER TYPE ... ADD VALUE` doit être committé AVANT tout usage de la valeur
-- (règle enum/txn du checklist — cf. COACH_COACH 20260723120000/120100). Cette
-- migration ne fait QUE ça ; le schéma + la RLS suivent en 2/3 et 3/3.
-- ═══════════════════════════════════════════════════════════════

ALTER TYPE public.conversation_type ADD VALUE IF NOT EXISTS 'GROUP';
