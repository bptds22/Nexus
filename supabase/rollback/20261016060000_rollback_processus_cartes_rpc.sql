-- Rollback de 20261016060000_processus_cartes_rpc.sql — une transaction.
-- La migration n'a fait qu'AJOUTER quatre fonctions (aucune donnée, aucune fonction existante modifiée) : le
-- rollback exact est de les retirer et d'effacer la version. Le code web et mobile qui les appelle (Mon
-- processus, export Excel, Mes listes, calendrier, Mon cégep) doit être revenu en arrière AVANT, sinon ces
-- écrans affichent l'erreur de chargement.
begin;

drop function public.processus_notes_export(uuid[], uuid[]);
drop function public.processus_dernieres_notes(uuid, uuid, boolean);
drop function public.processus_dernieres_notes_cartes(uuid, uuid, boolean);
drop function public.processus_cartes(uuid, uuid, boolean);

delete from supabase_migrations.schema_migrations where version = '20261016060000';

do $$
begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                               'processus_notes_export')) then
    raise exception 'NEXUS: rollback processus — une fonction subsiste';
  end if;
end $$;

commit;
