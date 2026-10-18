-- Rollback de 20261018120000 : retire la table des détails de visite, ses deux triggers et ses
-- cinq fonctions. Les visites elles-mêmes (visit_at, visite_le) ne sont pas touchées.
-- REFUSE si des détails existent : aucune donnée saisie par une unité n'est effacée en silence.
do $$
begin
  if to_regclass('public.visites_details') is null then
    raise exception 'NEXUS: 20261018120000 absente — rien à défaire';
  end if;
  if exists (select 1 from public.visites_details) then
    raise exception 'NEXUS: des détails de visite existent — rollback refusé, rien n''est touché';
  end if;
end $$;

drop trigger visites_details_menage on public.recruiter_pipeline;
drop trigger visites_details_menage on public.cartes_prospect;
drop function public.visites_details_menage_carte();
drop function public.visites_details_menage_pipeline();
drop function public.agenda_visites_details(text);
drop function public.visite_details_enregistrer(uuid, uuid, text, text, text, uuid, text, text);
drop function public.visites_details_unite();
drop table public.visites_details;
