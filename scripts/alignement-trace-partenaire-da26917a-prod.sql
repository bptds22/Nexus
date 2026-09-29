-- ═══════════════════════════════════════════════════════════════════════════
-- Alignement de la trace « visibilité partenaires » sur la fiche — athlète
-- da26917a-31ca-4b29-8b01-2dd0d183a706 (mineur). Décision BP 2026-09-28.
--
-- ÉTAT RELEVÉ EN PROD (2026-09-28) :
--   athletes.partner_visibility_opt_in = false, jamais modifiée depuis
--     l'INSERT de l'étape 1 de l'onboarding web (updated_at = created_at,
--     2026-08-12 23:43:37) ;
--   raw_user_meta_data.consent_parental_partner_visibility = 2026-08-12T23:41:34.692Z
--   privacy_preferences.consent_parental_partner_visibility = 2026-08-12T23:41:47.100Z
-- La fiche dit NON, la trace dit OUI. La fiche fait foi (décision BP) : la
-- trace passe à non. Cause la plus probable : case décochée à l'étape 1 — le
-- correctif de code (branche feat/partenaires-rpc-parametres) empêche la
-- récidive ; la cause exacte de CE cas reste ouverte.
--
-- CE QUE FAIT LE SCRIPT (une transaction, tout ou rien) :
--   1. vérifie que l'état est EXACTEMENT celui relevé — sinon s'arrête ;
--   2. retire la clé des deux emplacements de trace ;
--   3. écrit UNE ligne consent_audit_trail qui dit ce qui a été fait, par qui,
--      et pourquoi — la correction elle-même est tracée.
-- La fiche n'est PAS touchée : elle est déjà à false.
--
-- À APPLIQUER EN PROD SEULEMENT SUR GO BP. Idempotent : un second passage
-- s'arrête à l'étape 1 (la trace n'existe plus).
-- ═══════════════════════════════════════════════════════════════════════════
begin;

do $$
declare
  v_ath   public.athletes;
  v_meta  text;
  v_pref  text;
begin
  select * into v_ath from public.athletes where id = 'da26917a-31ca-4b29-8b01-2dd0d183a706';
  if v_ath.id is null then
    raise exception 'NEXUS: fiche da26917a introuvable — ne rien faire';
  end if;
  if v_ath.partner_visibility_opt_in is distinct from false then
    raise exception 'NEXUS: opt_in = % (attendu false) — l''état a changé, relire avant d''aligner', v_ath.partner_visibility_opt_in;
  end if;

  select u.raw_user_meta_data->>'consent_parental_partner_visibility',
         pu.privacy_preferences->>'consent_parental_partner_visibility'
    into v_meta, v_pref
    from auth.users u join public.users pu on pu.id = u.id
   where u.id = v_ath.user_id;

  if v_meta is null and v_pref is null then
    raise exception 'NEXUS: aucune trace « oui » à retirer — déjà aligné, rien à faire';
  end if;

  update auth.users
     set raw_user_meta_data = raw_user_meta_data - 'consent_parental_partner_visibility'
   where id = v_ath.user_id;

  update public.users
     set privacy_preferences = jsonb_set(coalesce(privacy_preferences, '{}'::jsonb),
                                         '{consent_parental_partner_visibility}', 'null'::jsonb)
   where id = v_ath.user_id;

  insert into public.consent_audit_trail
    (consent_id, athlete_id, coach_id, action, previous_status, new_status, ip_address, metadata)
  values (
    v_ath.consent_id, v_ath.id, null, 'WITHDRAWN', 'granted', 'withdrawn', null,
    jsonb_build_object(
      'acting_role',     'ADMIN',
      'consent_key',     'image_partenaire',
      'motif',           'alignement de la trace sur la fiche : opt_in=false depuis l''INSERT du 2026-08-12, trace signup restée à oui (décochage présumé à l''étape 1 de l''onboarding)',
      'trace_meta',      v_meta,
      'trace_pref',      v_pref,
      'decision',        'BP 2026-09-28',
      'policy_version',  '2026-08-v1'
    )
  );

  raise notice 'NEXUS: trace alignée (meta=% , pref=%) → non ; journal écrit', v_meta, v_pref;
end $$;

-- Relecture : doit rendre false | null | null
select a.partner_visibility_opt_in,
       u.raw_user_meta_data->>'consent_parental_partner_visibility' as meta,
       pu.privacy_preferences->>'consent_parental_partner_visibility' as pref
  from public.athletes a
  join auth.users u on u.id = a.user_id
  join public.users pu on pu.id = a.user_id
 where a.id = 'da26917a-31ca-4b29-8b01-2dd0d183a706';

commit;
