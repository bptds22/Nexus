-- ROLLBACK de 20260924200000_b1_tableau_blanc_unite (lot B1)
--
-- Retire exactement ce que la migration a posé, dans l'ordre inverse :
--   policies unite_* → triggers trg_unite_* → fonctions nouvelles →
--   définitions d'origine des 4 fonctions trigger (REJOUÉES depuis
--   _b1_sauvegarde, donc exactes dans chaque environnement) → index →
--   colonnes → table de sauvegarde.
--
-- Aucune donnée d'origine n'est perdue : les colonnes retirées ne portaient
-- que l'unité (déduite) et added_by (nouvelle). Si la synchronisation a
-- recopié des étapes ou des grades entre lignes sœurs APRÈS l'apply, ces
-- écritures restent : elles sont des écritures métier, pas du schéma.
--
-- Testé en local : apply → rollback → empreintes identiques.

do $$
declare
  r record;
  t text;
begin
  -- 1. Policies
  foreach t in array array['recruiter_pipeline','recruiter_athlete_grades','recruiter_notes',
                           'recruiter_favorites','recruiter_lists','recruiter_list_members','recruiter_list_notes']
  loop
    execute format('drop policy if exists unite_select on public.%I', t);
    execute format('drop policy if exists unite_insert on public.%I', t);
    execute format('drop policy if exists unite_update on public.%I', t);
    execute format('drop policy if exists unite_delete on public.%I', t);
    -- 2. Triggers
    execute format('drop trigger if exists trg_unite_a_poser on public.%I', t);
    execute format('drop trigger if exists trg_unite_b_figer on public.%I', t);
    execute format('drop trigger if exists trg_unite_c_aligner on public.%I', t);
    execute format('drop trigger if exists trg_unite_z_sync on public.%I', t);
  end loop;

  -- 3. Définitions d'origine des 4 fonctions trigger (ACL conservée par
  --    CREATE OR REPLACE, vérifiée plus bas).
  for r in select ligne->>'nom' as nom, ligne->>'def' as def
             from public._b1_sauvegarde where quoi = 'fonction'
  loop
    execute r.def;
  end loop;
end $$;

-- 4. Fonctions nouvelles
drop function if exists public.unite_pipeline(uuid, boolean);
drop function if exists public.unite_grades(uuid, boolean);
drop function if exists public.unite_favoris(uuid, boolean);
drop function if exists public.unite_auteurs();
drop function if exists public.unite_sync_soeurs();
drop function if exists public.unite_aligner_pipeline();
drop function if exists public.unite_figer();
drop function if exists public.unite_poser();
drop function if exists public.acces_unite(uuid, uuid);
drop function if exists public.rang_etape(text);

-- 5. Index et colonnes
drop index if exists public.recruiter_pipeline_unite_idx;
drop index if exists public.recruiter_athlete_grades_unite_idx;
drop index if exists public.recruiter_notes_unite_idx;
drop index if exists public.recruiter_favorites_unite_idx;
drop index if exists public.recruiter_lists_unite_idx;

alter table public.recruiter_pipeline       drop column if exists unite_cegep_id, drop column if exists unite_sport_id;
alter table public.recruiter_athlete_grades drop column if exists unite_cegep_id, drop column if exists unite_sport_id;
alter table public.recruiter_notes          drop column if exists unite_cegep_id, drop column if exists unite_sport_id;
alter table public.recruiter_favorites      drop column if exists unite_cegep_id, drop column if exists unite_sport_id;
alter table public.recruiter_lists          drop column if exists unite_cegep_id, drop column if exists unite_sport_id;
alter table public.recruiter_list_members   drop column if exists unite_cegep_id, drop column if exists unite_sport_id,
                                            drop column if exists added_by;
alter table public.recruiter_list_notes     drop column if exists unite_cegep_id, drop column if exists unite_sport_id;

-- 6. Contrôles, PUIS retrait de la sauvegarde (elle a servi au §3).
do $$
declare
  r record;
  n int;
begin
  for r in
    select b.ligne->>'nom' as nom, b.ligne->>'acl' as avant, p.proacl::text as apres,
           position('nexus.sync_unite' in p.prosrc) as garde
      from public._b1_sauvegarde b
      join pg_proc p on p.proname = b.ligne->>'nom' and p.pronamespace = 'public'::regnamespace
     where b.quoi = 'fonction'
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: rollback — ACL de % : % → %', r.nom, r.avant, r.apres;
    end if;
    if r.garde > 0 then
      raise exception 'NEXUS: rollback — % porte encore la garde du lot B1', r.nom;
    end if;
  end loop;
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and column_name in ('unite_cegep_id', 'unite_sport_id', 'added_by')
     and table_name like 'recruiter%';
  if n > 0 then
    raise exception 'NEXUS: rollback incomplet — % colonne(s) du lot B1 restante(s)', n;
  end if;
  select count(*) into n from pg_policy where polname like 'unite\_%';
  if n > 0 then
    raise exception 'NEXUS: rollback incomplet — % policy(s) unite_* restante(s)', n;
  end if;
  raise notice 'NEXUS: rollback lot B1 complet';
end $$;

drop table if exists public._b1_sauvegarde;
