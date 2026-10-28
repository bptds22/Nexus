-- Lot D2a cégep — inscription du recruteur universitaire, côté base, SOUS l'interrupteur lancement_universitaire.
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
