-- Retrait LOCAL de 20261015125824 (rejeu en local seulement) : supprime coach_nommable et
-- invitation_coach_nomme, remet les trois fonctions de trigger de 20261015114923.
begin;
drop function if exists public.invitation_coach_nomme(text);
drop function if exists public.invitation_equipe_coach(uuid);
drop function if exists public.coach_nommable(uuid);
delete from supabase_migrations.schema_migrations where version = '20261015125824';
create or replace function public.notify_invitation_email()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_secret     text;
  v_dob        date;
  v_recruteurs integer;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-invitation';
begin
  -- Garde idempotence : pas de destinataire (email NULL) ou déjà envoyé.
  -- Couvre aussi les UPDATE non liés (consume : email_sent_at déjà non-NULL).
  if NEW.email is null or NEW.email_sent_at is not null then
    return NEW;
  end if;

  -- Tout protégé : l'échec de l'envoi ne casse JAMAIS l'écriture de l'invitation.
  begin
    -- Garde-fou <14 (2e barrière, silencieuse). Ne bloque que si DOB CONNUE et <14.
    select date_naissance into v_dob
    from public.athletes
    where id = NEW.athlete_id;

    if v_dob is not null and extract(year from age(v_dob))::int < 14 then
      raise warning 'notify_invitation_email: athlete % <14 — email d''invitation SUPPRIMÉ (Loi 25)', NEW.athlete_id;
      return NEW;  -- pas d'envoi, pas de stamp
    end if;

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'INVITE_NOTICE_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_invitation_email: INVITE_NOTICE_SECRET absent du Vault';
      return NEW;  -- pas de stamp → réessai possible
    end if;

    -- Désinscription (LCAP) : l'adresse inscrite au registre, ou le compte qui la porte, ne
    -- reçoit plus rien. Pas de stamp : rien n'est parti.
    if exists (select 1 from public.courriel_desabonnements_adresses d
                where d.empreinte = public.empreinte_courriel(NEW.email))
       or exists (select 1 from public.courriel_desabonnements d join public.users u on u.id = d.user_id
                   where lower(btrim(u.email)) = lower(btrim(NEW.email))) then
      return NEW;
    end if;

    -- 2026-10-15 (décision BP, règle RSEQ) : AUCUN nom de coach, d'école, de cégep ni de recruteur.
    -- Le seul fait transmis est le nombre RÉEL de recruteurs qui suivent la fiche (jamais qui).
    v_recruteurs := public.recruteurs_suivant_athlete(NEW.athlete_id);

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-invite-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'email', NEW.email,
        'nb_recruteurs', coalesce(v_recruteurs, 0),
        'claim_token', NEW.token,
        -- Pour le lien « Ne plus recevoir ces courriels » (jeton signé par la fonction d'envoi).
        'invitation_id', NEW.id
      )
    );

    -- Enfilé avec succès (pg_net async) → stamp pour ne pas renvoyer.
    NEW.email_sent_at := now();

  exception when others then
    -- Échec (Vault, pg_net, lecture, réseau…) : avalé, PAS de stamp (réessai).
    raise warning 'notify_invitation_email a échoué pour invitation % (athlete %): %', NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- ── Courriel d'invitation d'équipe : plus le nom du coach ────────────────────

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
  v_user       uuid;
  v_team       record;
  v_nommable   boolean;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-team-invitation';
begin
  -- Garde d'idempotence + périmètre. N'ENVOIE QUE SI transfer_token EST POSÉ.
  if NEW.transfer_token is null
     or NEW.email_sent_at is not null
     or NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;

  begin
    -- Destinataire : adresse de la FICHE, sinon celle du COMPTE.
    select nullif(btrim(coalesce(a.email, u.email, '')), ''), a.user_id
      into v_email, v_user
    from public.athletes a
    left join public.users u on u.id = a.user_id
    where a.id = NEW.athlete_id;

    if v_email is null then
      return NEW;  -- rien à envoyer ; la pastille in-app reste
    end if;

    -- Sans compte, pas de lien de désabonnement possible (jeton de compte) — et le lien de
    -- transfert exige de se connecter. Rien ne part ; la pastille in-app reste.
    if v_user is null then
      return NEW;
    end if;

    -- Désinscription (LCAP) : compte au registre, ou adresse au registre → rien ne part.
    if exists (select 1 from public.courriel_desabonnements d where d.user_id = v_user)
       or exists (select 1 from public.courriel_desabonnements_adresses d
                   where d.empreinte = public.empreinte_courriel(v_email)) then
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

    select t.name, s.name as school_name, s.type as school_type, sp.nom as sport_name,
           t.age_group, t.division, t.gender
      into v_team
    from public.teams t
    left join public.schools s on s.id = t.school_id
    left join public.sports  sp on sp.id = t.sport_id
    where t.id = NEW.team_id;

    -- 2026-10-15 (décision BP, règle RSEQ) : aucun nom de coach. L'équipe et son école ne sont
    -- nommées QUE si c'est une équipe secondaire ou civile ; une équipe ou une école collégiale
    -- (ou de type inconnu) n'est jamais nommée, ni rien qui permette de la deviner.
    v_nommable := coalesce(v_team.school_type in ('SECONDAIRE', 'LIGUE_CIVILE'), false);

    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-team-invite-notice-secret', v_secret
      ),
      body := jsonb_build_object(
        'email',          v_email,
        'team_name',      case when v_nommable then coalesce(v_team.name, '') else '' end,
        'school_name',    case when v_nommable then coalesce(v_team.school_name, '') else '' end,
        'sport',          case when v_nommable then coalesce(v_team.sport_name, '') else '' end,
        'age_group',      case when v_nommable then coalesce(v_team.age_group, '') else '' end,
        'division',       case when v_nommable then coalesce(v_team.division, '') else '' end,
        'gender',         case when v_nommable then coalesce(v_team.gender, '') else '' end,
        'transfer_token', NEW.transfer_token,
        -- Pour le lien « Ne plus recevoir ces courriels » (jeton de compte, signé par la fonction).
        'user_id',        v_user
      )
    );

    NEW.email_sent_at := now();

  exception when others then
    raise warning 'notify_team_invitation_email a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- ── Notification in-app : plus « Un coach t'invite » ─────────────────────────

create or replace function public.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;
  begin
    insert into public.athlete_notifications (athlete_id, type, title, metadata)
    values (
      NEW.athlete_id,
      'TEAM_INVITATION',
      'Invitation à rejoindre une équipe',
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
commit;
