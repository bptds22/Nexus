-- ═══════════════════════════════════════════════════════════════════════════
-- Retrait du consentement partenaires par un MINEUR — le parent est notifié.
-- Décision BP 2026-09-29 (« Décision 2 », registre §55).
--
-- Un mineur PEUT retirer (set_my_partner_visibility, 20260929130822) ; seul
-- son parent peut réactiver (set_child_consent). Deux ajouts :
--
-- 1. my_partner_visibility_state() — ce que l'écran /athlete/parametres doit
--    afficher : état + date du dernier retrait fait PAR L'ATHLÈTE LUI-MÊME
--    s'il est postérieur au dernier accord. Le journal (consent_audit_trail)
--    n'est lisible que par les admins ; cette fonction en rend UNE date, pour
--    la fiche de l'appelant seulement.
--
-- 2. Le courriel au parent. Trigger AFTER INSERT sur consent_audit_trail :
--    ne réagit QU'À un vrai retrait par un mineur (acting_role ATHLETE,
--    WITHDRAWN, majeur = false, previous_status = 'granted'). Un appel répété
--    sur un état déjà retiré (previous = 'withdrawn') n'envoie rien.
--    Destinataire : le parent LIÉ (parent_athletes → son courriel de compte,
--    lien vers /parent/consentements) ; à défaut, le courriel parent de la
--    fiche, lien vers son invitation en attente (/parent/claim?token=…).
--    Même mécanique que notify_parent_on_minor : pg_net + PARENT_NOTICE_SECRET
--    (Vault), fonction send-parent-retrait-partenaires. Toute erreur est
--    avalée (warning) : le retrait lui-même ne doit JAMAIS échouer à cause
--    du courriel.
--    pg_net est transactionnel : un retrait annulé n'envoie rien.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. L'état vu par l'athlète ───────────────────────────────────────────
create or replace function public.my_partner_visibility_state()
  returns jsonb
  language plpgsql stable security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare
  v_uid     uuid := auth.uid();
  v_ath     public.athletes;
  v_accord  timestamptz;
  v_retrait timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error', 'not_authenticated'); end if;
  select * into v_ath from public.athletes where user_id = v_uid limit 1;
  if v_ath.id is null then return jsonb_build_object('error', 'not_found'); end if;

  select max(created_at) into v_accord from public.consent_audit_trail
   where athlete_id = v_ath.id and metadata->>'consent_key' = 'image_partenaire' and action = 'GRANTED';
  select max(created_at) into v_retrait from public.consent_audit_trail
   where athlete_id = v_ath.id and metadata->>'consent_key' = 'image_partenaire'
     and action = 'WITHDRAWN' and metadata->>'acting_role' = 'ATHLETE';

  return jsonb_build_object(
    'opt_in',             v_ath.partner_visibility_opt_in,
    'opted_in_at',        v_ath.partner_visibility_opted_in_at,
    -- Le retrait par l'athlète n'est « en cours » que s'il suit le dernier accord.
    'retire_par_moi_le',  case when v_retrait is not null and not v_ath.partner_visibility_opt_in
                                    and (v_accord is null or v_retrait > v_accord)
                               then v_retrait end,
    'parent_lie',         exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_ath.id)
  );
end;
$fn$;
revoke all on function public.my_partner_visibility_state() from public, anon, authenticated, service_role;
grant execute on function public.my_partner_visibility_state() to authenticated, service_role;

-- ── 2. Le courriel au parent ─────────────────────────────────────────────
create or replace function public.notify_parent_retrait_partenaires()
  returns trigger
  language plpgsql security definer
  set search_path to 'public', 'pg_temp'
  set row_security to off
as $fn$
declare
  v_ath     public.athletes;
  v_secret  text;
  v_email   text;
  v_prenom_parent text;
  v_lien    text;
  v_token   text;
  v_url     text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-retrait-partenaires';
begin
  if NEW.metadata->>'consent_key' is distinct from 'image_partenaire'
     or NEW.action is distinct from 'WITHDRAWN'
     or NEW.metadata->>'acting_role' is distinct from 'ATHLETE'
     or NEW.metadata->>'majeur' is distinct from 'false'
     or NEW.previous_status is distinct from 'granted' then
    return NEW;
  end if;

  begin
    select * into v_ath from public.athletes where id = NEW.athlete_id;
    if v_ath.id is null then return NEW; end if;

    -- Parent lié d'abord (il a un espace) ; sinon le courriel déclaré sur la fiche.
    select u.email, nullif(btrim(u.first_name), '') into v_email, v_prenom_parent
      from public.parent_athletes pa join public.users u on u.id = pa.parent_user_id
     where pa.athlete_id = v_ath.id limit 1;

    if v_email is not null then
      v_lien := 'parent';
    else
      v_email := nullif(btrim(v_ath.parent_email), '');
      v_prenom_parent := nullif(btrim(v_ath.parent_first_name), '');
      select token into v_token from public.parent_invitations
       where athlete_id = v_ath.id and claimed_at is null
       order by created_at desc limit 1;
      v_lien := case when v_token is not null then 'claim' else 'accueil' end;
    end if;

    if v_email is null then return NEW; end if;

    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'PARENT_NOTICE_SECRET' limit 1;
    if v_secret is null then
      raise warning 'notify_parent_retrait_partenaires: PARENT_NOTICE_SECRET absent du Vault';
      return NEW;
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-parent-notice-secret', v_secret),
      body := jsonb_build_object(
        'parent_email',      v_email,
        'parent_first_name', v_prenom_parent,
        'athlete_first_name', nullif(btrim(v_ath.first_name), ''),
        'lien',              v_lien,
        'claim_token',       v_token,
        'audit_id',          NEW.id
      )
    );
  exception when others then
    raise warning 'notify_parent_retrait_partenaires a échoué pour la ligne %: %', NEW.id, SQLERRM;
  end;
  return NEW;
end;
$fn$;
revoke all on function public.notify_parent_retrait_partenaires() from public, anon, authenticated, service_role;

create trigger trg_notify_parent_retrait_partenaires
  after insert on public.consent_audit_trail
  for each row execute function public.notify_parent_retrait_partenaires();

-- ── 3. Gates d'ACL — listes COMPLÈTES triées ─────────────────────────────
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') g from unnest(pr.proacl::text[]) x) t
   where pr.oid = 'public.my_partner_visibility_state()'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL de my_partner_visibility_state = %', vus;
  end if;

  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') g from unnest(pr.proacl::text[]) x) t
   where pr.oid = 'public.notify_parent_retrait_partenaires()'::regprocedure;
  if vus is distinct from array['postgres'] then
    raise exception 'NEXUS: ACL de notify_parent_retrait_partenaires = %', vus;
  end if;
  raise notice 'NEXUS: ACL exactes (état : authenticated+service_role ; trigger : postgres seul)';
end $$;
