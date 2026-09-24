-- ROLLBACK de 20260924190000_users_sport_id_recruteur
--
-- Retire exactement ce que la migration a posé : trigger, fonction, index,
-- colonne (et sa FK avec elle). users.sport n'a jamais cessé d'être écrit :
-- rien n'est perdu côté texte. Le rattrapage n'avait réaligné le texte que
-- sur sports.nom à l'identique (16/16 exacts), donc rien à restaurer.
--
-- Testé en local : apply → rollback → empreintes identiques (colonnes,
-- triggers, index, fonctions, contraintes de public.users).

drop trigger if exists trg_users_sport_id on public.users;
drop function if exists public.users_sport_id_depuis_texte();
drop index if exists public.users_school_sport_idx;
alter table public.users drop column if exists sport_id;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'users' and column_name = 'sport_id') then
    raise exception 'NEXUS: rollback incomplet, users.sport_id existe encore';
  end if;
  if exists (select 1 from pg_proc where proname = 'users_sport_id_depuis_texte') then
    raise exception 'NEXUS: rollback incomplet, la fonction existe encore';
  end if;
  raise notice 'NEXUS: rollback users.sport_id complet';
end $$;
