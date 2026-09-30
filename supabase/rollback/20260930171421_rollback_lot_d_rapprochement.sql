-- Rollback de 20260930171421_lot_d_rapprochement (lot D).
-- ⚠ Supprime les propositions (et le souvenir des refus) et les notifications.
-- Aucun objet antérieur n'a été modifié : les triggers ajoutés sur athletes,
-- users, team_athletes et cartes_prospect partent, rien d'autre ne bouge.

select cron.unschedule(jobid) from cron.job where jobname in ('rapprochements-evaluation', 'rapprochements-majorite');

drop trigger trg_rapprochement_athlete_insert on public.athletes;
drop trigger trg_rapprochement_athlete_identite on public.athletes;
drop trigger trg_rapprochement_onboarding on public.users;
drop trigger trg_rapprochement_equipe on public.team_athletes;
drop trigger trg_rapprochement_carte_insert on public.cartes_prospect;
drop trigger trg_rapprochement_carte_update on public.cartes_prospect;
drop trigger trg_carte_d_telephone on public.cartes_prospect;
drop trigger trg_carte_z_telephone on public.cartes_prospect;

drop function public.refuser_rapprochement(uuid);
drop function public.rapprochements_unite(uuid);
drop function public.rapprochement_majorite_du_jour();
drop function public.rapprochement_sur_carte();
drop function public.rapprochement_sur_equipe();
drop function public.rapprochement_sur_onboarding();
drop function public.rapprochement_sur_athlete();
drop function public.rapprochement_enfiler(uuid, uuid, text);
drop function public.evaluer_rapprochements(integer);
drop function public.rapprocher(uuid, uuid);
drop function public.rapprochement_candidats(uuid, uuid);

drop table public.notifications_unite;
drop table public.rapprochements;
drop table public.rapprochement_file;

-- ⚠ Le téléphone des cartes part avec la colonne.
alter table public.cartes_prospect drop column telephone;
drop function public.carte_telephone_journaliser();
drop function public.carte_telephone_normaliser();
drop function public.telephone_normalise(text);
drop function public.athletes_nom_proche(text, text, uuid);
drop function public.noms_proches(text, text);
drop function public.seuil_nom_proche();
drop function public.prenoms_compatibles(text, text);
drop function public.nom_normalise(text);
-- Installée par le lot D ; refuse de partir si un autre objet en dépend (voulu).
drop extension pg_trgm;

do $$
begin
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace
              and relname in ('rapprochement_file', 'rapprochements', 'notifications_unite')) then
    raise exception 'NEXUS: une table du lot D existe encore';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('nom_normalise','prenoms_compatibles','rapprochement_candidats','rapprocher',
                              'evaluer_rapprochements','rapprochement_enfiler','rapprochement_sur_athlete',
                              'rapprochement_sur_onboarding','rapprochement_sur_equipe','rapprochement_sur_carte',
                              'rapprochement_majorite_du_jour','rapprochements_unite','refuser_rapprochement',
                              'seuil_nom_proche','noms_proches','athletes_nom_proche',
                              'telephone_normalise','carte_telephone_normaliser','carte_telephone_journaliser')) then
    raise exception 'NEXUS: une fonction du lot D existe encore';
  end if;
  if exists (select 1 from pg_trigger where tgname like 'trg_rapprochement_%') then
    raise exception 'NEXUS: un trigger du lot D existe encore';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'cartes_prospect' and column_name = 'telephone') then
    raise exception 'NEXUS: cartes_prospect.telephone existe encore';
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'NEXUS: pg_trgm est encore installée';
  end if;
  if exists (select 1 from cron.job where jobname in ('rapprochements-evaluation', 'rapprochements-majorite')) then
    raise exception 'NEXUS: une tâche du lot D existe encore';
  end if;
end $$;
