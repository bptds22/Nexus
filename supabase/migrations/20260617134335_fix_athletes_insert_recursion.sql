-- fix_athletes_insert_recursion
-- Reconstruit depuis l'état réel en base (appliqué via MCP, sans fichier local).
-- Policy INSERT sur public.athletes : un coach insère un athlète de son équipe,
-- sous plafond de tier. Réécrite avec helpers (is_coach / user_has_pro /
-- get_user_tier / count_coach_athletes) pour éviter la récursion RLS.
drop policy if exists "athletes_insert" on public.athletes;
create policy "athletes_insert" on public.athletes
  for insert to authenticated
  with check (
    (coach_id = auth.uid()) and is_coach()
    and (
      user_has_pro()
      or (get_user_tier() = 'free' and count_coach_athletes() < 30)
    )
  );
