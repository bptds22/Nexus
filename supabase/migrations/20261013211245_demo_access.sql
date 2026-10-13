-- ════════════════════════════════════════════════════════════════════════════
-- /12octobre — accès à l'ENREGISTREMENT de la démo recruteurs, par jeton.
-- Décision BP 2026-10-13 : pas de liste blanche, pas de statut « en attente » :
-- toute demande valide est approuvée et reçoit son lien tout de suite ; l'admin
-- peut révoquer (et réactiver).
--
-- · demo_access : une ligne par courriel (lower). Une 2e demande du même
--   courriel met la ligne à jour et GARDE le jeton (le lien déjà envoyé reste
--   bon) ; elle ne réactive PAS un accès révoqué.
-- · Accès SERVEUR uniquement : RLS active, aucune policy, aucun privilège pour
--   anon / authenticated. Le formulaire et la page vidéo passent par une route
--   Next (service_role) ; l'admin par deux RPC gardées par is_admin().
-- · Limite de débit : réutilise demo_inscriptions_tentatives (empreinte d'IP
--   salée, jamais l'IP), 5 demandes par IP et par heure, 300 en tout.
-- ════════════════════════════════════════════════════════════════════════════

create type public.demo_access_status as enum ('approved', 'revoked');

create table public.demo_access (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name     text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name      text not null check (char_length(btrim(last_name)) between 1 and 80),
  -- Cégep : l'id du référentiel (autocomplétion existante) OU un texte libre
  -- (« Autre »), comme demo_inscriptions.
  cegep_id       uuid references public.schools(id) on delete set null,
  cegep_autre    text check (cegep_autre is null or char_length(cegep_autre) <= 160),
  sport_id       uuid references public.sports(id) on delete set null,
  role           text check (role is null or role in ('RECRUTEUR', 'ENTRAINEUR_CHEF', 'DIRECTEUR_SPORTS', 'AUTRE')),
  wants_1on1     boolean not null default false,
  consentement_le timestamptz not null default now(),
  token          uuid not null unique default gen_random_uuid(),
  status         public.demo_access_status not null default 'approved',
  revoked_at     timestamptz,
  last_viewed_at timestamptz,
  view_count     integer not null default 0,
  nb_demandes    integer not null default 1,
  created_at     timestamptz not null default now(),
  -- Envois (même modèle que demo_inscriptions : RÉCLAMÉ avant l'envoi).
  courriel_statut text not null default 'A_ENVOYER' check (courriel_statut in ('A_ENVOYER', 'EN_COURS', 'ENVOYE', 'ECHEC')),
  avis_statut     text not null default 'A_ENVOYER' check (avis_statut in ('A_ENVOYER', 'EN_COURS', 'ENVOYE', 'ECHEC')),
  envoi_erreur    text,
  constraint demo_access_revocation check ((status = 'revoked') = (revoked_at is not null))
);
create unique index demo_access_email_uniq on public.demo_access (lower(email));

alter table public.demo_access enable row level security;
revoke all on public.demo_access from public, anon, authenticated;

-- ── Demande (route Next, service_role) ────────────────────────────────────
-- Rend l'id et le jeton. p_ip : premier maillon de x-forwarded-for, lu par la
-- route ; seule son empreinte est gardée.
create function public.demo_access_demander(
  p_prenom text, p_nom text, p_courriel text,
  p_cegep_id uuid, p_cegep_autre text, p_sport_id uuid, p_role text,
  p_wants_1on1 boolean, p_consentement boolean, p_ip text
) returns table (id uuid, token uuid, status public.demo_access_status)
language plpgsql security definer set search_path = public as $$
declare
  v_empreinte text := encode(extensions.digest('nexus-demo-2026|' || coalesce(nullif(btrim(p_ip), ''), 'inconnue'), 'sha256'), 'hex');
  v_courriel text := lower(btrim(coalesce(p_courriel, '')));
begin
  delete from public.demo_inscriptions_tentatives where cree_le < now() - interval '1 day';
  if (select count(*) from public.demo_inscriptions_tentatives
       where ip_empreinte = v_empreinte and cree_le > now() - interval '1 hour') >= 5
     or (select count(*) from public.demo_inscriptions_tentatives where cree_le > now() - interval '1 hour') >= 300 then
    raise exception 'NEXUS: trop de tentatives, réessayez plus tard' using errcode = 'P0001';
  end if;
  insert into public.demo_inscriptions_tentatives (ip_empreinte) values (v_empreinte);

  if nullif(btrim(coalesce(p_prenom, '')), '') is null or nullif(btrim(coalesce(p_nom, '')), '') is null
     or v_courriel = '' then
    raise exception 'NEXUS: prénom, nom et courriel sont obligatoires' using errcode = '22023';
  end if;
  if v_courriel !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_courriel) > 200 then
    raise exception 'NEXUS: courriel invalide' using errcode = '22023';
  end if;
  if p_consentement is not true then
    raise exception 'NEXUS: consentement requis' using errcode = '22023';
  end if;
  if p_cegep_id is not null and not exists (select 1 from public.schools s where s.id = p_cegep_id and s.type = 'CEGEP') then
    raise exception 'NEXUS: cégep inconnu' using errcode = '22023';
  end if;
  if p_sport_id is not null and not exists (select 1 from public.sports s where s.id = p_sport_id) then
    raise exception 'NEXUS: sport inconnu' using errcode = '22023';
  end if;
  if p_role is not null and p_role not in ('RECRUTEUR', 'ENTRAINEUR_CHEF', 'DIRECTEUR_SPORTS', 'AUTRE') then
    raise exception 'NEXUS: rôle inconnu' using errcode = '22023';
  end if;

  return query
  insert into public.demo_access as d
    (email, first_name, last_name, cegep_id, cegep_autre, sport_id, role, wants_1on1)
  values
    (v_courriel, btrim(p_prenom), btrim(p_nom), p_cegep_id,
     case when p_cegep_id is null then nullif(btrim(coalesce(p_cegep_autre, '')), '') end,
     p_sport_id, p_role, coalesce(p_wants_1on1, false))
  on conflict (lower(email)) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    cegep_id = excluded.cegep_id, cegep_autre = excluded.cegep_autre,
    sport_id = excluded.sport_id, role = excluded.role,
    wants_1on1 = d.wants_1on1 or excluded.wants_1on1,
    consentement_le = now(), nb_demandes = d.nb_demandes + 1,
    -- Une nouvelle demande renvoie le lien (même jeton) ; rien pour un révoqué.
    courriel_statut = case when d.status = 'approved' then 'A_ENVOYER' else d.courriel_statut end,
    avis_statut = 'A_ENVOYER'
  returning d.id, d.token, d.status;
end $$;

-- ── Visionnement (page /12octobre/video, route serveur, service_role) ─────
-- Vrai seulement pour un jeton existant ET approuvé ; compte la vue.
create function public.demo_access_consulter(p_token uuid)
returns boolean
language sql security definer set search_path = public as $$
  with v as (
    update public.demo_access
       set view_count = view_count + 1, last_viewed_at = now()
     where token = p_token and status = 'approved'
    returning 1)
  select exists (select 1 from v)
$$;

-- ── Admin (/admin/demo-access) ─────────────────────────────────────────────
create function public.admin_demo_access_liste()
returns table (
  id uuid, first_name text, last_name text, email text, cegep text, sport text, role text,
  wants_1on1 boolean, token uuid, status public.demo_access_status, revoked_at timestamptz,
  view_count integer, last_viewed_at timestamptz, created_at timestamptz,
  courriel_statut text, envoi_erreur text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin' using errcode = '42501';
  end if;
  return query
  select d.id, d.first_name, d.last_name, d.email,
         coalesce(s.name, d.cegep_autre), sp.nom, d.role,
         d.wants_1on1, d.token, d.status, d.revoked_at,
         d.view_count, d.last_viewed_at, d.created_at,
         d.courriel_statut, d.envoi_erreur
    from public.demo_access d
    left join public.schools s on s.id = d.cegep_id
    left join public.sports sp on sp.id = d.sport_id
   order by d.created_at desc;
end $$;

create function public.admin_demo_access_statut(p_id uuid, p_status public.demo_access_status)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin' using errcode = '42501';
  end if;
  update public.demo_access
     set status = p_status,
         revoked_at = case when p_status = 'revoked' then now() end
   where id = p_id;
  if not found then
    raise exception 'NEXUS: demande introuvable' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.demo_access_demander(text, text, text, uuid, text, uuid, text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.demo_access_demander(text, text, text, uuid, text, uuid, text, boolean, boolean, text) to service_role;
revoke all on function public.demo_access_consulter(uuid) from public, anon, authenticated;
grant execute on function public.demo_access_consulter(uuid) to service_role;
revoke all on function public.admin_demo_access_liste() from public, anon, authenticated;
grant execute on function public.admin_demo_access_liste() to authenticated, service_role;
revoke all on function public.admin_demo_access_statut(uuid, public.demo_access_status) from public, anon, authenticated;
grant execute on function public.admin_demo_access_statut(uuid, public.demo_access_status) to authenticated, service_role;

-- ── Gates (listes complètes, jamais par inclusion) ─────────────────────────
do $$
declare r record; vus text[];
begin
  if not (select relrowsecurity from pg_class where oid = 'public.demo_access'::regclass) then
    raise exception 'NEXUS: RLS inactive sur demo_access';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'demo_access') then
    raise exception 'NEXUS: policy inattendue sur demo_access';
  end if;
  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.demo_access'::regclass;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de demo_access = %', vus;
  end if;

  for r in
    select * from (values
      ('public.demo_access_demander(text, text, text, uuid, text, uuid, text, boolean, boolean, text)', array['postgres', 'service_role']),
      ('public.demo_access_consulter(uuid)',                                                          array['postgres', 'service_role']),
      ('public.admin_demo_access_liste()',                                                            array['authenticated', 'postgres', 'service_role']),
      ('public.admin_demo_access_statut(uuid, public.demo_access_status)',                            array['authenticated', 'postgres', 'service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;
end $$;
