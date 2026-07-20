-- notify_parent_on_minor : avis parental Loi 25 pour les athlètes 14-17.
--
-- Quand un athlète mineur (14-17) matérialise/complète sa row `athletes` avec
-- date_naissance + parent_email, on appelle l'edge function send-parent-notice
-- (Resend) via pg_net. Cloné sur notify_on_message (lecture Vault, net.http_post,
-- erreur avalée).
--
-- Trigger BEFORE (pas AFTER) : permet de stamper NEW.parent_notified_at
-- atomiquement sur la MÊME row — pas d'UPDATE récursif, pas de re-déclenchement.
-- Idempotence : parent_notified_at non-null = déjà notifié → on ne renvoie pas.

-- 1. Colonne d'idempotence (garde anti-doublon d'envoi).
alter table public.athletes
  add column if not exists parent_notified_at timestamptz;

-- 2. Fonction trigger.
create or replace function public.notify_parent_on_minor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $function$
declare
  v_secret text;
  v_age    int;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-notice';
begin
  -- Gardes bon-marché AVANT tout travail :
  --   pas de DOB, pas de courriel parent, ou notice déjà envoyée → on ne fait rien.
  if NEW.date_naissance is null
     or NEW.parent_email is null
     or NEW.parent_notified_at is not null then
    return NEW;
  end if;

  -- Âge révolu au moment de l'écriture. On ne notifie QUE la tranche 14-17
  -- (borne haute explicite : jamais les 18+ ; les <14 sont hard-block au signup).
  v_age := extract(year from age(NEW.date_naissance))::int;
  if v_age < 14 or v_age > 17 then
    return NEW;
  end if;

  -- À partir d'ici : mineur 14-17, parent connu, jamais notifié.
  -- Tout est protégé : l'échec de la notif ne casse JAMAIS l'écriture sur athletes.
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'PARENT_NOTICE_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_parent_on_minor: PARENT_NOTICE_SECRET absent du Vault';
      return NEW;  -- pas de stamp → réessai possible au prochain write
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-parent-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'parent_email', NEW.parent_email,
        'parent_first_name', NEW.parent_first_name
      )
    );

    -- Requête enfilée avec succès (pg_net est async) → on stampe pour ne pas
    -- re-notifier au prochain UPDATE de date_naissance / parent_email.
    NEW.parent_notified_at := now();

  exception when others then
    -- Échec (Vault, pg_net, réseau…) : on avale, on NE stampe PAS (pour réessai)
    -- et l'écriture sur athletes se poursuit normalement.
    raise warning 'notify_parent_on_minor a échoué pour athlete %: %', NEW.id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- 3. Trigger : BEFORE INSERT OR UPDATE des seules colonnes pertinentes.
drop trigger if exists trg_notify_parent_on_minor on public.athletes;
create trigger trg_notify_parent_on_minor
  before insert or update of date_naissance, parent_email
  on public.athletes
  for each row
  execute function public.notify_parent_on_minor();
