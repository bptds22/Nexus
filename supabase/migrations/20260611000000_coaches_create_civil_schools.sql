-- ═══════════════════════════════════════════════════════════════
-- iter coach-1c — RLS additive : autoriser un coach civil à créer
-- son club (schools row type='LIGUE_CIVILE').
--
-- Contexte
-- --------
-- Avant ce patch, schools n'a qu'une seule policy INSERT :
--   "admins insert all"  WITH CHECK is_admin()
-- Conséquence : findOrCreateSchool('LIGUE_CIVILE') (web civil wizard)
-- plante avec "new row violates row-level security policy for table
-- schools" pour tout coach non-admin. Vérifié empiriquement en DIAG
-- coach-civil-responsable-1.
--
-- Cette policy débloque UNIQUEMENT le cas LIGUE_CIVILE pour un coach
-- civil légitime. Les écoles SECONDAIRE + CÉGEP restent fermées
-- (seedées via open data MEQ / pas créées par les coachs).
--
-- Sécurité (4 garde-fous)
-- ----------------------
-- 1. type = 'LIGUE_CIVILE' explicite — pas de wildcard sur d'autres types.
-- 2. role = 'COACH' (enum user_role uppercase) — pas n'importe quel
--    authenticated.
-- 3. context = 'ligue_civile' (text lowercase, CHECK contraint) — un
--    coach scolaire/collegial ne peut PAS créer de club civil.
-- 4. EXISTS (SELECT … users WHERE id=auth.uid()) — l'utilisateur DOIT
--    être enregistré comme coach civil dans users, pas juste avoir un
--    JWT valide.
--
-- Cumul avec policies existantes
-- ------------------------------
-- - "admins insert all" reste — un admin peut toujours créer n'importe
--   quel type (SECONDAIRE, CEGEP, LIGUE_CIVILE).
-- - "schools public read" + "admins read/update all" inchangées.
-- - Postgres applique l'OR sur les WITH CHECK des policies INSERT
--   permissives — si l'utilisateur match SOIT admin SOIT coach civil,
--   l'INSERT passe ; sinon refusé.
--
-- Pattern additif (cf. teams_onboarding_readable, civil_teams_discoverable)
-- — DROP IF EXISTS + CREATE pour idempotence sur replay.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Coaches create civil schools" ON public.schools;

CREATE POLICY "Coaches create civil schools"
  ON public.schools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'LIGUE_CIVILE'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'COACH'
        AND u.context = 'ligue_civile'
    )
  );
