-- Rollback de 20261001173705_recruteur_rattachement_verrou.
-- Rend `users update own` à son WITH CHECK d'avant (5 colonnes épinglées) et
-- retire les deux fonctions. ⚠ Rouvre le risque 2.
drop policy "users update own" on public.users;
create policy "users update own" on public.users
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and public.user_privileged_cols_unchanged(role, status, is_platform_admin, context, is_school_admin)
  );
drop function public.changer_rattachement_recruteur(uuid, uuid, text);
drop function public.recruteur_rattachement_inchange(uuid, text, uuid);
