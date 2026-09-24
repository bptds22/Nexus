-- ROLLBACK de 20260925120000_b2_0_signatures_unite (lot B2-0)
--
-- Remet l'état exact de B1 :
--   · les 20 policies unite_* sont RECRÉÉES depuis leurs expressions
--     sauvegardées (_b2_0_sauvegarde), telles que B1 les avait posées ;
--   · les 4 fonctions de journal reprennent leur définition EXACTE d'avant ;
--   · le journal perd ses colonnes d'unité, sa policy d'unité et ses triggers ;
--   · les fonctions nouvelles disparaissent.
--
-- Aucune donnée métier n'est touchée. Les lignes de journal écrites après
-- l'apply restent (signées par l'acteur) : ce sont des faits, pas du schéma.
--
-- Testé en local : apply → rollback → empreintes identiques.

drop policy if exists unite_journal_select on public.recruiter_activity_log;

do $$
declare
  r record;
  v_cmd text;
begin
  -- 1. Policies unite_* : retirées puis recréées depuis la sauvegarde.
  for r in select ligne->>'table' as t, ligne->>'nom' as nom from public._b2_0_sauvegarde where quoi = 'policy'
  loop
    execute format('drop policy if exists %I on %s', r.nom, r.t);
  end loop;
  for r in select ligne from public._b2_0_sauvegarde where quoi = 'policy'
  loop
    v_cmd := case r.ligne->>'cmd' when 'r' then 'select' when 'a' then 'insert'
                                  when 'w' then 'update' when 'd' then 'delete' else 'all' end;
    execute format('create policy %I on %s for %s to %s%s%s',
      r.ligne->>'nom', r.ligne->>'table', v_cmd, r.ligne->>'roles',
      case when r.ligne->>'using' is not null then ' using (' || (r.ligne->>'using') || ')' else '' end,
      case when r.ligne->>'check' is not null then ' with check (' || (r.ligne->>'check') || ')' else '' end);
  end loop;

  -- 2. Fonctions de journal : définitions d'avant.
  for r in select ligne->>'def' as def from public._b2_0_sauvegarde where quoi = 'fonction'
  loop
    execute r.def;
  end loop;
end $$;

-- 3. Journal : triggers, index, colonnes.
drop trigger if exists trg_unite_a_poser on public.recruiter_activity_log;
drop trigger if exists trg_unite_b_figer on public.recruiter_activity_log;
drop index if exists public.recruiter_activity_log_unite_idx;
alter table public.recruiter_activity_log
  drop column if exists unite_cegep_id,
  drop column if exists unite_sport_id;

-- 4. Fonctions nouvelles.
drop function if exists public.unite_ecrire_dossier(uuid, jsonb);
drop function if exists public.unite_ecrire_grade(uuid, text);
drop function if exists public.unite_retirer_favori(uuid, uuid);
drop function if exists public.unite_retirer_du_processus(uuid, uuid);
drop function if exists public.unite_retirer_grade(uuid, uuid);
drop function if exists public.unite_poser_journal();
drop function if exists public.unite_figer_journal();
drop function if exists public.acteur_recruteur();
drop function if exists public.acces_unite_pro(uuid, uuid);

-- 5. Contrôles, puis retrait de la sauvegarde.
do $$
declare
  r record;
  n int;
begin
  for r in
    select b.ligne->>'nom' as nom, b.ligne->>'acl' as avant, p.proacl::text as apres
      from public._b2_0_sauvegarde b
      join pg_proc p on p.proname = b.ligne->>'nom' and p.pronamespace = 'public'::regnamespace
     where b.quoi = 'fonction'
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: rollback B2-0 — ACL de % : % → %', r.nom, r.avant, r.apres;
    end if;
  end loop;
  select count(*) into n from pg_policy where polname like 'unite\_%';
  if n <> 20 then
    raise exception 'NEXUS: rollback B2-0 — % policies unite_*, attendu 20 (celles de B1)', n;
  end if;
  select count(*) into n from pg_policy where polname like 'unite\_%'
     and (coalesce(pg_get_expr(polqual, polrelid), '') like '%acces_unite_pro%'
          or coalesce(pg_get_expr(polwithcheck, polrelid), '') like '%acces_unite_pro%');
  if n > 0 then
    raise exception 'NEXUS: rollback B2-0 — % policy(s) encore en acces_unite_pro', n;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'recruiter_activity_log'
                and column_name in ('unite_cegep_id', 'unite_sport_id')) then
    raise exception 'NEXUS: rollback B2-0 — colonnes d''unité encore sur le journal';
  end if;
  raise notice 'NEXUS: rollback lot B2-0 complet';
end $$;

drop table if exists public._b2_0_sauvegarde;
