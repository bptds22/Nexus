-- ROLLBACK de 20261002172656_partenaires_consentement_14_ans.sql
-- Remet le seuil à 18 ans dans les trois fonctions (définitions d'avant).
-- ⚠ À lire AVANT de jouer : tout 14-17 qui a ACCORDÉ lui-même entre-temps
--   garde opt_in = true SANS accord parental ; avec le seuil à 18, il redevient
--   invisible des partenaires, mais la fiche dit encore « oui ». Le relever :
--   select id from athletes where partner_visibility_opt_in and not coalesce(partner_visibility_parental_consent,false)
--     and date_naissance > current_date - interval '18 years';

-- 1. set_my_partner_visibility (définition de 20260929130822)
create or replace function public.set_my_partner_visibility(
  p_granted        boolean,
  p_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $$
declare
  v_uid     uuid := auth.uid();
  v_ath     public.athletes;
  v_n       int;
  v_majeur  boolean;
  v_pref    jsonb;
  v_prev    text;
  v_new     text;
  v_ip      text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_granted is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_value');
  end if;
  if p_policy_version is null or length(trim(p_policy_version)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'policy_version_required');
  end if;

  select count(*) into v_n from public.athletes where user_id = v_uid;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  elsif v_n > 1 then
    return jsonb_build_object('ok', false, 'reason', 'ambiguous');
  end if;
  select * into v_ath from public.athletes where user_id = v_uid;

  -- Majeur = 18 ans révolus. DOB inconnue → traitée en mineur (prudence).
  v_majeur := v_ath.date_naissance is not null
              and v_ath.date_naissance <= current_date - interval '18 years';

  if p_granted and not v_majeur then
    return jsonb_build_object('ok', false, 'reason', 'parent_required');
  end if;

  v_prev := case when v_ath.partner_visibility_opt_in then 'granted' else 'withdrawn' end;
  v_new  := case when p_granted then 'granted' else 'withdrawn' end;

  begin
    v_ip := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for';
  exception when others then v_ip := null; end;

  update public.athletes set
    partner_visibility_opt_in      = p_granted,
    partner_visibility_opted_in_at = case when p_granted then now() else partner_visibility_opted_in_at end
  where id = v_ath.id;

  select privacy_preferences into v_pref from public.users where id = v_uid;
  v_pref := coalesce(v_pref, '{}'::jsonb);
  if p_granted then
    v_pref := jsonb_set(v_pref, '{consent_partner_visibility}', to_jsonb(now()));
  else
    v_pref := jsonb_set(v_pref, '{consent_partner_visibility}', 'null'::jsonb);
    v_pref := jsonb_set(v_pref, '{consent_parental_partner_visibility}', 'null'::jsonb);
  end if;
  update public.users set privacy_preferences = v_pref where id = v_uid;

  insert into public.consent_audit_trail
    (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
  values (
    v_ath.consent_id, v_ath.id, null,
    case when p_granted then 'GRANTED' else 'WITHDRAWN' end,
    v_prev, v_new, v_ip,
    jsonb_build_object(
      'acting_role',    'ATHLETE',
      'athlete_user_id', v_uid,
      'consent_key',    'image_partenaire',
      'majeur',         v_majeur,
      'policy_version', p_policy_version
    )
  );

  return jsonb_build_object('ok', true, 'granted', p_granted, 'previous', v_prev);
end;
$$;


comment on function public.set_my_partner_visibility(boolean, text) is
  'Athlète : accorde (majeur seulement) ou retire (tous) sa visibilité partenaires. Journalisé à chaque appel avec policy_version. Registre §50.';

-- 2. Éligibilité : opt_in ET (18 ans OU accord parental).
create or replace function public.is_partner_eligible_athlete(p_athlete_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select
    a.partner_visibility_opt_in = true
    and (
      extract(year from age(a.date_naissance)) >= 18
      or a.partner_visibility_parental_consent = true
    )
  from public.athletes a
  where a.id = p_athlete_id;
$$;

-- 3. Le trigger recopie la règle pour l'état « avant » : même seuil.
create or replace function public.emit_five_star_on_eligibility_flip()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
  v_was_eligible BOOLEAN;
  v_is_eligible BOOLEAN;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

  v_was_eligible :=
    COALESCE(OLD.partner_visibility_opt_in, false) = true
    AND (
      EXTRACT(YEAR FROM AGE(OLD.date_naissance)) >= 18
      OR COALESCE(OLD.partner_visibility_parental_consent, false) = true
    )
    AND COALESCE(OLD.verified, false) = true
    AND COALESCE(OLD.modified_since_verification, false) = false
    AND OLD.cote_globale_entraineur IS NOT NULL;

  v_is_eligible := is_partner_eligible_athlete(NEW.id);

  IF v_was_eligible OR NOT v_is_eligible THEN
    RETURN NEW;
  END IF;

  SELECT sch.name, s.nom
    INTO v_school_name, v_sport_name
  FROM (SELECT 1) dummy
  LEFT JOIN schools sch ON sch.id = NEW.school_id
  LEFT JOIN sports s ON s.id = NEW.sport_id;

  v_athlete_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.id,
    NEW.school_id,
    NEW.sport_id,
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'eligibility_flip'
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;


-- 3b. Avis au parent : trigger, fonction, journal (le journal part avec — il
--     ne sert qu'à cet avis ; le relever avant si on veut en garder la trace).
drop trigger if exists trg_aviser_parent_partenaires on public.athletes;
drop function if exists public.aviser_parent_partenaires();
drop table if exists public.avis_parent_partenaires;

-- 4. Gates d'ACL — comparaison COMPLÈTE, jamais par inclusion.
do $$
declare
  c    record;
  vus  text[];
begin
  for c in
    select * from (values
      ('public.set_my_partner_visibility(boolean, text)',
       array['authenticated','postgres','service_role']),
      ('public.is_partner_eligible_athlete(uuid)',
       array['PUBLIC','anon','authenticated','postgres','service_role']),
      ('public.emit_five_star_on_eligibility_flip()',
       array['PUBLIC','anon','authenticated','postgres','service_role'])
    ) as t(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = c.f::regprocedure;
    -- Les deux côtés triés par la MÊME collation (PUBLIC se range après postgres).
    if vus is distinct from (select array_agg(x order by x) from unnest(c.veut) x) then
      raise exception 'NEXUS: ACL de % = %, attendu %', c.f, vus, c.veut;
    end if;
  end loop;
  raise notice 'NEXUS: ACL exactes sur les trois fonctions';
end $$;

-- 5. Sécurité inchangée : DEFINER sur les trois, search_path posé.
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc
   where oid in ('public.set_my_partner_visibility(boolean, text)'::regprocedure,
                 'public.is_partner_eligible_athlete(uuid)'::regprocedure,
                 'public.emit_five_star_on_eligibility_flip()'::regprocedure)
     and prosecdef and proconfig is not null;
  if v_n <> 3 then
    raise exception 'NEXUS: attendu 3 fonctions SECURITY DEFINER avec search_path, vu %', v_n;
  end if;
end $$;
