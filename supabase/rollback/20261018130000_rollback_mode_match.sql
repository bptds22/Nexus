-- Rollback de 20261018130000 : retire le mode match (2 tables, 8 fonctions).
-- REFUSE si une séance existe : aucune note de match n'est effacée en silence.
do $$
begin
  if to_regclass('public.match_seances') is null then
    raise exception 'NEXUS: 20261018130000 absente — rien à défaire';
  end if;
  if exists (select 1 from public.match_seances) then
    raise exception 'NEXUS: des séances de match existent — rollback refusé, rien n''est touché';
  end if;
end $$;

drop function public.match_notes_lier(uuid, text, text, text, uuid, uuid);
drop function public.match_notes_seance(uuid);
drop function public.match_seances_recentes();
drop function public.match_note_supprimer(uuid);
drop function public.match_notes_envoyer(uuid, jsonb);
drop function public.match_seance_terminer(uuid);
drop function public.match_seance_ouvrir(uuid, uuid, text, text, text, timestamptz);
drop function public.match_seance_acces(uuid);
drop table public.match_notes;
drop table public.match_seances;
