-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1b : consentements (lecture consolidée + écriture
-- des 2 consentements parent + audit + RLS parent sur parental_consents).
--
-- GATE #1 (décidé BP) : consent_audit_trail.consent_id → DROP NOT NULL, pour
-- auditer un consentement parent SANS ligne parental_consents liée.
-- Ne touche PAS parental_consents (structure), le flow coach, ni les policies
-- athletes existantes. Pas de consolidation des emplacements (dette trackée).
-- ═══════════════════════════════════════════════════════════════

-- ── GATE #1 : l'audit accepte consent_id null (action parent sans attestation).
alter table public.consent_audit_trail alter column consent_id drop not null;

-- Action 'GRANTED' pour les octrois parent (additif ; le flow coach garde
-- ATTESTED/WITHDRAWN/EXPIRED/PDF_*). La clé du consentement vit dans
-- metadata.consent_key. Ne touche pas parental_consents ni le trigger coach.
alter table public.consent_audit_trail drop constraint if exists consent_audit_trail_action_check;
alter table public.consent_audit_trail add constraint consent_audit_trail_action_check
  check (action = any (array['ATTESTED','WITHDRAWN','EXPIRED','PDF_DOWNLOADED','PDF_UPLOADED','GRANTED']));

-- ── RPC LECTURE : état consolidé des consentements de l'enfant (garde parent).
create or replace function public.get_child_consents(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_ath  public.athletes;
  v_pref jsonb;
  v_pc   public.parental_consents;
begin
  if not public.is_parent_of(p_athlete_id) then
    return jsonb_build_object('error', 'not_parent');
  end if;
  select * into v_ath from public.athletes where id = p_athlete_id;
  if v_ath.id is null then return jsonb_build_object('error', 'not_found'); end if;

  select privacy_preferences into v_pref from public.users where id = v_ath.user_id;
  v_pref := coalesce(v_pref, '{}'::jsonb);

  if v_ath.consent_id is not null then
    select * into v_pc from public.parental_consents where id = v_ath.consent_id;
  end if;

  return jsonb_build_object(
    'privacy_preferences', jsonb_build_object(
      'consent_privacy_policy',              v_pref->>'consent_privacy_policy',
      'consent_data_collection',             v_pref->>'consent_data_collection',
      'consent_marketing',                   v_pref->>'consent_marketing',
      'consent_parental_profile',            v_pref->>'consent_parental_profile',
      'consent_parental_visibility',         v_pref->>'consent_parental_visibility',
      'consent_parental_partner_visibility', v_pref->>'consent_parental_partner_visibility'
    ),
    'partner_visibility', jsonb_build_object(
      'opt_in',           v_ath.partner_visibility_opt_in,
      'opted_in_at',      v_ath.partner_visibility_opted_in_at,
      'parental_consent', v_ath.partner_visibility_parental_consent
    ),
    'coach_attestation', case when v_pc.id is not null then jsonb_build_object(
      'status',                 v_pc.status,
      'consent_profile_public', v_pc.consent_profile_public,
      'consent_photo',          v_pc.consent_photo,
      'consent_stats',          v_pc.consent_stats,
      'consent_contact',        v_pc.consent_contact,
      'attested_at',            v_pc.attested_at,
      'school_year',            v_pc.school_year
    ) else null end
  );
end;
$$;
grant execute on function public.get_child_consents(uuid) to authenticated;

-- ── RPC ÉCRITURE : set d'un consentement parent (whitelist stricte) + audit.
create or replace function public.set_child_consent(
  p_athlete_id    uuid,
  p_consent_key   text,
  p_granted       boolean,
  p_policy_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_uid   uuid := auth.uid();
  v_ath   public.athletes;
  v_pref  jsonb;
  v_prev  text;
  v_new   text := case when p_granted then 'granted' else 'withdrawn' end;
  v_ip    text;
  v_action text;
begin
  if not public.is_parent_of(p_athlete_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_parent');
  end if;
  if p_consent_key not in ('marketing', 'image_partenaire') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_key');
  end if;

  select * into v_ath from public.athletes where id = p_athlete_id;
  if v_ath.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  begin
    v_ip := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for';
  exception when others then v_ip := null; end;

  if p_consent_key = 'marketing' then
    select privacy_preferences into v_pref from public.users where id = v_ath.user_id;
    v_pref := coalesce(v_pref, '{}'::jsonb);
    v_prev := case when (v_pref->>'consent_marketing') is not null then 'granted' else 'withdrawn' end;
    v_pref := jsonb_set(v_pref, '{consent_marketing}',
                        case when p_granted then to_jsonb(now()) else 'null'::jsonb end);
    update public.users set privacy_preferences = v_pref where id = v_ath.user_id;

  else  -- image_partenaire : les 3 emplacements ensemble
    v_prev := case when v_ath.partner_visibility_opt_in then 'granted' else 'withdrawn' end;

    -- 1) users.privacy_preferences.consent_parental_partner_visibility
    select privacy_preferences into v_pref from public.users where id = v_ath.user_id;
    v_pref := coalesce(v_pref, '{}'::jsonb);
    v_pref := jsonb_set(v_pref, '{consent_parental_partner_visibility}',
                        case when p_granted then to_jsonb(now()) else 'null'::jsonb end);
    update public.users set privacy_preferences = v_pref where id = v_ath.user_id;

    -- 2) athletes.partner_visibility_opt_in (+ parental_consent + opted_in_at)
    update public.athletes set
      partner_visibility_opt_in           = p_granted,
      partner_visibility_parental_consent = p_granted,
      partner_visibility_opted_in_at      = case when p_granted then now() else partner_visibility_opted_in_at end
    where id = p_athlete_id;

    -- 3) parental_consents.consent_photo SI ligne liée (sinon skip, pas de création)
    if v_ath.consent_id is not null then
      update public.parental_consents set consent_photo = p_granted where id = v_ath.consent_id;
    end if;
  end if;

  -- Audit (chaque appel). consent_id null accepté (GATE #1). La clé → metadata.consent_key.
  v_action := case when p_granted then 'GRANTED' else 'WITHDRAWN' end;
  insert into public.consent_audit_trail
    (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
  values (
    v_ath.consent_id, p_athlete_id, null, v_action, v_prev, v_new, v_ip,
    jsonb_build_object(
      'acting_role',    'PARENT',
      'parent_user_id', v_uid,
      'consent_key',    p_consent_key,
      'policy_version', p_policy_version
    )
  );

  return jsonb_build_object('ok', true, 'key', p_consent_key, 'granted', p_granted);
end;
$$;
grant execute on function public.set_child_consent(uuid, text, boolean, text) to authenticated;

-- ── RLS : le parent lit la ligne parental_consents de son enfant (lecture seule).
--    Ne touche PAS la policy admin existante. Aucun INSERT/UPDATE parent ici.
drop policy if exists "parent reads linked child consent" on public.parental_consents;
create policy "parent reads linked child consent" on public.parental_consents
  for select using (public.is_parent_of(athlete_id));
