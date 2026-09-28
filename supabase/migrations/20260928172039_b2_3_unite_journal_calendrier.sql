-- 20260928172039_b2_3_unite_journal_calendrier (version enregistrée en prod ; écrite 20260928160000)
--
-- LOT B2, ÉTAPE 3 — deux correctifs en base pour le tableau blanc par unité.
--
-- A. REGISTRE §39 — un retrait d'unité fait par un admin cégep dans un AUTRE
-- sport de son cégep range sa ligne de journal dans l'unité VISÉE, plus dans
-- la sienne (lot B2, étape 3 — GO BP 2026-09-28).
--
-- Cause : unite_retirer_favori / unite_retirer_du_processus sont SECURITY
-- INVOKER ; leur INSERT au journal passe par le trigger unite_poser_journal
-- qui, pour un appel client (current_user = authenticated), ignorait toute
-- unité fournie et prenait celle du SIGNATAIRE — celle de l'admin.
--
-- Correctif, sans changer aucune signature :
-- 1. unite_poser_journal (CREATE OR REPLACE) : pour un appel client, une
--    unité fournie est GARDÉE si l'appelant y a accès (acces_unite_pro :
--    son unité, ou un sport de son cégep s'il est admin, Pro exigé) ; sinon
--    elle est dérivée de l'acteur, exactement comme avant. Un client ne peut
--    donc ranger une ligne que dans une unité qu'il lit et modifie déjà. (Il
--    pouvait déjà insérer ses propres lignes de journal : policy propriétaire
--    « Recruiters see their own activity », FOR ALL — inchangée.)
-- 2. unite_retirer_favori / unite_retirer_du_processus (CREATE OR REPLACE,
--    mêmes signatures, mêmes corps) : l'INSERT au journal fournit l'unité
--    visée (v_c, v_s). Sans p_sport_id, c'est l'unité de l'appelant : rien ne
--    change pour un non-admin.
--
-- B. CALENDRIER DE L'UNITÉ — team_athletes. La policy « Recruiters read own
-- target team rows » ne rend l'équipe d'un athlète qu'à qui le suit LUI-MÊME
-- (processus, favori, liste). Un athlète suivi par un collègue revenait sans
-- équipe, donc sans match. AJOUT d'une policy SELECT unite_equipes_suivies :
-- l'athlète (ACTIF) est suivi par une unité à laquelle l'appelant a accès
-- (acces_unite_pro, Pro exigé), via athlete_suivi_par_mon_unite(), SECURITY
-- DEFINER (règle 4). La policy existante n'est PAS touchée.
--
-- ACL relevées AVANT et comparées intégralement APRÈS (gates). Aucune
-- contrainte ni colonne touchée, aucune policy retirée, aucune signature
-- existante changée.
-- Rollback : supabase/rollback/20260928172039_rollback_b2_3_unite_journal_calendrier.sql

create temp table _b2_3_avant on commit drop as
  select p.oid, p.proname::text as nom, p.proacl::text as acl, pg_get_functiondef(p.oid) as def
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('unite_poser_journal', 'unite_retirer_favori', 'unite_retirer_du_processus');

-- Sauvegarde persistante des définitions d'origine, pour le rollback.
create table public._b2_3_sauvegarde (
  nom     text        not null,
  acl     text,
  def     text        not null,
  pris_le timestamptz not null default now()
);
revoke all on public._b2_3_sauvegarde from public, anon, authenticated;
alter table public._b2_3_sauvegarde enable row level security;
comment on table public._b2_3_sauvegarde is
  'Lot B2 étape 3 (2026-09-28) : définitions de unite_poser_journal, unite_retirer_favori, unite_retirer_du_processus avant le correctif §39. Illisible hors service_role/postgres.';
insert into public._b2_3_sauvegarde (nom, acl, def) select nom, acl, def from _b2_3_avant;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. unite_poser_journal — garder l'unité fournie si l'appelant y a accès.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.unite_poser_journal()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_cegep uuid;
  v_sport uuid;
  v_garder boolean;
begin
  if current_user in ('authenticated', 'anon') then
    -- Appel client : l'unité fournie n'est gardée que si l'appelant y a
    -- accès (§39 : l'admin cégep qui agit dans un autre sport de son cégep).
    v_garder := new.unite_cegep_id is not null and new.unite_sport_id is not null
                and coalesce(public.acces_unite_pro(new.unite_cegep_id, new.unite_sport_id), false);
  else
    -- Chemins serveur (fonctions SECURITY DEFINER) : inchangé.
    v_garder := new.unite_cegep_id is not null and new.unite_sport_id is not null;
  end if;

  if not v_garder then
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
end $function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Les deux retraits d'unité — l'INSERT au journal fournit l'unité visée.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.unite_retirer_favori(p_athlete_id uuid, p_sport_id uuid default null::uuid)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
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
    -- §39 : la ligne va dans l'unité VISÉE (gardée par unite_poser_journal
    -- si l'appelant y a accès).
    insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
    select v_moi, a.id, 'UNFAVORITED',
           jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name, 'unite', true, 'lignes', n),
           v_c, v_s
      from public.athletes a where a.id = p_athlete_id;
  end if;
  return n;
end $function$;

create or replace function public.unite_retirer_du_processus(p_athlete_id uuid, p_sport_id uuid default null::uuid)
 returns integer
 language plpgsql
 set search_path to 'public'
as $function$
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
    -- §39 : la ligne va dans l'unité VISÉE.
    insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
    select v_moi, a.id, 'PIPELINE_CHANGED',
           jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name,
                              'new_stage', null, 'before_stage', v_etape,
                              'retire', true, 'unite', true, 'lignes', n),
           v_c, v_s
      from public.athletes a where a.id = p_athlete_id;
  end if;
  return n;
end $function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CALENDRIER — les équipes des athlètes suivis par l'unité.
-- ════════════════════════════════════════════════════════════════════════════
create temp table _ta_acl_avant on commit drop as
  select relacl::text as acl from pg_class where oid = 'public.team_athletes'::regclass;

create function public.athlete_suivi_par_mon_unite(p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.athletes a where a.id = p_athlete_id and a.status = 'ACTIF'::public.account_status)
     and (
          exists (select 1 from public.recruiter_pipeline p
                   where p.athlete_id = p_athlete_id and public.acces_unite_pro(p.unite_cegep_id, p.unite_sport_id))
       or exists (select 1 from public.recruiter_favorites f
                   where f.athlete_id = p_athlete_id and public.acces_unite_pro(f.unite_cegep_id, f.unite_sport_id))
       or exists (select 1 from public.recruiter_list_members m
                   where m.athlete_id = p_athlete_id and public.acces_unite_pro(m.unite_cegep_id, m.unite_sport_id))
     )
$$;
comment on function public.athlete_suivi_par_mon_unite(uuid) is
  'Lot B2 étape 3 (2026-09-28) : vrai si l''athlète ACTIF est suivi (processus, favori, liste) par une unité à laquelle l''appelant a accès (Pro). Utilisée par la policy unite_equipes_suivies de team_athletes.';
revoke execute on function public.athlete_suivi_par_mon_unite(uuid) from public, anon;
grant  execute on function public.athlete_suivi_par_mon_unite(uuid) to authenticated;

create policy unite_equipes_suivies on public.team_athletes for select to authenticated
  using (public.athlete_suivi_par_mon_unite(athlete_id));

-- ════════════════════════════════════════════════════════════════════════════
-- 4. GATES — ACL d'avant, au caractère près, et liste complète attendue.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  r record;
  vus text[];
  n int;
begin
  select count(*) into n from _b2_3_avant;
  if n <> 3 then raise exception 'NEXUS: % fonctions relevées, attendu 3', n; end if;

  for r in
    select a.nom, a.acl as avant, p.proacl::text as apres
      from _b2_3_avant a join pg_proc p on p.oid = a.oid
  loop
    if r.avant is distinct from r.apres then
      raise exception 'NEXUS: ACL de % modifiée : % → %', r.nom, r.avant, r.apres;
    end if;
  end loop;

  for r in
    select * from (values
      ('public.unite_poser_journal()',                  array['postgres','service_role']),
      ('public.unite_retirer_favori(uuid, uuid)',       array['authenticated','postgres','service_role']),
      ('public.unite_retirer_du_processus(uuid, uuid)', array['authenticated','postgres','service_role'])
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

  -- Fonction nouvelle : ACL complète.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.athlete_suivi_par_mon_unite(uuid)'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL de athlete_suivi_par_mon_unite = %', vus;
  end if;

  -- team_athletes : policies, liste complète ; ACL de la table inchangée.
  select array_agg(polname::text order by polname::text) into vus
    from pg_policy where polrelid = 'public.team_athletes'::regclass;
  if vus is distinct from array['Athletes read own team rows','Coaches manage own team athletes',
                                'Directors manage school team athletes','Recruiters read own target team rows',
                                'Recruiters read verified team athletes','admins read all','unite_equipes_suivies'] then
    raise exception 'NEXUS: policies de team_athletes = %', vus;
  end if;
  if (select acl from _ta_acl_avant) is distinct from
     (select relacl::text from pg_class where oid = 'public.team_athletes'::regclass) then
    raise exception 'NEXUS: ACL de team_athletes modifiée';
  end if;

  -- Toujours SECURITY INVOKER (la RLS décide de ce qui part).
  select count(*) into n from pg_proc
   where oid in ('public.unite_retirer_favori(uuid, uuid)'::regprocedure,
                 'public.unite_retirer_du_processus(uuid, uuid)'::regprocedure,
                 'public.unite_poser_journal()'::regprocedure)
     and prosecdef;
  if n <> 0 then raise exception 'NEXUS: % fonction(s) passée(s) en SECURITY DEFINER', n; end if;
end $$;
