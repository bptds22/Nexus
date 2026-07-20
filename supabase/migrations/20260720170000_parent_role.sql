-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a (fondations). Migration 1/5 : rôle PARENT.
--
-- Ajoute la valeur 'PARENT' à l'enum public.user_role (mécanisme identifié
-- au diagnostic : les rôles valides sont un enum PG, pas un CHECK).
--
-- ADD VALUE est isolé dans sa propre migration : la valeur ne peut pas être
-- UTILISÉE dans la même transaction que son ADD. Aucune utilisation ici.
-- ═══════════════════════════════════════════════════════════════

alter type public.user_role add value if not exists 'PARENT';
