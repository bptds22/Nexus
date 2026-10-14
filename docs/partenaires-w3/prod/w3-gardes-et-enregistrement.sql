-- W3 en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f w3-releve-avant.sql -f <W3> -f <ce fichier>).
-- Une garde qui échoue (RAISE « NEXUS: ») annule TOUT : W3, l'historique et
-- admin_operations. Les témoins viennent de _w3_avant (w3-releve-avant.sql).
-- La chaîne dollar-quotée de _w3 (§3) est le fichier W3 copié OCTET POUR OCTET
-- depuis git show : ne pas éditer ce fichier à la main (le md5 de garde casserait).

-- ── 1. Rien de posé, rien d'évalué ─────────────────────────────────────────
do $$
begin
  if (select count(*) from public.partner_badges) <> 0 then
    raise exception 'NEXUS: partner_badges non vide';
  end if;
  if (select count(*) from public.partner_athlete_badges) <> 0 then
    raise exception 'NEXUS: partner_athlete_badges non vide';
  end if;
  if (select count(*) from public.partner_evaluation_retraits) <> 0 then
    raise exception 'NEXUS: partner_evaluation_retraits non vide';
  end if;
  if (select count(*) from public.partner_evaluations) <> 0 then
    raise exception 'NEXUS: une évaluation partenaire existe en prod';
  end if;
end $$;

-- ── 2. Ce que W3 ne doit jamais toucher : comparé au relevé avant ─────────
do $$
declare
  a _w3_avant%rowtype;
  v text;
begin
  select * into a from _w3_avant;

  if md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)) is distinct from a.badge_plafond then
    raise exception 'NEXUS: badge_plafond() a changé';
  end if;
  select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname) into v
    from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal;
  if v is distinct from a.triggers_athlete_badges then
    raise exception 'NEXUS: triggers d''athlete_badges changés : %', v;
  end if;
  if v not like '%trg_badge_plafond:badge_plafond:O%' then
    raise exception 'NEXUS: trg_badge_plafond absent ou désactivé';
  end if;

  select string_agg(p.oid::regprocedure::text || '=' || md5(pg_get_functiondef(p.oid)), ',' order by p.oid::regprocedure::text) into v
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'ambassadeur%';
  if v is distinct from a.fonctions_ambassadeur then
    raise exception 'NEXUS: fonctions ambassadeur (M10) changées';
  end if;
  select string_agg(c.relname || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgenabled::text, ',' order by c.relname, t.tgname) into v
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and t.tgfoid::regproc::text like '%ambassadeur%';
  if v is distinct from a.triggers_ambassadeur then
    raise exception 'NEXUS: triggers ambassadeur (M10) changés : %', v;
  end if;

  if (select string_agg(md5(pg_get_functiondef(p.oid)), ',') from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes')
     is distinct from 'c15481a07a3b98e3ae72f8917763a45a' then
    raise exception 'NEXUS: recruiter_search_athletes a changé (md5 attendu c15481a0…)';
  end if;
  if md5(pg_get_functiondef('public.calc_cote_globale()'::regprocedure)) is distinct from a.calc_cote_globale then
    raise exception 'NEXUS: calc_cote_globale a changé';
  end if;

  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || cote_globale::text || updated_at::text, ',' order by id), ''))
        from public.evaluations) is distinct from a.evaluations then
    raise exception 'NEXUS: evaluations a bougé';
  end if;
  if (select md5(coalesce(string_agg(id::text || ':' || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id), ''))
        from public.athletes) is distinct from a.cotes_coach then
    raise exception 'NEXUS: cotes des coachs ont bougé';
  end if;
  if (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || coalesce(retire_le::text, '∅'), ',' order by id), ''))
        from public.athlete_badges) is distinct from a.athlete_badges then
    raise exception 'NEXUS: athlete_badges a bougé';
  end if;
  select string_agg(p.oid::regprocedure::text || '=' || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text) into v
    from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('partenaire_evaluer_athlete', 'partenaire_evaluation_contexte',
                       'evaluations_partenaires_athlete', 'recruiter_search_athletes');
  if v is distinct from a.acl_w2 then
    raise exception 'NEXUS: droits des fonctions W2 changés';
  end if;
end $$;

-- ── 3. Droits : liste COMPLÈTE, jamais par inclusion ───────────────────────
do $$
declare
  f regprocedure;
  t regclass;
  v text;
begin
  foreach f in array array[
    'public.admin_badges_partenaire(uuid)'::regprocedure,
    'public.admin_enregistrer_badge_partenaire(uuid, uuid, text, text, boolean, integer)'::regprocedure,
    'public.partenaire_mes_badges()'::regprocedure,
    'public.partenaire_attribuer_badge(uuid, uuid)'::regprocedure,
    'public.retirer_badge_partenaire(uuid)'::regprocedure,
    'public.coach_masquer_badge_partenaire(uuid, boolean)'::regprocedure,
    'public.badges_partenaires_athlete(uuid)'::regprocedure,
    'public.retirer_evaluation_partenaire(uuid)'::regprocedure]
  loop
    select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
      into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = f;
    if v is distinct from 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE' then
      raise exception 'NEXUS: droits % = %', f, v;
    end if;
    if not (select prosecdef from pg_proc where oid = f) then
      raise exception 'NEXUS: % n''est pas SECURITY DEFINER', f;
    end if;
  end loop;

  foreach t in array array['public.partner_badges'::regclass,
                           'public.partner_athlete_badges'::regclass,
                           'public.partner_evaluation_retraits'::regclass]
  loop
    if not (select relrowsecurity from pg_class where oid = t) then
      raise exception 'NEXUS: RLS inactive sur %', t;
    end if;
    if exists (select 1 from pg_policies p where p.schemaname = 'public'
                 and p.tablename = (select relname from pg_class where oid = t)) then
      raise exception 'NEXUS: policy inattendue sur %', t;
    end if;
    if exists (select 1 from pg_class c, lateral aclexplode(c.relacl) a
                where c.oid = t and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) then
      raise exception 'NEXUS: privilège direct sur %', t;
    end if;
  end loop;

  -- Bucket des icônes : public en lecture, 512 Ko, PNG/WebP, écriture admin.
  if (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'partner-badges')
     is distinct from '(t,524288,"{image/png,image/webp}")' then
    raise exception 'NEXUS: bucket partner-badges inattendu : %',
      (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'partner-badges');
  end if;
  select string_agg(policyname || ':' || cmd || ':' || roles::text, ',' order by policyname) into v
    from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'partner badges%';
  if v is distinct from
     'partner badges admin delete:DELETE:{authenticated},partner badges admin insert:INSERT:{authenticated},partner badges admin update:UPDATE:{authenticated},partner badges read:SELECT:{public}' then
    raise exception 'NEXUS: policies du bucket partner-badges inattendues : %', v;
  end if;
end $$;

-- ── 4. Enregistrement : historique des migrations + admin_operations ───────
-- Version FIXE = nom du fichier (aucun renommage après coup). statements = le
-- fichier W3 tel que git show (fins de ligne Unix) ; son md5 est vérifié ici.
create temp table _w3 on commit drop as
select '20261014142700'::text as version,
       $w3$-- ═══════════════════════════════════════════════════════════════════════════
-- W3 — Badges PARTENAIRE + retrait par le partenaire (lots W3 et « C »).
--
-- Décisions BP (2026-10-14) :
--   · Badges spéciaux CRÉÉS PAR PARTENAIRE (ex. L'Esprit Sportif) : catalogue
--     propre à chaque organisation (partner_badges), géré par l'admin seul
--     (créer, nommer, icône). Posés seulement par CE partenaire ou un admin,
--     jamais proposés au coach ni à l'athlète.
--   · Table SÉPARÉE partner_athlete_badges : ne touche JAMAIS athlete_badges,
--     donc ni le plafond de 5 (trigger badge_plafond) ni la pose automatique
--     M10 (ambassadeur_recalculer_paliers). Ils ne comptent pas dans les 5.
--   · Même garde que W2 pour poser : partenaire_peut_evaluer() + athlète
--     admissible (is_partner_eligible_athlete) + ACTIF.
--   · Le coach de l'athlète peut MASQUER un badge partenaire (sans le
--     supprimer) et le réafficher. L'athlète ne le peut pas.
--   · Retrait : le partenaire retire SON évaluation ou SON badge ; l'admin
--     aussi ; jamais ceux d'un autre partenaire. Une trace est gardée (qui,
--     quand), jamais projetée :
--       - badge : retrait DOUX (retire_le / retire_par), comme athlete_badges ;
--       - évaluation : la ligne est SUPPRIMÉE (elle sort ainsi de toutes les
--         lectures, y compris le filtre « 4+ » de recruiter_search_athletes,
--         sans toucher cette fonction) et une copie part dans
--         partner_evaluation_retraits.
--   · Tout passe par des RPC SECURITY DEFINER : aucune policy, aucun
--     privilège direct sur les trois tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Catalogue des badges d'un partenaire ────────────────────────────────
create table public.partner_badges (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.media_partners(id) on delete cascade,
  libelle     text not null check (char_length(btrim(libelle)) between 2 and 40),
  -- Chemin dans le bucket partner-badges : « <partner_id>/<fichier> ».
  icone_path  text check (icone_path is null or icone_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'),
  actif       boolean not null default true,
  ordre       integer not null default 0,
  cree_par    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint partner_badges_libelle_key unique (partner_id, libelle)
);

comment on table public.partner_badges is
  'W3 : badges propres à un partenaire. Gérés par l''admin (RPC admin_*). Hors catalogue badges : jamais proposés au coach ni à l''athlète.';

alter table public.partner_badges enable row level security;
revoke all on public.partner_badges from public, anon, authenticated;

-- ── 2. Badges partenaire posés sur un athlète ──────────────────────────────
create table public.partner_athlete_badges (
  id               uuid primary key default gen_random_uuid(),
  partner_badge_id uuid not null references public.partner_badges(id) on delete cascade,
  athlete_id       uuid not null references public.athletes(id) on delete cascade,
  attribue_par     uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  -- Retrait (partenaire ou admin) : doux, la ligne reste comme trace.
  retire_le        timestamptz,
  retire_par       uuid references public.users(id) on delete set null,
  -- Masquage par le coach : le badge reste posé, il ne s'affiche plus.
  masque_le        timestamptz,
  masque_par       uuid references public.users(id) on delete set null,
  constraint partner_athlete_badges_retrait_coherent
    check ((retire_le is null and retire_par is null) or retire_le is not null),
  constraint partner_athlete_badges_masque_coherent
    check ((masque_le is null and masque_par is null) or masque_le is not null)
);

comment on table public.partner_athlete_badges is
  'W3 : badges partenaire posés. Table séparée d''athlete_badges : hors plafond de 5 (badge_plafond) et hors M10. Retrait doux ; masquage par le coach.';

-- Un même badge, une seule fois VIVANT par athlète (un retiré peut être reposé).
create unique index partner_athlete_badges_vivant_key
  on public.partner_athlete_badges (partner_badge_id, athlete_id) where retire_le is null;
create index partner_athlete_badges_athlete_idx on public.partner_athlete_badges (athlete_id);

alter table public.partner_athlete_badges enable row level security;
revoke all on public.partner_athlete_badges from public, anon, authenticated;

-- ── 3. Trace des évaluations retirées ──────────────────────────────────────
create table public.partner_evaluation_retraits (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null,
  partner_id    uuid,
  athlete_id    uuid,
  cote_globale  numeric(3,2),
  evaluation    jsonb not null,
  retire_par    uuid references public.users(id) on delete set null,
  retire_le     timestamptz not null default now()
);

comment on table public.partner_evaluation_retraits is
  'W3 : copie d''une évaluation partenaire au moment de son retrait (qui, quand). Jamais projetée ; lecture SQL admin seulement.';

alter table public.partner_evaluation_retraits enable row level security;
revoke all on public.partner_evaluation_retraits from public, anon, authenticated;

-- ── 4. Admin : catalogue des badges d'un partenaire ────────────────────────
create function public.admin_badges_partenaire(p_partner_id uuid)
returns table (id uuid, libelle text, icone_path text, actif boolean, ordre integer,
               poses integer, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin' using errcode = '42501';
  end if;
  return query
  select b.id, b.libelle, b.icone_path, b.actif, b.ordre,
         (select count(*)::int from public.partner_athlete_badges x
           where x.partner_badge_id = b.id and x.retire_le is null),
         b.created_at
    from public.partner_badges b
   where b.partner_id = p_partner_id
   order by b.ordre, b.libelle;
end $$;

-- Crée (p_id NULL) ou modifie un badge. Désactiver (p_actif = false) le
-- retire des fiches et du choix du partenaire, sans toucher les poses.
create function public.admin_enregistrer_badge_partenaire(
  p_id         uuid,
  p_partner_id uuid,
  p_libelle    text,
  p_icone_path text,
  p_actif      boolean default true,
  p_ordre      integer default 0
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.media_partners where id = p_partner_id) then
    raise exception 'NEXUS: partenaire introuvable' using errcode = 'P0002';
  end if;
  if p_icone_path is not null and split_part(p_icone_path, '/', 1) <> p_partner_id::text then
    raise exception 'NEXUS: l''icône doit être rangée sous le dossier du partenaire' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.partner_badges (partner_id, libelle, icone_path, actif, ordre, cree_par)
    values (p_partner_id, btrim(p_libelle), p_icone_path, coalesce(p_actif, true), coalesce(p_ordre, 0), auth.uid())
    returning id into v_id;
  else
    update public.partner_badges
       set libelle = btrim(p_libelle), icone_path = p_icone_path,
           actif = coalesce(p_actif, true), ordre = coalesce(p_ordre, 0), updated_at = now()
     where id = p_id and partner_id = p_partner_id
    returning id into v_id;
    if v_id is null then
      raise exception 'NEXUS: badge introuvable pour ce partenaire' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end $$;

-- ── 5. Partenaire : son catalogue (pour « Attribuer un badge ») ────────────
create function public.partenaire_mes_badges()
returns table (id uuid, libelle text, icone_path text)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select b.id, b.libelle, b.icone_path
    from public.partner_badges b
    join public.media_partners mp on mp.id = b.partner_id
   where mp.user_id = auth.uid()
     and b.actif
   order by b.ordre, b.libelle
$$;

-- ── 6. Poser un badge ──────────────────────────────────────────────────────
create function public.partenaire_attribuer_badge(p_athlete_id uuid, p_badge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_badge   public.partner_badges%rowtype;
  v_mp      public.media_partners%rowtype;
  v_sport   uuid;
  v_status  public.account_status;
  v_admin   boolean := public.is_admin();
  v_id      uuid;
begin
  select * into v_badge from public.partner_badges where id = p_badge_id;
  if not found or not v_badge.actif then
    raise exception 'NEXUS: badge introuvable ou désactivé' using errcode = 'P0002';
  end if;
  select * into v_mp from public.media_partners where id = v_badge.partner_id;

  select a.sport_id, a.status into v_sport, v_status from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if v_status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;
  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  if v_admin then
    -- L'admin pose au nom du partenaire : l'organisation doit être APPROUVÉE.
    if v_mp.status is distinct from 'APPROVED' then
      raise exception 'NEXUS: partenaire non approuvé' using errcode = '42501';
    end if;
  else
    -- Le partenaire : SES badges seulement, et la garde W2 complète.
    if v_mp.user_id is distinct from auth.uid() then
      raise exception 'NEXUS: ce badge appartient à un autre partenaire' using errcode = '42501';
    end if;
    if not public.partenaire_peut_evaluer(v_mp.id, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from public.partner_athlete_badges
              where partner_badge_id = p_badge_id and athlete_id = p_athlete_id and retire_le is null) then
    raise exception 'NEXUS: ce badge est déjà attribué à cet athlète' using errcode = '23505';
  end if;

  insert into public.partner_athlete_badges (partner_badge_id, athlete_id, attribue_par)
  values (p_badge_id, p_athlete_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ── 7. Retirer un badge (partenaire propriétaire ou admin) ─────────────────
create function public.retirer_badge_partenaire(p_attribution_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_owner uuid;
  v_retire timestamptz;
begin
  select mp.user_id, x.retire_le into v_owner, v_retire
    from public.partner_athlete_badges x
    join public.partner_badges b on b.id = x.partner_badge_id
    join public.media_partners mp on mp.id = b.partner_id
   where x.id = p_attribution_id;
  if not found then
    raise exception 'NEXUS: badge introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or v_owner is not distinct from auth.uid()) then
    raise exception 'NEXUS: seul le partenaire qui a posé ce badge, ou un admin, peut le retirer' using errcode = '42501';
  end if;
  if v_retire is not null then
    raise exception 'NEXUS: badge déjà retiré' using errcode = '22023';
  end if;
  update public.partner_athlete_badges
     set retire_le = now(), retire_par = auth.uid()
   where id = p_attribution_id;
end $$;

-- ── 8. Masquer / réafficher (coach de l'athlète, ou admin) ─────────────────
create function public.coach_masquer_badge_partenaire(p_attribution_id uuid, p_masque boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_athlete uuid;
begin
  select x.athlete_id into v_athlete
    from public.partner_athlete_badges x
   where x.id = p_attribution_id and x.retire_le is null;
  if not found then
    raise exception 'NEXUS: badge introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or public.coach_can_award_badge(v_athlete)) then
    raise exception 'NEXUS: seul le coach de l''athlète peut masquer ce badge' using errcode = '42501';
  end if;
  update public.partner_athlete_badges
     set masque_le  = case when p_masque then now() end,
         masque_par = case when p_masque then auth.uid() end
   where id = p_attribution_id;
end $$;

-- ── 9. Lecture des badges partenaire d'un athlète ──────────────────────────
-- Mêmes lecteurs que evaluations_partenaires_athlete (W2). Un badge masqué
-- n'est rendu qu'au coach / à la direction de l'athlète, à l'admin et au
-- partenaire qui l'a posé (pour qu'ils voient l'état) ; jamais au recruteur,
-- à l'athlète ni à un autre partenaire.
create function public.badges_partenaires_athlete(p_athlete_id uuid)
returns table (id uuid, badge_id uuid, libelle text, icone_path text, organisation text,
               created_at timestamptz, est_masque boolean, est_le_mien boolean, peut_masquer boolean)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout
  )
  select x.id, b.id, b.libelle, b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach)
    from public.partner_athlete_badges x
    join public.partner_badges b on b.id = x.partner_badge_id and b.actif
    join public.media_partners mp on mp.id = b.partner_id and mp.status = 'APPROVED'
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
   order by x.created_at
$$;

-- ── 10. Retirer une évaluation partenaire (partenaire propriétaire ou admin)
create function public.retirer_evaluation_partenaire(p_evaluation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_pe    public.partner_evaluations%rowtype;
  v_owner uuid;
begin
  select * into v_pe from public.partner_evaluations where id = p_evaluation_id for update;
  if not found then
    raise exception 'NEXUS: évaluation introuvable' using errcode = 'P0002';
  end if;
  select mp.user_id into v_owner from public.media_partners mp where mp.id = v_pe.partner_id;
  if not (public.is_admin() or v_owner is not distinct from auth.uid()) then
    raise exception 'NEXUS: seul le partenaire auteur, ou un admin, peut retirer cette évaluation' using errcode = '42501';
  end if;

  insert into public.partner_evaluation_retraits
    (evaluation_id, partner_id, athlete_id, cote_globale, evaluation, retire_par)
  values (v_pe.id, v_pe.partner_id, v_pe.athlete_id, v_pe.cote_globale, to_jsonb(v_pe), auth.uid());

  delete from public.partner_evaluations where id = p_evaluation_id;
end $$;

-- ── 11. Droits d'exécution ─────────────────────────────────────────────────
revoke all on function public.admin_badges_partenaire(uuid) from public, anon, authenticated;
revoke all on function public.admin_enregistrer_badge_partenaire(uuid, uuid, text, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.partenaire_mes_badges() from public, anon, authenticated;
revoke all on function public.partenaire_attribuer_badge(uuid, uuid) from public, anon, authenticated;
revoke all on function public.retirer_badge_partenaire(uuid) from public, anon, authenticated;
revoke all on function public.coach_masquer_badge_partenaire(uuid, boolean) from public, anon, authenticated;
revoke all on function public.badges_partenaires_athlete(uuid) from public, anon, authenticated;
revoke all on function public.retirer_evaluation_partenaire(uuid) from public, anon, authenticated;

grant execute on function public.admin_badges_partenaire(uuid) to authenticated, service_role;
grant execute on function public.admin_enregistrer_badge_partenaire(uuid, uuid, text, text, boolean, integer) to authenticated, service_role;
grant execute on function public.partenaire_mes_badges() to authenticated, service_role;
grant execute on function public.partenaire_attribuer_badge(uuid, uuid) to authenticated, service_role;
grant execute on function public.retirer_badge_partenaire(uuid) to authenticated, service_role;
grant execute on function public.coach_masquer_badge_partenaire(uuid, boolean) to authenticated, service_role;
grant execute on function public.badges_partenaires_athlete(uuid) to authenticated, service_role;
grant execute on function public.retirer_evaluation_partenaire(uuid) to authenticated, service_role;

-- ── 12. Icônes : bucket public en lecture, écriture admin seulement ────────
-- PNG / WebP seulement : un SVG servi depuis le stockage pourrait porter du
-- script si on l'ouvre directement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-badges', 'partner-badges', true, 524288, array['image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le rollback laisse le bucket et sa lecture publique : on repose à neuf.
drop policy if exists "partner badges read" on storage.objects;
create policy "partner badges read" on storage.objects
  for select to public using (bucket_id = 'partner-badges');
create policy "partner badges admin insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'partner-badges' and public.is_admin());
create policy "partner badges admin update" on storage.objects
  for update to authenticated using (bucket_id = 'partner-badges' and public.is_admin())
  with check (bucket_id = 'partner-badges' and public.is_admin());
create policy "partner badges admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'partner-badges' and public.is_admin());

-- ── Gates (comparaison complète, jamais par inclusion) ─────────────────────
do $$
declare
  f    regprocedure;
  t    regclass;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  foreach f in array array[
    'public.admin_badges_partenaire(uuid)'::regprocedure,
    'public.admin_enregistrer_badge_partenaire(uuid, uuid, text, text, boolean, integer)'::regprocedure,
    'public.partenaire_mes_badges()'::regprocedure,
    'public.partenaire_attribuer_badge(uuid, uuid)'::regprocedure,
    'public.retirer_badge_partenaire(uuid)'::regprocedure,
    'public.coach_masquer_badge_partenaire(uuid, boolean)'::regprocedure,
    'public.badges_partenaires_athlete(uuid)'::regprocedure,
    'public.retirer_evaluation_partenaire(uuid)'::regprocedure]
  loop
    select array_agg(x.g order by x.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(a,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as a) x
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;

  foreach t in array array['public.partner_badges'::regclass,
                           'public.partner_athlete_badges'::regclass,
                           'public.partner_evaluation_retraits'::regclass]
  loop
    if not (select relrowsecurity from pg_class where oid = t) then
      raise exception 'NEXUS: RLS inactive sur %', t;
    end if;
    if exists (select 1 from pg_policies p join pg_class c on c.relname = p.tablename
                where p.schemaname = 'public' and c.oid = t) then
      raise exception 'NEXUS: policy inattendue sur %', t;
    end if;
    select array_agg(g.nom || ':' || a.privilege_type order by g.nom, a.privilege_type) into vus
      from pg_class c,
           lateral aclexplode(c.relacl) a,
           lateral (select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as nom) g
     where c.oid = t and g.nom in ('anon', 'authenticated', 'PUBLIC');
    if vus is not null then
      raise exception 'NEXUS: privilèges directs sur % : %', t, vus;
    end if;
  end loop;

  -- Ce que W3 ne doit jamais toucher : le plafond et M10 restent sur athlete_badges.
  if not exists (select 1 from pg_trigger where tgrelid = 'public.athlete_badges'::regclass
                  and tgfoid = 'public.badge_plafond()'::regprocedure) then
    raise exception 'NEXUS: trigger badge_plafond absent d''athlete_badges';
  end if;
  if exists (select 1 from pg_trigger where tgrelid in ('public.partner_athlete_badges'::regclass,
                                                       'public.partner_badges'::regclass,
                                                       'public.partner_evaluation_retraits'::regclass)
                and not tgisinternal) then
    raise exception 'NEXUS: trigger inattendu sur les tables W3';
  end if;
end $$;
$w3$::text as contenu;

do $$
begin
  if (select md5(contenu) from _w3) <> 'e8287957202ba065efc271ea1ebd12f6' then
    raise exception 'NEXUS: contenu W3 embarqué altéré (md5 %)', (select md5(contenu) from _w3);
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'w3_partenaire_badges_retrait', array[contenu], 'bptds22@gmail.com' from _w3;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W3_PARTENAIRE_BADGES_RETRAIT',
       'W3 Partenaire : badges partenaire (partner_badges, partner_athlete_badges, bucket partner-badges) + retrait d''évaluation et de badge par le partenaire (GO BP 2026-10-14)',
       jsonb_build_object(
         'nom', 'w3_partenaire_badges_retrait',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_w3_partenaire_badges_retrait.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_w3_partenaire_badges_retrait.sql',
         'voie', 'psql -1 (session pooler) : relevé avant + migration + gardes dans une seule transaction',
         'md5_fichier', 'e8287957202ba065efc271ea1ebd12f6',
         'md5_recruiter_search_athletes', 'c15481a07a3b98e3ae72f8917763a45a (inchangé)',
         'acl_fonctions_w3', 'authenticated,postgres,service_role (x8)',
         'tables_w3_lignes', 0,
         'partner_evaluations_lignes', 0,
         'badge_plafond_et_m10', 'inchangés (md5 et triggers comparés au relevé avant)',
         'bucket', 'partner-badges public, 512 Ko, PNG/WebP, écriture admin'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _w3;

select version as version_w3_enregistree from _w3;
