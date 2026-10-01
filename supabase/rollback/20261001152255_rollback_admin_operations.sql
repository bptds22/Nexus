-- Rollback de 20261001152255_admin_operations.
-- ⚠ Détruit le registre : à ne jouer que si la table est vide, ou après en
-- avoir exporté le contenu.
drop trigger trg_admin_operations_immuable on public.admin_operations;
drop function public.admin_operations_immuable();
drop table public.admin_operations;
