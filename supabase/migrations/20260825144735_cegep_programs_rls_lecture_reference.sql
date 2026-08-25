-- ═══════════════════════════════════════════════════════════════
-- T1 (suite) — RLS des deux tables de référence.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- Les deux tables sont sorties de CREATE TABLE avec RLS ACTIVE et
-- ZÉRO POLICY — donc lisibles par PERSONNE via PostgREST. Le
-- sélecteur aurait rendu une liste vide, sans erreur : exactement le
-- mode de panne « la donnee absente lue comme un resultat vide » que
-- ce chantier corrige ailleurs. Verifie avant, pas apres.
--
-- MODELE : school_programs.programs_read — donnee de reference, lecture
-- ouverte a tout compte authentifie, ecriture reservee.
-- Aucune identite, aucune donnee personnelle : ce sont des noms de
-- programmes collegiaux publics.
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY cegep_programs_read ON public.cegep_programs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY cegep_program_labels_read ON public.cegep_program_labels
  FOR SELECT TO authenticated USING (true);

-- Ecriture : admin seulement. La liste nationale n'est pas editable
-- par un cegep — chaque etablissement edite SON catalogue
-- (school_programs), jamais la reference partagee.
CREATE POLICY cegep_programs_write ON public.cegep_programs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY cegep_program_labels_write ON public.cegep_program_labels
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
