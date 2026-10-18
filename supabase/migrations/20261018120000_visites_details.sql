-- ════════════════════════════════════════════════════════════════════════════
-- Détails d'une visite planifiée (retour d'un coach, 18 oct. 2026)
--
-- Une visite n'était qu'un instant (recruiter_pipeline.visit_at, cartes_prospect.visite_le).
-- On ajoute, À CÔTÉ, sans toucher aux tables ni aux fonctions existantes :
--   · format : en personne / Zoom / téléphone ;
--   · adresse (en personne) ou lien (Zoom) ;
--   · responsable : un recruteur de l'unité (responsable_id) OU un nom tapé à la main
--     (coach hors Nexus) — la visite reste rattachée à l'unité, donc à ceux qui gèrent Nexus ;
--   · note courte.
--
-- Portée : la même que la visite elle-même.
--   · athlète, ligne d'unité  → (athlete_id, unite_cegep_id, unite_sport_id) : une visite par unité
--     (les lignes sœurs du pipeline sont synchronisées, lot B1) ;
--   · athlète, ligne privée   → (athlete_id, recruiter_id) : recruteur sans unité ;
--   · carte prospect          → carte_id (l'unité est celle de la carte).
--
-- Accès : AUCUN accès direct à la table. Trois fonctions :
--   · visites_details_unite()          — lecture groupée pour le calendrier ;
--   · visite_details_enregistrer(...)  — écrire (seulement s'il y a une visite en cours) ;
--   · agenda_visites_details(jeton)    — pour le flux d'agenda (Google, Outlook) : lieu, lien,
--                                         description. agenda_flux() reste intacte.
-- Ménage : quand la visite disparaît (date effacée, athlète retiré, carte supprimée), les détails
-- sont supprimés par trigger — ils ne ressurgissent pas sur une visite future.
--
-- Rollback : supabase/rollback/20261018120000_rollback_visites_details.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.visites_details') is not null then
    raise exception 'NEXUS: 20261018120000 déjà appliquée (visites_details existe)';
  end if;
  if to_regprocedure('public.acces_unite_pro(uuid,uuid)') is null
  or to_regprocedure('public.carte_ecriture_ok(uuid)') is null
  or to_regprocedure('public.carte_lecture_ok(uuid)') is null
  or to_regprocedure('public.agenda_hacher(text)') is null
  or to_regprocedure('public.agenda_est_pro(uuid)') is null then
    raise exception 'NEXUS: fonctions préalables absentes (lot B1, cartes, flux d''agenda)';
  end if;
end $$;

-- ── 1. Table ──────────────────────────────────────────────────────────────
create table public.visites_details (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid references public.athletes(id) on delete cascade,
  carte_id        uuid references public.cartes_prospect(id) on delete cascade,
  unite_cegep_id  uuid,
  unite_sport_id  uuid,
  recruiter_id    uuid references auth.users(id) on delete cascade,
  format          text not null default 'EN_PERSONNE'
                  check (format in ('EN_PERSONNE', 'ZOOM', 'TELEPHONE')),
  adresse         text check (char_length(adresse) <= 300),
  lien            text check (char_length(lien) <= 500 and lien ~* '^https://'),
  responsable_id  uuid references public.users(id) on delete set null,
  responsable_nom text check (char_length(responsable_nom) <= 120),
  note            text check (char_length(note) <= 500),
  modifie_par     uuid references auth.users(id) on delete set null,
  modifie_le      timestamptz not null default now(),
  constraint visites_details_une_cible check (num_nonnulls(athlete_id, carte_id) = 1),
  -- Athlète : unité complète OU ligne privée (recruteur), jamais les deux ; carte : ni l'un ni l'autre.
  constraint visites_details_portee check (
    (carte_id is not null and unite_cegep_id is null and unite_sport_id is null and recruiter_id is null)
    or (athlete_id is not null and unite_cegep_id is not null and unite_sport_id is not null and recruiter_id is null)
    or (athlete_id is not null and unite_cegep_id is null and unite_sport_id is null and recruiter_id is not null)
  ),
  constraint visites_details_un_responsable check (num_nonnulls(responsable_id, responsable_nom) <= 1)
);

create unique index visites_details_carte  on public.visites_details (carte_id) where carte_id is not null;
create unique index visites_details_unite  on public.visites_details (athlete_id, unite_cegep_id, unite_sport_id)
  where athlete_id is not null and unite_cegep_id is not null;
create unique index visites_details_prive  on public.visites_details (athlete_id, recruiter_id)
  where athlete_id is not null and recruiter_id is not null;

alter table public.visites_details enable row level security;   -- aucune policy : fonctions seulement
revoke all on public.visites_details from public, anon, authenticated;

comment on table public.visites_details is
  'Détails d''une visite planifiée (format, adresse ou lien, responsable Nexus ou nom libre, note). '
  'Accès par visites_details_unite() / visite_details_enregistrer() / agenda_visites_details() seulement.';

-- ── 2. Lecture groupée (calendrier) ───────────────────────────────────────
-- Ne rend que les détails dont la visite EXISTE encore et que l'appelant peut voir.
create function public.visites_details_unite()
returns table (
  athlete_id uuid, carte_id uuid, format text, adresse text, lien text,
  responsable_id uuid, responsable_nom text, note text, modifie_par uuid, modifie_le timestamptz
)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  with moi as (
    select u.id, u.school_id, u.sport_id, u.is_school_admin
      from public.users u
     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role
  )
  select d.athlete_id, d.carte_id, d.format, d.adresse, d.lien, d.responsable_id,
         coalesce(nullif(trim(concat_ws(' ', r.first_name, r.last_name)), ''), d.responsable_nom),
         d.note, d.modifie_par, d.modifie_le
    from public.visites_details d
    cross join moi
    left join public.users r on r.id = d.responsable_id
   where (
          d.athlete_id is not null and d.unite_cegep_id is not null
          and public.acces_unite_pro(d.unite_cegep_id, d.unite_sport_id)
          and exists (select 1 from public.recruiter_pipeline p
                       where p.athlete_id = d.athlete_id and p.unite_cegep_id = d.unite_cegep_id
                         and p.unite_sport_id = d.unite_sport_id and p.visit_at is not null)
         )
      or (
          d.recruiter_id = moi.id
          and exists (select 1 from public.recruiter_pipeline p
                       where p.athlete_id = d.athlete_id and p.recruiter_id = moi.id
                         and p.unite_cegep_id is null and p.visit_at is not null)
         )
      or (
          d.carte_id is not null and public.carte_lecture_ok(d.carte_id)
          and exists (select 1 from public.cartes_prospect c
                       where c.id = d.carte_id and c.visite_le is not null and c.fusionnee_le is null)
         )
$$;

-- ── 3. Écriture ───────────────────────────────────────────────────────────
-- Exactement une cible (athlète OU carte). Refuse s'il n'y a pas de visite en cours.
-- Le responsable Nexus doit être un recruteur du même cégep ; un nom libre sinon.
create function public.visite_details_enregistrer(
  p_athlete_id      uuid,
  p_carte_id        uuid,
  p_format          text,
  p_adresse         text,
  p_lien            text,
  p_responsable_id  uuid,
  p_responsable_nom text,
  p_note            text
)
returns uuid
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_moi    public.users%rowtype;
  v_cegep  uuid;
  v_sport  uuid;
  v_prive  boolean := false;
  v_id     uuid;
  v_adr    text := nullif(trim(coalesce(p_adresse, '')), '');
  v_lien   text := nullif(trim(coalesce(p_lien, '')), '');
  v_nom    text := nullif(trim(coalesce(p_responsable_nom, '')), '');
  v_note   text := nullif(trim(coalesce(p_note, '')), '');
begin
  select * into v_moi from public.users where id = auth.uid();
  if v_moi.id is null or v_moi.role <> 'RECRUTEUR'::public.user_role then
    raise exception 'NEXUS: réservé aux recruteurs';
  end if;
  if num_nonnulls(p_athlete_id, p_carte_id) <> 1 then
    raise exception 'NEXUS: une visite vise un athlète OU une carte';
  end if;
  if p_format is null or p_format not in ('EN_PERSONNE', 'ZOOM', 'TELEPHONE') then
    raise exception 'NEXUS: format de visite inconnu';
  end if;
  if v_lien is not null and v_lien !~* '^https://' then
    raise exception 'NEXUS: le lien doit commencer par https://';
  end if;
  if p_responsable_id is not null and v_nom is not null then
    raise exception 'NEXUS: choisis un responsable sur Nexus OU tape un nom, pas les deux';
  end if;

  if p_carte_id is not null then
    if not public.carte_ecriture_ok(p_carte_id) then
      raise exception 'NEXUS: carte hors de ton unité';
    end if;
    select c.unite_cegep_id into v_cegep from public.cartes_prospect c
     where c.id = p_carte_id and c.visite_le is not null and c.fusionnee_le is null;
    if not found then raise exception 'NEXUS: aucune visite planifiée pour cette carte'; end if;
  else
    -- Ligne d'unité d'abord (celle que le calendrier montre), sinon ligne privée.
    select p.unite_cegep_id, p.unite_sport_id into v_cegep, v_sport
      from public.recruiter_pipeline p
     where p.athlete_id = p_athlete_id and p.visit_at is not null and p.unite_cegep_id is not null
       and public.acces_unite_pro(p.unite_cegep_id, p.unite_sport_id)
     limit 1;
    if v_cegep is null then
      if not exists (select 1 from public.recruiter_pipeline p
                      where p.athlete_id = p_athlete_id and p.recruiter_id = v_moi.id
                        and p.unite_cegep_id is null and p.visit_at is not null) then
        raise exception 'NEXUS: aucune visite planifiée pour cet athlète dans ton unité';
      end if;
      v_prive := true;
    end if;
  end if;

  if p_responsable_id is not null and not exists (
       select 1 from public.users r
        where r.id = p_responsable_id and r.role = 'RECRUTEUR'::public.user_role
          and r.school_id = coalesce(v_cegep, v_moi.school_id)) then
    raise exception 'NEXUS: le responsable doit être un recruteur de ton cégep';
  end if;

  if p_carte_id is not null then
    insert into public.visites_details as d
      (carte_id, format, adresse, lien, responsable_id, responsable_nom, note, modifie_par, modifie_le)
    values (p_carte_id, p_format, v_adr, v_lien, p_responsable_id, v_nom, v_note, v_moi.id, now())
    on conflict (carte_id) where carte_id is not null do update
      set format = excluded.format, adresse = excluded.adresse, lien = excluded.lien,
          responsable_id = excluded.responsable_id, responsable_nom = excluded.responsable_nom,
          note = excluded.note, modifie_par = excluded.modifie_par, modifie_le = now()
    returning d.id into v_id;
  elsif v_prive then
    insert into public.visites_details as d
      (athlete_id, recruiter_id, format, adresse, lien, responsable_id, responsable_nom, note, modifie_par, modifie_le)
    values (p_athlete_id, v_moi.id, p_format, v_adr, v_lien, p_responsable_id, v_nom, v_note, v_moi.id, now())
    on conflict (athlete_id, recruiter_id) where athlete_id is not null and recruiter_id is not null do update
      set format = excluded.format, adresse = excluded.adresse, lien = excluded.lien,
          responsable_id = excluded.responsable_id, responsable_nom = excluded.responsable_nom,
          note = excluded.note, modifie_par = excluded.modifie_par, modifie_le = now()
    returning d.id into v_id;
  else
    insert into public.visites_details as d
      (athlete_id, unite_cegep_id, unite_sport_id, format, adresse, lien, responsable_id, responsable_nom, note, modifie_par, modifie_le)
    values (p_athlete_id, v_cegep, v_sport, p_format, v_adr, v_lien, p_responsable_id, v_nom, v_note, v_moi.id, now())
    on conflict (athlete_id, unite_cegep_id, unite_sport_id) where athlete_id is not null and unite_cegep_id is not null do update
      set format = excluded.format, adresse = excluded.adresse, lien = excluded.lien,
          responsable_id = excluded.responsable_id, responsable_nom = excluded.responsable_nom,
          note = excluded.note, modifie_par = excluded.modifie_par, modifie_le = now()
    returning d.id into v_id;
  end if;
  return v_id;
end $$;

-- ── 4. Flux d'agenda : lieu, lien, description par visite ─────────────────
-- Même contrôle de jeton que agenda_flux() ; rend les détails des visites de l'unité du jeton.
create function public.agenda_visites_details(p_jeton text)
returns table (cible text, cible_id uuid, format text, adresse text, lien text, responsable text, note text)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
declare
  v_j public.agenda_jetons%rowtype;
  v_u public.users%rowtype;
begin
  select * into v_j from public.agenda_jetons where jeton_hash = public.agenda_hacher(p_jeton);
  if v_j.user_id is null then return; end if;
  select * into v_u from public.users where id = v_j.user_id;
  if v_u.id is null or v_u.role <> 'RECRUTEUR'::public.user_role
     or not public.agenda_est_pro(v_u.id)
     or v_u.school_id is distinct from v_j.unite_cegep_id
     or v_u.sport_id  is distinct from v_j.unite_sport_id then
    return;
  end if;

  return query
  select case when d.carte_id is null then 'athlete' else 'carte' end,
         coalesce(d.athlete_id, d.carte_id), d.format, d.adresse, d.lien,
         coalesce(nullif(trim(concat_ws(' ', r.first_name, r.last_name)), ''), d.responsable_nom),
         d.note
    from public.visites_details d
    left join public.users r on r.id = d.responsable_id
    left join public.cartes_prospect c on c.id = d.carte_id
   where (d.unite_cegep_id = v_j.unite_cegep_id and d.unite_sport_id = v_j.unite_sport_id)
      or (d.recruiter_id = v_u.id)
      or (c.id is not null and c.unite_cegep_id = v_j.unite_cegep_id and c.unite_sport_id = v_j.unite_sport_id
          and c.fusionnee_le is null);
end $$;

-- ── 5. Ménage : la visite disparaît → ses détails aussi ───────────────────
create function public.visites_details_menage_pipeline()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if old.visit_at is null or (tg_op = 'UPDATE' and new.visit_at is not null) then
    return null;
  end if;
  if old.unite_cegep_id is not null then
    -- Les lignes sœurs sont synchronisées : on attend qu'aucune ne porte encore la visite.
    if not exists (select 1 from public.recruiter_pipeline p
                    where p.athlete_id = old.athlete_id and p.unite_cegep_id = old.unite_cegep_id
                      and p.unite_sport_id = old.unite_sport_id and p.visit_at is not null) then
      delete from public.visites_details
       where athlete_id = old.athlete_id and unite_cegep_id = old.unite_cegep_id
         and unite_sport_id = old.unite_sport_id;
    end if;
  else
    delete from public.visites_details where athlete_id = old.athlete_id and recruiter_id = old.recruiter_id;
  end if;
  return null;
end $$;

create function public.visites_details_menage_carte()
returns trigger language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if old.visite_le is not null and (new.visite_le is null or new.fusionnee_le is not null) then
    delete from public.visites_details where carte_id = old.id;
  end if;
  return null;
end $$;

create trigger visites_details_menage
  after update of visit_at or delete on public.recruiter_pipeline
  for each row execute function public.visites_details_menage_pipeline();

create trigger visites_details_menage
  after update of visite_le, fusionnee_le on public.cartes_prospect
  for each row execute function public.visites_details_menage_carte();

-- ── 6. ACL : poser, puis vérifier la liste COMPLÈTE triée (CLAUDE.md) ─────
revoke all on function public.visites_details_unite()                                             from public, anon, authenticated;
revoke all on function public.visite_details_enregistrer(uuid, uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.agenda_visites_details(text)                                        from public, anon, authenticated;
revoke all on function public.visites_details_menage_pipeline()                                   from public, anon, authenticated;
revoke all on function public.visites_details_menage_carte()                                      from public, anon, authenticated;
grant execute on function public.visites_details_unite()                                             to authenticated, service_role;
grant execute on function public.visite_details_enregistrer(uuid, uuid, text, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.agenda_visites_details(text)                                        to service_role;

do $$
declare
  f regprocedure; veut text[]; vus text[];
begin
  for f, veut in
    select * from (values
      ('public.visites_details_unite()'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.visite_details_enregistrer(uuid,uuid,text,text,text,uuid,text,text)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.agenda_visites_details(text)'::regprocedure, array['postgres','service_role']),
      ('public.visites_details_menage_pipeline()'::regprocedure, array['postgres','service_role']),
      ('public.visites_details_menage_carte()'::regprocedure, array['postgres','service_role'])
    ) v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut; end if;
  end loop;

  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.visites_details'::regclass;
  if exists (select 1 from unnest(vus) g where g not in ('postgres','service_role')) then
    raise exception 'NEXUS: ACL visites_details = %', vus;
  end if;
end $$;
