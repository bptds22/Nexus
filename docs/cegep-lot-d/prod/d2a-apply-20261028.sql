-- ════════════════════════════════════════════════════════════════════════════
-- Lot D2a cégep — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc), version 20261028030000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d2a (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → migration → parcours d'inscription d'un compte témoin NEUF (créé dans chaque
-- essai, défait aussitôt avec l'interrupteur posé pour l'essai) : OFF / ON, universitaire / collégial, cas
-- refusés → ce que voient les rôles existants sous OFF et sous ON → inscription (schema_migrations + admin_operations) → COMMIT. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-d2a';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028030000') then
    raise exception 'NEXUS: version 20261028030000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028030000' then raise exception 'NEXUS: version 20261028030000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D2A', 'ROLLBACK_CEGEP_LOT_D2A')) then
    raise exception 'NEXUS: le lot D2a a déjà laissé une trace dans admin_operations';
  end if;
  if to_regprocedure('nexus_prive.ids_universites()') is null
     or to_regprocedure('public.verrou_reference_universite()') is null then
    raise exception 'NEXUS: préalable D1a2 absent';
  end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') = 0 then
    raise exception 'NEXUS: préalable D1 absent (aucune université)';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: lancement_universitaire est ON — D2a se pose interrupteur OFF';
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000d2a01') then
    raise exception 'NEXUS: l''identifiant du compte témoin existe déjà';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
with u as (select s.id from public.schools s where s.type = 'UNIVERSITE'
            and exists (select 1 from public.teams t where t.school_id = s.id) order by s.name limit 1)
select (select id from u) as univ,
       (select t.id from public.teams t where t.school_id = (select id from u) order by t.id limit 1) as univ_team,
       (select count(*) from public.teams t where t.school_id = (select id from u) and t.is_active) as univ_n_equipes,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'UNIVERSITE' and s.id <> (select id from u) order by t.id limit 1) as autre_team,
       (select s.id from public.schools s where s.type = 'CEGEP' order by s.name limit 1) as cegep,
       (select count(*) from public.schools where type = 'UNIVERSITE') as n_univ,
       (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1) as u_par,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d2a01'::uuid as neuf;
do $$
begin
  if exists (select 1 from _t where univ is null or univ_team is null or autre_team is null or cegep is null
                or u_ath is null or u_coach is null or u_rec is null or u_part is null or u_par is null or u_adm is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d2a on commit drop as
select '20261028030000'::text as version,
       $nexus_mig$-- Lot D2a cégep — inscription du recruteur universitaire, côté base, SOUS l'interrupteur lancement_universitaire.
-- Décisions BP 2026-10-28 : il ne voit que SA propre université ; validation du compte comme au cégep
-- (responsable d'unité, admin_claims). Tant que l'interrupteur est OFF, rien ne change pour personne.
--   1. claim_signup_role : RECRUTEUR + contexte « universitaire » accepté sous ON seulement (sinon collégial,
--      comme avant : mobile 1.4.5 et web inchangés).
--   2. finish_recruiter_onboarding : branche universitaire (UNIVERSITE, sous ON, équipe principale de cette
--      université). Branche collégiale identique.
--   3. universites_inscription() / equipes_universite_inscription(école) : listes du formulaire, sous ON, pour un
--      recruteur universitaire seulement. Les policies ne s'ouvrent pas à tous.
--   4. Policies universites_masquees : + sa propre université et ses équipes (nexus_prive.mon_universite()).
--   5. Verrous : un recruteur universitaire ne pointe que SA université (équipe principale permise) ; une
--      université n'accueille qu'un compte au contexte universitaire.

-- ── 1. claim_signup_role ─────────────────────────────────────────────────────
create or replace function public.claim_signup_role(p_role text, p_context text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to 'off'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_row     public.users%rowtype;
  v_context text := null;
begin
  -- Garde 1 -- authentification obligatoire.
  if v_uid is null then
    raise exception 'claim_signup_role: appel non authentifie'
      using errcode = '28000';
  end if;

  -- Garde 2 -- whitelist stricte. JAMAIS ADMIN, JAMAIS PARTNER.
  if p_role is null or p_role not in ('ATHLETE', 'COACH', 'RECRUTEUR') then
    raise exception 'claim_signup_role: role % non autorise (attendu ATHLETE|COACH|RECRUTEUR)', p_role
      using errcode = '22023';
  end if;

  -- FOR UPDATE : verrouille la ligne. Sans ce verrou, deux appels concurrents
  -- (double-tap, retry reseau) pourraient tous deux lire role_claimed_at IS NULL
  -- et le one-shot serait franchissable deux fois.
  select * into v_row from public.users where id = v_uid for update;
  if not found then
    raise exception 'claim_signup_role: profil introuvable'
      using errcode = 'P0002';
  end if;

  -- Garde 2bis -- RÔLES FIGÉS (décision BP 2026-09-29) : un rôle PARENT,
  -- PARTNER ou ADMIN déjà attribué ne s'écrase JAMAIS par cette voie. Même
  -- liste que needs_signup_role() et lib/auth/rolesFiges.ts.
  if v_row.role::text = any (array['PARENT', 'PARTNER', 'ADMIN']) then
    raise exception 'claim_signup_role: role % deja attribue -- fige', v_row.role
      using errcode = '55000';
  end if;

  -- Garde 3 -- one-shot.
  if v_row.role_claimed_at is not null then
    raise exception 'claim_signup_role: role deja reclame (%) -- immuable', v_row.role_claimed_at
      using errcode = '55000';
  end if;

  -- Garde 4 -- onboarding termine = role fige.
  if v_row.onboarding_complete is true then
    raise exception 'claim_signup_role: onboarding deja complete -- role fige'
      using errcode = '55000';
  end if;

  -- Garde 5 -- une fiche athlete existante fige le role.
  if exists (select 1 from public.athletes where user_id = v_uid) then
    raise exception 'claim_signup_role: fiche athlete existante -- role fige'
      using errcode = '55000';
  end if;

  -- Coherence role/context -- MIROIR EXACT de maybeApplySignupRole
  -- (app/auth/callback/route.ts). Web et mobile ne doivent pas diverger.
  --   COACH     -> context ∈ {scolaire, ligue_civile} (choix du picker)
  --   RECRUTEUR -> universitaire si demande ET lancement_universitaire ON (lot D2a), sinon collegial
  --   ATHLETE   -> context ignore ici (choisi a l'ecran 2 / onboarding)
  if p_role = 'COACH' and p_context in ('scolaire', 'ligue_civile') then
    v_context := p_context;
  elsif p_role = 'RECRUTEUR' and p_context = 'universitaire' then
    if not public.lancement_universitaire_actif() then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
    v_context := 'universitaire';
  elsif p_role = 'RECRUTEUR' then
    v_context := 'collegial';
  end if;

  update public.users
  set    role            = p_role::public.user_role,
         context         = coalesce(v_context, context),
         role_claimed_at = now()
  where  id = v_uid;

  return jsonb_build_object(
    'role',       p_role,
    'context',    v_context,
    'claimed_at', now()
  );
end;
$function$;

-- ── 2. finish_recruiter_onboarding ───────────────────────────────────────────
create or replace function public.finish_recruiter_onboarding(p_cegep_id uuid, p_primary_team_id uuid, p_sport text, p_first_name text, p_last_name text, p_phone text, p_bio text, p_experience_years integer, p_photo_url text, p_director_choice text, p_rprp_accepted boolean, p_invite_email text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set row_security to 'off'
as $function$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_cegep_valid        boolean;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
BEGIN
  -- 1. Auth check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 2. Role + context check (recruteur : collegial, ou universitaire — lot D2a)
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'RECRUTEUR'::public.user_role
     OR v_context IS NULL
     OR v_context NOT IN ('collegial', 'universitaire')
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  IF v_context = 'collegial' THEN
    -- 3. CEGEP validation (type='CEGEP', coherence wizard 561b1ab)
    -- Auparavant : (has_collegial = true) — flag mal peuple, rejetait 24 CEGEP reels.
    -- EXISTS sur type='CEGEP' couvre id inexistant ET non-CEGEP.
    SELECT EXISTS(
      SELECT 1 FROM public.schools WHERE id = p_cegep_id AND type = 'CEGEP'
    ) INTO v_cegep_valid;

    IF NOT v_cegep_valid THEN
      RAISE EXCEPTION 'INVALID_CEGEP';
    END IF;
  ELSE
    -- 3bis. Universite (lot D2a) : sous l'interrupteur, une UNIVERSITE, equipe principale de cette universite.
    IF NOT public.lancement_universitaire_actif() THEN
      RAISE EXCEPTION 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_cegep_id AND type = 'UNIVERSITE') THEN
      RAISE EXCEPTION 'INVALID_UNIVERSITE';
    END IF;
    IF p_primary_team_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_primary_team_id AND school_id = p_cegep_id) THEN
      RAISE EXCEPTION 'INVALID_TEAM';
    END IF;
  END IF;

  -- 4. Director choice validation (parite ecole : 4 choix)
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- 5. ENFORCEMENT — regle Loi 25 (parite ecole)
  v_has_resp := public.school_has_responsable(p_cegep_id);

  -- Regle 1 : CEGEP sans responsable → seuls owner ou interim acceptes.
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Regle 2 : owner/interim exige p_rprp_accepted=true.
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- 6. Preparation profile_data (parite ecole)
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : stash uniquement si email non-vide. type='cegep' (ou 'universite', lot D2a)
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now,
                              'type', CASE WHEN v_context = 'universitaire' THEN 'universite' ELSE 'cegep' END)
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- 7. Merge profile_data (preserve l'existant)
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- 8. users UPDATE
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_cegep_id,
      primary_team_id     = COALESCE(p_primary_team_id, primary_team_id),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- 9. admin_claims INSERT si owner/interim — anti-duplicate
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_cegep_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_cegep_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- 10. Retour
  RETURN jsonb_build_object(
    'ok',                     true,
    'cegep_id',               p_cegep_id,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created
  );
END;
$function$;

-- ── 3. Listes du formulaire d'inscription ────────────────────────────────────
create function nexus_prive.est_recruteur_universitaire() returns boolean
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select public.lancement_universitaire_actif()
     and exists (select 1 from public.users u
                  where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role and u.context = 'universitaire');
$function$;
revoke all on function nexus_prive.est_recruteur_universitaire() from public;
grant execute on function nexus_prive.est_recruteur_universitaire() to authenticated, service_role;

create function public.universites_inscription()
  returns table (id uuid, name text, city text, team_name text, province text)
  language plpgsql stable security definer
  set search_path = public set row_security = off
as $function$
begin
  if not nexus_prive.est_recruteur_universitaire() then
    raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
      using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.city, s.team_name, s.province
      from public.schools s where s.type = 'UNIVERSITE' order by s.name;
end;
$function$;
revoke all on function public.universites_inscription() from public, anon;
grant execute on function public.universites_inscription() to authenticated, service_role;

create function public.equipes_universite_inscription(p_school_id uuid)
  returns table (id uuid, name text, sport text, gender text, division text, season text)
  language plpgsql stable security definer
  set search_path = public set row_security = off
as $function$
begin
  if not nexus_prive.est_recruteur_universitaire() then
    raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
      using errcode = '42501';
  end if;
  return query
    select t.id, t.name, sp.nom, t.gender, t.division, t.season
      from public.teams t
      join public.schools s on s.id = t.school_id and s.type = 'UNIVERSITE'
      left join public.sports sp on sp.id = t.sport_id
     where t.school_id = p_school_id and t.is_active
     order by sp.nom, t.gender, t.name;
end;
$function$;
revoke all on function public.equipes_universite_inscription(uuid) from public, anon;
grant execute on function public.equipes_universite_inscription(uuid) to authenticated, service_role;

-- ── 4. Policies : + sa propre université ─────────────────────────────────────
create function nexus_prive.mon_universite() returns uuid
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select u.school_id from public.users u
    join public.schools s on s.id = u.school_id and s.type = 'UNIVERSITE'
   where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role and u.context = 'universitaire'
     and public.lancement_universitaire_actif();
$function$;
revoke all on function nexus_prive.mon_universite() from public;
grant execute on function nexus_prive.mon_universite() to anon, authenticated, service_role;

alter policy universites_masquees on public.schools
  using (type <> 'UNIVERSITE' or (select public.is_admin()) or id = (select nexus_prive.mon_universite()));
alter policy universites_masquees on public.teams
  using ((select public.is_admin())
         or not (school_id = any ((select nexus_prive.ids_universites())::uuid[]))
         or school_id = (select nexus_prive.mon_universite()));

-- ── 5. Verrous ───────────────────────────────────────────────────────────────
-- users : une université n'accueille qu'un compte au contexte universitaire, et un compte universitaire ne
-- pointe qu'une université (ou rien). Le reste de verrou_universites est inchangé (D0).
create or replace function public.verrou_universites()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_univ boolean;
begin
  if tg_table_name = 'athletes' then
    if new.school_id is null
       or (tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id) then
      return new;
    end if;
    if exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une université.'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'team_athletes' then
    if new.team_id is null
       or (tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id) then
      return new;
    end if;
    if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where t.id = new.team_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une équipe universitaire.'
        using errcode = '42501';
    end if;
  else
    -- users : seule l'entrée dans une université ou dans le contexte universitaire est regardée.
    if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id
       and old.context is not distinct from new.context and old.role is not distinct from new.role then
      return new;
    end if;
    v_univ := new.school_id is not null
              and exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE');
    if not v_univ and new.context is distinct from 'universitaire' then
      return new;
    end if;
    if auth.uid() is null or public.is_admin() then
      return new;
    end if;
    if new.role is distinct from 'RECRUTEUR'::public.user_role then
      raise exception 'NEXUS: Seul un recruteur universitaire peut être rattaché à une université.'
        using errcode = '42501';
    end if;
    if not public.lancement_universitaire_actif() then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
    -- Lot D2a : contexte et école vont ensemble.
    if v_univ and new.context is distinct from 'universitaire' then
      raise exception 'NEXUS: Seul un recruteur universitaire peut être rattaché à une université.'
        using errcode = '42501';
    end if;
    if not v_univ and new.school_id is not null then
      raise exception 'NEXUS: Un recruteur universitaire est rattaché à une université.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

-- Verrou par référence (D1a2) : l'équipe principale d'un recruteur universitaire peut être une équipe de SA
-- université, sous l'interrupteur, sur sa propre ligne. Tout le reste reste fermé.
create or replace function public.verrou_reference_universite() returns trigger
  language plpgsql security definer
  set search_path = public
as $function$
declare
  v_col text;
  v_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  foreach v_col in array tg_argv loop
    v_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_id is null
       or (tg_op = 'UPDATE' and (to_jsonb(old) ->> v_col)::uuid is not distinct from v_id) then
      continue;
    end if;
    if tg_table_name = 'users' and v_col = 'primary_team_id'
       and (to_jsonb(new) ->> 'id')::uuid = auth.uid()
       and to_jsonb(new) ->> 'role' = 'RECRUTEUR' and to_jsonb(new) ->> 'context' = 'universitaire'
       and public.lancement_universitaire_actif()
       and exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                    where t.id = v_id and s.type = 'UNIVERSITE'
                      and t.school_id = (to_jsonb(new) ->> 'school_id')::uuid) then
      continue;
    end if;
    if exists (select 1 from public.schools s where s.id = v_id and s.type = 'UNIVERSITE')
       or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                   where t.id = v_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$function$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot D2a cégep : remet claim_signup_role, finish_recruiter_onboarding (définitions prod du
-- 2026-10-28), verrou_universites (D0), verrou_reference_universite et les policies (D1a2) ; retire les
-- listes d'inscription et les fonctions nexus_prive du lot.
CREATE OR REPLACE FUNCTION public.claim_signup_role(p_role text, p_context text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET row_security TO 'off'
AS $function$
declare
  v_uid     uuid := auth.uid();
  v_row     public.users%rowtype;
  v_context text := null;
begin
  -- Garde 1 -- authentification obligatoire.
  if v_uid is null then
    raise exception 'claim_signup_role: appel non authentifie'
      using errcode = '28000';
  end if;

  -- Garde 2 -- whitelist stricte. JAMAIS ADMIN, JAMAIS PARTNER.
  if p_role is null or p_role not in ('ATHLETE', 'COACH', 'RECRUTEUR') then
    raise exception 'claim_signup_role: role % non autorise (attendu ATHLETE|COACH|RECRUTEUR)', p_role
      using errcode = '22023';
  end if;

  -- FOR UPDATE : verrouille la ligne. Sans ce verrou, deux appels concurrents
  -- (double-tap, retry reseau) pourraient tous deux lire role_claimed_at IS NULL
  -- et le one-shot serait franchissable deux fois.
  select * into v_row from public.users where id = v_uid for update;
  if not found then
    raise exception 'claim_signup_role: profil introuvable'
      using errcode = 'P0002';
  end if;

  -- Garde 2bis -- RÔLES FIGÉS (décision BP 2026-09-29) : un rôle PARENT,
  -- PARTNER ou ADMIN déjà attribué ne s'écrase JAMAIS par cette voie. Même
  -- liste que needs_signup_role() et lib/auth/rolesFiges.ts.
  if v_row.role::text = any (array['PARENT', 'PARTNER', 'ADMIN']) then
    raise exception 'claim_signup_role: role % deja attribue -- fige', v_row.role
      using errcode = '55000';
  end if;

  -- Garde 3 -- one-shot.
  if v_row.role_claimed_at is not null then
    raise exception 'claim_signup_role: role deja reclame (%) -- immuable', v_row.role_claimed_at
      using errcode = '55000';
  end if;

  -- Garde 4 -- onboarding termine = role fige.
  if v_row.onboarding_complete is true then
    raise exception 'claim_signup_role: onboarding deja complete -- role fige'
      using errcode = '55000';
  end if;

  -- Garde 5 -- une fiche athlete existante fige le role.
  if exists (select 1 from public.athletes where user_id = v_uid) then
    raise exception 'claim_signup_role: fiche athlete existante -- role fige'
      using errcode = '55000';
  end if;

  -- Coherence role/context -- MIROIR EXACT de maybeApplySignupRole
  -- (app/auth/callback/route.ts). Web et mobile ne doivent pas diverger.
  --   COACH     -> context ∈ {scolaire, ligue_civile} (choix du picker)
  --   RECRUTEUR -> collegial (derive, pas un choix utilisateur)
  --   ATHLETE   -> context ignore ici (choisi a l'ecran 2 / onboarding)
  if p_role = 'COACH' and p_context in ('scolaire', 'ligue_civile') then
    v_context := p_context;
  elsif p_role = 'RECRUTEUR' then
    v_context := 'collegial';
  end if;

  update public.users
  set    role            = p_role::public.user_role,
         context         = coalesce(v_context, context),
         role_claimed_at = now()
  where  id = v_uid;

  return jsonb_build_object(
    'role',       p_role,
    'context',    v_context,
    'claimed_at', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.finish_recruiter_onboarding(p_cegep_id uuid, p_primary_team_id uuid, p_sport text, p_first_name text, p_last_name text, p_phone text, p_bio text, p_experience_years integer, p_photo_url text, p_director_choice text, p_rprp_accepted boolean, p_invite_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_cegep_valid        boolean;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
BEGIN
  -- 1. Auth check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 2. Role + context check (recruteur : collegial uniquement)
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'RECRUTEUR'::public.user_role
     OR v_context IS DISTINCT FROM 'collegial'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- 3. CEGEP validation (type='CEGEP', coherence wizard 561b1ab)
  -- Auparavant : (has_collegial = true) — flag mal peuple, rejetait 24 CEGEP reels.
  -- EXISTS sur type='CEGEP' couvre id inexistant ET non-CEGEP.
  SELECT EXISTS(
    SELECT 1 FROM public.schools WHERE id = p_cegep_id AND type = 'CEGEP'
  ) INTO v_cegep_valid;

  IF NOT v_cegep_valid THEN
    RAISE EXCEPTION 'INVALID_CEGEP';
  END IF;

  -- 4. Director choice validation (parite ecole : 4 choix)
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- 5. ENFORCEMENT — regle Loi 25 (parite ecole)
  v_has_resp := public.school_has_responsable(p_cegep_id);

  -- Regle 1 : CEGEP sans responsable → seuls owner ou interim acceptes.
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Regle 2 : owner/interim exige p_rprp_accepted=true.
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- 6. Preparation profile_data (parite ecole)
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : stash uniquement si email non-vide. type='cegep'
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'cegep')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- 7. Merge profile_data (preserve l'existant)
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- 8. users UPDATE
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_cegep_id,
      primary_team_id     = COALESCE(p_primary_team_id, primary_team_id),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- 9. admin_claims INSERT si owner/interim — anti-duplicate
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_cegep_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_cegep_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- 10. Retour
  RETURN jsonb_build_object(
    'ok',                     true,
    'cegep_id',               p_cegep_id,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created
  );
END;
$function$;

create or replace function public.verrou_universites()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_univ boolean;
begin
  if tg_table_name = 'athletes' then
    if new.school_id is null
       or (tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id) then
      return new;
    end if;
    if exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une université.'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'team_athletes' then
    if new.team_id is null
       or (tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id) then
      return new;
    end if;
    if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where t.id = new.team_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Une fiche athlète ne peut pas être rattachée à une équipe universitaire.'
        using errcode = '42501';
    end if;
  else
    -- users : seule l'entrée dans une université ou dans le contexte universitaire est regardée.
    if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id
       and old.context is not distinct from new.context and old.role is not distinct from new.role then
      return new;
    end if;
    v_univ := new.school_id is not null
              and exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE');
    if not v_univ and new.context is distinct from 'universitaire' then
      return new;
    end if;
    if auth.uid() is null or public.is_admin() then
      return new;
    end if;
    if new.role is distinct from 'RECRUTEUR'::public.user_role then
      raise exception 'NEXUS: Seul un recruteur universitaire peut être rattaché à une université.'
        using errcode = '42501';
    end if;
    if not public.lancement_universitaire_actif() then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.verrou_reference_universite() returns trigger
  language plpgsql security definer
  set search_path = public
as $function$
declare
  v_col text;
  v_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  foreach v_col in array tg_argv loop
    v_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_id is null
       or (tg_op = 'UPDATE' and (to_jsonb(old) ->> v_col)::uuid is not distinct from v_id) then
      continue;
    end if;
    if exists (select 1 from public.schools s where s.id = v_id and s.type = 'UNIVERSITE')
       or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                   where t.id = v_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$function$;

alter policy universites_masquees on public.schools
  using (type <> 'UNIVERSITE' or (select public.is_admin()));
alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));

drop function public.equipes_universite_inscription(uuid);
drop function public.universites_inscription();
drop function nexus_prive.mon_universite();
drop function nexus_prive.est_recruteur_universitaire();
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d2a) <> 'd0bbfe451ab6fd4226ae92b54614cdf1' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d2a);
  end if;
  if (select md5(rollback) from _d2a) <> '9d63fdf0a69f313d45448bfb9c997391' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d2a);
  end if;
  execute (select contenu from _d2a);
end $apply$;
set local search_path = public, extensions;

-- ── Outils d'essai ───────────────────────────────────────────────────────────
-- Une étape : « ok <valeur> » ou « refusé <sqlstate> <message> ». Le rôle courant est celui de l'appelant.
create function pg_temp.etape(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return 'ok ' || coalesce(v, '·');
exception when others then
  return 'refusé ' || sqlstate || ' ' || left(sqlerrm, 60);
end $$;
-- Parcours complet d'un compte NEUF, défait aussitôt. p_ctx : contexte demandé à claim_signup_role.
create function pg_temp.parcours(p_on boolean, p_ctx text, p_ecole uuid, p_equipe uuid) returns text
language plpgsql as $$
declare r text[] := '{}'; v_neuf uuid := (select neuf from _t); v_univ uuid := (select univ from _t);
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_neuf, 'authenticated', 'authenticated', 'd2a-temoin@nexus.invalid',
            '{}', '{}', now(), now());
    perform set_config('request.jwt.claims', json_build_object('sub', v_neuf, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    r := r || pg_temp.etape(format('select (public.claim_signup_role(''RECRUTEUR'', %L))->>''context''', p_ctx));
    r := r || pg_temp.etape('select count(*)::text from public.universites_inscription()');
    r := r || pg_temp.etape(format('select count(*)::text from public.equipes_universite_inscription(%L)', v_univ));
    r := r || pg_temp.etape(format(
      'select (public.finish_recruiter_onboarding(%L, %L, ''Football'', ''Témoin'', ''D2a'', null, null, null, null, ''owner'', true, null))->>''ok''',
      p_ecole, p_equipe));
    -- Ce qu'il voit ensuite : univ. visibles / la sienne / équipes de la sienne / équipes des autres univ.
    r := r || pg_temp.etape(format(
      'select (select count(*) from public.schools where type = ''UNIVERSITE'') || ''/'' ||
              (select count(*) from public.schools where id = %1$L) || ''/'' ||
              (select count(*) from public.teams where school_id = %1$L) || ''/'' ||
              (select count(*) from public.teams t where t.age_group = ''Universitaire'' and t.school_id <> %1$L)', v_univ));
    raise exception using errcode = 'NX000', message = array_to_string(r, ' | ');
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 80) || ' après ' || array_to_string(r, ' | ');
  end;
end $$;

create temp table _parcours on commit drop as
select 1 as o, 'A. OFF, universitaire, son université' as cas,
       pg_temp.parcours(false, 'universitaire', univ, univ_team) as resultat from _t
union all select 2, 'B. ON, universitaire, son université + son équipe', pg_temp.parcours(true, 'universitaire', univ, univ_team) from _t
union all select 3, 'C. ON, universitaire, un cégep', pg_temp.parcours(true, 'universitaire', cegep, null) from _t
union all select 4, 'D. ON, universitaire, équipe d''une autre université', pg_temp.parcours(true, 'universitaire', univ, autre_team) from _t
union all select 5, 'E. OFF, collégial (régression), un cégep', pg_temp.parcours(false, null, cegep, null) from _t
union all select 6, 'F. ON, collégial, une université', pg_temp.parcours(true, null, univ, null) from _t;
select cas, resultat as "claim | univ. | équipes | finish | vu u/sienne/ses éq./autres" from _parcours order by o;

-- Ce que voient les rôles existants (OFF, puis ON posé dans l'essai) : univ. / équipes univ. / écoles / équipes.
create function pg_temp.compte(q text) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.vu(p_on boolean, p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    v := pg_temp.compte('select count(*) from public.schools where type = ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where age_group = ''Universitaire''') || ' / ' ||
         pg_temp.compte('select count(*) from public.schools where type <> ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where age_group is distinct from ''Universitaire''');
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create temp table _vu on commit drop as
select o, role, pg_temp.vu(false, r, uid) as off, pg_temp.vu(true, r, uid) as "on"
  from (select 1 as o, 'anon (site public)' as role, 'anon' as r, null::uuid as uid
        union all select 2, 'athlète', 'authenticated', u_ath from _t
        union all select 3, 'parent', 'authenticated', u_par from _t
        union all select 4, 'coach', 'authenticated', u_coach from _t
        union all select 5, 'recruteur collégial', 'authenticated', u_rec from _t
        union all select 6, 'partenaire', 'authenticated', u_part from _t
        union all select 7, 'admin', 'authenticated', u_adm from _t) x;
select role, off as "OFF : univ / équipes univ / écoles / équipes", "on" as "ON" from _vu order by o;

-- Un recruteur collégial existant, sous ON, ne se rattache pas à une université (verrou D2a), même en écriture directe.
create function pg_temp.ecrit(p_on boolean, p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _verrou on commit drop as
select 'recruteur collégial → school_id université (ON)' as essai,
       pg_temp.ecrit(true, u_rec, format('update public.users set school_id = %L where id = %L', univ, u_rec)) as resultat from _t
union all
select 'recruteur collégial → contexte universitaire (ON)',
       pg_temp.ecrit(true, u_rec, format('update public.users set context = ''universitaire'' where id = %L', u_rec)) from _t
union all
select 'recruteur collégial → primary_team_id équipe univ. (ON)',
       pg_temp.ecrit(true, u_rec, format('update public.users set primary_team_id = %L where id = %L', univ_team, u_rec)) from _t;
select * from _verrou;

-- Coût des policies sur la lecture la plus large (recruteur collégial : toutes les équipes), médiane de 5.
create function pg_temp.duree_recruteur() returns numeric language plpgsql as $$
declare t0 timestamptz; d numeric[] := '{}'; i int; n bigint; u uuid := (select u_rec from _t);
begin
  for i in 1..5 loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      t0 := clock_timestamp();
      select count(*) into n from public.teams;
      d := d || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
      raise exception using errcode = 'NX000';
    exception when sqlstate 'NX000' then null;
    end;
  end loop;
  return (select percentile_cont(0.5) within group (order by x) from unnest(d) x);
end $$;
select round(pg_temp.duree_recruteur(), 1) as recruteur_toutes_equipes_ms_apres;

do $$
declare t record; p text;
begin
  select * into t from _t;
  if exists (select 1 from _parcours where resultat like 'ERREUR%') then raise exception 'NEXUS: un parcours a échoué'; end if;
  -- A : OFF → tout refusé, rien vu.
  p := (select resultat from _parcours where o = 1);
  if p not like 'refusé 42501 NEXUS: Les universités%| refusé 42501%| refusé 42501%| refusé %WRONG_ROLE_OR_CONTEXT%| ok 0/0/0/0' then
    raise exception 'NEXUS: A (OFF universitaire) : %', p;
  end if;
  -- B : ON → contexte universitaire, 12 universités, ses équipes, inscription faite, il ne voit que la sienne.
  p := (select resultat from _parcours where o = 2);
  if p <> format('ok universitaire | ok %s | ok %s | ok true | ok 1/1/%s/0', t.n_univ, t.univ_n_equipes,
                 (select count(*) from public.teams where school_id = t.univ)) then
    raise exception 'NEXUS: B (ON universitaire) : %', p;
  end if;
  if (select resultat from _parcours where o = 3) not like 'ok universitaire |%| refusé %INVALID_UNIVERSITE%' then
    raise exception 'NEXUS: C (cégep choisi par un recruteur universitaire) : %', (select resultat from _parcours where o = 3);
  end if;
  if (select resultat from _parcours where o = 4) not like 'ok universitaire |%| refusé %INVALID_TEAM%' then
    raise exception 'NEXUS: D (équipe d''une autre université) : %', (select resultat from _parcours where o = 4);
  end if;
  if (select resultat from _parcours where o = 5) not like 'ok collegial | refusé 42501%| refusé 42501%| ok true | ok 0/0/0/0' then
    raise exception 'NEXUS: E (régression collégiale) : %', (select resultat from _parcours where o = 5);
  end if;
  if (select resultat from _parcours where o = 6) not like 'ok collegial | refusé 42501%| refusé 42501%| refusé %INVALID_CEGEP%| ok 0/0/0/0' then
    raise exception 'NEXUS: F (collégial vers une université) : %', (select resultat from _parcours where o = 6);
  end if;
  if exists (select 1 from _vu where off like 'ERREUR%' or "on" like 'ERREUR%') then raise exception 'NEXUS: un essai de vue a échoué'; end if;
  if exists (select 1 from _vu where role <> 'admin'
               and (split_part(off, ' / ', 1) || split_part(off, ' / ', 2) not in ('00', '0refusé')
                 or split_part("on", ' / ', 1) || split_part("on", ' / ', 2) not in ('00', '0refusé'))) then
    raise exception 'NEXUS: un rôle existant non admin voit une université';
  end if;
  if exists (select 1 from _vu where split_part(off, ' / ', 3) <> split_part("on", ' / ', 3)
                                  or split_part(off, ' / ', 4) <> split_part("on", ' / ', 4)) then
    raise exception 'NEXUS: les écoles ou équipes ordinaires changent avec l''interrupteur';
  end if;
  if exists (select 1 from _verrou where resultat like 'accepté%' and resultat <> 'accepté 0') then
    raise exception 'NEXUS: un recruteur collégial peut se rattacher à une université';
  end if;
  raise notice 'NEXUS: VERDICT D2a — OFF tout fermé ; ON inscription universitaire complète, il ne voit que son université ; collégial inchangé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d2a_recruteur_universitaire', array[contenu], 'bptds22@gmail.com' from _d2a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D2A',
       'Chantier cégep, lot D2a : inscription du recruteur universitaire côté base, sous lancement_universitaire (OFF) (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d2a_recruteur_universitaire', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d2a_recruteur_universitaire.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d2a_recruteur_universitaire.sql',
         'md5_fichier', 'd0bbfe451ab6fd4226ae92b54614cdf1', 'md5_rollback', '9d63fdf0a69f313d45448bfb9c997391', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d2a;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028030000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d2a;
commit;
\echo '== COMMIT fait : lot D2a cégep en prod (inscription du recruteur universitaire, interrupteur OFF).'
