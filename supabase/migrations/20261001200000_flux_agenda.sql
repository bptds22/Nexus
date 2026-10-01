-- ═══════════════════════════════════════════════════════════════
-- Flux d'agenda du recruteur Pro (décision BP 2026-10-01, web, avant la 1.4.4)
--
-- Une adresse d'abonnement PRIVÉE par recruteur Pro : un jeton secret
-- (affiché une seule fois), stocké HACHÉ (sha256), régénérable et révocable.
-- Le flux .ics sert les RELANCES et les VISITES de son unité (cégep × sport),
-- pas les matchs.
--
--   · agenda_jeton_creer()     — crée OU remplace le jeton (l'ancien meurt) ;
--                                 Pro et unité complète exigés.
--   · agenda_jeton_revoquer()  — supprime le jeton : l'adresse rend 404.
--   · agenda_jeton_etat()      — actif ? depuis quand ? l'unité est-elle encore
--                                 celle du jeton ? (jamais le haché)
--   · agenda_flux(p_jeton)     — les événements ; SERVICE_ROLE SEULEMENT
--                                 (la route /api/agenda/<jeton>.ics).
--
-- Le flux devient VIDE (calendrier valide, sans événement) quand le
-- recruteur n'est plus Pro, ou que son unité n'est plus celle du jeton.
-- Une inconnue (jeton absent, révoqué) ne rend aucune ligne non plus : la
-- route distingue les deux cas par agenda_flux_existe().
--
-- Noms : décision BP « noms complets dans le flux » — MAIS la règle Loi 25 de
-- l'app reste : un athlète dont l'identité n'est pas visible au recruteur
-- (mineur sans consentement, athlete_identity_ok) sort en « Identité
-- réservée », exactement comme dans recruiter_athlete_cards.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.agenda_jetons (
  user_id        uuid primary key references public.users(id) on delete cascade,
  jeton_hash     text not null unique,
  unite_cegep_id uuid not null references public.schools(id) on delete cascade,
  unite_sport_id uuid not null references public.sports(id) on delete cascade,
  cree_le        timestamptz not null default now()
);
alter table public.agenda_jetons enable row level security;
-- Aucune policy : seules les fonctions SECURITY DEFINER ci-dessous y touchent.
revoke all on table public.agenda_jetons from public, anon, authenticated;

comment on table public.agenda_jetons is
  'Flux d''agenda recruteur : un jeton par recruteur, HACHÉ (sha256 hex). Le jeton en clair n''existe qu''une fois, dans la réponse de agenda_jeton_creer().';

-- ── Pro, par identifiant (get_user_tier lit auth.uid(), inutilisable ici) ──
create or replace function public.agenda_est_pro(p_user uuid)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select s.tier in ('pro', 'all_star')
       from public.subscriptions s
      where s.user_id = p_user and s.status = 'active'
      order by s.created_at desc limit 1),
    false)
$$;

create or replace function public.agenda_hacher(p_jeton text)
returns text
language sql immutable
set search_path = public
as $$
  select encode(extensions.digest(convert_to(p_jeton, 'UTF8'), 'sha256'), 'hex')
$$;

-- ── Créer / remplacer ──────────────────────────────────────────
create or replace function public.agenda_jeton_creer()
returns text
language plpgsql volatile security definer
set search_path = public
set row_security = off
as $$
declare
  v_moi public.users%rowtype;
  v_jeton text;
begin
  select * into v_moi from public.users where id = auth.uid();
  if v_moi.id is null or v_moi.role <> 'RECRUTEUR'::public.user_role then
    raise exception 'NEXUS: réservé aux recruteurs' using errcode = '42501';
  end if;
  if not public.agenda_est_pro(v_moi.id) then
    raise exception 'NEXUS: flux d''agenda réservé au Pro' using errcode = '42501';
  end if;
  if v_moi.school_id is null or v_moi.sport_id is null then
    raise exception 'NEXUS: unité incomplète (cégep et sport requis)' using errcode = '22023';
  end if;

  v_jeton := 'nxa_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.agenda_jetons (user_id, jeton_hash, unite_cegep_id, unite_sport_id, cree_le)
  values (v_moi.id, public.agenda_hacher(v_jeton), v_moi.school_id, v_moi.sport_id, now())
  on conflict (user_id) do update
     set jeton_hash = excluded.jeton_hash,
         unite_cegep_id = excluded.unite_cegep_id,
         unite_sport_id = excluded.unite_sport_id,
         cree_le = excluded.cree_le;
  return v_jeton;
end $$;

-- ── Révoquer ───────────────────────────────────────────────────
create or replace function public.agenda_jeton_revoquer()
returns boolean
language sql volatile security definer
set search_path = public
set row_security = off
as $$
  with d as (delete from public.agenda_jetons where user_id = auth.uid() returning 1)
  select exists (select 1 from d)
$$;

-- ── État (jamais le haché) ─────────────────────────────────────
create or replace function public.agenda_jeton_etat()
returns table (actif boolean, cree_le timestamptz, unite_a_jour boolean, pro boolean)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select j.user_id is not null,
         j.cree_le,
         coalesce(j.unite_cegep_id = u.school_id and j.unite_sport_id = u.sport_id, false),
         public.agenda_est_pro(u.id)
    from public.users u
    left join public.agenda_jetons j on j.user_id = u.id
   where u.id = auth.uid()
$$;

-- ── Le jeton existe-t-il ? (route : 404 sinon) ─────────────────
create or replace function public.agenda_flux_existe(p_jeton text)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.agenda_jetons where jeton_hash = public.agenda_hacher(p_jeton))
$$;

-- ── Les événements ─────────────────────────────────────────────
create or replace function public.agenda_flux(p_jeton text)
returns table (
  type       text,         -- 'RELANCE' | 'VISITE'
  cible      text,         -- 'athlete' | 'carte'
  cible_id   uuid,
  nom        text,
  jour       date,         -- relance : échéance
  instant    timestamptz,  -- visite : heure
  note       text
)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
declare
  v_j public.agenda_jetons%rowtype;
  v_u public.users%rowtype;
  v_depuis date := current_date - 60;
begin
  select * into v_j from public.agenda_jetons where jeton_hash = public.agenda_hacher(p_jeton);
  if v_j.user_id is null then return; end if;
  select * into v_u from public.users where id = v_j.user_id;
  -- Flux VIDE : plus recruteur, plus Pro, ou unité changée depuis le jeton.
  if v_u.id is null or v_u.role <> 'RECRUTEUR'::public.user_role
     or not public.agenda_est_pro(v_u.id)
     or v_u.school_id is distinct from v_j.unite_cegep_id
     or v_u.sport_id  is distinct from v_j.unite_sport_id then
    return;
  end if;

  return query
  with cible as (
    select p.*
      from public.recruiter_pipeline p
     where (p.unite_cegep_id = v_j.unite_cegep_id and p.unite_sport_id = v_j.unite_sport_id)
        or (p.unite_cegep_id is null and p.recruiter_id = v_u.id)
  ),
  -- Même ligne retenue que unite_pipeline() : l'étape la plus avancée.
  meilleure as (
    select distinct on (c.athlete_id, c.unite_cegep_id, c.unite_sport_id) c.*
      from cible c
     order by c.athlete_id, c.unite_cegep_id, c.unite_sport_id,
              public.rang_etape(c.stage::text) desc, c.moved_at desc nulls last
  ),
  athl as (
    select m.*,
           case when public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                then nullif(trim(concat_ws(' ', a.first_name, a.last_name)), '')
           end as nom_visible
      from meilleure m
      join public.athletes a on a.id = m.athlete_id and a.status = 'ACTIF'::public.account_status
  )
  select 'RELANCE', 'athlete', x.athlete_id, coalesce(x.nom_visible, 'Identité réservée'),
         x.next_action_at, null::timestamptz, nullif(trim(coalesce(x.next_action_note, '')), '')
    from athl x
   where x.next_action_at is not null and x.next_action_at >= v_depuis
  union all
  select 'VISITE', 'athlete', x.athlete_id, coalesce(x.nom_visible, 'Identité réservée'),
         null::date, x.visit_at, null
    from athl x
   where x.visit_at is not null and x.visit_at >= v_depuis
  union all
  select 'RELANCE', 'carte', c.id, nullif(trim(concat_ws(' ', c.prenom, c.nom)), ''),
         c.relance_le, null::timestamptz, nullif(trim(coalesce(c.relance_note, '')), '')
    from public.cartes_prospect c
   where c.unite_cegep_id = v_j.unite_cegep_id and c.unite_sport_id = v_j.unite_sport_id
     and c.fusionnee_le is null and c.relance_le is not null and c.relance_le >= v_depuis
  union all
  select 'VISITE', 'carte', c.id, nullif(trim(concat_ws(' ', c.prenom, c.nom)), ''),
         null::date, c.visite_le, null
    from public.cartes_prospect c
   where c.unite_cegep_id = v_j.unite_cegep_id and c.unite_sport_id = v_j.unite_sport_id
     and c.fusionnee_le is null and c.visite_le is not null and c.visite_le >= v_depuis;
end $$;

-- ── ACL : poser, puis vérifier la liste COMPLÈTE triée (CLAUDE.md) ──
revoke all on function public.agenda_est_pro(uuid)        from public, anon, authenticated;
revoke all on function public.agenda_hacher(text)         from public, anon, authenticated;
revoke all on function public.agenda_jeton_creer()        from public, anon, authenticated;
revoke all on function public.agenda_jeton_revoquer()     from public, anon, authenticated;
revoke all on function public.agenda_jeton_etat()         from public, anon, authenticated;
revoke all on function public.agenda_flux_existe(text)    from public, anon, authenticated;
revoke all on function public.agenda_flux(text)           from public, anon, authenticated;
grant execute on function public.agenda_jeton_creer()     to authenticated;
grant execute on function public.agenda_jeton_revoquer()  to authenticated;
grant execute on function public.agenda_jeton_etat()      to authenticated;
grant execute on function public.agenda_est_pro(uuid)     to service_role;
grant execute on function public.agenda_hacher(text)      to service_role;
grant execute on function public.agenda_flux_existe(text) to service_role;
grant execute on function public.agenda_flux(text)        to service_role;
grant execute on function public.agenda_jeton_creer()     to service_role;
grant execute on function public.agenda_jeton_revoquer()  to service_role;
grant execute on function public.agenda_jeton_etat()      to service_role;

do $$
declare
  f regprocedure; veut text[]; vus text[];
begin
  for f, veut in
    select * from (values
      ('public.agenda_est_pro(uuid)'::regprocedure,     array['postgres','service_role']),
      ('public.agenda_hacher(text)'::regprocedure,      array['postgres','service_role']),
      ('public.agenda_flux_existe(text)'::regprocedure, array['postgres','service_role']),
      ('public.agenda_flux(text)'::regprocedure,        array['postgres','service_role']),
      ('public.agenda_jeton_creer()'::regprocedure,     array['authenticated','postgres','service_role']),
      ('public.agenda_jeton_revoquer()'::regprocedure,  array['authenticated','postgres','service_role']),
      ('public.agenda_jeton_etat()'::regprocedure,      array['authenticated','postgres','service_role'])
    ) v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut; end if;
  end loop;

  -- La table : personne d'autre que postgres / service_role.
  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.agenda_jetons'::regclass;
  if exists (select 1 from unnest(vus) g where g not in ('postgres','service_role')) then
    raise exception 'NEXUS: ACL agenda_jetons = %', vus;
  end if;
end $$;
