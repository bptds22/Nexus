-- Rollback de 20260928172039_b2_3_unite_journal_calendrier (lot B2, étape 3 ; écrite 20260928160000).
-- B : retire la policy unite_equipes_suivies et athlete_suivi_par_mon_unite().
-- A (§39) :
-- Rejoue les trois définitions d'origine sauvegardées, vérifie les ACL,
-- supprime la table de sauvegarde. Rouvre §39 : la ligne de journal d'un
-- admin agissant dans un autre sport retourne dans SON unité.

create temp table _acl_avant on commit drop as
  select p.proname::text as nom, p.proacl::text as acl
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('unite_poser_journal', 'unite_retirer_favori', 'unite_retirer_du_processus');

do $$
declare
  r record;
  n int := 0;
begin
  for r in select nom, def from public._b2_3_sauvegarde loop
    execute r.def;
    n := n + 1;
  end loop;
  if n <> 3 then raise exception 'NEXUS: % définitions rejouées, attendu 3', n; end if;

  for r in
    select a.nom, a.acl as avant, p.proacl::text as apres
      from _acl_avant a join pg_proc p on p.proname = a.nom and p.pronamespace = 'public'::regnamespace
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: ACL de % modifiée par le rollback : % → %', r.nom, r.avant, r.apres;
    end if;
  end loop;

  -- Les définitions en place sont exactement celles d'origine.
  select count(*) into n
    from public._b2_3_sauvegarde s
    join pg_proc p on p.proname = s.nom and p.pronamespace = 'public'::regnamespace
   where pg_get_functiondef(p.oid) = s.def;
  if n <> 3 then raise exception 'NEXUS: % définitions identiques à l''origine, attendu 3', n; end if;
end $$;

drop table public._b2_3_sauvegarde;

drop policy unite_equipes_suivies on public.team_athletes;
drop function public.athlete_suivi_par_mon_unite(uuid);
do $$ begin
  if exists (select 1 from pg_policy where polname = 'unite_equipes_suivies') then
    raise exception 'NEXUS: unite_equipes_suivies existe encore';
  end if;
end $$;
