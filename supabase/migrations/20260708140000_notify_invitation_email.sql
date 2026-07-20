-- notify_invitation_email : envoi de l'email d'invitation coach→athlète.
--
-- À l'INSERT (nouvelle invite) OU à l'UPDATE de email/email_sent_at (renvoi via
-- le RPC create_athlete_invitation qui remet email_sent_at=NULL), quand `email`
-- est présent, appelle l'edge function send-invitation (Resend) via pg_net avec
-- un lien de claim /claim?token=NEW.token. Cloné sur notify_parent_on_minor.
--
-- Trigger BEFORE : stampe NEW.email_sent_at atomiquement (idempotence, miroir de
-- parent_notified_at) — pas d'UPDATE récursif.
--
-- DOUBLE BARRIÈRE <14 (Loi 25) : le gate DUR vit dans le RPC (RAISE, bloque
-- l'invitation entière). ICI = 2e barrière SILENCIEUSE : avant d'envoyer, on
-- relit athletes.date_naissance ; si <14 connu → on N'ENVOIE PAS (pas de RAISE,
-- juste pas d'email). Un email d'invitation à un <14 ne doit JAMAIS partir,
-- même si un INSERT contourne le RPC.

create or replace function public.notify_invitation_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $function$
declare
  v_secret     text;
  v_dob        date;
  v_coach_name text;
  v_school     text;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-invitation';
begin
  -- Garde idempotence : pas de destinataire (email NULL) ou déjà envoyé.
  -- Couvre aussi les UPDATE non liés (consume : email_sent_at déjà non-NULL).
  if NEW.email is null or NEW.email_sent_at is not null then
    return NEW;
  end if;

  -- Tout protégé : l'échec de l'envoi ne casse JAMAIS l'écriture de l'invitation.
  begin
    -- Garde-fou <14 (2e barrière, silencieuse). Ne bloque que si DOB CONNUE et
    -- <14 (cohérent avec isUnder14("")=false côté front). Pas de stamp → si la
    -- row est retouchée, on re-vérifie.
    select date_naissance into v_dob
    from public.athletes
    where id = NEW.athlete_id;

    if v_dob is not null and extract(year from age(v_dob))::int < 14 then
      raise warning 'notify_invitation_email: athlete % <14 — email d''invitation SUPPRIMÉ (Loi 25)', NEW.athlete_id;
      return NEW;  -- pas d'envoi, pas de stamp
    end if;

    -- Secret dispatch dédié depuis le Vault.
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'INVITE_NOTICE_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_invitation_email: INVITE_NOTICE_SECRET absent du Vault';
      return NEW;  -- pas de stamp → réessai possible
    end if;

    -- Coach (created_by → users) + son école (users.school_id → schools.name).
    -- coalesce/trim : noms/école NULL → chaînes vides (send-invitation a le repli).
    select trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
           s.name
    into v_coach_name, v_school
    from public.users u
    left join public.schools s on s.id = u.school_id
    where u.id = NEW.created_by;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-invite-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'coach_name', coalesce(v_coach_name, ''),
        'school_name', coalesce(v_school, ''),
        'claim_token', NEW.token
      )
    );

    -- Enfilé avec succès (pg_net async) → stamp pour ne pas renvoyer.
    NEW.email_sent_at := now();

  exception when others then
    -- Échec (Vault, pg_net, lecture, réseau…) : avalé, PAS de stamp (réessai),
    -- l'écriture de l'invitation se poursuit.
    raise warning 'notify_invitation_email a échoué pour invitation % (athlete %): %', NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- Trigger : BEFORE INSERT (nouvelle invite) OR UPDATE OF email, email_sent_at
-- (renvoi — le RPC remet email_sent_at=NULL). Les UPDATE de consume (status/
-- consumed_*) ne touchent pas ces colonnes → ne déclenchent pas.
drop trigger if exists trg_notify_invitation_email on public.athlete_invitations;
create trigger trg_notify_invitation_email
  before insert or update of email, email_sent_at
  on public.athlete_invitations
  for each row
  execute function public.notify_invitation_email();
