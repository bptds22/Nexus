-- LOT PROD D1 — généré par docs/doublons-d1/prod/construire-lot.mjs
-- Fichier : supabase/migrations/20261015094834_d1_doublons_athletes.sql — md5 08ebd51e91cecf8aacaca825e204390c
-- Empreinte attendue des objets : 9903dd903ab3c21af5407e6707986b89
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _d1_releve as
select txid_current() as txid,
       (select count(*) from public.athletes) as athletes,
       md5(coalesce((select string_agg(id::text || coalesce(first_name, '') || coalesce(last_name, '') || coalesce(date_naissance::text, '') || status::text, ',' order by id) from public.athletes), '')) as athletes_md5,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261015094834') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       to_regclass('public.doublons_probables') is not null or to_regclass('public.doublons_verifications') is not null as tables_deja,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _d1_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _d1_releve) <> 0 or (select tables_deja from _d1_releve) then
    raise exception 'NEXUS LOT: D1 déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261015094834_d1_doublons_athletes.sql =====
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
--    compte ATHLETE dont l'onboarding n'est pas terminé. ANTI-ÉNUMÉRATION (décision BP
--    2026-10-15) : 3 vérifications par compte, puis toujours « aucun doublon » ; chaque appel
--    est journalisé dans doublons_verifications (admin seulement, sans le nom cherché), purgé
--    après 180 jours.
--  · coach_athletes_meme_identite() : le contrôle de l'assistant coach. SECURITY INVOKER : elle
--    ne lit QUE les fiches que la RLS laisse déjà voir à ce coach. Un mineur que le coach ne
--    voit pas ne sort pas — le trigger le note pour l'admin, et le coach n'en apprend rien.

do $$
begin
  if to_regclass('public.doublons_probables') is not null or to_regclass('public.doublons_verifications') is not null then
    raise exception 'NEXUS: D1 déjà appliquée (doublons_probables ou doublons_verifications existe)';
  end if;
  if exists (select 1 from cron.job where jobname = 'doublons-verifications-purge') then
    raise exception 'NEXUS: tâche doublons-verifications-purge déjà présente';
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

-- ── Le journal des vérifications (anti-énumération) ──────────────────────────
-- Sans le nom ni la date cherchés : le journal dit QUI a vérifié, QUAND et ce qu'il a obtenu.
-- Un compte qui cherche des identités en série s'y voit à son nombre d'appels.

create table public.doublons_verifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  appel      int not null check (appel >= 1),
  resultat   text not null check (resultat in ('AUCUN', 'COMPTE', 'FICHE_COACH', 'LIMITE', 'HORS_INSCRIPTION')),
  created_at timestamptz not null default now()
);
create index doublons_verifications_user_idx on public.doublons_verifications (user_id, created_at);

alter table public.doublons_verifications enable row level security;
revoke all on public.doublons_verifications from public, anon, authenticated;

comment on table public.doublons_verifications is
  'D1 (2026-10-15) — journal des appels à inscription_doublon_possible (anti-énumération : 3 par compte). ADMIN seulement : RLS sans politique. Ni nom ni date cherchés. Purge à 180 jours.';

select cron.schedule('doublons-verifications-purge', '23 4 * * *',
  $cron$delete from public.doublons_verifications where created_at < now() - interval '180 days'$cron$);

-- ── L'avertissement de l'inscription athlète ─────────────────────────────────

create or replace function public.inscription_doublon_possible(p_prenom text, p_nom text, p_date_naissance date)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c_max_appels constant int := 3;   -- décision BP 2026-10-15
  v_uid     uuid := auth.uid();
  v_courriel text;
  v_nom     text := public.nexus_normaliser_nom(coalesce(p_prenom, '') || ' ' || coalesce(p_nom, ''));
  v_compte  boolean;
  v_appel   int;
  v_res     text;
begin
  if v_uid is null then
    return null;
  end if;
  -- Deux appels simultanés du même compte ne doivent pas passer tous deux sous la limite.
  perform pg_advisory_xact_lock(hashtext('doublons_verifications:' || v_uid::text));
  select count(*) + 1 into v_appel from public.doublons_verifications where user_id = v_uid;

  -- Seulement pendant l'inscription d'un athlète : hors de là, la fonction ne répond rien.
  if not exists (select 1 from public.users u
                  where u.id = v_uid and u.role = 'ATHLETE'::public.user_role
                    and u.onboarding_complete is not true) then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'HORS_INSCRIPTION');
    return null;
  end if;
  -- Au-delà de la limite : toujours « aucun doublon », sans même chercher.
  if v_appel > c_max_appels then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'LIMITE');
    return null;
  end if;
  if p_date_naissance is null or v_nom is null
     or coalesce(btrim(p_prenom), '') = '' or coalesce(btrim(p_nom), '') = '' then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'AUCUN');
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

  v_res := case when v_compte is null then null when v_compte then 'COMPTE' else 'FICHE_COACH' end;
  insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, coalesce(v_res, 'AUCUN'));
  return v_res;
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
              where c.oid in ('public.doublons_probables'::regclass, 'public.doublons_verifications'::regclass)
                and (not c.relrowsecurity
                     or exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                                 where split_part(a::text, '=', 1) in ('anon', 'authenticated', '')))) then
    raise exception 'NEXUS: une table D1 est lisible par anon/authenticated ou sans RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('doublons_probables', 'doublons_verifications')) then
    raise exception 'NEXUS: aucune politique attendue sur les tables D1';
  end if;
  if (select count(*) from cron.job where jobname = 'doublons-verifications-purge') <> 1 then
    raise exception 'NEXUS: tâche de purge du journal absente ou en double';
  end if;
  if (select provolatile from pg_proc where oid = 'public.inscription_doublon_possible(text,text,date)'::regprocedure) <> 'v' then
    raise exception 'NEXUS: inscription_doublon_possible doit être VOLATILE (elle journalise)';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass
        and tgname = 'trg_doublons_probables_noter') <> 1 then
    raise exception 'NEXUS: trigger trg_doublons_probables_noter absent';
  end if;
  if (select count(*) from public.doublons_probables) <> 0 or (select count(*) from public.doublons_verifications) <> 0 then
    raise exception 'NEXUS: les tables D1 doivent naître vides (aucune fiche existante n''est touchée)';
  end if;
  raise notice 'NEXUS D1 : doublons_probables + doublons_verifications (RLS, aucun droit direct), trigger, 2 fonctions, ACL exactes, purge planifiée — OK';
end $$;

-- ===== FIN 20261015094834_d1_doublons_athletes.sql =====

-- 4. Enregistrement de la version (même forme que W4a : statements = le fichier).
--    created_by existe en prod, pas dans la base locale (CLI plus ancienne) : même lot aux deux endroits.
create temp table _d1_texte as select $D1MIG$-- D1 — Empêcher les NOUVEAUX doublons d'athlètes (base seulement). Plan validé par BP le 2026-10-15.
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
--    compte ATHLETE dont l'onboarding n'est pas terminé. ANTI-ÉNUMÉRATION (décision BP
--    2026-10-15) : 3 vérifications par compte, puis toujours « aucun doublon » ; chaque appel
--    est journalisé dans doublons_verifications (admin seulement, sans le nom cherché), purgé
--    après 180 jours.
--  · coach_athletes_meme_identite() : le contrôle de l'assistant coach. SECURITY INVOKER : elle
--    ne lit QUE les fiches que la RLS laisse déjà voir à ce coach. Un mineur que le coach ne
--    voit pas ne sort pas — le trigger le note pour l'admin, et le coach n'en apprend rien.

do $$
begin
  if to_regclass('public.doublons_probables') is not null or to_regclass('public.doublons_verifications') is not null then
    raise exception 'NEXUS: D1 déjà appliquée (doublons_probables ou doublons_verifications existe)';
  end if;
  if exists (select 1 from cron.job where jobname = 'doublons-verifications-purge') then
    raise exception 'NEXUS: tâche doublons-verifications-purge déjà présente';
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

-- ── Le journal des vérifications (anti-énumération) ──────────────────────────
-- Sans le nom ni la date cherchés : le journal dit QUI a vérifié, QUAND et ce qu'il a obtenu.
-- Un compte qui cherche des identités en série s'y voit à son nombre d'appels.

create table public.doublons_verifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  appel      int not null check (appel >= 1),
  resultat   text not null check (resultat in ('AUCUN', 'COMPTE', 'FICHE_COACH', 'LIMITE', 'HORS_INSCRIPTION')),
  created_at timestamptz not null default now()
);
create index doublons_verifications_user_idx on public.doublons_verifications (user_id, created_at);

alter table public.doublons_verifications enable row level security;
revoke all on public.doublons_verifications from public, anon, authenticated;

comment on table public.doublons_verifications is
  'D1 (2026-10-15) — journal des appels à inscription_doublon_possible (anti-énumération : 3 par compte). ADMIN seulement : RLS sans politique. Ni nom ni date cherchés. Purge à 180 jours.';

select cron.schedule('doublons-verifications-purge', '23 4 * * *',
  $cron$delete from public.doublons_verifications where created_at < now() - interval '180 days'$cron$);

-- ── L'avertissement de l'inscription athlète ─────────────────────────────────

create or replace function public.inscription_doublon_possible(p_prenom text, p_nom text, p_date_naissance date)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c_max_appels constant int := 3;   -- décision BP 2026-10-15
  v_uid     uuid := auth.uid();
  v_courriel text;
  v_nom     text := public.nexus_normaliser_nom(coalesce(p_prenom, '') || ' ' || coalesce(p_nom, ''));
  v_compte  boolean;
  v_appel   int;
  v_res     text;
begin
  if v_uid is null then
    return null;
  end if;
  -- Deux appels simultanés du même compte ne doivent pas passer tous deux sous la limite.
  perform pg_advisory_xact_lock(hashtext('doublons_verifications:' || v_uid::text));
  select count(*) + 1 into v_appel from public.doublons_verifications where user_id = v_uid;

  -- Seulement pendant l'inscription d'un athlète : hors de là, la fonction ne répond rien.
  if not exists (select 1 from public.users u
                  where u.id = v_uid and u.role = 'ATHLETE'::public.user_role
                    and u.onboarding_complete is not true) then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'HORS_INSCRIPTION');
    return null;
  end if;
  -- Au-delà de la limite : toujours « aucun doublon », sans même chercher.
  if v_appel > c_max_appels then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'LIMITE');
    return null;
  end if;
  if p_date_naissance is null or v_nom is null
     or coalesce(btrim(p_prenom), '') = '' or coalesce(btrim(p_nom), '') = '' then
    insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, 'AUCUN');
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

  v_res := case when v_compte is null then null when v_compte then 'COMPTE' else 'FICHE_COACH' end;
  insert into public.doublons_verifications (user_id, appel, resultat) values (v_uid, v_appel, coalesce(v_res, 'AUCUN'));
  return v_res;
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
              where c.oid in ('public.doublons_probables'::regclass, 'public.doublons_verifications'::regclass)
                and (not c.relrowsecurity
                     or exists (select 1 from unnest(coalesce(c.relacl, '{}'::aclitem[])) a
                                 where split_part(a::text, '=', 1) in ('anon', 'authenticated', '')))) then
    raise exception 'NEXUS: une table D1 est lisible par anon/authenticated ou sans RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
               and tablename in ('doublons_probables', 'doublons_verifications')) then
    raise exception 'NEXUS: aucune politique attendue sur les tables D1';
  end if;
  if (select count(*) from cron.job where jobname = 'doublons-verifications-purge') <> 1 then
    raise exception 'NEXUS: tâche de purge du journal absente ou en double';
  end if;
  if (select provolatile from pg_proc where oid = 'public.inscription_doublon_possible(text,text,date)'::regprocedure) <> 'v' then
    raise exception 'NEXUS: inscription_doublon_possible doit être VOLATILE (elle journalise)';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass
        and tgname = 'trg_doublons_probables_noter') <> 1 then
    raise exception 'NEXUS: trigger trg_doublons_probables_noter absent';
  end if;
  if (select count(*) from public.doublons_probables) <> 0 or (select count(*) from public.doublons_verifications) <> 0 then
    raise exception 'NEXUS: les tables D1 doivent naître vides (aucune fiche existante n''est touchée)';
  end if;
  raise notice 'NEXUS D1 : doublons_probables + doublons_verifications (RLS, aucun droit direct), trigger, 2 fonctions, ACL exactes, purge planifiée — OK';
end $$;
$D1MIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _d1_texte' using '20261015094834', 'd1_doublons_athletes', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _d1_texte' using '20261015094834', 'd1_doublons_athletes';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _d1_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015094834')
     is distinct from '08ebd51e91cecf8aacaca825e204390c' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('doublons_probables_noter', 'inscription_doublon_possible', 'coach_athletes_meme_identite')
  union all
  select 'col:' || table_name || '.' || column_name || '|' || data_type || '|' || coalesce(column_default, '')
         || '|' || is_nullable || '|' || is_identity
    from information_schema.columns
   where table_schema = 'public' and table_name in ('doublons_probables', 'doublons_verifications')
  union all
  select 'idx:' || indexdef from pg_indexes
   where schemaname = 'public' and tablename in ('doublons_probables', 'doublons_verifications')
  union all
  select 'con:' || conrelid::regclass::text || '|' || conname || '|' || pg_get_constraintdef(oid) from pg_constraint
   where conrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace
                        and relname in ('doublons_probables', 'doublons_verifications'))
  union all
  select 'trg:' || pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_doublons_probables_noter'
  union all
  select 'cron:' || schedule || '|' || command from cron.job where jobname = 'doublons-verifications-purge'
) t
  ) e;
  if v_empreinte is distinct from '9903dd903ab3c21af5407e6707986b89' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.athletes) <> (select athletes from _d1_releve)
     or md5(coalesce((select string_agg(id::text || coalesce(first_name, '') || coalesce(last_name, '') || coalesce(date_naissance::text, '') || status::text, ',' order by id) from public.athletes), ''))
        <> (select athletes_md5 from _d1_releve) then
    raise exception 'NEXUS LOT: une fiche athlète a changé — tout est annulé';
  end if;
  if (select count(*) from public.doublons_probables) <> 0 or (select count(*) from public.doublons_verifications) <> 0 then
    raise exception 'NEXUS LOT: les tables D1 doivent être vides';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select athletes, version_deja, derniere_version, tables_deja, pg from _d1_releve) r),
  'apres', json_build_object(
     'athletes', (select count(*) from public.athletes),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261015094834'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015094834'),
     'tables', (select count(*) from pg_class where oid in (to_regclass('public.doublons_probables'), to_regclass('public.doublons_verifications'))),
     'purge', (select count(*) from cron.job where jobname = 'doublons-verifications-purge'),
     'meme_transaction', (select txid from _d1_releve) = txid_current())
) as resultat_lot_d1;
