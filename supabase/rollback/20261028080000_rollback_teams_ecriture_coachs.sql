-- Rollback du lot T : retire les trois policies restrictives d'écriture de teams (retour aux seules policies
-- « Coaches create / update / delete teams »).
drop policy teams_ecriture_coachs_insert on public.teams;
drop policy teams_ecriture_coachs_update on public.teams;
drop policy teams_ecriture_coachs_delete on public.teams;
