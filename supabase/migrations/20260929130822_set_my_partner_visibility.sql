-- ═══════════════════════════════════════════════════════════════════════════
-- set_my_partner_visibility — l'athlète gère SA visibilité partenaires.
-- Décision BP 2026-09-28 (registre §48 et §50).
--
-- ── LE TROU ──────────────────────────────────────────────────────────────
-- Depuis 20260909191744, partner_visibility_opt_in / _opted_in_at /
-- _parental_consent sont dans enforce_athlete_self_edit_perimeter(). Or
-- /athlete/parametres les écrivait par un UPDATE direct sous l'identité de
-- l'athlète → exception. Personne ne pouvait plus RETIRER ce consentement,
-- alors que l'écran promet « vous pouvez le retirer en tout temps » (Loi 25).
--
-- ── LA RÈGLE ─────────────────────────────────────────────────────────────
--   majeur (18 ans révolus) → accorde OU retire ;
--   mineur, ou date de naissance inconnue → RETIRE seulement. L'accord d'un
--     mineur appartient au parent (set_child_consent, portail parent).
-- Le consentement est SÉPARÉ : rien ici ne lit ni n'écrit
-- consentement_parental. partner_visibility_parental_consent n'est jamais
-- écrite par l'athlète — elle dit ce que le PARENT a autorisé.
--
-- ── CE QUI EST ÉCRIT, À CHAQUE APPEL ─────────────────────────────────────
--   athletes.partner_visibility_opt_in (+ opted_in_at = now() à l'accord ;
--     conservée au retrait, comme set_child_consent — l'historique vit au
--     journal) ;
--   users.privacy_preferences : accord → consent_partner_visibility = now() ;
--     retrait → les DEUX clés (majeur ET parentale) à null : la trace dit non ;
--   consent_audit_trail : une ligne PAR APPEL, même sans changement d'état,
--     acting_role = 'ATHLETE', consent_key = 'image_partenaire',
--     policy_version OBLIGATOIRE (refus sinon).
--
-- DEFINER : l'UPDATE s'exécute sous le propriétaire, la garde de périmètre
-- (current_user <> 'authenticated') le laisse passer. La fonction ne touche
-- QUE la fiche dont user_id = auth.uid() — aucun paramètre ne désigne une
-- autre fiche.
--
-- ACL : Supabase accorde EXECUTE à anon/authenticated/service_role sur toute
-- fonction créée (default privileges). On révoque tout, on accorde à
-- authenticated, puis gate par comparaison COMPLÈTE (règle CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════════

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

revoke all on function public.set_my_partner_visibility(boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.set_my_partner_visibility(boolean, text) to authenticated, service_role;

-- Gate d'ACL — comparaison COMPLÈTE, jamais par inclusion.
do $$
declare
  f    regprocedure := 'public.set_my_partner_visibility(boolean, text)'::regprocedure;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de set_my_partner_visibility = %, attendu %', vus, veut;
  end if;
  raise notice 'NEXUS: ACL exacte — %', vus;
end $$;
