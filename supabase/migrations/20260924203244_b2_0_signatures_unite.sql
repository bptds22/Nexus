-- 20260924203244_b2_0_signatures_unite (version enregistrée en prod ; écrite 20260925120000)
--
-- LOT B2-0 — le tableau blanc, CHAQUE GESTE SIGNÉ PAR CELUI QUI AGIT
-- (décisions BP du 2026-09-24). Suite de B1 (20260924201029). Aucune
-- interface : B2 (Mon processus, Favoris/Listes, Calendrier/Tableau de bord)
-- s'appuie sur ce qui est posé ici.
--
-- 1. GRATUIT = TOUT BLOQUÉ, EN BASE (décision BP 1). Les 20 policies unite_*
--    de B1 sont RECRÉÉES avec l'exigence Pro en lecture, modification ET
--    suppression. DÉROGATION à la règle 1 accordée par BP pour ces 20
--    policies seulement : aucun client ne les utilisait encore (ni le web, ni
--    l'app 1.4.3). Un recruteur gratuit ne lit plus aucune ligne d'un
--    collègue par appel direct ; ses propres lignes restent aux policies
--    propriétaire, inchangées.
-- 2. ÉCRIRE PAR SA PROPRE LIGNE : unite_ecrire_dossier / unite_ecrire_grade.
--    L'acteur écrit TOUJOURS sa ligne (créée au besoin, alignée sur l'unité,
--    sans bruit de journal) ; la synchronisation B1 recopie sur les sœurs.
-- 3. RETRAITS D'UNITÉ, une fonction par geste, UNE ligne de journal signée
--    par l'acteur : unite_retirer_favori, unite_retirer_du_processus,
--    unite_retirer_grade (les grades ne se journalisent pas).
-- 4. JOURNAUX SIGNÉS PAR L'ACTEUR : log_pipeline_change, log_unfavorited,
--    log_list_member_added, log_list_member_removed signent l'appelant quand
--    c'est un recruteur (sinon l'auteur d'avant : admin plateforme, chemins
--    serveur). Mêmes signatures, jamais appelées par l'app ; définitions
--    d'origine sauvegardées et rejouées par le rollback.
-- 5. LE JOURNAL DE L'UNITÉ (décision BP, question 5) : unite_cegep_id /
--    unite_sport_id sur recruiter_activity_log, posées à l'INSERT (jamais
--    choisies par un client), et une policy de lecture pour les collègues Pro,
--    limitée aux GESTES du tableau blanc. Les vues de profil et les
--    notifications rangées dans la même table restent privées. Pas de
--    rattrapage : le journal d'unité commence à l'apply.
--
-- AUCUNE contrainte modifiée, AUCUNE signature de fonction existante changée,
-- AUCUN DROP de fonction.
--
-- Rollback : supabase/rollback/20260924203244_rollback_b2_0_signatures_unite.sql

-- ════════════════════════════════════════════════════════════════════════════
-- 0. SAUVEGARDE — définitions et ACL des 4 fonctions modifiées, et des 20
--    policies remplacées. Illisible hors service.
-- ════════════════════════════════════════════════════════════════════════════
create table public._b2_0_sauvegarde (
  quoi    text        not null,
  ligne   jsonb       not null,
  pris_le timestamptz not null default now()
);
revoke all on public._b2_0_sauvegarde from public, anon, authenticated;
alter table public._b2_0_sauvegarde enable row level security;
comment on table public._b2_0_sauvegarde is
  'Lot B2-0 (2026-09-25) : définitions des 4 fonctions de journal et des 20 policies unite_* avant remplacement. Illisible hors service_role/postgres.';

insert into public._b2_0_sauvegarde (quoi, ligne)
  select 'fonction', jsonb_build_object('nom', p.proname, 'def', pg_get_functiondef(p.oid), 'acl', p.proacl::text)
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('log_pipeline_change', 'log_unfavorited', 'log_list_member_added', 'log_list_member_removed');
insert into public._b2_0_sauvegarde (quoi, ligne)
  select 'policy', jsonb_build_object(
           'table', pol.polrelid::regclass::text, 'nom', pol.polname, 'cmd', pol.polcmd::text,
           'roles', array_to_string(pol.polroles::regrole[], ','),
           'using', pg_get_expr(pol.polqual, pol.polrelid), 'check', pg_get_expr(pol.polwithcheck, pol.polrelid))
    from pg_policy pol
   where pol.polname like 'unite\_%';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. GRATUIT = TOUT BLOQUÉ — les 20 policies unite_* recréées avec Pro.
-- ════════════════════════════════════════════════════════════════════════════
create function public.acces_unite_pro(p_cegep uuid, p_sport uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.acces_unite(p_cegep, p_sport) and public.user_has_pro()
$$;

do $$
declare
  t text;
begin
  foreach t in array array['recruiter_pipeline','recruiter_athlete_grades','recruiter_notes',
                           'recruiter_favorites','recruiter_lists','recruiter_list_members','recruiter_list_notes']
  loop
    execute format('drop policy if exists unite_select on public.%I', t);
    execute format('drop policy if exists unite_update on public.%I', t);
    execute format('drop policy if exists unite_delete on public.%I', t);
    execute format('drop policy if exists unite_insert on public.%I', t);
  end loop;
end $$;

create policy unite_select on public.recruiter_pipeline for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_pipeline for update to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_pipeline for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_athlete_grades for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_athlete_grades for update to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_athlete_grades for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_notes for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_notes for update to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_notes for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_favorites for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_favorites for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_lists for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_lists for update to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_lists for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_list_members for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_insert on public.recruiter_list_members for insert to authenticated
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_list_members for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_list_notes for select to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_list_notes for update to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite_pro(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_list_notes for delete to authenticated
  using (public.acces_unite_pro(unite_cegep_id, unite_sport_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. L'ACTEUR — qui signe un geste.
--    Le recruteur appelant s'il y en a un ; sinon NULL (admin plateforme,
--    chemins serveur, service) et chaque journal garde son auteur d'avant.
-- ════════════════════════════════════════════════════════════════════════════
create function public.acteur_recruteur()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id from public.users u
   where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LE JOURNAL DE L'UNITÉ
-- ════════════════════════════════════════════════════════════════════════════
alter table public.recruiter_activity_log
  add column unite_cegep_id uuid,
  add column unite_sport_id uuid;
comment on column public.recruiter_activity_log.unite_cegep_id is
  'Unité du geste (lot B2-0) : celle de la ligne touchée quand un journal serveur la fournit, sinon celle du signataire. Jamais choisie par un client. NULL = hors tableau blanc.';
create index recruiter_activity_log_unite_idx
  on public.recruiter_activity_log (unite_cegep_id, unite_sport_id, created_at desc)
  where unite_cegep_id is not null;

-- Poser l'unité d'une ligne de journal.
-- SECURITY INVOKER exprès : current_user dit qui insère. Un client
-- ('authenticated') ne choisit jamais l'unité : elle est déduite de son propre
-- compte. Une fonction serveur (SECURITY DEFINER, current_user = propriétaire)
-- peut fournir l'unité de la ligne qu'elle journalise ; sinon on la déduit du
-- signataire.
create function public.unite_poser_journal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cegep uuid;
  v_sport uuid;
begin
  if current_user in ('authenticated', 'anon') or new.unite_cegep_id is null or new.unite_sport_id is null then
    select u.school_id, u.sport_id into v_cegep, v_sport
      from public.users u
     where u.id = new.recruiter_id and u.role = 'RECRUTEUR'::public.user_role;
    if v_cegep is null or v_sport is null then
      new.unite_cegep_id := null;
      new.unite_sport_id := null;
    else
      new.unite_cegep_id := v_cegep;
      new.unite_sport_id := v_sport;
    end if;
  end if;
  return new;
end $$;

-- L'unité d'une ligne de journal ne bouge plus (le propriétaire met à jour
-- is_read : c'est tout ce qui doit changer).
create function public.unite_figer_journal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.unite_cegep_id := old.unite_cegep_id;
  new.unite_sport_id := old.unite_sport_id;
  return new;
end $$;

create trigger trg_unite_a_poser before insert on public.recruiter_activity_log
  for each row execute function public.unite_poser_journal();
create trigger trg_unite_b_figer before update on public.recruiter_activity_log
  for each row execute function public.unite_figer_journal();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. JOURNAUX SIGNÉS PAR L'ACTEUR (même signature, garde B1 conservée)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.log_pipeline_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Lot B1 : une ligne sœur recopiée par la synchronisation d'unité ne se
  -- journalise pas ; seule la ligne écrite le fait.
  IF coalesce(current_setting('nexus.sync_unite', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  -- Lot B2-0 : signé par l'ACTEUR (le recruteur qui agit), sinon par l'auteur
  -- de la ligne ; rangé dans l'unité de la ligne.
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  SELECT coalesce(public.acteur_recruteur(), NEW.recruiter_id), NEW.athlete_id, 'PIPELINE_CHANGED',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'new_stage', NEW.stage,
      -- Iter 7.30a — capture du before_stage pour afficher "X → Y" dans le feed.
      -- Sur AFTER INSERT, OLD.* est NULL → before_stage NULL (1ère entrée pipeline).
      -- Sur AFTER UPDATE, OLD.stage est la valeur avant changement.
      'before_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END
    ),
    NEW.unite_cegep_id, NEW.unite_sport_id
  FROM public.athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;

create or replace function public.log_unfavorited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Lot B2-0 : un retrait d'unité (unite_retirer_favori) écrit UNE ligne
  -- lui-même ; les lignes supprimées une à une ne se journalisent pas.
  IF coalesce(current_setting('nexus.retrait_unite', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  SELECT coalesce(public.acteur_recruteur(), OLD.recruiter_id), OLD.athlete_id, 'UNFAVORITED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name),
    OLD.unite_cegep_id, OLD.unite_sport_id
  FROM public.athletes a WHERE a.id = OLD.athlete_id;
  RETURN OLD;
END;
$$;

create or replace function public.log_list_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Lot B2-0 : signé par qui a ajouté (added_by, imposé par trigger), plus par
  -- le propriétaire de la liste.
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details, unite_cegep_id, unite_sport_id)
  SELECT coalesce(public.acteur_recruteur(), NEW.added_by, l.recruiter_id), NEW.athlete_id, NEW.list_id, 'ATHLETE_ADDED_TO_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    ),
    NEW.unite_cegep_id, NEW.unite_sport_id
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = NEW.athlete_id
  WHERE l.id = NEW.list_id;
  RETURN NEW;
END;
$$;

create or replace function public.log_list_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  -- Lot B2-0 : signé par qui retire, plus par le propriétaire de la liste.
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details, unite_cegep_id, unite_sport_id)
  SELECT coalesce(public.acteur_recruteur(), l.recruiter_id), OLD.athlete_id, OLD.list_id, 'ATHLETE_REMOVED_FROM_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    ),
    OLD.unite_cegep_id, OLD.unite_sport_id
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = OLD.athlete_id
  WHERE l.id = OLD.list_id;
  RETURN OLD;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ÉCRIRE PAR SA PROPRE LIGNE
--    SECURITY INVOKER : la RLS décide (Pro exigé à l'INSERT et à l'UPDATE de
--    sa ligne, par les policies propriétaire). Rien n'est écrit au nom d'un
--    collègue.
-- ════════════════════════════════════════════════════════════════════════════

-- Dossier : p_champs porte les champs à écrire. Clé présente = valeur écrite
-- (null compris) ; clé absente = inchangée. Clés admises : stage,
-- next_action_at, next_action_note, visit_at, flagged.
--   · l'acteur a déjà sa ligne       → UPDATE (journal signé par lui) ;
--   · un collègue suit déjà l'athlète → sa ligne est créée SANS journal ni
--     notification (elle naît alignée sur l'unité), puis UPDATE ;
--   · dossier neuf                    → un seul INSERT avec les champs.
create function public.unite_ecrire_dossier(p_athlete_id uuid, p_champs jsonb)
returns public.recruiter_pipeline
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_ligne public.recruiter_pipeline%rowtype;
  v_cle text;
  v_unite_c uuid;
  v_unite_s uuid;
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  if p_athlete_id is null or p_champs is null or jsonb_typeof(p_champs) <> 'object' then
    raise exception 'NEXUS: athlète et champs requis' using errcode = '22023';
  end if;
  for v_cle in select jsonb_object_keys(p_champs) loop
    if v_cle not in ('stage', 'next_action_at', 'next_action_note', 'visit_at', 'flagged') then
      raise exception 'NEXUS: champ non modifiable : %', v_cle using errcode = '22023';
    end if;
  end loop;

  if not exists (select 1 from public.recruiter_pipeline
                  where recruiter_id = v_moi and athlete_id = p_athlete_id) then
    select u.school_id, u.sport_id into v_unite_c, v_unite_s from public.users u where u.id = v_moi;
    if v_unite_c is not null and v_unite_s is not null and exists (
         select 1 from public.recruiter_pipeline s
          where s.unite_cegep_id = v_unite_c and s.unite_sport_id = v_unite_s
            and s.athlete_id = p_athlete_id) then
      -- Rejoindre le dossier de l'unité : pas un geste, pas de journal.
      perform set_config('nexus.sync_unite', 'on', true);
      insert into public.recruiter_pipeline (recruiter_id, athlete_id)
      values (v_moi, p_athlete_id);
      perform set_config('nexus.sync_unite', 'off', true);
    else
      -- Dossier neuf : un seul INSERT, un seul journal.
      insert into public.recruiter_pipeline (recruiter_id, athlete_id, stage, next_action_at, next_action_note, visit_at, flagged)
      values (v_moi, p_athlete_id,
              coalesce(p_champs->>'stage', 'IDENTIFIE'),
              (p_champs->>'next_action_at')::date,
              p_champs->>'next_action_note',
              (p_champs->>'visit_at')::timestamptz,
              coalesce((p_champs->>'flagged')::boolean, false))
      returning * into v_ligne;
      return v_ligne;
    end if;
  end if;

  update public.recruiter_pipeline p
     set stage            = case when p_champs ? 'stage' then p_champs->>'stage' else p.stage end,
         moved_at         = case when p_champs ? 'stage' and (p_champs->>'stage') is distinct from p.stage::text
                                 then now() else p.moved_at end,
         next_action_at   = case when p_champs ? 'next_action_at' then (p_champs->>'next_action_at')::date else p.next_action_at end,
         next_action_note = case when p_champs ? 'next_action_note' then p_champs->>'next_action_note' else p.next_action_note end,
         visit_at         = case when p_champs ? 'visit_at' then (p_champs->>'visit_at')::timestamptz else p.visit_at end,
         flagged          = case when p_champs ? 'flagged' then coalesce((p_champs->>'flagged')::boolean, false) else p.flagged end,
         updated_at       = now()
   where p.recruiter_id = v_moi and p.athlete_id = p_athlete_id
  returning * into v_ligne;
  return v_ligne;
end $$;

-- Grade : sa propre ligne (upsert) ; la synchronisation B1 aligne les sœurs.
-- p_grade NULL = retirer le grade pour l'unité.
create function public.unite_ecrire_grade(p_athlete_id uuid, p_grade text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  if p_grade is null then
    perform public.unite_retirer_grade(p_athlete_id);
    return null;
  end if;
  insert into public.recruiter_athlete_grades (recruiter_id, athlete_id, grade)
  values (auth.uid(), p_athlete_id, p_grade)
  on conflict (recruiter_id, athlete_id) do update set grade = excluded.grade;
  return p_grade;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RETRAITS D'UNITÉ — une fonction par geste, UNE ligne de journal.
--    Portée : l'unité de l'appelant, ou un autre sport de son cégep
--    (p_sport_id, admin cégep) ; plus ses propres lignes privées (sans
--    unité). La RLS (Pro exigé) décide de ce qui part vraiment.
--    Rend le nombre de lignes retirées ; 0 = rien à retirer, rien journalisé.
-- ════════════════════════════════════════════════════════════════════════════
create function public.unite_retirer_favori(p_athlete_id uuid, p_sport_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_c uuid; v_s uuid;
  n int;
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  select u.school_id, coalesce(p_sport_id, u.sport_id) into v_c, v_s from public.users u where u.id = v_moi;

  perform set_config('nexus.retrait_unite', 'on', true);
  delete from public.recruiter_favorites f
   where f.athlete_id = p_athlete_id
     and ((f.unite_cegep_id = v_c and f.unite_sport_id = v_s)
          or (f.unite_cegep_id is null and f.recruiter_id = v_moi));
  get diagnostics n = row_count;
  perform set_config('nexus.retrait_unite', 'off', true);

  if n > 0 then
    insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
    select v_moi, a.id, 'UNFAVORITED',
           jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name, 'unite', true, 'lignes', n)
      from public.athletes a where a.id = p_athlete_id;
  end if;
  return n;
end $$;

create function public.unite_retirer_du_processus(p_athlete_id uuid, p_sport_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_c uuid; v_s uuid;
  v_etape text;
  n int;
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  select u.school_id, coalesce(p_sport_id, u.sport_id) into v_c, v_s from public.users u where u.id = v_moi;

  select p.stage into v_etape
    from public.recruiter_pipeline p
   where p.athlete_id = p_athlete_id
     and ((p.unite_cegep_id = v_c and p.unite_sport_id = v_s)
          or (p.unite_cegep_id is null and p.recruiter_id = v_moi))
   order by public.rang_etape(p.stage) desc
   limit 1;

  delete from public.recruiter_pipeline p
   where p.athlete_id = p_athlete_id
     and ((p.unite_cegep_id = v_c and p.unite_sport_id = v_s)
          or (p.unite_cegep_id is null and p.recruiter_id = v_moi));
  get diagnostics n = row_count;

  if n > 0 then
    -- Même type que les changements d'étape (la contrainte du journal n'est
    -- pas touchée) : new_stage NULL + retire = true dit « retiré ».
    insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
    select v_moi, a.id, 'PIPELINE_CHANGED',
           jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name,
                              'new_stage', null, 'before_stage', v_etape,
                              'retire', true, 'unite', true, 'lignes', n)
      from public.athletes a where a.id = p_athlete_id;
  end if;
  return n;
end $$;

create function public.unite_retirer_grade(p_athlete_id uuid, p_sport_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_c uuid; v_s uuid;
  n int;
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  select u.school_id, coalesce(p_sport_id, u.sport_id) into v_c, v_s from public.users u where u.id = v_moi;
  delete from public.recruiter_athlete_grades g
   where g.athlete_id = p_athlete_id
     and ((g.unite_cegep_id = v_c and g.unite_sport_id = v_s)
          or (g.unite_cegep_id is null and g.recruiter_id = v_moi));
  get diagnostics n = row_count;
  return n;   -- les grades ne se journalisent pas (inchangé)
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LECTURE DU JOURNAL DE L'UNITÉ — collègues Pro, gestes du tableau blanc
--    seulement. Les policies existantes (soi, admin cégep, coach, admin)
--    sont inchangées.
-- ════════════════════════════════════════════════════════════════════════════
create policy unite_journal_select on public.recruiter_activity_log for select to authenticated
  using (
    action_type = any (array['PIPELINE_CHANGED', 'FAVORITED', 'UNFAVORITED', 'NOTE_ADDED', 'NOTE_UPDATED',
                             'LIST_CREATED', 'LIST_NOTE_ADDED', 'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST'])
    and public.acces_unite_pro(unite_cegep_id, unite_sport_id)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 8. DROITS D'EXÉCUTION — liste complète.
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on function public.unite_poser_journal()  from public, anon, authenticated;
revoke execute on function public.unite_figer_journal()  from public, anon, authenticated;
revoke execute on function public.acteur_recruteur()     from public, anon, authenticated;
revoke execute on function public.acces_unite_pro(uuid, uuid)                 from public, anon;
revoke execute on function public.unite_ecrire_dossier(uuid, jsonb)           from public, anon;
revoke execute on function public.unite_ecrire_grade(uuid, text)              from public, anon;
revoke execute on function public.unite_retirer_favori(uuid, uuid)            from public, anon;
revoke execute on function public.unite_retirer_du_processus(uuid, uuid)      from public, anon;
revoke execute on function public.unite_retirer_grade(uuid, uuid)             from public, anon;
grant execute on function public.acces_unite_pro(uuid, uuid)            to authenticated;
grant execute on function public.unite_ecrire_dossier(uuid, jsonb)      to authenticated;
grant execute on function public.unite_ecrire_grade(uuid, text)         to authenticated;
grant execute on function public.unite_retirer_favori(uuid, uuid)       to authenticated;
grant execute on function public.unite_retirer_du_processus(uuid, uuid) to authenticated;
grant execute on function public.unite_retirer_grade(uuid, uuid)        to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. GATES
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  vus text[];
  n int;
begin
  -- 9a. ACL des fonctions nouvelles, liste complète.
  for r in
    select * from (values
      ('public.unite_poser_journal()',                array['postgres','service_role']),
      ('public.unite_figer_journal()',                array['postgres','service_role']),
      ('public.acteur_recruteur()',                   array['postgres','service_role']),
      ('public.acces_unite_pro(uuid, uuid)',          array['authenticated','postgres','service_role']),
      ('public.unite_ecrire_dossier(uuid, jsonb)',    array['authenticated','postgres','service_role']),
      ('public.unite_ecrire_grade(uuid, text)',       array['authenticated','postgres','service_role']),
      ('public.unite_retirer_favori(uuid, uuid)',     array['authenticated','postgres','service_role']),
      ('public.unite_retirer_du_processus(uuid, uuid)', array['authenticated','postgres','service_role']),
      ('public.unite_retirer_grade(uuid, uuid)',      array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;

  -- 9b. Les 4 fonctions de journal gardent EXACTEMENT leur ACL d'avant.
  for r in
    select b.ligne->>'nom' as nom, b.ligne->>'acl' as avant, p.proacl::text as apres
      from public._b2_0_sauvegarde b
      join pg_proc p on p.proname = b.ligne->>'nom' and p.pronamespace = 'public'::regnamespace
     where b.quoi = 'fonction'
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: ACL de % modifiée : % → %', r.nom, r.avant, r.apres;
    end if;
  end loop;
  select count(*) into n from public._b2_0_sauvegarde where quoi = 'fonction';
  if n <> 4 then raise exception 'NEXUS: % fonctions sauvegardées, attendu 4', n; end if;
  select count(*) into n from public._b2_0_sauvegarde where quoi = 'policy';
  if n <> 20 then raise exception 'NEXUS: % policies sauvegardées, attendu 20', n; end if;

  -- 9c. Les 20 policies unite_* exigent Pro partout.
  select count(*) into n from pg_policy
   where polname like 'unite\_%' and polname <> 'unite_journal_select';
  if n <> 20 then raise exception 'NEXUS: % policies unite_*, attendu 20', n; end if;
  select count(*) into n from pg_policy
   where polname like 'unite\_%'
     and coalesce(pg_get_expr(polqual, polrelid), '') not like '%acces_unite_pro%'
     and coalesce(pg_get_expr(polwithcheck, polrelid), '') not like '%acces_unite_pro%';
  if n > 0 then raise exception 'NEXUS: % policy(s) unite_* sans exigence Pro', n; end if;

  -- 9d. Les policies propriétaire sont toutes là (27).
  select count(*) into n from pg_policy
   where polrelid in ('public.recruiter_pipeline'::regclass, 'public.recruiter_athlete_grades'::regclass,
                      'public.recruiter_notes'::regclass, 'public.recruiter_favorites'::regclass,
                      'public.recruiter_lists'::regclass, 'public.recruiter_list_members'::regclass,
                      'public.recruiter_list_notes'::regclass)
     and polname not like 'unite\_%';
  if n <> 27 then raise exception 'NEXUS: % policies propriétaire, attendu 27', n; end if;

  -- 9e. La sauvegarde est illisible hors service.
  if has_table_privilege('authenticated', 'public._b2_0_sauvegarde', 'select')
     or has_table_privilege('anon', 'public._b2_0_sauvegarde', 'select') then
    raise exception 'NEXUS: _b2_0_sauvegarde lisible par un rôle client';
  end if;

  raise notice 'NEXUS: lot B2-0 posé — gates OK';
end $$;
