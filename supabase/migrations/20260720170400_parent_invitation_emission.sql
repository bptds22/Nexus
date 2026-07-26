-- ═══════════════════════════════════════════════════════════════
-- Portal parental — Lot 1a. Migration 5/5 : émission de l'invitation parent
-- DANS le flow existant (trigger notify_parent_on_minor).
--
-- ⚠️ CHECKLIST PRÉ-PROD (condition BP) : cette migration fait CREATE OR REPLACE
-- de notify_parent_on_minor() en repartant de la version repo 20260708120000.
-- AVANT tout push prod : dump pg_get_functiondef('public.notify_parent_on_minor')
-- depuis PROD et diff contre 20260708120000. Identiques → push. Écart (hotfix
-- prod hors-repo) → STOP, on regarde. Ne PAS écraser à l'aveugle.
--
-- Écart #3 assumé : parent_invitations.athlete_id devient DEFERRABLE INITIALLY
-- DEFERRED — le trigger BEFORE INSERT insère l'invitation avant que la ligne
-- athletes soit committée ; la FK est vérifiée au COMMIT (l'athlète existe alors).
-- ═══════════════════════════════════════════════════════════════

-- Défensif : colonne d'idempotence du flow parent-notice (présente en prod via
-- 20260708120000, absente sur la DB locale désync). IF NOT EXISTS → no-op prod.
alter table public.athletes add column if not exists parent_notified_at timestamptz;

alter table public.parent_invitations
  drop constraint if exists parent_invitations_athlete_id_fkey;
alter table public.parent_invitations
  add constraint parent_invitations_athlete_id_fkey
    foreign key (athlete_id) references public.athletes(id) on delete cascade
    deferrable initially deferred;

-- Version repo 20260708120000 (BEFORE, garde 14-17, idempotence parent_notified_at)
-- + création de l'invitation parent + claim_token dans le body pg_net. Rien d'autre.
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
  v_token  text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-notice';
begin
  -- Gardes bon-marché (inchangées).
  if NEW.date_naissance is null
     or NEW.parent_email is null
     or NEW.parent_notified_at is not null then
    return NEW;
  end if;

  v_age := extract(year from age(NEW.date_naissance))::int;
  if v_age < 14 or v_age > 17 then
    return NEW;
  end if;

  begin
    -- ── Lot 1a : émission de l'invitation parent (FK deferrable → NEW.id pas
    --    encore committé, la FK sera vérifiée au commit). Une seule PENDING par
    --    athlète (index partiel) → ON CONFLICT DO NOTHING défensif.
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    insert into public.parent_invitations (token, athlete_id, parent_email)
      values (v_token, NEW.id, NEW.parent_email)
      on conflict (athlete_id) where claimed_at is null do nothing;
    -- Token effectif : nouvellement inséré OU pending pré-existant.
    select token into v_token from public.parent_invitations
      where athlete_id = NEW.id and claimed_at is null
      order by created_at desc limit 1;

    -- ── Email best-effort (inchangé sauf claim_token ajouté au body).
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'PARENT_NOTICE_SECRET' limit 1;

    if v_secret is null then
      raise warning 'notify_parent_on_minor: PARENT_NOTICE_SECRET absent du Vault';
      return NEW;  -- invitation créée ; email non envoyé ; pas de stamp → réessai possible.
    end if;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-parent-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'parent_email',      NEW.parent_email,
        'parent_first_name', NEW.parent_first_name,
        'claim_token',       v_token
      )
    );

    NEW.parent_notified_at := now();

  exception when others then
    raise warning 'notify_parent_on_minor a échoué pour athlete %: %', NEW.id, SQLERRM;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_notify_parent_on_minor on public.athletes;
create trigger trg_notify_parent_on_minor
  before insert or update of date_naissance, parent_email
  on public.athletes
  for each row
  execute function public.notify_parent_on_minor();
