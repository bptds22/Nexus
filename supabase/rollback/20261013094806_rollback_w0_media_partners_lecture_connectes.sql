-- Rollback de 20261013094806_w0_media_partners_lecture_connectes.sql : rend la policy relevée
-- avant (« Public read approved partners », TO public, status = 'APPROVED').

drop policy if exists "Anon read approved partners" on public.media_partners;

create policy "Public read approved partners"
  on public.media_partners
  for select
  to public
  using (status = 'APPROVED');
