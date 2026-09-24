-- 20260924201029_b1_tableau_blanc_unite (version enregistrée en prod ; écrite 20260924200000)
--
-- LOT B1 — le tableau blanc par unité, CÔTÉ DONNÉES (décision BP 2026-09-24).
-- Invisible à l'écran : B2 apporte l'interface.
--
-- Unité = cégep × sport (users.school_id × users.sport_id, lot A). Dossiers,
-- étapes, grades, notes, favoris, listes (+ membres et notes de liste)
-- appartiennent à l'unité. L'auteur reste recruiter_id : la signature du geste.
--
-- ADDITIVE SEULEMENT (règle 1 de BP) :
--   · colonnes nullables unite_cegep_id / unite_sport_id sur 7 tables, et
--     recruiter_list_members.added_by (la table n'avait pas d'auteur) ;
--   · policies ÉLARGIES (même unité ; admin cégep = tout son cégep), les
--     policies propriétaire actuelles CONSERVÉES. Leur retrait viendra dans
--     une migration séparée, sur GO distinct, après B2 ;
--   · fonctions nouvelles (aide aux policies, triggers, lectures par unité,
--     noms des auteurs) ;
--   · AUCUNE contrainte d'unicité modifiée, AUCUNE signature changée, AUCUN
--     DROP de fonction (règle 2). Quatre fonctions TRIGGER existantes reçoivent
--     une garde en tête (même signature, jamais appelées par l'app) : voir §3.
--
-- Règles de l'unité :
--   · posée à l'INSERT par trigger d'après l'AUTEUR (lignes à recruiter_id) ou
--     d'après la LISTE (membres, notes de liste) ; la valeur envoyée par le
--     client est ignorée ;
--   · FIGÉE ensuite : un recruteur qui change de sport ou de cégep laisse tout
--     dans l'ancienne unité ;
--   · un recruteur sans cégep OU sans sport n'a pas d'unité : unite_* NULL,
--     ses lignes restent privées (seules les policies propriétaire s'y
--     appliquent) ;
--   · un collègue peut modifier la ligne d'un autre, jamais en changer
--     l'auteur (recruiter_id) : la signature ne se falsifie pas.
--
-- Une ligne par unité et par athlète, SANS toucher UNIQUE(recruiter_id,
-- athlete_id) :
--   · fonctions de lecture par unité (unite_pipeline, unite_grades,
--     unite_favoris) ;
--   · synchronisation des lignes sœurs (pipeline et grades) : une écriture sur
--     la ligne d'un recruteur est recopiée sur les lignes des collègues pour le
--     même athlète. Les effets de bord (journal, notifications parent, statut
--     global de l'athlète) ne se déclenchent QU'UNE fois, sur la ligne écrite.
--
-- Rollback : supabase/rollback/20260924201029_rollback_b1_tableau_blanc_unite.sql
-- (il rejoue les définitions EXACTES des fonctions sauvegardées ici).

-- ════════════════════════════════════════════════════════════════════════════
-- 0. SAUVEGARDE — tables touchées + définitions des fonctions modifiées.
--    Illisible hors service : REVOKE ALL + RLS sans aucune policy.
-- ════════════════════════════════════════════════════════════════════════════
create table public._b1_sauvegarde (
  quoi    text        not null,
  ligne   jsonb       not null,
  pris_le timestamptz not null default now()
);
revoke all on public._b1_sauvegarde from public, anon, authenticated;
alter table public._b1_sauvegarde enable row level security;
comment on table public._b1_sauvegarde is
  'Lot B1 (2026-09-24) : copie des 7 tables recruteur et des 4 fonctions trigger '
  'avant la migration du tableau blanc. Illisible hors service_role/postgres.';

insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_pipeline',       to_jsonb(t) from public.recruiter_pipeline t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_athlete_grades', to_jsonb(t) from public.recruiter_athlete_grades t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_notes',          to_jsonb(t) from public.recruiter_notes t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_favorites',      to_jsonb(t) from public.recruiter_favorites t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_lists',          to_jsonb(t) from public.recruiter_lists t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_list_members',   to_jsonb(t) from public.recruiter_list_members t;
insert into public._b1_sauvegarde (quoi, ligne) select 'recruiter_list_notes',     to_jsonb(t) from public.recruiter_list_notes t;
insert into public._b1_sauvegarde (quoi, ligne)
  select 'fonction', jsonb_build_object('nom', p.proname, 'def', pg_get_functiondef(p.oid), 'acl', p.proacl::text)
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('log_pipeline_change', 'notify_parent_pipeline_stage',
                       'notify_parent_visit', 'sync_global_recruitment_status');

-- ════════════════════════════════════════════════════════════════════════════
-- 1. COLONNES
-- ════════════════════════════════════════════════════════════════════════════
alter table public.recruiter_pipeline       add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_athlete_grades add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_notes          add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_favorites      add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_lists          add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_list_members   add column unite_cegep_id uuid, add column unite_sport_id uuid;
alter table public.recruiter_list_notes     add column unite_cegep_id uuid, add column unite_sport_id uuid;

-- Les membres de liste n'avaient pas d'auteur. Le défaut auth.uid() signe
-- aussi les ajouts de l'app 1.4.3, qui ignore la colonne.
alter table public.recruiter_list_members
  add column added_by uuid default auth.uid() references auth.users(id) on delete set null;

comment on column public.recruiter_pipeline.unite_cegep_id is
  'Unité (lot B1) : cégep de l''auteur à la création. Posée par trigger, figée ensuite. NULL = ligne privée (auteur sans unité).';
comment on column public.recruiter_pipeline.unite_sport_id is
  'Unité (lot B1) : sport de l''auteur à la création. Posée par trigger, figée ensuite.';
comment on column public.recruiter_list_members.added_by is
  'Auteur de l''ajout (lot B1). auth.uid() par défaut et imposé par trigger ; rattrapé au propriétaire de la liste pour l''existant.';

create index recruiter_pipeline_unite_idx       on public.recruiter_pipeline       (unite_cegep_id, unite_sport_id, athlete_id) where unite_cegep_id is not null;
create index recruiter_athlete_grades_unite_idx on public.recruiter_athlete_grades (unite_cegep_id, unite_sport_id, athlete_id) where unite_cegep_id is not null;
create index recruiter_notes_unite_idx          on public.recruiter_notes          (unite_cegep_id, unite_sport_id, athlete_id) where unite_cegep_id is not null;
create index recruiter_favorites_unite_idx      on public.recruiter_favorites      (unite_cegep_id, unite_sport_id, athlete_id) where unite_cegep_id is not null;
create index recruiter_lists_unite_idx          on public.recruiter_lists          (unite_cegep_id, unite_sport_id) where unite_cegep_id is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. AIDES
-- ════════════════════════════════════════════════════════════════════════════

-- Rang d'une étape du processus (ordre de CLAUDE.md). 0 = inconnue.
create function public.rang_etape(p_etape text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_etape
    when 'IDENTIFIE'        then 1
    when 'CONTACTE'         then 2
    when 'EN_DISCUSSION'    then 3
    when 'VISITE_PLANIFIEE' then 4
    when 'ENGAGE'           then 5
    when 'LETTRE_SIGNEE'    then 6
    else 0 end
$$;

-- L'appelant a-t-il accès à l'unité (cégep, sport) ?
--   · recruteur de la MÊME unité (même cégep ET même sport) ;
--   · ou admin de ce cégep (tous les sports du cégep).
-- Une unité incomplète (NULL) n'est accessible à personne par cette voie :
-- les lignes sans unité restent aux policies propriétaire.
-- SECURITY DEFINER : users n'est pas lisible entre collègues (et une policy ne
-- doit jamais lire users en direct — checklist, règle 4).
create function public.acces_unite(p_cegep uuid, p_sport uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_cegep is not null
     and p_sport is not null
     and exists (
       select 1
         from public.users u
        where u.id = auth.uid()
          and u.role = 'RECRUTEUR'::public.user_role
          and u.school_id = p_cegep
          and (u.sport_id = p_sport or u.is_school_admin = true)
     )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. GARDES sur quatre fonctions TRIGGER existantes
--
--    La synchronisation des lignes sœurs (§5) écrit les lignes des collègues.
--    Sans garde, chaque ligne sœur rejouerait les effets de bord de la ligne
--    écrite : une entrée de journal SIGNÉE DU MAUVAIS AUTEUR, une notification
--    parent en double, un recalcul du statut de l'athlète par ligne. La garde
--    ne s'active que pendant la synchronisation (nexus.sync_unite = 'on',
--    local à la transaction) : tous les autres chemins sont INCHANGÉS.
--
--    notify_parent_pipeline_stage reçoit en plus une règle : à l'INSERT d'une
--    ligne sœur, le parent n'est PAS notifié si l'unité avait déjà atteint
--    cette étape — le dossier n'a pas progressé, un collègue l'a seulement
--    rejoint.
--
--    Mêmes signatures, mêmes attributs (SECURITY DEFINER, search_path). Les
--    définitions d'origine sont sauvegardées au §0 ; le rollback les rejoue.
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
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'PIPELINE_CHANGED',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'new_stage', NEW.stage,
      -- Iter 7.30a — capture du before_stage pour afficher "X → Y" dans le feed.
      -- Sur AFTER INSERT, OLD.* est NULL → before_stage NULL (1ère entrée pipeline).
      -- Sur AFTER UPDATE, OLD.stage est la valeur avant changement.
      'before_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END
    )
  FROM public.athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;

create or replace function public.notify_parent_pipeline_stage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_notify boolean := false;
begin
  -- Lot B1 : pas de notification pour une ligne sœur recopiée.
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    v_notify := NEW.stage is distinct from 'IDENTIFIE';
    -- Lot B1 : un collègue qui rejoint un dossier déjà à cette étape ne fait
    -- pas progresser le dossier de l'enfant.
    if v_notify and NEW.unite_cegep_id is not null and exists (
         select 1 from public.recruiter_pipeline s
          where s.unite_cegep_id = NEW.unite_cegep_id
            and s.unite_sport_id = NEW.unite_sport_id
            and s.athlete_id = NEW.athlete_id
            and s.id <> NEW.id
            and public.rang_etape(s.stage) >= public.rang_etape(NEW.stage)) then
      v_notify := false;
    end if;
  elsif TG_OP = 'UPDATE' then
    v_notify := OLD.stage is distinct from NEW.stage;
  end if;
  if v_notify then
    perform public.emit_parent_notification(
      NEW.athlete_id, 'CHILD_PIPELINE_STAGE', 'Progression du dossier',
      'Le dossier de votre enfant a progressé : ' || public.pipeline_stage_label_fr(NEW.stage) || '.',
      jsonb_build_object('event','stage','stage',NEW.stage,'recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
    );
  end if;
  return NEW;
end;
$$;

create or replace function public.notify_parent_visit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Lot B1 : pas de notification pour une ligne sœur recopiée.
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return NEW;
  end if;
  perform public.emit_parent_notification(
    NEW.athlete_id, 'CHILD_VISIT_PLANNED', 'Visite planifiée',
    'Une visite a été planifiée pour votre enfant le '
      || to_char(NEW.visit_at at time zone 'America/Toronto', 'DD/MM/YYYY') || '.',
    jsonb_build_object('event','visit','visit_at',NEW.visit_at,'recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
  );
  return NEW;
end;
$$;

-- sync_global_recruitment_status : corps d'origine intégral, garde en tête.
do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.sync_global_recruitment_status()'::regprocedure) into v_def;
  if position('nexus.sync_unite' in v_def) = 0 then
    -- Insère la garde juste après le premier BEGIN du corps (le corps est
    -- repris tel quel, quelle que soit sa mise en forme dans l'environnement).
    v_def := regexp_replace(v_def, '(\mBEGIN\M)',
      E'\\1\n  -- Lot B1 : la ligne écrite a déjà recalculé le statut ; ses sœurs\n  -- recopiées ne le refont pas.\n  IF coalesce(current_setting(''nexus.sync_unite'', true), '''') = ''on'' THEN\n    RETURN NEW;\n  END IF;', 'i');
    execute v_def;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. RATTRAPAGE de l'existant — d'après l'unité ACTUELLE de l'auteur.
--    Garde active : les triggers existants ne rejouent rien. Les updated_at
--    des grades sont préservés (« le plus récent l'emporte » s'appuie dessus).
-- ════════════════════════════════════════════════════════════════════════════
-- UN SEUL bloc : la garde (set_config local) doit couvrir chaque écriture,
-- que la migration tourne en une transaction (apply_migration) ou instruction
-- par instruction (psql en autocommit). Leçon du test local du 2026-09-24 :
-- hors bloc, la réconciliation avait journalisé une étape.
do $$
begin
  perform set_config('nexus.sync_unite', 'on', true);
  execute 'alter table public.recruiter_athlete_grades disable trigger trg_grades_updated_at';

  update public.recruiter_pipeline t set unite_cegep_id = u.school_id, unite_sport_id = u.sport_id
    from public.users u where u.id = t.recruiter_id and u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null;
  update public.recruiter_athlete_grades t set unite_cegep_id = u.school_id, unite_sport_id = u.sport_id
    from public.users u where u.id = t.recruiter_id and u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null;
  update public.recruiter_notes t set unite_cegep_id = u.school_id, unite_sport_id = u.sport_id
    from public.users u where u.id = t.recruiter_id and u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null;
  update public.recruiter_favorites t set unite_cegep_id = u.school_id, unite_sport_id = u.sport_id
    from public.users u where u.id = t.recruiter_id and u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null;
  update public.recruiter_lists t set unite_cegep_id = u.school_id, unite_sport_id = u.sport_id
    from public.users u where u.id = t.recruiter_id and u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null;
  update public.recruiter_list_members m set unite_cegep_id = l.unite_cegep_id, unite_sport_id = l.unite_sport_id, added_by = l.recruiter_id
    from public.recruiter_lists l where l.id = m.list_id;
  update public.recruiter_list_notes n set unite_cegep_id = l.unite_cegep_id, unite_sport_id = l.unite_sport_id
    from public.recruiter_lists l where l.id = n.list_id;

  -- Réconciliation des lignes sœurs déjà divergentes (décisions BP) :
  --   · processus : l'étape la PLUS AVANCÉE gagne, avec sa relance et sa visite ;
  --   · grades : le PLUS RÉCENT gagne.
  with ref as (
    select distinct on (unite_cegep_id, unite_sport_id, athlete_id)
           unite_cegep_id, unite_sport_id, athlete_id, stage, moved_at, flagged,
           next_action_at, next_action_note, visit_at
      from public.recruiter_pipeline
     where unite_cegep_id is not null
     order by unite_cegep_id, unite_sport_id, athlete_id,
              public.rang_etape(stage) desc, moved_at desc nulls last
  )
  update public.recruiter_pipeline p
     set stage = r.stage, moved_at = r.moved_at, flagged = r.flagged,
         next_action_at = r.next_action_at, next_action_note = r.next_action_note, visit_at = r.visit_at
    from ref r
   where p.unite_cegep_id = r.unite_cegep_id and p.unite_sport_id = r.unite_sport_id and p.athlete_id = r.athlete_id
     and (p.stage, p.moved_at, p.flagged, p.next_action_at, p.next_action_note, p.visit_at)
         is distinct from (r.stage, r.moved_at, r.flagged, r.next_action_at, r.next_action_note, r.visit_at);

  with ref as (
    select distinct on (unite_cegep_id, unite_sport_id, athlete_id)
           unite_cegep_id, unite_sport_id, athlete_id, grade
      from public.recruiter_athlete_grades
     where unite_cegep_id is not null
     order by unite_cegep_id, unite_sport_id, athlete_id, updated_at desc
  )
  update public.recruiter_athlete_grades g set grade = r.grade
    from ref r
   where g.unite_cegep_id = r.unite_cegep_id and g.unite_sport_id = r.unite_sport_id and g.athlete_id = r.athlete_id
     and g.grade is distinct from r.grade;

  execute 'alter table public.recruiter_athlete_grades enable trigger trg_grades_updated_at';
  perform set_config('nexus.sync_unite', 'off', true);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. TRIGGERS D'UNITÉ
-- ════════════════════════════════════════════════════════════════════════════

-- 5a. Poser l'unité à l'INSERT (valeur du client ignorée).
--     SECURITY DEFINER : lit users (l'auteur n'est pas forcément l'appelant —
--     fav_insert_to_pipeline, reassign_pipeline).
create function public.unite_poser()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cegep uuid;
  v_sport uuid;
begin
  if tg_table_name in ('recruiter_list_members', 'recruiter_list_notes') then
    select l.unite_cegep_id, l.unite_sport_id into v_cegep, v_sport
      from public.recruiter_lists l where l.id = new.list_id;
    if tg_table_name = 'recruiter_list_members' and auth.uid() is not null then
      new.added_by := auth.uid();   -- la signature ne se choisit pas
    end if;
  else
    select u.school_id, u.sport_id into v_cegep, v_sport
      from public.users u
     where u.id = new.recruiter_id
       and u.role = 'RECRUTEUR'::public.user_role;
  end if;

  if v_cegep is null or v_sport is null then
    new.unite_cegep_id := null;      -- pas d'unité : la ligne reste privée
    new.unite_sport_id := null;
  else
    new.unite_cegep_id := v_cegep;
    new.unite_sport_id := v_sport;
  end if;
  return new;
end $$;

-- 5b. Figer l'unité (et la signature) à l'UPDATE.
--     SECURITY INVOKER exprès : current_user y dit QUI écrit. Un appel REST
--     tourne en 'authenticated' ; une fonction SECURITY DEFINER du serveur
--     (reassign_pipeline) tourne en propriétaire et garde le droit de
--     réattribuer.
create function public.unite_figer()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.unite_cegep_id := old.unite_cegep_id;
  new.unite_sport_id := old.unite_sport_id;

  if tg_table_name = 'recruiter_list_members' then
    new.added_by := old.added_by;
  elsif current_user in ('authenticated', 'anon')
        and new.recruiter_id is distinct from old.recruiter_id
        and old.recruiter_id is distinct from auth.uid() then
    raise exception 'NEXUS: l''auteur d''une ligne partagée ne se modifie pas'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- 5c. Aligner une nouvelle ligne de processus sur l'état de l'unité : un
--     collègue qui ajoute un athlète déjà suivi rejoint le dossier, il ne le
--     fait pas reculer. L'étape la plus avancée gagne ; relance, visite et
--     drapeau de l'unité sont repris quand la nouvelle ligne n'en porte pas.
create function public.unite_aligner_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.recruiter_pipeline%rowtype;
begin
  if new.unite_cegep_id is null then
    return new;
  end if;
  select * into s
    from public.recruiter_pipeline p
   where p.unite_cegep_id = new.unite_cegep_id
     and p.unite_sport_id = new.unite_sport_id
     and p.athlete_id = new.athlete_id
   order by public.rang_etape(p.stage) desc, p.moved_at desc nulls last
   limit 1;
  if not found then
    return new;
  end if;
  if public.rang_etape(s.stage) > public.rang_etape(new.stage) then
    new.stage := s.stage;
    new.moved_at := s.moved_at;
  end if;
  if new.next_action_at is null and new.next_action_note is null then
    new.next_action_at := s.next_action_at;
    new.next_action_note := s.next_action_note;
  end if;
  if new.visit_at is null then
    new.visit_at := s.visit_at;
  end if;
  new.flagged := coalesce(new.flagged, false) or coalesce(s.flagged, false);
  return new;
end $$;

-- 5d. Synchroniser les lignes sœurs (processus et grades). Ce qui vient
--     d'être écrit sur UNE ligne est recopié sur les lignes des collègues de
--     l'unité pour le même athlète. Dernière écriture = état de l'unité.
--     La garde nexus.sync_unite empêche la récursion et les effets de bord en
--     double (§3). Elle est locale à la transaction et remise à 'off' après.
create function public.unite_sync_soeurs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return null;
  end if;
  if new.unite_cegep_id is null or new.unite_sport_id is null then
    return null;
  end if;

  perform set_config('nexus.sync_unite', 'on', true);

  if tg_table_name = 'recruiter_pipeline' then
    if tg_op = 'INSERT'
       or (new.stage, new.moved_at, new.flagged, new.next_action_at, new.next_action_note, new.visit_at)
          is distinct from
          (old.stage, old.moved_at, old.flagged, old.next_action_at, old.next_action_note, old.visit_at) then
      update public.recruiter_pipeline s
         set stage = new.stage, moved_at = new.moved_at, flagged = new.flagged,
             next_action_at = new.next_action_at, next_action_note = new.next_action_note,
             visit_at = new.visit_at
       where s.unite_cegep_id = new.unite_cegep_id
         and s.unite_sport_id = new.unite_sport_id
         and s.athlete_id = new.athlete_id
         and s.id <> new.id
         and (s.stage, s.moved_at, s.flagged, s.next_action_at, s.next_action_note, s.visit_at)
             is distinct from
             (new.stage, new.moved_at, new.flagged, new.next_action_at, new.next_action_note, new.visit_at);
    end if;
  elsif tg_table_name = 'recruiter_athlete_grades' then
    if tg_op = 'INSERT' or new.grade is distinct from old.grade then
      update public.recruiter_athlete_grades s
         set grade = new.grade
       where s.unite_cegep_id = new.unite_cegep_id
         and s.unite_sport_id = new.unite_sport_id
         and s.athlete_id = new.athlete_id
         and s.id <> new.id
         and s.grade is distinct from new.grade;
    end if;
  end if;

  perform set_config('nexus.sync_unite', 'off', true);
  return null;
end $$;

-- Ordre : les BEFORE s'exécutent par ordre alphabétique de nom (poser avant
-- aligner) ; l'AFTER de synchronisation vient APRÈS les AFTER existants
-- (trg_log_*, trg_notify_*, trg_sync_global_status) : la ligne écrite a fait
-- ses effets de bord avant que ses sœurs soient recopiées.
create trigger trg_unite_a_poser before insert on public.recruiter_pipeline       for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_athlete_grades for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_notes          for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_favorites      for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_lists          for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_list_members   for each row execute function public.unite_poser();
create trigger trg_unite_a_poser before insert on public.recruiter_list_notes     for each row execute function public.unite_poser();

create trigger trg_unite_b_figer before update on public.recruiter_pipeline       for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_athlete_grades for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_notes          for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_favorites      for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_lists          for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_list_members   for each row execute function public.unite_figer();
create trigger trg_unite_b_figer before update on public.recruiter_list_notes     for each row execute function public.unite_figer();

create trigger trg_unite_c_aligner before insert on public.recruiter_pipeline for each row execute function public.unite_aligner_pipeline();

create trigger trg_unite_z_sync after insert or update on public.recruiter_pipeline       for each row execute function public.unite_sync_soeurs();
create trigger trg_unite_z_sync after insert or update on public.recruiter_athlete_grades for each row execute function public.unite_sync_soeurs();

-- ════════════════════════════════════════════════════════════════════════════
-- 6. POLICIES ÉLARGIES — même unité (lecture et modification), admin cégep
--    (tout son cégep). Chacune REPRODUIT la policy propriétaire de la même
--    commande, « recruiter_id = soi » remplacé par l'accès à l'unité : mêmes
--    exigences de palier (user_has_pro) là où le propriétaire en a.
--    L'INSERT reste celui du propriétaire (recruiter_id = soi) : on n'écrit
--    jamais au nom d'un collègue — sauf les membres de liste, qui n'ont pas
--    d'auteur dans la clé (added_by est imposé par trigger).
-- ════════════════════════════════════════════════════════════════════════════
create policy unite_select on public.recruiter_pipeline for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_pipeline for update to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite(unite_cegep_id, unite_sport_id) and public.user_has_pro());
create policy unite_delete on public.recruiter_pipeline for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_athlete_grades for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_athlete_grades for update to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite(unite_cegep_id, unite_sport_id) and public.user_has_pro());
create policy unite_delete on public.recruiter_athlete_grades for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_notes for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_notes for update to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_notes for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

-- Favori d'unité = au moins un recruteur l'a. Retirer (web) = supprimer les
-- lignes de l'unité ; le mobile 1.4.3 ne retire que la sienne (registre).
create policy unite_select on public.recruiter_favorites for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_favorites for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_lists for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_lists for update to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite(unite_cegep_id, unite_sport_id) and public.user_has_pro());
create policy unite_delete on public.recruiter_lists for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

-- Membres : l'unité est celle de la liste (posée par trigger AVANT le
-- contrôle WITH CHECK).
create policy unite_select on public.recruiter_list_members for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_insert on public.recruiter_list_members for insert to authenticated
  with check (public.acces_unite(unite_cegep_id, unite_sport_id) and public.user_has_pro());
create policy unite_delete on public.recruiter_list_members for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

create policy unite_select on public.recruiter_list_notes for select to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_update on public.recruiter_list_notes for update to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id))
  with check (public.acces_unite(unite_cegep_id, unite_sport_id));
create policy unite_delete on public.recruiter_list_notes for delete to authenticated
  using (public.acces_unite(unite_cegep_id, unite_sport_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LECTURES PAR UNITÉ — une ligne par athlète.
--    SECURITY INVOKER : la RLS ci-dessus décide de ce que l'appelant voit ;
--    ces fonctions ne font que regrouper. Par défaut : l'unité de l'appelant.
--    p_sport_id : un autre sport du cégep (admin cégep) ; p_tout_le_cegep :
--    tous les sports (admin cégep). Un recruteur sans unité reçoit ses
--    propres lignes privées.
-- ════════════════════════════════════════════════════════════════════════════
create function public.unite_pipeline(p_sport_id uuid default null, p_tout_le_cegep boolean default false)
returns table (
  athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
  stage text, moved_at timestamptz, flagged boolean,
  next_action_at date, next_action_note text, visit_at timestamptz,
  recruteurs uuid[], ajoute_le timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with moi as (
    select u.school_id, u.sport_id from public.users u where u.id = auth.uid()
  ),
  cible as (
    select p.*
      from public.recruiter_pipeline p, moi
     where (p.unite_cegep_id = moi.school_id
            and (p_tout_le_cegep or p.unite_sport_id = coalesce(p_sport_id, moi.sport_id)))
        or (p.unite_cegep_id is null and p.recruiter_id = auth.uid())
  ),
  meilleure as (
    select distinct on (c.athlete_id, c.unite_cegep_id, c.unite_sport_id) c.*
      from cible c
     order by c.athlete_id, c.unite_cegep_id, c.unite_sport_id,
              public.rang_etape(c.stage) desc, c.moved_at desc nulls last
  ),
  agg as (
    select c.athlete_id, c.unite_cegep_id, c.unite_sport_id,
           array_agg(c.recruiter_id order by c.created_at) as recruteurs,
           bool_or(coalesce(c.flagged, false)) as flagged,
           min(c.created_at) as ajoute_le
      from cible c
     group by c.athlete_id, c.unite_cegep_id, c.unite_sport_id
  )
  select m.athlete_id, m.unite_cegep_id, m.unite_sport_id,
         m.stage::text, m.moved_at, a.flagged,
         m.next_action_at, m.next_action_note, m.visit_at,
         a.recruteurs, a.ajoute_le
    from meilleure m
    join agg a on a.athlete_id = m.athlete_id
              and a.unite_cegep_id is not distinct from m.unite_cegep_id
              and a.unite_sport_id is not distinct from m.unite_sport_id
$$;

create function public.unite_grades(p_sport_id uuid default null, p_tout_le_cegep boolean default false)
returns table (
  athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
  grade text, maj_le timestamptz, recruteurs uuid[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with moi as (
    select u.school_id, u.sport_id from public.users u where u.id = auth.uid()
  ),
  cible as (
    select g.*
      from public.recruiter_athlete_grades g, moi
     where (g.unite_cegep_id = moi.school_id
            and (p_tout_le_cegep or g.unite_sport_id = coalesce(p_sport_id, moi.sport_id)))
        or (g.unite_cegep_id is null and g.recruiter_id = auth.uid())
  ),
  recent as (
    select distinct on (c.athlete_id, c.unite_cegep_id, c.unite_sport_id) c.*
      from cible c
     order by c.athlete_id, c.unite_cegep_id, c.unite_sport_id, c.updated_at desc
  )
  select r.athlete_id, r.unite_cegep_id, r.unite_sport_id, r.grade::text, r.updated_at,
         (select array_agg(c.recruiter_id order by c.created_at) from cible c
           where c.athlete_id = r.athlete_id
             and c.unite_cegep_id is not distinct from r.unite_cegep_id
             and c.unite_sport_id is not distinct from r.unite_sport_id)
    from recent r
$$;

create function public.unite_favoris(p_sport_id uuid default null, p_tout_le_cegep boolean default false)
returns table (
  athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
  recruteurs uuid[], premier_ajout timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with moi as (
    select u.school_id, u.sport_id from public.users u where u.id = auth.uid()
  )
  select f.athlete_id, f.unite_cegep_id, f.unite_sport_id,
         array_agg(f.recruiter_id order by f.created_at), min(f.created_at)
    from public.recruiter_favorites f, moi
   where (f.unite_cegep_id = moi.school_id
          and (p_tout_le_cegep or f.unite_sport_id = coalesce(p_sport_id, moi.sport_id)))
      or (f.unite_cegep_id is null and f.recruiter_id = auth.uid())
   group by f.athlete_id, f.unite_cegep_id, f.unite_sport_id
$$;

-- Noms des auteurs : users n'est pas lisible entre collègues. Rend les
-- recruteurs de l'unité de l'appelant (admin cégep : tout son cégep), et
-- l'appelant lui-même. Rien d'autre que l'identité d'affichage.
create function public.unite_auteurs()
returns table (id uuid, first_name text, last_name text, sport_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.first_name, u.last_name, u.sport_id
    from public.users u
    join public.users moi on moi.id = auth.uid()
   where u.role = 'RECRUTEUR'::public.user_role
     and moi.role = 'RECRUTEUR'::public.user_role
     and (
          u.id = moi.id
       or (moi.school_id is not null and u.school_id = moi.school_id
           and (moi.is_school_admin = true
                or (moi.sport_id is not null and u.sport_id = moi.sport_id)))
     )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. DROITS D'EXÉCUTION — liste complète, jamais par inclusion.
--    Les default privileges de Supabase accordent EXECUTE à anon,
--    authenticated et service_role sur toute fonction créée : on retire.
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on function public.unite_poser()            from public, anon, authenticated;
revoke execute on function public.unite_figer()            from public, anon, authenticated;
revoke execute on function public.unite_aligner_pipeline() from public, anon, authenticated;
revoke execute on function public.unite_sync_soeurs()      from public, anon, authenticated;
revoke execute on function public.rang_etape(text)                     from public, anon;
revoke execute on function public.acces_unite(uuid, uuid)              from public, anon;
revoke execute on function public.unite_pipeline(uuid, boolean)        from public, anon;
revoke execute on function public.unite_grades(uuid, boolean)          from public, anon;
revoke execute on function public.unite_favoris(uuid, boolean)         from public, anon;
revoke execute on function public.unite_auteurs()                      from public, anon;
grant execute on function public.rang_etape(text)              to authenticated;
grant execute on function public.acces_unite(uuid, uuid)       to authenticated;
grant execute on function public.unite_pipeline(uuid, boolean) to authenticated;
grant execute on function public.unite_grades(uuid, boolean)   to authenticated;
grant execute on function public.unite_favoris(uuid, boolean)  to authenticated;
grant execute on function public.unite_auteurs()               to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. GATES
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  vus text[];
  n int;
begin
  -- 9a. ACL des fonctions NOUVELLES, liste complète.
  for r in
    select * from (values
      ('public.unite_poser()',                    array['postgres','service_role']),
      ('public.unite_figer()',                    array['postgres','service_role']),
      ('public.unite_aligner_pipeline()',         array['postgres','service_role']),
      ('public.unite_sync_soeurs()',              array['postgres','service_role']),
      ('public.rang_etape(text)',                 array['authenticated','postgres','service_role']),
      ('public.acces_unite(uuid, uuid)',          array['authenticated','postgres','service_role']),
      ('public.unite_pipeline(uuid, boolean)',    array['authenticated','postgres','service_role']),
      ('public.unite_grades(uuid, boolean)',      array['authenticated','postgres','service_role']),
      ('public.unite_favoris(uuid, boolean)',     array['authenticated','postgres','service_role']),
      ('public.unite_auteurs()',                  array['authenticated','postgres','service_role'])
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

  -- 9b. Les quatre fonctions gardées gardent EXACTEMENT leur ACL d'avant.
  for r in
    select b.ligne->>'nom' as nom, b.ligne->>'acl' as avant, p.proacl::text as apres
      from public._b1_sauvegarde b
      join pg_proc p on p.proname = b.ligne->>'nom' and p.pronamespace = 'public'::regnamespace
     where b.quoi = 'fonction'
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: ACL de % modifiée : % → %', r.nom, r.avant, r.apres;
    end if;
  end loop;
  select count(*) into n from public._b1_sauvegarde where quoi = 'fonction';
  if n <> 4 then
    raise exception 'NEXUS: % définitions de fonction sauvegardées, attendu 4', n;
  end if;
  select count(*) into n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('log_pipeline_change','notify_parent_pipeline_stage','notify_parent_visit','sync_global_recruitment_status')
     and position('nexus.sync_unite' in prosrc) = 0;
  if n > 0 then
    raise exception 'NEXUS: % fonction(s) trigger sans garde de synchronisation', n;
  end if;

  -- 9c. Toute ligne dont l'auteur a une unité complète l'a reçue.
  select count(*) into n
    from public.recruiter_pipeline t join public.users u on u.id = t.recruiter_id
   where u.role = 'RECRUTEUR' and u.school_id is not null and u.sport_id is not null
     and (t.unite_cegep_id is distinct from u.school_id or t.unite_sport_id is distinct from u.sport_id);
  if n > 0 then raise exception 'NEXUS: % ligne(s) de processus sans unité', n; end if;

  -- 9d. Plus aucune divergence entre lignes sœurs.
  select count(*) into n from (
    select 1 from public.recruiter_pipeline where unite_cegep_id is not null
     group by unite_cegep_id, unite_sport_id, athlete_id
    having count(distinct (stage, moved_at, flagged, next_action_at, next_action_note, visit_at)) > 1) d;
  if n > 0 then raise exception 'NEXUS: % dossier(s) d''unité divergent(s) (processus)', n; end if;
  select count(*) into n from (
    select 1 from public.recruiter_athlete_grades where unite_cegep_id is not null
     group by unite_cegep_id, unite_sport_id, athlete_id having count(distinct grade) > 1) d;
  if n > 0 then raise exception 'NEXUS: % dossier(s) d''unité divergent(s) (grades)', n; end if;

  -- 9e. La sauvegarde est illisible hors service.
  if has_table_privilege('authenticated', 'public._b1_sauvegarde', 'select')
     or has_table_privilege('anon', 'public._b1_sauvegarde', 'select') then
    raise exception 'NEXUS: _b1_sauvegarde lisible par un rôle client';
  end if;

  -- 9f. La garde de synchronisation est retombée.
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    raise exception 'NEXUS: garde nexus.sync_unite restée active';
  end if;

  raise notice 'NEXUS: lot B1 posé — gates OK';
end $$;
