-- Rollback de 20261016040000_coachs_nommables.sql — une transaction.
-- La migration n'a fait qu'AJOUTER trois fonctions (aucune donnée, aucune fonction existante
-- modifiée) : le rollback exact est de les retirer et d'effacer la version. Les clients web et
-- mobile qui les appellent doivent être revenus en arrière AVANT (sinon leurs listes de coachs
-- et l'aperçu de code échouent).
begin;

drop function public.apercu_code_equipe(text);
drop function public.coachs_nommables_equipe(uuid);
drop function public.coachs_nommables_ecole(uuid);

delete from supabase_migrations.schema_migrations where version = '20261016040000';

do $$
begin
  if to_regprocedure('public.apercu_code_equipe(text)') is not null
     or to_regprocedure('public.coachs_nommables_equipe(uuid)') is not null
     or to_regprocedure('public.coachs_nommables_ecole(uuid)') is not null then
    raise exception 'NEXUS: rollback coachs nommables — une fonction subsiste';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.coach_nommable(uuid)'::regprocedure)
       is distinct from 'a70d5b069285a61aced0fab5a208c031'
     or (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.resolve_team_join_token(text)'::regprocedure)
       is distinct from '069c147d79f963aad5e97d39772bee2a' then
    raise exception 'NEXUS: rollback coachs nommables — coach_nommable ou resolve_team_join_token a changé';
  end if;
end $$;

commit;
