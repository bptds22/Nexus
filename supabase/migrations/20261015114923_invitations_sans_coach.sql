-- Invitations coach → joueur : AUCUN message ne nomme le coach ; le texte dit ce qui est VRAI
-- (base seulement). Décision BP du 2026-10-15.
--
--  · recruteurs_suivant_athlete(athlete) : nombre de recruteurs DISTINCTS (compte RECRUTEUR actif)
--    qui suivent la fiche — favori, dossier de pipeline, ou carte prospect rapprochée de cette
--    fiche et ACCEPTÉE (fusion active ou définitive). Une proposition de rapprochement non
--    décidée ne compte PAS : on ne sait pas encore si c'est lui. Jamais qui. Serveur seulement.
--  · invitation_recruteurs_suivent(jeton) : ce nombre pour la page /claim, SEULEMENT pour un jeton
--    d'invitation valide (même règle que resolve_athlete_invitation) ; sinon null.
--  · notify_invitation_email : le courriel de réclamation reçoit le NOMBRE, plus le nom du coach
--    ni de son école.
--  · notify_team_invitation_email : le courriel d'invitation d'équipe ne reçoit plus le nom du coach,
--    et l'équipe n'est nommée que si elle est SECONDAIRE ou LIGUE_CIVILE (règle RSEQ).
--  · Les deux courriels respectent la désinscription (registre des adresses et des comptes) et
--    transmettent de quoi signer le lien « Ne plus recevoir ces courriels ».
--  · notify_team_invitation : la notification in-app ne dit plus « Un coach t'invite ».
-- Les trois fonctions de trigger sont redéfinies par CREATE OR REPLACE (droits et triggers
-- conservés), après une garde sur la version remplacée.

do $$
begin
  if to_regprocedure('public.recruteurs_suivant_athlete(uuid)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (recruteurs_suivant_athlete existe)';
  end if;
  -- Versions remplacées : empreinte SANS commentaires ni espaces (prod et local diffèrent par les
  -- commentaires). notify_team_invitation_email : la version locale diffère aussi par les accents
  -- d'un message d'avertissement (50204cf9…), la logique est la même — les deux sont acceptées.
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_invitation_email()'::regprocedure)
     is distinct from 'd244312f80d9eee525350202f35b1b31' then
    raise exception 'NEXUS: notify_invitation_email ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation()'::regprocedure)
     is distinct from 'a0f127b99390c4c6b254c60781da29af' then
    raise exception 'NEXUS: notify_team_invitation ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation_email()'::regprocedure)
     not in ('09ed0ec710566d6f80ce04c1e169ec64', '50204cf96db32c39c440e10aea85bf51') then
    raise exception 'NEXUS: notify_team_invitation_email ne correspond pas au relevé';
  end if;
end $$;

-- ── Le nombre réel de recruteurs qui suivent une fiche ───────────────────────

create function public.recruteurs_suivant_athlete(p_athlete uuid)
returns integer
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select count(distinct r.recruteur)::int
    from (
      select f.recruiter_id as recruteur from public.recruiter_favorites f where f.athlete_id = p_athlete
      union
      select p.recruiter_id from public.recruiter_pipeline p where p.athlete_id = p_athlete
      union
      -- Carte prospect fusionnée avec CETTE fiche (rapprochement accepté) : son auteur la suit.
      select c.cree_par
        from public.fusions_cartes fc
        join public.cartes_prospect c on c.id = fc.carte_id
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
      union
      select fc.acteur
        from public.fusions_cartes fc
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
    ) r
    join public.users u on u.id = r.recruteur
   where u.role = 'RECRUTEUR'::public.user_role
     and u.status = 'ACTIF'::public.account_status
$$;

-- ── /claim : le nombre, seulement pour un jeton valide ───────────────────────

create function public.invitation_recruteurs_suivent(p_token text)
returns integer
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ai record;
begin
  select ai.athlete_id, ai.status, ai.expires_at into v_ai
    from public.athlete_invitations ai where ai.token = p_token limit 1;
  if v_ai.athlete_id is null
     or v_ai.status <> 'PENDING' or v_ai.expires_at <= now()
     or exists (select 1 from public.athletes a where a.id = v_ai.athlete_id and a.user_id is not null) then
    return null;
  end if;
  return public.recruteurs_suivant_athlete(v_ai.athlete_id);
end;
$$;

-- ── Courriel de réclamation : le nombre, plus le coach ───────────────────────

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

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.recruteurs_suivant_athlete(uuid) from public, anon, authenticated;
revoke all on function public.invitation_recruteurs_suivent(text) from public, anon, authenticated;
grant execute on function public.invitation_recruteurs_suivent(text) to anon, authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('recruteurs_suivant_athlete', 'invitation_recruteurs_suivent')
  loop
    veut := case when r.proname = 'recruteurs_suivant_athlete' then array['postgres', 'service_role']
                 else array['anon', 'authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('notify_invitation_email', 'notify_team_invitation_email', 'notify_team_invitation')
               and (position('coach_name' in prosrc) > 0 or position('Un coach' in prosrc) > 0)) then
    raise exception 'NEXUS: un trigger d''invitation transmet encore le coach';
  end if;
  -- Désinscription respectée et équipe collégiale jamais nommée (règle RSEQ).
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('notify_invitation_email', 'notify_team_invitation_email')
        and position('courriel_desabonnements_adresses' in prosrc) > 0
        and position('courriel_desabonnements d' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: un courriel d''invitation ignore la désinscription';
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                   and proname = 'notify_team_invitation_email'
                   and position('''SECONDAIRE'', ''LIGUE_CIVILE''' in prosrc) > 0) then
    raise exception 'NEXUS: le courriel d''équipe pourrait nommer une équipe collégiale';
  end if;
  if (select count(*) from pg_trigger where tgname in ('trg_notify_invitation_email', 'trg_notify_team_invitation_email', 'trg_notify_team_invitation')) <> 3 then
    raise exception 'NEXUS: triggers d''invitation absents';
  end if;
  raise notice 'NEXUS invitations : aucun coach dans les messages, nombre réel de recruteurs, ACL exactes — OK';
end $$;
