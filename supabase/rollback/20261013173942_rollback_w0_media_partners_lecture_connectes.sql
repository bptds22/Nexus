-- Rollback de 20261013173942_w0_media_partners_lecture_connectes.sql (ancien n° 094806) : rend la policy relevée
-- avant (« Public read approved partners », TO public, status = 'APPROVED').

drop policy if exists "Anon read approved partners" on public.media_partners;

create policy "Public read approved partners"
  on public.media_partners
  for select
  to public
  using (status = 'APPROVED');
