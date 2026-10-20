-- Rollback de 20261020180000_parent_notif_sans_identifiant_recruteur.
-- Retire le trigger et ses fonctions : les nouvelles lignes reprennent
-- recruiter_id. Les anciennes lignes ne bougent PAS ici — leur retour à
-- l'origine est scripts/parent-notif-sans-recruteur/2-rollback.sql, à jouer
-- AVANT ce fichier si le script 1 a tourné. La table de copie est gardée.

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_parent_notif_sans_identifiants') then
    raise exception 'NEXUS: 20261020180000 absente';
  end if;
end $$;

drop trigger trg_parent_notif_sans_identifiants on public.parent_notifications;
drop function public.parent_notif_sans_identifiants();
drop function public.parent_notif_cles_retirees();
