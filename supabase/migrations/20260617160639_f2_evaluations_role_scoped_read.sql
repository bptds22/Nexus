-- f2_evaluations_role_scoped_read
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Lecture des évaluations scoped par rôle : le coach auteur, tout recruteur,
-- l'athlète propriétaire, ou un admin.
drop policy if exists "authenticated read evaluations" on public.evaluations;
create policy "authenticated read evaluations" on public.evaluations
  for select to authenticated
  using (
    (coach_id = auth.uid())
    or is_recruiter()
    or exists (
      select 1 from public.athletes a
      where a.id = evaluations.athlete_id and a.user_id = auth.uid()
    )
    or is_admin()
  );
