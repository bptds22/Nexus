-- 20260928190000_lot_c_cartes_prospect (renommée à la version prod après apply)
--
-- LOT C — CARTES PROSPECT (GO BP 2026-09-28). Un athlète qui n'est pas encore
-- sur Nexus peut être suivi dans « Mon processus » sous forme de carte.
--
-- PROPRIÉTÉ : l'UNITÉ (cégep × sport), posée par trigger d'après le créateur,
-- jamais modifiable. Loi 25 : le cégep est propriétaire de ces données
-- (docs/pipeline-recruteur-frontieres.md).
--
-- ACCÈS (RLS, via fonctions SECURITY DEFINER — checklist, règle 4) :
--   · lecture ET écriture : recruteur Pro/All Star de l'UNITÉ ;
--   · lecture seule : admin cégep, sur tout son cégep (tous sports, tout palier
--     — comme le reste de Mon CÉGEP) ;
--   · rien pour coach, athlète, parent, partenaire, anon. Aucune recherche ne
--     lit cette table : une carte n'apparaît jamais hors de son cégep.
--
-- CONTENU : prénom, nom, équipe RÉELLE (teams.id, obligatoire à la création),
-- position, numéro, promotion, taille, poids, lien vidéo, courriel FACULTATIF
-- (invitation du lot D) — aucune autre coordonnée. Suivi : étape, grade,
-- relance (date + note), visite, drapeau. Notes à part, signées. Retirer une
-- carte la SUPPRIME (décision BP) ; une trace d'audit minimale, SANS donnée de
-- l'athlète, est gardée.
--
-- RÉTENTION : purge pg_cron quotidienne, 12 mois après la dernière activité
-- (derniere_activite : toute modification de la carte ou de ses notes).
-- L'avis 30 jours avant est CALCULÉ à l'écran (bandeau + marqueur, décision
-- BP) — aucune table d'avis.
--
-- ADDITIF : quatre tables nouvelles, fonctions nouvelles, une tâche pg_cron.
-- AUCUNE table, colonne, contrainte, policy ni fonction existante touchée —
-- l'app 1.4.3 ne lit aucune de ces tables.
--
-- Rollback : supabase/rollback/20260928190000_rollback_lot_c_cartes_prospect.sql

-- ════════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════════════════════
create table public.cartes_prospect (
  id                uuid primary key default gen_random_uuid(),
  unite_cegep_id    uuid not null,
  unite_sport_id    uuid not null,
  cree_par          uuid default auth.uid() references auth.users(id) on delete set null,
  modifie_par       uuid references auth.users(id) on delete set null,
  prenom            text not null check (char_length(btrim(prenom)) between 1 and 80),
  nom               text not null check (char_length(btrim(nom)) between 1 and 80),
  -- Obligatoire À LA CRÉATION (trigger) ; SET NULL si un coach supprime l'équipe.
  team_id           uuid references public.teams(id) on delete set null,
  position_id       uuid references public.positions(id) on delete set null,
  numero            text check (numero is null or char_length(numero) between 1 and 4),
  promotion         integer check (promotion is null or promotion between 2020 and 2040),
  taille_pieds      integer check (taille_pieds is null or taille_pieds between 3 and 8),
  taille_pouces     integer check (taille_pouces is null or taille_pouces between 0 and 11),
  poids_lbs         integer check (poids_lbs is null or poids_lbs between 50 and 450),
  lien_video        text check (lien_video is null or lien_video ~* '^https?://[^\s]+$'),
  courriel          text check (courriel is null or courriel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  etape             text not null default 'IDENTIFIE'
                      check (etape in ('IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE')),
  grade             text check (grade is null or grade in ('A+','A','B+','B','C+','C','D')),
  relance_le        date,
  relance_note      text check (relance_note is null or char_length(relance_note) <= 500),
  visite_le         timestamptz,
  drapeau           boolean not null default false,
  -- Dernier changement d'étape (« depuis N jours » du kanban), posé par trigger.
  etape_le          timestamptz not null default now(),
  derniere_activite timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index cartes_prospect_unite_idx on public.cartes_prospect (unite_cegep_id, unite_sport_id);
create index cartes_prospect_team_idx on public.cartes_prospect (team_id);
create index cartes_prospect_activite_idx on public.cartes_prospect (derniere_activite);
comment on table public.cartes_prospect is
  'Lot C (2026-09-28) : carte d''un prospect pas encore sur Nexus, propriété de l''unité (cégep × sport). Le cégep est propriétaire des données (Loi 25). Purge 12 mois après la dernière activité.';

create table public.cartes_prospect_notes (
  id         uuid primary key default gen_random_uuid(),
  carte_id   uuid not null references public.cartes_prospect(id) on delete cascade,
  auteur     uuid default auth.uid() references auth.users(id) on delete set null,
  contenu    text not null check (char_length(btrim(contenu)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cartes_prospect_notes_carte_idx on public.cartes_prospect_notes (carte_id, created_at desc);

create table public.cartes_prospect_journal (
  id         uuid primary key default gen_random_uuid(),
  carte_id   uuid not null references public.cartes_prospect(id) on delete cascade,
  acteur     uuid references auth.users(id) on delete set null,
  action     text not null check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE')),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index cartes_prospect_journal_carte_idx on public.cartes_prospect_journal (carte_id, created_at desc);

-- Trace d'audit MINIMALE à la suppression : aucune donnée de l'athlète.
create table public.cartes_prospect_suppressions (
  id              uuid primary key default gen_random_uuid(),
  carte_id        uuid not null,
  unite_cegep_id  uuid not null,
  unite_sport_id  uuid not null,
  motif           text not null check (motif in ('RETRAIT','PURGE')),
  supprimee_par   uuid,
  carte_creee_le  timestamptz,
  derniere_activite timestamptz,
  supprimee_le    timestamptz not null default now()
);
comment on table public.cartes_prospect_suppressions is
  'Lot C : trace minimale de chaque carte prospect supprimée (retrait par un recruteur ou purge de rétention). Aucune donnée de l''athlète.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. ACCÈS — fonctions SECURITY DEFINER (users n'est pas lu dans une policy).
-- ════════════════════════════════════════════════════════════════════════════
-- Écriture : recruteur Pro de l'unité EXACTE (l'admin cégep écrit dans la sienne).
create function public.acces_carte_ecriture(p_cegep uuid, p_sport uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_cegep is not null and p_sport is not null
     and exists (select 1 from public.users u
                  where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role
                    and u.school_id = p_cegep and u.sport_id = p_sport)
     and public.user_has_pro()
$$;

-- Lecture : l'écriture, ou l'admin cégep sur tout son cégep.
create function public.acces_carte_lecture(p_cegep uuid, p_sport uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.acces_carte_ecriture(p_cegep, p_sport)
      or (p_cegep is not null
          and exists (select 1 from public.users u
                       where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role
                         and u.school_id = p_cegep and u.is_school_admin = true))
$$;

create function public.carte_lecture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and public.acces_carte_lecture(c.unite_cegep_id, c.unite_sport_id))
$$;

create function public.carte_ecriture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and public.acces_carte_ecriture(c.unite_cegep_id, c.unite_sport_id))
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════
-- 3a. Création : unité d'après le créateur, équipe réelle du sport de l'unité.
create function public.cartes_prospect_avant_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cegep uuid; v_sport uuid; v_sport_equipe uuid; v_sport_position uuid;
begin
  select u.school_id, u.sport_id into v_cegep, v_sport
    from public.users u where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role;
  if v_cegep is null or v_sport is null then
    raise exception 'NEXUS: une carte prospect appartient à une unité (cégep × sport) — recruteur requis'
      using errcode = '42501';
  end if;
  new.unite_cegep_id := v_cegep;       -- la valeur envoyée par le client est ignorée
  new.unite_sport_id := v_sport;
  new.cree_par := auth.uid();
  new.modifie_par := auth.uid();
  new.derniere_activite := now();
  new.etape_le := now();
  new.created_at := now();
  new.updated_at := now();

  if new.team_id is null then
    raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
  end if;
  select t.sport_id into v_sport_equipe from public.teams t where t.id = new.team_id;
  if v_sport_equipe is distinct from v_sport then
    raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
  end if;
  if new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from v_sport then
      raise exception 'NEXUS: la position doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- 3b. Modification : unité, créateur et date de création figés ; signature.
create function public.cartes_prospect_avant_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sport_equipe uuid; v_sport_position uuid;
begin
  new.unite_cegep_id := old.unite_cegep_id;
  new.unite_sport_id := old.unite_sport_id;
  new.cree_par := old.cree_par;
  new.created_at := old.created_at;
  new.updated_at := now();
  if auth.uid() is not null then new.modifie_par := auth.uid(); end if;
  new.derniere_activite := now();
  new.etape_le := case when new.etape is distinct from old.etape then now() else old.etape_le end;

  if new.team_id is distinct from old.team_id then
    if new.team_id is null then
      raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
    end if;
    select t.sport_id into v_sport_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.unite_sport_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from old.unite_sport_id then
      raise exception 'NEXUS: la position doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- 3c. Journal : un geste = une ligne, signée par l'acteur.
create function public.cartes_prospect_journaliser()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_acteur uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'CREEE', jsonb_build_object('etape', new.etape));
    return new;
  end if;
  if new.etape is distinct from old.etape then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'ETAPE', jsonb_build_object('avant', old.etape, 'apres', new.etape));
  end if;
  if new.grade is distinct from old.grade then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'GRADE', jsonb_build_object('avant', old.grade, 'apres', new.grade));
  end if;
  if new.relance_le is distinct from old.relance_le or new.relance_note is distinct from old.relance_note then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'RELANCE', jsonb_build_object('le', new.relance_le));
  end if;
  if new.visite_le is distinct from old.visite_le then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'VISITE', jsonb_build_object('le', new.visite_le));
  end if;
  if new.drapeau is distinct from old.drapeau then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'DRAPEAU', jsonb_build_object('drapeau', new.drapeau));
  end if;
  if (new.prenom, new.nom, new.team_id, new.position_id, new.numero, new.promotion, new.taille_pieds,
      new.taille_pouces, new.poids_lbs, new.lien_video, new.courriel)
     is distinct from
     (old.prenom, old.nom, old.team_id, old.position_id, old.numero, old.promotion, old.taille_pieds,
      old.taille_pouces, old.poids_lbs, old.lien_video, old.courriel) then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'MODIFIEE', '{}'::jsonb);
  end if;
  return new;
end $$;

-- 3d. Suppression : trace minimale (motif RETRAIT, ou PURGE posé par la purge).
create function public.cartes_prospect_tracer_suppression()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_purge boolean := coalesce(current_setting('nexus.purge_cartes', true), '') = 'on';
begin
  -- Une purge n'a jamais d'acteur : la rétention n'est le geste de personne.
  insert into public.cartes_prospect_suppressions
    (carte_id, unite_cegep_id, unite_sport_id, motif, supprimee_par, carte_creee_le, derniere_activite)
  values (old.id, old.unite_cegep_id, old.unite_sport_id,
          case when v_purge then 'PURGE' else 'RETRAIT' end,
          case when v_purge then null else auth.uid() end,
          old.created_at, old.derniere_activite);
  return old;
end $$;

-- 3e. Notes : signées par l'auteur (jamais au nom d'un autre), figées ;
--     elles comptent comme activité de la carte.
create function public.cartes_prospect_notes_avant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.auteur := auth.uid();
    new.created_at := now();
  else
    new.auteur := old.auteur;
    new.carte_id := old.carte_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

create function public.cartes_prospect_notes_apres()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.cartes_prospect set derniere_activite = now() where id = new.carte_id;
  if tg_op = 'INSERT' then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.carte_id, auth.uid(), 'NOTE', '{}'::jsonb);
  end if;
  return new;
end $$;

create trigger trg_carte_a_avant_insert before insert on public.cartes_prospect
  for each row execute function public.cartes_prospect_avant_insert();
create trigger trg_carte_b_avant_update before update on public.cartes_prospect
  for each row execute function public.cartes_prospect_avant_update();
create trigger trg_carte_z_journal after insert or update on public.cartes_prospect
  for each row execute function public.cartes_prospect_journaliser();
create trigger trg_carte_z_suppression after delete on public.cartes_prospect
  for each row execute function public.cartes_prospect_tracer_suppression();
create trigger trg_carte_note_avant before insert or update on public.cartes_prospect_notes
  for each row execute function public.cartes_prospect_notes_avant();
create trigger trg_carte_note_apres after insert or update on public.cartes_prospect_notes
  for each row execute function public.cartes_prospect_notes_apres();

-- ════════════════════════════════════════════════════════════════════════════
-- 4. RLS
-- ════════════════════════════════════════════════════════════════════════════
alter table public.cartes_prospect enable row level security;
alter table public.cartes_prospect_notes enable row level security;
alter table public.cartes_prospect_journal enable row level security;
alter table public.cartes_prospect_suppressions enable row level security;

create policy cartes_select on public.cartes_prospect for select to authenticated
  using (public.acces_carte_lecture(unite_cegep_id, unite_sport_id));
-- L'unité est posée par le trigger AVANT le with check : c'est celle du créateur.
create policy cartes_insert on public.cartes_prospect for insert to authenticated
  with check (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));
create policy cartes_update on public.cartes_prospect for update to authenticated
  using (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id))
  with check (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));
create policy cartes_delete on public.cartes_prospect for delete to authenticated
  using (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));

create policy cartes_notes_select on public.cartes_prospect_notes for select to authenticated
  using (public.carte_lecture_ok(carte_id));
create policy cartes_notes_insert on public.cartes_prospect_notes for insert to authenticated
  with check (auteur = (select auth.uid()) and public.carte_ecriture_ok(carte_id));
-- Chacun ne modifie et ne supprime que SES notes.
create policy cartes_notes_update on public.cartes_prospect_notes for update to authenticated
  using (auteur = (select auth.uid()) and public.carte_ecriture_ok(carte_id))
  with check (auteur = (select auth.uid()) and public.carte_ecriture_ok(carte_id));
create policy cartes_notes_delete on public.cartes_prospect_notes for delete to authenticated
  using (auteur = (select auth.uid()) and public.carte_ecriture_ok(carte_id));

-- Journal : lecture seulement ; il n'est écrit que par les triggers.
create policy cartes_journal_select on public.cartes_prospect_journal for select to authenticated
  using (public.carte_lecture_ok(carte_id));

-- Trace de suppression : admin plateforme seulement.
create policy cartes_suppressions_select on public.cartes_prospect_suppressions for select to authenticated
  using (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 5. DROITS — anon n'a rien ; le journal et la trace ne s'écrivent pas par l'API.
-- ════════════════════════════════════════════════════════════════════════════
revoke all on public.cartes_prospect, public.cartes_prospect_notes,
              public.cartes_prospect_journal, public.cartes_prospect_suppressions from public, anon;
revoke all on public.cartes_prospect_journal, public.cartes_prospect_suppressions from authenticated;
grant select, insert, update, delete on public.cartes_prospect, public.cartes_prospect_notes to authenticated;
grant select on public.cartes_prospect_journal, public.cartes_prospect_suppressions to authenticated;

revoke execute on function public.acces_carte_ecriture(uuid, uuid) from public, anon;
revoke execute on function public.acces_carte_lecture(uuid, uuid)  from public, anon;
revoke execute on function public.carte_lecture_ok(uuid)           from public, anon;
revoke execute on function public.carte_ecriture_ok(uuid)          from public, anon;
grant  execute on function public.acces_carte_ecriture(uuid, uuid) to authenticated;
grant  execute on function public.acces_carte_lecture(uuid, uuid)  to authenticated;
grant  execute on function public.carte_lecture_ok(uuid)           to authenticated;
grant  execute on function public.carte_ecriture_ok(uuid)          to authenticated;

revoke execute on function public.cartes_prospect_avant_insert()        from public, anon, authenticated;
revoke execute on function public.cartes_prospect_avant_update()        from public, anon, authenticated;
revoke execute on function public.cartes_prospect_journaliser()         from public, anon, authenticated;
revoke execute on function public.cartes_prospect_tracer_suppression()  from public, anon, authenticated;
revoke execute on function public.cartes_prospect_notes_avant()         from public, anon, authenticated;
revoke execute on function public.cartes_prospect_notes_apres()         from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RÉTENTION — purge quotidienne, 12 mois après la dernière activité.
-- ════════════════════════════════════════════════════════════════════════════
create function public.purger_cartes_prospect()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('nexus.purge_cartes', 'on', true);
  delete from public.cartes_prospect where derniere_activite < now() - interval '12 months';
  get diagnostics n = row_count;
  perform set_config('nexus.purge_cartes', 'off', true);
  return n;
end $$;
revoke execute on function public.purger_cartes_prospect() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'cartes-prospect-purge-quotidienne';
select cron.schedule('cartes-prospect-purge-quotidienne', '40 8 * * *', 'select public.purger_cartes_prospect()');

-- ════════════════════════════════════════════════════════════════════════════
-- 7. GATES — listes complètes, jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  vus text[];
begin
  -- 7a. ACL des tables.
  for r in
    select * from (values
      ('public.cartes_prospect',              array['authenticated','postgres','service_role']),
      ('public.cartes_prospect_notes',        array['authenticated','postgres','service_role']),
      ('public.cartes_prospect_journal',      array['authenticated','postgres','service_role']),
      ('public.cartes_prospect_suppressions', array['authenticated','postgres','service_role'])
    ) as v(t, veut)
  loop
    select array_agg(distinct t.g order by t.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) t
     where c.oid = r.t::regclass;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.t, vus, r.veut;
    end if;
    if not (select relrowsecurity from pg_class where oid = r.t::regclass) then
      raise exception 'NEXUS: RLS inactive sur %', r.t;
    end if;
  end loop;

  -- 7b. Droits fins : journal et trace en LECTURE seule pour authenticated.
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name in ('cartes_prospect_journal', 'cartes_prospect_suppressions')
                and privilege_type <> 'SELECT') then
    raise exception 'NEXUS: authenticated peut écrire dans le journal ou la trace des cartes';
  end if;

  -- 7c. ACL des fonctions.
  for r in
    select * from (values
      ('public.acces_carte_ecriture(uuid, uuid)',           array['authenticated','postgres','service_role']),
      ('public.acces_carte_lecture(uuid, uuid)',            array['authenticated','postgres','service_role']),
      ('public.carte_lecture_ok(uuid)',                     array['authenticated','postgres','service_role']),
      ('public.carte_ecriture_ok(uuid)',                    array['authenticated','postgres','service_role']),
      ('public.cartes_prospect_avant_insert()',             array['postgres','service_role']),
      ('public.cartes_prospect_avant_update()',             array['postgres','service_role']),
      ('public.cartes_prospect_journaliser()',              array['postgres','service_role']),
      ('public.cartes_prospect_tracer_suppression()',       array['postgres','service_role']),
      ('public.cartes_prospect_notes_avant()',              array['postgres','service_role']),
      ('public.cartes_prospect_notes_apres()',              array['postgres','service_role']),
      ('public.purger_cartes_prospect()',                   array['postgres','service_role'])
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

  -- 7d. Policies, liste complète par table.
  for r in
    select * from (values
      ('public.cartes_prospect',              array['cartes_delete','cartes_insert','cartes_select','cartes_update']),
      ('public.cartes_prospect_notes',        array['cartes_notes_delete','cartes_notes_insert','cartes_notes_select','cartes_notes_update']),
      ('public.cartes_prospect_journal',      array['cartes_journal_select']),
      ('public.cartes_prospect_suppressions', array['cartes_suppressions_select'])
    ) as v(t, veut)
  loop
    select array_agg(polname::text order by polname::text) into vus from pg_policy where polrelid = r.t::regclass;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: policies de % = %, attendu %', r.t, vus, r.veut;
    end if;
  end loop;

  -- 7e. La purge est planifiée, une seule fois.
  if (select count(*) from cron.job where jobname = 'cartes-prospect-purge-quotidienne') <> 1 then
    raise exception 'NEXUS: tâche de purge des cartes absente ou en double';
  end if;
end $$;
