-- D1 — Empêcher les NOUVEAUX doublons d'athlètes (base seulement). Plan validé par BP le 2026-10-15.
--
-- Diagnostic du 2026-10-15 : 4 doublons probables en prod, tous des jeunes inscrits DEUX FOIS
-- avec deux comptes (faute de frappe dans le courriel, inscription abandonnée puis reprise,
-- un compte par sport). Rien ne comparait le nom et la date de naissance à la création.
-- Cette migration ne touche à AUCUNE fiche existante — les 4 doublons restent tels quels.
--
--  · doublons_probables : la file de l'ADMIN. RLS active, AUCUNE politique, aucun droit pour
--    anon/authenticated. Une ligne par PAIRE de fiches (ordre indifférent), jamais deux.
--  · doublons_probables_noter() : trigger AFTER INSERT/UPDATE (nom, date de naissance, statut)
--    sur athletes. Même nom normalisé (nexus_normaliser_nom, celui de la pastille admin
--    « Doublon probable ») + même date de naissance qu'une autre fiche ACTIVE → la paire va
--    dans la file. Il NE BLOQUE JAMAIS l'écriture : une erreur interne devient un WARNING.
--    Il couvre tous les chemins — web, appli mobile déjà publiée, coach, athlète — sans build.
--  · inscription_doublon_possible() : l'avertissement de l'inscription athlète. Ne rend
--    qu'un code ('COMPTE' / 'FICHE_COACH' / null), jamais rien de l'autre fiche. Réservée à un
--    compte ATHLETE dont l'onboarding n'est pas terminé.
--  · coach_athletes_meme_identite() : le contrôle de l'assistant coach. SECURITY INVOKER : elle
--    ne lit QUE les fiches que la RLS laisse déjà voir à ce coach. Un mineur que le coach ne
--    voit pas ne sort pas — le trigger le note pour l'admin, et le coach n'en apprend rien.

do $$
begin
  if to_regclass('public.doublons_probables') is not null then
    raise exception 'NEXUS: D1 déjà appliquée (doublons_probables existe)';
  end if;
  if to_regprocedure('public.nexus_normaliser_nom(text)') is null then
    raise exception 'NEXUS: nexus_normaliser_nom(text) introuvable';
  end if;
end $$;

-- ── La file de l'admin ───────────────────────────────────────────────────────

create table public.doublons_probables (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athletes(id) on delete cascade,
  athlete_existant_id uuid not null references public.athletes(id) on delete cascade,
  -- Qui écrivait la fiche quand la paire est apparue : l'athlète lui-même, son coach, ou
  -- autre chose (admin, service, opération en lot).
  source              text not null check (source in ('ATHLETE', 'COACH', 'AUTRE')),
  operation           text not null check (operation in ('INSERT', 'UPDATE')),
  meme_ecole          boolean not null default false,
  ecrit_par           uuid,
  statut              text not null default 'A_TRAITER' check (statut in ('A_TRAITER', 'FUSIONNE', 'PAS_UN_DOUBLON')),
  created_at          timestamptz not null default now(),
  check (athlete_id <> athlete_existant_id)
);
create unique index doublons_probables_paire_uidx
  on public.doublons_probables (least(athlete_id, athlete_existant_id), greatest(athlete_id, athlete_existant_id));
create index doublons_probables_existant_idx on public.doublons_probables (athlete_existant_id);

alter table public.doublons_probables enable row level security;
revoke all on public.doublons_probables from public, anon, authenticated;

comment on table public.doublons_probables is
  'D1 (2026-10-15) — paires de fiches athlètes probablement en double (même nom normalisé + même date de naissance). ADMIN seulement : RLS sans politique. Rien n''y est fusionné automatiquement.';

-- ── Le trigger : noter, jamais bloquer ───────────────────────────────────────

create or replace function public.doublons_probables_noter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom    text;
  v_uid    uuid := auth.uid();
  v_source text;
begin
  if tg_op = 'UPDATE'
     and old.first_name is not distinct from new.first_name
     and old.last_name is not distinct from new.last_name
     and old.date_naissance is not distinct from new.date_naissance
     and old.status is not distinct from new.status then
    return null;
  end if;
  if new.status = 'SUPPRIME'::public.account_status or new.date_naissance is null
     or coalesce(btrim(new.first_name), '') = '' or coalesce(btrim(new.last_name), '') = '' then
    return null;
  end if;

  begin
    v_nom := public.nexus_normaliser_nom(new.first_name || ' ' || new.last_name);
    v_source := case
      when v_uid is not null and v_uid = new.user_id  then 'ATHLETE'
      when v_uid is not null and v_uid = new.coach_id then 'COACH'
      else 'AUTRE' end;

    insert into public.doublons_probables (athlete_id, athlete_existant_id, source, operation, meme_ecole, ecrit_par)
    select new.id, a.id, v_source, tg_op, coalesce(a.school_id = new.school_id, false), v_uid
      from public.athletes a
     where a.id <> new.id
       and a.status = 'ACTIF'::public.account_status
       and a.date_naissance = new.date_naissance
       and public.nexus_normaliser_nom(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) = v_nom
    on conflict do nothing;
  exception when others then
    -- Une inscription ou une création de fiche ne doit JAMAIS échouer à cause de la file.
    raise warning 'NEXUS doublons_probables_noter (fiche %) : % %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$$;

create trigger trg_doublons_probables_noter
  after insert or update of first_name, last_name, date_naissance, status on public.athletes
  for each row execute function public.doublons_probables_noter();

-- ── L'avertissement de l'inscription athlète ─────────────────────────────────

create or replace function public.inscription_doublon_possible(p_prenom text, p_nom text, p_date_naissance date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_courriel text;
  v_nom     text := public.nexus_normaliser_nom(coalesce(p_prenom, '') || ' ' || coalesce(p_nom, ''));
  v_compte  boolean;
begin
  -- Seulement pendant l'inscription d'un athlète : hors de là, la fonction ne répond rien.
  if v_uid is null or p_date_naissance is null or v_nom is null
     or coalesce(btrim(p_prenom), '') = '' or coalesce(btrim(p_nom), '') = ''
     or not exists (select 1 from public.users u
                     where u.id = v_uid and u.role = 'ATHLETE'::public.user_role
                       and u.onboarding_complete is not true) then
    return null;
  end if;
  select lower(btrim(email)) into v_courriel from auth.users where id = v_uid;

  select bool_or(a.user_id is not null) into v_compte
    from public.athletes a
   where a.status = 'ACTIF'::public.account_status
     and a.date_naissance = p_date_naissance
     and a.user_id is distinct from v_uid
     -- Fiche de coach portant SON courriel : elle lui revient déjà (rattachement à
     -- l'inscription, ou fenêtre « réclamer »). Ce n'est pas un doublon à signaler.
     and not (a.user_id is null and lower(btrim(coalesce(a.email, ''))) = coalesce(v_courriel, ''))
     and public.nexus_normaliser_nom(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) = v_nom;

  return case when v_compte is null then null when v_compte then 'COMPTE' else 'FICHE_COACH' end;
end;
$$;

-- ── Le contrôle de l'assistant coach ─────────────────────────────────────────
-- SECURITY INVOKER, et c'est tout le point : la RLS de athletes décide de ce qui sort.
-- Ce que le coach lit ici, il pouvait déjà l'ouvrir ; ce qu'il ne voit pas n'existe pas pour lui.

create or replace function public.coach_athletes_meme_identite(p_prenom text, p_nom text, p_date_naissance date)
returns table (athlete_id uuid, prenom text, nom text, ecole text, est_le_mien boolean, a_un_compte boolean, courriel text)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.first_name, a.last_name, s.name, a.coach_id = auth.uid(), a.user_id is not null, a.email
    from public.athletes a
    left join public.schools s on s.id = a.school_id
   where public.is_coach()
     and p_date_naissance is not null
     and coalesce(btrim(p_prenom), '') <> '' and coalesce(btrim(p_nom), '') <> ''
     and a.status = 'ACTIF'::public.account_status
     and a.date_naissance = p_date_naissance
     and public.nexus_normaliser_nom(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, ''))
         = public.nexus_normaliser_nom(p_prenom || ' ' || p_nom)
   order by a.created_at
   limit 3;
$$;

revoke all on function public.doublons_probables_noter() from public, anon, authenticated;
revoke all on function public.inscription_doublon_possible(text, text, date) from public, anon, authenticated;
revoke all on function public.coach_athletes_meme_identite(text, text, date) from public, anon, authenticated;
grant execute on function public.inscription_doublon_possible(text, text, date) to authenticated;
grant execute on function public.coach_athletes_meme_identite(text, text, date) to authenticated;

-- ── Garde finale : ACL comparées EN ENTIER (règle du 2026-09-07) ─────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('doublons_probables_noter', 'inscription_doublon_possible', 'coach_athletes_meme_identite')
  loop
    veut := case when r.proname = 'doublons_probables_noter' then array['postgres', 'service_role']
                 else array['authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('doublons_probables_noter', 'inscription_doublon_possible', 'coach_athletes_meme_identite')) <> 3 then
    raise exception 'NEXUS: 3 fonctions D1 attendues';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.coach_athletes_meme_identite(text,text,date)'::regprocedure) then
    raise exception 'NEXUS: coach_athletes_meme_identite doit rester SECURITY INVOKER (la RLS fait la frontière)';
  end if;
  if exists (select 1 from pg_class c
              where c.oid = 'public.doublons_probables'::regclass
                and (not c.relrowsecurity
                     or exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                                 where split_part(a::text, '=', 1) in ('anon', 'authenticated', '')))) then
    raise exception 'NEXUS: doublons_probables lisible par anon/authenticated ou sans RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'doublons_probables') then
    raise exception 'NEXUS: aucune politique attendue sur doublons_probables';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass
        and tgname = 'trg_doublons_probables_noter') <> 1 then
    raise exception 'NEXUS: trigger trg_doublons_probables_noter absent';
  end if;
  if (select count(*) from public.doublons_probables) <> 0 then
    raise exception 'NEXUS: la file doit naître vide (aucune fiche existante n''est touchée)';
  end if;
  raise notice 'NEXUS D1 : file doublons_probables (RLS, aucun droit direct), trigger, 2 fonctions, ACL exactes — OK';
end $$;
