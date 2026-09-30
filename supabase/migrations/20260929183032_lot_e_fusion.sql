-- ════════════════════════════════════════════════════════════════════════════
-- LOT E — Fusion d'une carte prospect avec le vrai profil (GO BP 2026-09-29).
--
-- Accepter une proposition du lot D = fusionner_carte(carte, athlète) :
--   · Pro de l'unité de la carte, identité de l'athlète visible, proposition
--     ouverte sur la paire ;
--   · le dossier de l'unité est créé ou complété PAR LA LIGNE DE L'ACTEUR
--     (la synchronisation d'unité propage aux sœurs) ; si un dossier existe,
--     l'étape la plus avancée gagne, relance/visite existantes gardées,
--     drapeau = OU ;
--   · cote : celle de l'unité si elle existe, sinon celle de la carte ;
--   · notes de la carte recopiées dans recruiter_notes, signées par leur
--     auteur (s'il est encore de l'unité, sinon par l'acteur avec la mention
--     de l'auteur d'origine) et datées de leur date d'origine ;
--   · l'athlète rejoint les listes où figurait la carte ;
--   · UNE ligne de journal, signée par l'acteur (les lignes automatiques de
--     la transaction sont remplacées par celle-là) ;
--   · la carte est masquée immédiatement (policy RESTRICTIVE).
--
-- « Annuler la fusion » : 7 jours, règle « garder le modifié » — ce qui n'a
-- pas bougé depuis la fusion est retiré, ce qui a été modifié reste, et la
-- réponse dit lequel. La carte revient ; la paire devient REFUSEE (plus
-- jamais proposée).
-- Après 7 jours : la carte est supprimée, trace minimale du lot C avec le
-- motif FUSION.
--
-- Effet de bord accepté : un dossier ENGAGE/LETTRE_SIGNEE passe l'athlète en
-- « Recruté à [cégep] » (sync_global_recruitment_status), comme tout dossier.
-- Aucun type de journal nouveau : PIPELINE_CHANGED avec details.fusion /
-- details.fusion_annulee — l'app 1.4.3 les lit comme un changement d'étape.
-- Additif : colonnes nullables, table neuve, une policy RESTRICTIVE, la
-- contrainte de motif élargie ; quatre fonctions redéfinies à l'identique
-- plus « carte non fusionnée ».
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. LA CARTE MASQUÉE
-- ════════════════════════════════════════════════════════════════════════════
alter table public.cartes_prospect
  add column fusionnee_le   timestamptz,
  add column fusionnee_avec uuid references public.athletes(id) on delete set null;

-- Les colonnes de fusion ne s'écrivent que par les fonctions de fusion.
create function public.carte_fusion_garde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nexus.fusion_carte', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.fusionnee_le := null;
      new.fusionnee_avec := null;
    else
      new.fusionnee_le := old.fusionnee_le;
      new.fusionnee_avec := old.fusionnee_avec;
    end if;
  end if;
  return new;
end $$;
create trigger trg_carte_c_fusion before insert or update on public.cartes_prospect
  for each row execute function public.carte_fusion_garde();

-- Masquée partout, pour tous : lecture, écriture, suppression.
create policy cartes_non_fusionnees on public.cartes_prospect as restrictive for all to authenticated
  using (fusionnee_le is null) with check (fusionnee_le is null);

-- Notes, listes et journal de la carte suivent (leurs policies passent par ces deux fonctions).
create or replace function public.carte_lecture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and c.fusionnee_le is null
                    and public.acces_carte_lecture(c.unite_cegep_id, c.unite_sport_id))
$$;
create or replace function public.carte_ecriture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and c.fusionnee_le is null
                    and public.acces_carte_ecriture(c.unite_cegep_id, c.unite_sport_id))
$$;

-- Trace de suppression : motif FUSION en plus.
alter table public.cartes_prospect_suppressions drop constraint cartes_prospect_suppressions_motif_check;
alter table public.cartes_prospect_suppressions add constraint cartes_prospect_suppressions_motif_check
  check (motif = any (array['RETRAIT'::text, 'PURGE'::text, 'FUSION'::text]));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LE REGISTRE DES FUSIONS (serveur seulement ; lu par fusions_athlete)
-- ════════════════════════════════════════════════════════════════════════════
create table public.fusions_cartes (
  id               uuid primary key default gen_random_uuid(),
  rapprochement_id uuid references public.rapprochements(id) on delete set null,
  carte_id         uuid not null,                 -- la carte disparaît à J+7 : pas de FK
  carte_libelle    text not null,
  athlete_id       uuid not null references public.athletes(id) on delete cascade,
  unite_cegep_id   uuid not null,
  unite_sport_id   uuid not null,
  acteur           uuid references auth.users(id) on delete set null,
  fusionnee_le     timestamptz not null default now(),
  etat             text not null default 'ACTIVE' check (etat in ('ACTIVE', 'ANNULEE', 'DEFINITIVE')),
  annulee_par      uuid references auth.users(id) on delete set null,
  annulee_le       timestamptz,
  definitive_le    timestamptz,
  conserves        text[],
  -- Ce qui a été écrit, pour pouvoir le défaire : dossier (avant / écrit),
  -- cote, notes recopiées, appartenances aux listes, propositions caduques.
  snapshot         jsonb not null
);
create index fusions_cartes_athlete_idx on public.fusions_cartes (athlete_id, unite_cegep_id, unite_sport_id);
create index fusions_cartes_actives_idx on public.fusions_cartes (fusionnee_le) where etat = 'ACTIVE';
create unique index fusions_cartes_carte_active_uniq on public.fusions_cartes (carte_id) where etat = 'ACTIVE';

alter table public.fusions_cartes enable row level security;
revoke all on public.fusions_cartes from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. FUSIONNER
-- ════════════════════════════════════════════════════════════════════════════
create function public.fusionner_carte(p_carte uuid, p_athlete uuid)
returns uuid language plpgsql security definer set search_path = public set row_security = off as $$
declare
  v_moi uuid := auth.uid();
  c record; a record; r record; t record; n record;
  v_existait boolean;
  v_ligne_moi uuid; v_ligne_creee boolean := false;
  v_etape text; v_moved timestamptz; v_relance date; v_relance_note text; v_visite timestamptz; v_drapeau boolean;
  v_grade_avant text; v_grade_ecrit text; v_grade_ligne uuid;
  v_notes jsonb := '[]'::jsonb; v_membres uuid[] := '{}'; v_caduques uuid[] := '{}';
  v_logs_avant uuid[]; v_note_id uuid; v_auteur_ok boolean; v_auteur_nom text;
  v_fusion uuid := gen_random_uuid();
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;

  select * into c from public.cartes_prospect where id = p_carte for update;
  if not found or c.fusionnee_le is not null
     or not public.acces_carte_ecriture(c.unite_cegep_id, c.unite_sport_id) then
    raise exception 'NEXUS: carte introuvable' using errcode = '42501';
  end if;
  select * into a from public.athletes where id = p_athlete;
  if not found or a.status <> 'ACTIF'::public.account_status
     or not public.athlete_identity_ok(a.date_naissance, a.consentement_parental) then
    raise exception 'NEXUS: profil introuvable' using errcode = '42501';
  end if;
  select * into r from public.rapprochements where carte_id = p_carte and athlete_id = p_athlete for update;
  if not found or r.statut <> 'PROPOSEE' then
    raise exception 'NEXUS: aucune proposition ouverte pour cette paire' using errcode = '22023';
  end if;

  -- Les lignes de journal déjà là pour cet athlète dans cette transaction ne
  -- sont pas les nôtres : on ne remplacera que celles que la fusion écrit.
  select coalesce(array_agg(id), '{}') into v_logs_avant from public.recruiter_activity_log
   where athlete_id = p_athlete and created_at = now();

  -- ── Dossier : la tête de l'unité, puis les valeurs réunies ──
  select * into t from public.recruiter_pipeline p
   where p.unite_cegep_id = c.unite_cegep_id and p.unite_sport_id = c.unite_sport_id and p.athlete_id = p_athlete
   order by public.rang_etape(p.stage) desc, p.moved_at desc nulls last limit 1;
  v_existait := found;

  if v_existait and public.rang_etape(t.stage) >= public.rang_etape(c.etape) then
    v_etape := t.stage; v_moved := t.moved_at;
  else
    v_etape := c.etape; v_moved := c.etape_le;
  end if;
  if v_existait and (t.next_action_at is not null or t.next_action_note is not null) then
    v_relance := t.next_action_at; v_relance_note := t.next_action_note;
  else
    v_relance := c.relance_le; v_relance_note := c.relance_note;
  end if;
  v_visite  := case when v_existait then coalesce(t.visit_at, c.visite_le) else c.visite_le end;
  v_drapeau := coalesce(case when v_existait then t.flagged end, false) or c.drapeau;

  select id into v_ligne_moi from public.recruiter_pipeline where recruiter_id = v_moi and athlete_id = p_athlete;
  if found then
    update public.recruiter_pipeline
       set stage = v_etape, moved_at = v_moved, next_action_at = v_relance, next_action_note = v_relance_note,
           visit_at = v_visite, flagged = v_drapeau, updated_at = now()
     where id = v_ligne_moi;
  else
    insert into public.recruiter_pipeline (recruiter_id, athlete_id, stage, moved_at, next_action_at, next_action_note, visit_at, flagged)
    values (v_moi, p_athlete, v_etape, v_moved, v_relance, v_relance_note, v_visite, v_drapeau)
    returning id into v_ligne_moi;
    v_ligne_creee := true;
  end if;

  -- ── Cote : celle de l'unité gagne ──
  select g.grade into v_grade_avant from public.recruiter_athlete_grades g
   where g.unite_cegep_id = c.unite_cegep_id and g.unite_sport_id = c.unite_sport_id
     and g.athlete_id = p_athlete and g.grade is not null
   order by g.updated_at desc limit 1;
  if v_grade_avant is null and c.grade is not null then
    insert into public.recruiter_athlete_grades (recruiter_id, athlete_id, grade)
    values (v_moi, p_athlete, c.grade)
    on conflict (recruiter_id, athlete_id) do update set grade = excluded.grade
    returning id into v_grade_ligne;
    v_grade_ecrit := c.grade;
  end if;

  -- ── Notes : signées, datées ──
  for n in select * from public.cartes_prospect_notes where carte_id = p_carte order by created_at loop
    select exists (select 1 from public.users u
                    where u.id = n.auteur and u.role = 'RECRUTEUR'::public.user_role
                      and u.school_id = c.unite_cegep_id and u.sport_id = c.unite_sport_id)
      into v_auteur_ok;
    if not v_auteur_ok then
      select nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
        into v_auteur_nom from public.users u where u.id = n.auteur;
    end if;
    insert into public.recruiter_notes (recruiter_id, athlete_id, content, created_at, updated_at)
    values (case when v_auteur_ok then n.auteur else v_moi end, p_athlete,
            case when v_auteur_ok then n.contenu
                 else '[Note de la carte prospect' || coalesce(', de ' || v_auteur_nom, '') || '] ' || n.contenu end,
            n.created_at, n.updated_at)
    returning id into v_note_id;
    v_notes := v_notes || jsonb_build_object('id', v_note_id,
      'content', case when v_auteur_ok then n.contenu
                      else '[Note de la carte prospect' || coalesce(', de ' || v_auteur_nom, '') || '] ' || n.contenu end);
  end loop;

  -- ── Listes suivies ──
  with ajout as (
    insert into public.recruiter_list_members (list_id, athlete_id)
    select cl.list_id, p_athlete from public.cartes_prospect_listes cl where cl.carte_id = p_carte
    on conflict (list_id, athlete_id) do nothing
    returning id
  ) select coalesce(array_agg(id), '{}') into v_membres from ajout;

  -- ── Propositions ──
  update public.rapprochements set statut = 'ACCEPTEE', decide_par = v_moi, decide_le = now() where id = r.id;
  with cad as (
    update public.rapprochements set statut = 'CADUQUE', decide_par = v_moi, decide_le = now()
     where carte_id = p_carte and id <> r.id and statut = 'PROPOSEE'
    returning id
  ) select coalesce(array_agg(id), '{}') into v_caduques from cad;
  update public.notifications_unite set traitee_le = now()
   where type = 'RAPPROCHEMENT' and traitee_le is null and objet_id = any (v_caduques || r.id);

  -- ── Une ligne de journal ──
  delete from public.recruiter_activity_log
   where athlete_id = p_athlete and created_at = now() and id <> all (v_logs_avant);
  insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  values (v_moi, p_athlete, 'PIPELINE_CHANGED',
          jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name,
                             'new_stage', v_etape,
                             'before_stage', case when v_existait and t.stage is distinct from v_etape then t.stage end,
                             'unite', true,
                             'fusion', jsonb_build_object('id', v_fusion, 'carte', c.prenom || ' ' || c.nom)),
          c.unite_cegep_id, c.unite_sport_id);

  -- ── La carte disparaît ──
  perform set_config('nexus.fusion_carte', 'on', true);
  update public.cartes_prospect set fusionnee_le = now(), fusionnee_avec = p_athlete where id = p_carte;
  perform set_config('nexus.fusion_carte', 'off', true);

  insert into public.fusions_cartes (id, rapprochement_id, carte_id, carte_libelle, athlete_id,
                                     unite_cegep_id, unite_sport_id, acteur, snapshot)
  values (v_fusion, r.id, p_carte, c.prenom || ' ' || c.nom, p_athlete, c.unite_cegep_id, c.unite_sport_id, v_moi,
          jsonb_build_object(
            'dossier', jsonb_build_object(
              'existait', v_existait,
              'ligne_moi', v_ligne_moi, 'ligne_creee', v_ligne_creee,
              'avant', case when v_existait then jsonb_build_object(
                         'stage', t.stage, 'moved_at', t.moved_at, 'flagged', t.flagged,
                         'next_action_at', t.next_action_at, 'next_action_note', t.next_action_note,
                         'visit_at', t.visit_at) end,
              'ecrit', jsonb_build_object(
                         'stage', v_etape, 'flagged', v_drapeau, 'next_action_at', v_relance,
                         'next_action_note', v_relance_note, 'visit_at', v_visite)),
            'grade', jsonb_build_object('ecrit', v_grade_ecrit, 'ligne', v_grade_ligne),
            'notes', v_notes,
            'membres', to_jsonb(v_membres),
            'caduques', to_jsonb(v_caduques)));
  return v_fusion;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ANNULER (7 jours, « garder le modifié »)
-- ════════════════════════════════════════════════════════════════════════════
create function public.annuler_fusion(p_fusion uuid)
returns jsonb language plpgsql security definer set search_path = public set row_security = off as $$
declare
  v_moi uuid := auth.uid();
  f record; t record; a record;
  s jsonb; e jsonb; av jsonb;
  v_conserves text[] := '{}'; v_retires text[] := '{}';
  v_logs_avant uuid[]; v_etape_avant text; v_etape_apres text; v_retire boolean := false;
  v_note jsonb; v_n integer; v_notes_gardees integer := 0; v_notes_retirees integer := 0; v_grade text;
  v_etape_max text; v_recruteur_max uuid;
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  select * into f from public.fusions_cartes where id = p_fusion for update;
  if not found or not public.acces_carte_ecriture(f.unite_cegep_id, f.unite_sport_id) then
    raise exception 'NEXUS: fusion introuvable' using errcode = '42501';
  end if;
  if f.etat <> 'ACTIVE' or f.fusionnee_le < now() - interval '7 days'
     or not exists (select 1 from public.cartes_prospect where id = f.carte_id) then
    raise exception 'NEXUS: cette fusion n''est plus annulable' using errcode = '22023';
  end if;
  s := f.snapshot; e := s->'dossier'->'ecrit'; av := s->'dossier'->'avant';

  select coalesce(array_agg(id), '{}') into v_logs_avant from public.recruiter_activity_log
   where athlete_id = f.athlete_id and created_at = now();

  -- ── Dossier ──
  select * into t from public.recruiter_pipeline p
   where p.unite_cegep_id = f.unite_cegep_id and p.unite_sport_id = f.unite_sport_id and p.athlete_id = f.athlete_id
   order by public.rang_etape(p.stage) desc, p.moved_at desc nulls last limit 1;
  if not found then
    null;  -- retiré depuis la fusion par un membre de l'unité : rien à défaire
  else
    v_etape_avant := t.stage;
    if (t.stage::text, t.flagged, t.next_action_at, t.next_action_note, t.visit_at)
       is not distinct from
       (e->>'stage', (e->>'flagged')::boolean, (e->>'next_action_at')::date, e->>'next_action_note', (e->>'visit_at')::timestamptz) then
      if not (s->'dossier'->>'existait')::boolean then
        delete from public.recruiter_pipeline
         where unite_cegep_id = f.unite_cegep_id and unite_sport_id = f.unite_sport_id and athlete_id = f.athlete_id;
        v_retire := true;
        v_retires := v_retires || 'dossier'::text;
      else
        -- Toutes les lignes de l'unité d'un coup, synchronisation coupée : une
        -- correction n'avise pas le parent et ne journalise pas en double.
        perform set_config('nexus.sync_unite', 'on', true);
        update public.recruiter_pipeline
           set stage = av->>'stage', moved_at = (av->>'moved_at')::timestamptz, flagged = (av->>'flagged')::boolean,
               next_action_at = (av->>'next_action_at')::date, next_action_note = av->>'next_action_note',
               visit_at = (av->>'visit_at')::timestamptz, updated_at = now()
         where unite_cegep_id = f.unite_cegep_id and unite_sport_id = f.unite_sport_id and athlete_id = f.athlete_id;
        perform set_config('nexus.sync_unite', 'off', true);
        if (s->'dossier'->>'ligne_creee')::boolean then
          delete from public.recruiter_pipeline where id = (s->'dossier'->>'ligne_moi')::uuid;
        end if;
        v_etape_apres := av->>'stage';
        v_retires := v_retires || 'étape et suivi'::text;
      end if;
      -- Le statut global suit (« Recruté à… » posé par la fusion ne survit pas
      -- à son annulation) — même calcul que sync_global_recruitment_status,
      -- seulement s'il n'a pas été posé à la main.
      select p.stage, p.recruiter_id into v_etape_max, v_recruteur_max from public.recruiter_pipeline p
       where p.athlete_id = f.athlete_id
       order by public.rang_etape(p.stage) desc, p.moved_at desc nulls last limit 1;
      update public.athletes x
         set recruitment_status = case when v_etape_max in ('ENGAGE', 'LETTRE_SIGNEE') then 'RECRUTE'
                                       when v_etape_max in ('EN_DISCUSSION', 'VISITE_PLANIFIEE') then 'EN_PROCESSUS'
                                       else 'OUVERT' end::public.recruitment_status,
             committed_school_id = case when v_etape_max in ('ENGAGE', 'LETTRE_SIGNEE')
                                        then (select u.school_id from public.users u where u.id = v_recruteur_max) end,
             recruitment_status_changed_at = now()
       where x.id = f.athlete_id and x.recruitment_status_changed_by is null
         and (x.recruitment_status::text, x.committed_school_id) is distinct from
             (case when v_etape_max in ('ENGAGE', 'LETTRE_SIGNEE') then 'RECRUTE'
                   when v_etape_max in ('EN_DISCUSSION', 'VISITE_PLANIFIEE') then 'EN_PROCESSUS'
                   else 'OUVERT' end,
              case when v_etape_max in ('ENGAGE', 'LETTRE_SIGNEE')
                   then (select u.school_id from public.users u where u.id = v_recruteur_max) end);
    else
      v_etape_apres := t.stage;
      v_conserves := v_conserves || 'étape et suivi'::text;
    end if;
  end if;

  -- ── Cote ──
  if s->'grade'->>'ecrit' is not null then
    select g.grade into v_grade from public.recruiter_athlete_grades g
     where g.unite_cegep_id = f.unite_cegep_id and g.unite_sport_id = f.unite_sport_id and g.athlete_id = f.athlete_id
     order by g.updated_at desc limit 1;
    if v_grade is not distinct from s->'grade'->>'ecrit' then
      delete from public.recruiter_athlete_grades
       where unite_cegep_id = f.unite_cegep_id and unite_sport_id = f.unite_sport_id and athlete_id = f.athlete_id;
      v_retires := v_retires || 'cote'::text;
    elsif v_grade is not null then
      v_conserves := v_conserves || 'cote'::text;
    end if;
  end if;

  -- ── Notes : retirées si intactes ──
  for v_note in select * from jsonb_array_elements(s->'notes') loop
    delete from public.recruiter_notes where id = (v_note->>'id')::uuid and content = v_note->>'content';
    get diagnostics v_n = row_count;
    if v_n > 0 then
      v_notes_retirees := v_notes_retirees + 1;
    elsif exists (select 1 from public.recruiter_notes where id = (v_note->>'id')::uuid) then
      v_notes_gardees := v_notes_gardees + 1;
    end if;
  end loop;
  if v_notes_retirees > 0 then v_retires := v_retires || (v_notes_retirees || ' note(s)'); end if;
  if v_notes_gardees > 0 then v_conserves := v_conserves || (v_notes_gardees || ' note(s)'); end if;

  -- ── Listes ──
  delete from public.recruiter_list_members
   where id in (select (x #>> '{}')::uuid from jsonb_array_elements(s->'membres') x);
  get diagnostics v_n = row_count;
  if v_n > 0 then v_retires := v_retires || (v_n || ' liste(s)'); end if;

  -- ── Propositions : la paire refusée pour toujours, les autres rouvertes ──
  update public.rapprochements set statut = 'REFUSEE', decide_par = v_moi, decide_le = now()
   where id = f.rapprochement_id;
  update public.rapprochements set statut = 'PROPOSEE', decide_par = null, decide_le = null
   where statut = 'CADUQUE' and id in (select (x #>> '{}')::uuid from jsonb_array_elements(s->'caduques') x);
  update public.notifications_unite set traitee_le = null
   where type = 'RAPPROCHEMENT' and objet_id in (select (x #>> '{}')::uuid from jsonb_array_elements(s->'caduques') x);

  -- ── La carte revient ──
  perform set_config('nexus.fusion_carte', 'on', true);
  update public.cartes_prospect set fusionnee_le = null, fusionnee_avec = null where id = f.carte_id;
  perform set_config('nexus.fusion_carte', 'off', true);

  -- ── Une ligne de journal ──
  delete from public.recruiter_activity_log
   where athlete_id = f.athlete_id and created_at = now() and id <> all (v_logs_avant);
  select * into a from public.athletes where id = f.athlete_id;
  insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  values (v_moi, f.athlete_id, 'PIPELINE_CHANGED',
          jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name,
                             'new_stage', case when v_retire then null else v_etape_apres end,
                             'before_stage', case when v_retire or v_etape_avant is distinct from v_etape_apres then v_etape_avant end,
                             'retire', v_retire, 'unite', true,
                             'fusion_annulee', jsonb_build_object('id', f.id, 'carte', f.carte_libelle,
                                                                  'conserves', to_jsonb(v_conserves))),
          f.unite_cegep_id, f.unite_sport_id);

  update public.fusions_cartes set etat = 'ANNULEE', annulee_par = v_moi, annulee_le = now(), conserves = v_conserves
   where id = f.id;
  return jsonb_build_object('conserves', to_jsonb(v_conserves), 'retires', to_jsonb(v_retires));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. LECTURE — les fusions de l'unité sur un athlète (Historique)
-- ════════════════════════════════════════════════════════════════════════════
create function public.fusions_athlete(p_athlete uuid)
returns table (id uuid, carte_libelle text, acteur uuid, fusionnee_le timestamptz, etat text,
               annulable_jusqu_au timestamptz, annulable boolean, annulee_par uuid, annulee_le timestamptz,
               conserves text[])
language sql stable security definer set search_path = public set row_security = off as $$
  select f.id, f.carte_libelle, f.acteur, f.fusionnee_le, f.etat,
         f.fusionnee_le + interval '7 days',
         f.etat = 'ACTIVE' and f.fusionnee_le >= now() - interval '7 days',
         f.annulee_par, f.annulee_le, f.conserves
    from public.fusions_cartes f
   where f.athlete_id = p_athlete
     and public.acces_carte_ecriture(f.unite_cegep_id, f.unite_sport_id)
   order by f.fusionnee_le desc
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. APRÈS 7 JOURS — la carte part, trace minimale du lot C (motif FUSION)
-- ════════════════════════════════════════════════════════════════════════════
create function public.fusions_definitives()
returns integer language plpgsql security definer set search_path = public set row_security = off as $$
declare f record; n integer := 0;
begin
  for f in
    select * from public.fusions_cartes
     where etat = 'ACTIVE' and fusionnee_le < now() - interval '7 days'
     for update skip locked
  loop
    perform set_config('nexus.purge_cartes', 'on', true);
    delete from public.cartes_prospect where id = f.carte_id and fusionnee_le is not null;
    perform set_config('nexus.purge_cartes', 'off', true);
    update public.cartes_prospect_suppressions set motif = 'FUSION'
     where carte_id = f.carte_id and motif = 'PURGE' and supprimee_le = now();
    update public.fusions_cartes set etat = 'DEFINITIVE', definitive_le = now() where id = f.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. LOT D — deux retouches, corps identiques par ailleurs :
--    · une carte fusionnée n'est plus candidate ni proposée ;
--    · un athlète DÉJÀ dans le processus de l'unité n'est plus exclu. C'est
--      le doublon le plus probable (un collègue a trouvé le vrai profil et
--      l'a ajouté pendant que la carte vivait encore) ; l'exclure rendait
--      inatteignable la fusion « dossier existant, étape la plus avancée ».
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.rapprochement_candidats(p_athlete uuid, p_carte uuid)
returns table (carte_id uuid, athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
               critere text, force text, promotion_concorde boolean)
language sql stable security definer set search_path = public set row_security = off as $$
  with ath as (
    select a.id, a.first_name, a.school_id, a.sport_id, a.annee_diplomation,
           public.nom_normalise(a.last_name) as nom_n,
           nullif(lower(btrim(a.email)), '')        as courriel_fiche,
           nullif(lower(btrim(a.parent_email)), '') as courriel_parent,
           nullif(lower(btrim(u.email)), '')        as courriel_compte,
           public.telephone_normalise(a.telephone)        as tel_fiche,
           public.telephone_normalise(a.telephone_parent) as tel_parent
      from public.athletes a
      left join public.users u on u.id = a.user_id
     where a.status = 'ACTIF'::public.account_status
       and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
       and (p_athlete is null or a.id = p_athlete)
  ), car as (
    select c.id, c.unite_cegep_id, c.unite_sport_id, c.team_id, c.prenom, c.promotion,
           public.nom_normalise(c.nom) as nom_n,
           nullif(lower(btrim(c.courriel)), '') as courriel,
           c.telephone as tel,
           t.school_id as ecole
      from public.cartes_prospect c
      left join public.teams t on t.id = c.team_id
     where (p_carte is null or c.id = p_carte)
       and c.fusionnee_le is null
  ), paires as (
    select car.*, ath.id as ath_id, ath.first_name, ath.school_id as ath_ecole, ath.sport_id as ath_sport,
           ath.annee_diplomation, ath.nom_n as ath_nom, ath.courriel_fiche, ath.courriel_parent, ath.courriel_compte,
           ath.tel_fiche, ath.tel_parent
      from car join ath
        on (car.courriel is not null and car.courriel in (ath.courriel_compte, ath.courriel_fiche, ath.courriel_parent))
        or (car.tel is not null and car.tel in (ath.tel_fiche, ath.tel_parent))
        or (car.nom_n <> '' and (car.nom_n = ath.nom_n or public.noms_proches(car.nom_n, ath.nom_n)))
  ), qualifiees as (
    -- Ce que chaque paire réunit ; le critère se lit ensuite, du plus fort au plus faible.
    select p.*,
      p.nom_n = p.ath_nom as nom_exact,
      public.prenoms_compatibles(p.prenom, p.first_name) as prenom_ok,
      (p.team_id is not null
       and exists (select 1 from public.team_athletes ta where ta.athlete_id = p.ath_id and ta.team_id = p.team_id)) as meme_equipe,
      (p.ecole is not null
       and (p.ath_ecole = p.ecole
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.school_id = p.ecole))
       and (p.ath_sport = p.unite_sport_id
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.sport_id = p.unite_sport_id))) as meme_ecole_sport
      from paires p
  ), notees as (
    select q.*,
      case
        when q.courriel is not null and q.courriel in (q.courriel_compte, q.courriel_fiche) then 'COURRIEL'
        when q.courriel is not null and q.courriel = q.courriel_parent and q.prenom_ok then 'COURRIEL_PARENT'
        when q.tel is not null and q.tel = q.tel_fiche then 'TELEPHONE'
        when q.tel is not null and q.tel = q.tel_parent and q.prenom_ok then 'TELEPHONE_PARENT'
        when q.prenom_ok and q.meme_equipe and q.nom_exact then 'EQUIPE'
        when q.prenom_ok and q.meme_equipe then 'EQUIPE_PROCHE'
        when q.prenom_ok and q.meme_ecole_sport and q.nom_exact then 'ECOLE'
        when q.prenom_ok and q.meme_ecole_sport then 'ECOLE_PROCHE'
      end as critere
      from qualifiees q
  )
  select n.id, n.ath_id, n.unite_cegep_id, n.unite_sport_id, n.critere,
         case n.critere when 'EQUIPE' then 'MOYENNE' when 'EQUIPE_PROCHE' then 'FAIBLE'
                        when 'ECOLE' then 'FAIBLE' when 'ECOLE_PROCHE' then 'FAIBLE' else 'FORTE' end,
         case when n.promotion is null or n.annee_diplomation is null then null
              else n.promotion = n.annee_diplomation end
    from notees n
   where n.critere is not null
     and not exists (select 1 from public.rapprochements r where r.carte_id = n.id and r.athlete_id = n.ath_id)
$$;

create or replace function public.rapprochements_unite(p_carte uuid default null)
returns table (
  id uuid, force text, critere text, promotion_concorde boolean, cree_le timestamptz,
  carte_id uuid, carte_prenom text, carte_nom text, carte_equipe text, carte_ecole text,
  carte_promotion integer, carte_position text, carte_courriel_present boolean,
  athlete_id uuid, athlete_prenom text, athlete_nom text, athlete_ecole text, athlete_equipes text,
  athlete_promotion integer, athlete_position text, athlete_photo_url text
)
language sql stable security definer set search_path = public set row_security = off as $$
  select r.id, r.force, r.critere, r.promotion_concorde, r.cree_le,
         c.id, c.prenom, c.nom, t.name, ts.name, c.promotion, pc.abreviation, c.courriel is not null,
         a.id, a.first_name, a.last_name, sa.name,
         (select string_agg(tt.name, ' · ' order by tt.name) from public.team_athletes ta
            join public.teams tt on tt.id = ta.team_id where ta.athlete_id = a.id),
         a.annee_diplomation, pa.abreviation, a.photo_url
    from public.rapprochements r
    join public.cartes_prospect c on c.id = r.carte_id
    join public.athletes a on a.id = r.athlete_id
    left join public.teams t on t.id = c.team_id
    left join public.schools ts on ts.id = t.school_id
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
   where r.statut = 'PROPOSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and (p_carte is null or r.carte_id = p_carte)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'EQUIPE_PROCHE' then 5
                           when 'ECOLE' then 6 else 7 end, r.cree_le
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. DROITS
-- ════════════════════════════════════════════════════════════════════════════
revoke execute on function public.carte_fusion_garde()               from public, anon, authenticated;
revoke execute on function public.fusions_definitives()              from public, anon, authenticated;
revoke execute on function public.fusionner_carte(uuid, uuid)        from public, anon;
revoke execute on function public.annuler_fusion(uuid)               from public, anon;
revoke execute on function public.fusions_athlete(uuid)              from public, anon;
grant  execute on function public.fusionner_carte(uuid, uuid)        to authenticated;
grant  execute on function public.annuler_fusion(uuid)               to authenticated;
grant  execute on function public.fusions_athlete(uuid)              to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. TÂCHE — chaque jour, les fusions de plus de 7 jours deviennent définitives.
-- ════════════════════════════════════════════════════════════════════════════
select cron.unschedule(jobid) from cron.job where jobname = 'fusions-definitives';
select cron.schedule('fusions-definitives', '50 8 * * *', 'select public.fusions_definitives()');

-- Rattrapage : les athlètes déjà dans un processus d'unité, que le lot D
-- excluait, repassent une fois dans la file.
insert into public.rapprochement_file (athlete_id, raison)
select distinct p.athlete_id, 'rattrapage_processus' from public.recruiter_pipeline p
 where p.unite_cegep_id is not null
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. GATES — listes complètes, jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.fusions_cartes'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de fusions_cartes = %, attendu {postgres,service_role}', vus;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.fusions_cartes'::regclass) then
    raise exception 'NEXUS: RLS inactive sur fusions_cartes';
  end if;

  for r in
    select * from (values
      ('public.carte_fusion_garde()',                  array['postgres','service_role']),
      ('public.fusions_definitives()',                 array['postgres','service_role']),
      ('public.fusionner_carte(uuid, uuid)',           array['authenticated','postgres','service_role']),
      ('public.annuler_fusion(uuid)',                  array['authenticated','postgres','service_role']),
      ('public.fusions_athlete(uuid)',                 array['authenticated','postgres','service_role']),
      ('public.carte_lecture_ok(uuid)',                array['authenticated','postgres','service_role']),
      ('public.carte_ecriture_ok(uuid)',               array['authenticated','postgres','service_role']),
      ('public.rapprochement_candidats(uuid, uuid)',   array['postgres','service_role']),
      ('public.rapprochements_unite(uuid)',            array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;

  for r in
    select * from (values
      ('public.fusions_cartes',  array[]::text[]),
      ('public.cartes_prospect', array['cartes_delete','cartes_insert','cartes_non_fusionnees','cartes_select','cartes_update'])
    ) as v(t, veut)
  loop
    select coalesce(array_agg(polname::text order by polname::text), array[]::text[]) into vus
      from pg_policy where polrelid = r.t::regclass;
    if vus is distinct from r.veut then raise exception 'NEXUS: policies de % = %, attendu %', r.t, vus, r.veut; end if;
  end loop;
  if (select polpermissive from pg_policy where polname = 'cartes_non_fusionnees'
         and polrelid = 'public.cartes_prospect'::regclass) then
    raise exception 'NEXUS: cartes_non_fusionnees doit être RESTRICTIVE';
  end if;

  if (select count(*) from cron.job where jobname = 'fusions-definitives') <> 1 then
    raise exception 'NEXUS: tâche fusions-definitives absente ou en double';
  end if;
end $$;
