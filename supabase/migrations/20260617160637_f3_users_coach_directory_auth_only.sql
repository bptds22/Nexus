-- f3_users_coach_directory_auth_only
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Annuaire coachs : la lecture des users COACH est réservée aux authentifiés
-- (plus d'accès anon).
drop policy if exists "authenticated read coaches" on public.users;
create policy "authenticated read coaches" on public.users
  for select to authenticated
  using (role = 'COACH'::user_role);
