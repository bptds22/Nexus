-- Retrait LOCAL de 20261015114923 (rejeu en local seulement) : supprime les deux fonctions nouvelles
-- et remet les trois fonctions de trigger d'avant (copiées des migrations qui les ont créées).
-- Les empreintes résultantes sont celles qu'attend la garde d'entrée de la migration (vérifié).
begin;
drop function public.invitation_recruteurs_suivent(text);
drop function public.recruteurs_suivant_athlete(uuid);
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
create or replace function public.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Seules les invitations RÉELLEMENT en attente valent une notification. Une
  -- ligne créée directement en ACCEPTED/CANCELLED (reprise, import) n'appelle
  -- aucune décision de l'athlète.
  if NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;

  -- Une notification est un ornement : elle ne doit JAMAIS faire échouer la
  -- création de l'invitation elle-même. Même principe que le try/catch du
  -- helper haptique et que notify_invitation_email.
  begin
    insert into public.athlete_notifications (athlete_id, type, title, metadata)
    values (
      NEW.athlete_id,
      'TEAM_INVITATION',
      'Un coach t''invite à rejoindre son équipe',
      jsonb_build_object(
        'invitation_id', NEW.id,
        'team_id',       NEW.team_id,
        'coach_id',      NEW.invited_by_coach_id
      )
    );
  exception when others then
    raise warning 'notify_team_invitation a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;
create or replace function public.notify_team_invitation_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_secret     text;
  v_email      text;
  v_coach_name text;
  v_team       record;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-team-invitation';
begin
  -- Garde d'idempotence + périmètre : pas de jeton (voir l'en-tête), déjà
  -- envoyé, ou invitation qui ne demande aucune décision.
  if NEW.transfer_token is null
     or NEW.email_sent_at is not null
     or NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;

  begin
    -- Destinataire : l'adresse de la FICHE, sinon celle du COMPTE. L'ordre
    -- compte — un athlète inscrit par Apple avec relais privé porte une adresse
    -- de compte que son coach ne connaît pas, mais qui reste livrable.
    select nullif(btrim(coalesce(a.email, u.email, '')), '')
      into v_email
    from public.athletes a
    left join public.users u on u.id = a.user_id
    where a.id = NEW.athlete_id;

    if v_email is null then
      -- Rien à envoyer, et ce n'est pas une erreur : la pastille in-app reste.
      return NEW;
    end if;

    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'TEAM_INVITE_NOTICE_SECRET'
     limit 1;

    if v_secret is null then
      raise warning 'notify_team_invitation_email: TEAM_INVITE_NOTICE_SECRET absent du Vault';
      return NEW;  -- pas de stamp → réessai possible
    end if;

    select t.name, s.name as school_name, sp.nom as sport_name,
           t.age_group, t.division, t.gender
      into v_team
    from public.teams t
    left join public.schools s on s.id = t.school_id
    left join public.sports  sp on sp.id = t.sport_id
    where t.id = NEW.team_id;

    select nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
      into v_coach_name
    from public.users u where u.id = NEW.invited_by_coach_id;

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-team-invite-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'email',          v_email,
        'coach_name',     coalesce(v_coach_name, ''),
        'team_name',      coalesce(v_team.name, ''),
        'school_name',    coalesce(v_team.school_name, ''),
        'sport',          coalesce(v_team.sport_name, ''),
        'age_group',      coalesce(v_team.age_group, ''),
        'division',       coalesce(v_team.division, ''),
        'gender',         coalesce(v_team.gender, ''),
        'transfer_token', NEW.transfer_token
      )
    );

    NEW.email_sent_at := now();

  exception when others then
    -- Vault, pg_net, lecture, réseau… : avalé, PAS de stamp, l'invitation se
    -- crée quand même. Un courriel est un ornement ; l'invitation est le fait.
    raise warning 'notify_team_invitation_email a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;
commit;
