-- ═══════════════════════════════════════════════════════════════
-- iter civil-rpc-drop — DROP claim_civil_league_admin() + cleanup
-- row fantôme footcivilcoach.
--
-- Contexte
-- --------
-- claim_civil_league_admin() (migration 20260520130000) flippait
-- is_school_admin=true pour TOUT coach civil sans gate (pas de RPRP,
-- pas d'admin_claims, pas de modération). C'était l'auto-promotion
-- civile, équivalente au trigger first_coach_claim qu'on a déjà droppé
-- côté école (sprint coach-responsable-2b-trigger).
--
-- Depuis cards-restructure-web, plus aucun client ne l'appelle :
--   - Mobile civil → CoachOnboardingMobileCivil + RPC
--     finish_coach_civil_onboarding (gère admin_claims PENDING +
--     enforcement RPRP).
--   - Web civil  → app/onboarding/page.tsx branche isCivilCoach + même RPC.
-- L'appel mort au site app/onboarding/page.tsx (L853-856 historique)
-- a été retiré juste avant cette migration.
--
-- Vérifications pré-drop (effectuées en recon) :
--   - 0 appel actif côté code (3 grep matches restants = commentaires).
--   - 0 caller dans pg_proc (aucune autre function/RPC ne la référence).
--   - 0 trigger qui en dépend.
-- → Drop safe.
--
-- Signature confirmée : claim_civil_league_admin() — 0 params, retour
-- boolean. Le DROP IF EXISTS suffit.
--
-- Cleanup données legacy
-- ----------------------
-- Row fantôme persistante depuis le pre-DROP trigger first_coach_claim
-- (mai 2026) : footcivilcoach@gmail.com / Phénix du Collège Esther-
-- Blondin / school_coaches.role='DIRECTEUR_INTERIM' mais is_school_admin=
-- false + admin_type=NULL + 0 admin_claims → état hybride incohérent.
--
-- Recon empirique pré-cleanup :
--   SELECT confirme 1 SEULE row DIRECTEUR_INTERIM (le fantôme) ;
--   legitimate_claims=0 → aucune row intérim légitime à toucher par
--   accident. La clause WHERE coach_id='a63c4ac4...' AND role=
--   'DIRECTEUR_INTERIM' cible précisément cette row.
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop la fonction (idempotent).
DROP FUNCTION IF EXISTS public.claim_civil_league_admin();

-- 2. Normaliser la row fantôme : role='DIRECTEUR_INTERIM' → 'COACH'.
--    Scope strict (coach_id + role) — ne touche PAS un éventuel intérim
--    légitime (créé via admin_claims APPROVED) sur cette même école.
UPDATE public.school_coaches
SET role = 'COACH'
WHERE coach_id = 'a63c4ac4-eb15-4c69-b0ed-27ea229b09f9'
  AND role = 'DIRECTEUR_INTERIM';
