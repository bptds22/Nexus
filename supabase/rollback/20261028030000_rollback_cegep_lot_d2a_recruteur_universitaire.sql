-- Rollback du lot D2a cégep : remet claim_signup_role, finish_recruiter_onboarding (définitions prod du
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
