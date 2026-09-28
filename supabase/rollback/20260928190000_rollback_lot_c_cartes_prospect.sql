-- Rollback de 20260928190000_lot_c_cartes_prospect (lot C, cartes prospect).
-- ⚠️ SUPPRIME les cartes, leurs notes, leur journal et les traces de
--    suppression. À n'exécuter en prod qu'après export si des cartes existent.
-- Aucun objet antérieur n'a été modifié par la migration : rien à restaurer.

select cron.unschedule(jobid) from cron.job where jobname = 'cartes-prospect-purge-quotidienne';

drop table public.cartes_prospect_listes;
drop table public.cartes_prospect_notes;
drop table public.cartes_prospect_journal;
drop table public.cartes_prospect;              -- ses triggers et policies partent avec elle
drop table public.cartes_prospect_suppressions;

drop function public.purger_cartes_prospect();
drop function public.athlete_nexus_par_courriel(text);
drop function public.cartes_prospect_listes_journal();
drop function public.cartes_prospect_listes_avant();
drop function public.cartes_prospect_notes_apres();
drop function public.cartes_prospect_notes_avant();
drop function public.cartes_prospect_tracer_suppression();
drop function public.cartes_prospect_journaliser();
drop function public.cartes_prospect_avant_update();
drop function public.cartes_prospect_avant_insert();
drop function public.carte_ecriture_ok(uuid);
drop function public.carte_lecture_ok(uuid);
drop function public.acces_carte_lecture(uuid, uuid);
drop function public.acces_carte_ecriture(uuid, uuid);

do $$
begin
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname like 'cartes\_prospect%') then
    raise exception 'NEXUS: une table cartes_prospect* existe encore';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('acces_carte_ecriture','acces_carte_lecture','carte_lecture_ok','carte_ecriture_ok',
                              'purger_cartes_prospect','cartes_prospect_avant_insert','cartes_prospect_avant_update',
                              'cartes_prospect_journaliser','cartes_prospect_tracer_suppression',
                              'cartes_prospect_notes_avant','cartes_prospect_notes_apres',
                              'cartes_prospect_listes_avant','cartes_prospect_listes_journal',
                              'athlete_nexus_par_courriel')) then
    raise exception 'NEXUS: une fonction des cartes existe encore';
  end if;
  if exists (select 1 from cron.job where jobname = 'cartes-prospect-purge-quotidienne') then
    raise exception 'NEXUS: la tâche de purge existe encore';
  end if;
end $$;
