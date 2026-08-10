-- notify_parent_marketing : avis parental Loi 25 « consentement à l'utilisation
-- de l'image » (marketing) pour les athlètes mineurs 14-17.
--
-- JUMEAU de notify_parent_on_minor (20260708120000). MÊME table (athletes),
-- MÊME source PII parent (athletes.parent_email / parent_first_name), MÊME
-- garde d'âge 14-17, MÊME contrat pg_net (Vault → net.http_post → stamp,
-- erreur avalée, l'écriture sur athletes n'est jamais cassée).
--
-- DIFFÉRENCE CLÉ — le flag de consentement marketing NE vit PAS sur athletes.
-- Il est écrit au signup par persistInitialConsents dans
--   users.privacy_preferences ->> 'consent_marketing'   (timestamp ISO ou null)
-- On le lit donc par jointure via NEW.user_id. Le courriel ne part QUE si ce
-- consentement est non-null (opt-in effectif). Un parent qui n'a pas opté ne
-- reçoit que l'avis parental standard (send-parent-notice), pas celui-ci.
--
-- DEUX courriels distincts peuvent partir sur le même submit d'onboarding
-- (avis parental + avis marketing) : comportement voulu et validé.
--
-- ⚠️ Sémantique write-time (identique au jumeau) : le trigger s'évalue au
-- moment où parent_email se matérialise. Le consent_marketing étant posé plus
-- tôt (au signup), il est déjà présent à ce moment. Un opt-in marketing
-- POSTÉRIEUR (via les paramètres) ne re-déclenche PAS ce courriel — hors scope.

-- 1. Colonne d'idempotence DÉDIÉE (indépendante de parent_notified_at).
alter table public.athletes
  add column if not exists parent_marketing_notified_at timestamptz;

-- 2. Fonction trigger.
create or replace function public.notify_parent_marketing()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $function$
declare
  v_secret  text;
  v_age     int;
  v_consent text;
  v_url     text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-marketing';
begin
  -- Gardes bon-marché AVANT tout travail : pas de DOB, pas de courriel parent,
  -- pas d'utilisateur lié, ou notice déjà envoyée → on ne fait rien.
  if NEW.date_naissance is null
     or NEW.parent_email is null
     or NEW.user_id is null
     or NEW.parent_marketing_notified_at is not null then
    return NEW;
  end if;

  -- Garde d'âge 14-17 (IDENTIQUE à notify_parent_on_minor) : ce courriel
  -- concerne l'image d'un MINEUR — il ne doit JAMAIS partir pour un athlète
  -- majeur. Garde-fou sécurité-enfant, pas une optimisation.
  v_age := extract(year from age(NEW.date_naissance))::int;
  if v_age < 14 or v_age > 17 then
    return NEW;
  end if;

  -- Consentement marketing = source app-side users.privacy_preferences
  -- (queryable ; raw_user_meta_data du schéma auth serait pénible ici).
  -- Non-null => opt-in effectif au signup. Absent/null => aucun courriel.
  select privacy_preferences ->> 'consent_marketing'
    into v_consent
    from public.users
    where id = NEW.user_id
    limit 1;

  if v_consent is null then
    return NEW;  -- pas de consentement marketing → on ne notifie pas
  end if;

  -- À partir d'ici : mineur 14-17, parent connu, consentement marketing donné,
  -- jamais notifié. Tout est protégé : l'échec de la notif ne casse JAMAIS
  -- l'écriture sur athletes.
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'MARKETING_NOTICE_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_parent_marketing: MARKETING_NOTICE_SECRET absent du Vault';
      return NEW;  -- pas de stamp → réessai possible au prochain write
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-marketing-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'parent_email', NEW.parent_email,
        'parent_first_name', NEW.parent_first_name
      )
    );

    -- Requête enfilée avec succès (pg_net est async) → on stampe pour ne pas
    -- re-notifier au prochain UPDATE de parent_email.
    NEW.parent_marketing_notified_at := now();

  exception when others then
    -- Échec (Vault, pg_net, réseau…) : on avale, on NE stampe PAS (réessai)
    -- et l'écriture sur athletes se poursuit normalement.
    raise warning 'notify_parent_marketing a échoué pour athlete %: %', NEW.id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- 3. Trigger : BEFORE INSERT OR UPDATE de la seule colonne parent_email
--    (miroir du jumeau — c'est le moment où le courriel parent se matérialise).
drop trigger if exists trg_notify_parent_marketing on public.athletes;
create trigger trg_notify_parent_marketing
  before insert or update of parent_email
  on public.athletes
  for each row
  execute function public.notify_parent_marketing();
