-- fix_users_admin_insert_policy
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Policy INSERT sur public.users : seuls les admins peuvent insérer un user.
drop policy if exists "admins insert users" on public.users;
create policy "admins insert users" on public.users
  for insert to authenticated
  with check (is_admin());
