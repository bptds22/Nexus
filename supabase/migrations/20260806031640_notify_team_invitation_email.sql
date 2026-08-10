-- ═══════════════════════════════════════════════════════════════════════════
-- notify_team_invitation_email — le courriel du transfert
--
-- LE TROU QU'IL COMBLE
-- team_invitations n'avait aucune chaîne d'envoi, contrairement à
-- athlete_invitations. Un athlète invité n'était prévenu que par la pastille
-- in-app (déclencheur trg_notify_team_invitation) — donc uniquement s'il
-- ouvrait l'application. Celui qui ne l'ouvre pas ne savait rien.
--
-- ⚠ IL N'ENVOIE QUE SI transfer_token EST POSÉ — ET C'EST UNE LIMITE ASSUMÉE
-- Trois chemins créent une invitation d'équipe :
--   1. invite_anchored_athlete_to_team  → pose un jeton → COURRIEL ENVOYÉ
--   2. inviteAthleteToTeam (suggestion) → pas de jeton → pas de courriel
--   3. l'INSERT direct du wizard mobile → pas de jeton → pas de courriel
-- Les deux derniers restent donc muets par courriel, comme avant. Ce n'est pas
-- un oubli : sans jeton, le lien mènerait à un portail vide. Les rebrancher
-- suppose de leur faire générer un jeton aussi — chantier distinct, à décider.
--
-- ⚠ DEUX SECRETS À DÉPOSER, DES DEUX CÔTÉS — SINON SILENCE TOTAL
-- Le déclencheur lit TEAM_INVITE_NOTICE_SECRET dans le Vault ; la fonction
-- périphérique lit une variable d'environnement du MÊME nom et compare. Les
-- deux valeurs doivent être IDENTIQUES. Si le Vault est vide, le déclencheur
-- sort proprement sans poser email_sent_at (réessai possible) ; si seules les
-- deux divergent, Resend n'est jamais appelé et la fonction répond 401.
-- Dans les deux cas l'invitation se crée et la pastille monte : le seul signal
-- est un `raise warning` dans les journaux Postgres.
--
-- LIMITE DU CHANTIER : le lien mène à /athlete/parametres?tab=transfert, un
-- onglet qui n'existe PAS sur dev. Tant que feat/transfer-portal n'est pas
-- fusionnée, l'athlète atterrira sur « Compte ». Décision de fusion séparée.
--
-- PATRON : calqué sur notify_invitation_email (l'autre chaîne de courriel).
--   BEFORE INSERT · SECURITY DEFINER · secret du Vault · pg_net · stamp
-- Tout est enveloppé : l'échec d'un envoi ne doit JAMAIS empêcher la création
-- de l'invitation. Pas de stamp en cas d'échec → un réessai reste possible.
-- ═══════════════════════════════════════════════════════════════════════════

-- Colonne de trace, jumelle de athlete_invitations.email_sent_at. Sa présence
-- vaut idempotence : posée = déjà enfilé, on ne renvoie pas.
alter table public.team_invitations
  add column if not exists email_sent_at timestamptz;

comment on column public.team_invitations.email_sent_at is
  'Horodatage d''ENFILEMENT de l''envoi (pg_net asynchrone), pas de livraison. '
  'NULL après un échec → réessai possible.';

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

drop trigger if exists trg_notify_team_invitation_email on public.team_invitations;

create trigger trg_notify_team_invitation_email
  before insert on public.team_invitations
  for each row
  execute function public.notify_team_invitation_email();

comment on function public.notify_team_invitation_email() is
  'BEFORE INSERT sur team_invitations → courriel de transfert via '
  'send-team-invitation (Resend). N''envoie QUE si transfer_token est posé : '
  'les invitations issues d''une suggestion restent muettes par courriel.';
