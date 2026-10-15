-- LOT PROD invitations coach nommé — généré par docs/invitations-coach-nomme/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261015125824_invitations_coach_nomme.sql — md5 e1bf4215cc441627301cc15599aa2742
-- Empreinte attendue des objets : 00000000000000000000000000000000
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _cn_releve as
select txid_current() as txid,
       (select count(*) from public.athlete_invitations) || '|' || (select count(*) from public.team_invitations)
       || '|' || (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.courriel_desabonnements)
       || '|' || (select count(*) from public.courriel_desabonnements_adresses) as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261015125824') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _cn_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _cn_releve) <> 0 then
    raise exception 'NEXUS LOT: migration invitations déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261015125824_invitations_coach_nomme.sql =====
-- Invitations : le coach du SECONDAIRE ou du CIVIL peut être nommé (correction BP du 2026-10-15).
-- Règle RSEQ précisée : seuls les recruteurs, les cégeps et les coachs d'équipes COLLÉGIALES ne sont
-- jamais nommés à un athlète. Le nombre de recruteurs reste le seul fait sur eux, jamais lesquels.
--
--  · coach_nommable(coach) : { nom, ecole } SEULEMENT si le compte est un COACH dont l'école
--    (users.school_id) est SECONDAIRE ou LIGUE_CIVILE et qui n'entraîne AUCUNE équipe d'un autre
--    type (collégiale, ou école inconnue). Sinon null : indéterminé = jamais nommé. Serveur seulement.
--  · invitation_coach_nomme(jeton) : la même chose pour la page /claim, seulement pour un jeton
--    d'invitation valide (même règle que invitation_recruteurs_suivent) ; sinon null.
--  · invitation_equipe_coach(invitation) : pour la carte « Invitations en attente » — le coach
--    nommable d'une invitation d'équipe, SEULEMENT pour l'athlète destinataire (son compte) et si
--    l'équipe est secondaire ou civile ; sinon null.
--  · notify_invitation_email : transmet coach_name / coach_ecole quand le coach est nommable.
--  · notify_team_invitation_email : transmet coach_name quand l'équipe ET le coach sont nommables.
--  · notify_team_invitation : « {Coach} t'invite à rejoindre {Équipe} » dans ce même cas ; sinon le
--    titre générique.
-- La désinscription (20261015114923) est conservée telle quelle.

do $$
begin
  if to_regprocedure('public.coach_nommable(uuid)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (coach_nommable existe)';
  end if;
  -- Versions remplacées (celles de 20261015114923), empreinte SANS commentaires ni espaces.
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_invitation_email()'::regprocedure)
     is distinct from '1a4763db8ab134709a116532a949a196' then
    raise exception 'NEXUS: notify_invitation_email ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation()'::regprocedure)
     is distinct from 'd426a638bfac7ea08e17407759b2c09a' then
    raise exception 'NEXUS: notify_team_invitation ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation_email()'::regprocedure)
     is distinct from '6f9b30afda372be7b6dd101e830c9bb2' then
    raise exception 'NEXUS: notify_team_invitation_email ne correspond pas au relevé';
  end if;
end $$;

-- ── Qui peut être nommé : un coach du secondaire ou du civil, rien d'autre ───

create function public.coach_nommable(p_coach uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
           'nom',   btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
           'ecole', btrim(coalesce(s.name, '')))
    from public.users u
    join public.schools s on s.id = u.school_id
   where u.id = p_coach
     and u.role = 'COACH'::public.user_role
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
     and btrim(coalesce(u.first_name, '') || coalesce(u.last_name, '')) <> ''
     -- Une seule équipe collégiale (ou d'école inconnue) suffit : jamais nommé.
     and not exists (
       select 1
         from public.team_coaches tc
         join public.teams t on t.id = tc.team_id
         left join public.schools s2 on s2.id = t.school_id
        where tc.coach_id = p_coach
          and coalesce(s2.type, '') not in ('SECONDAIRE', 'LIGUE_CIVILE'))
$$;

-- ── /claim : le coach nommable, seulement pour un jeton valide ───────────────

create function public.invitation_coach_nomme(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ai record;
begin
  select ai.athlete_id, ai.created_by, ai.status, ai.expires_at into v_ai
    from public.athlete_invitations ai where ai.token = p_token limit 1;
  if v_ai.athlete_id is null
     or v_ai.status <> 'PENDING' or v_ai.expires_at <= now()
     or exists (select 1 from public.athletes a where a.id = v_ai.athlete_id and a.user_id is not null) then
    return null;
  end if;
  return public.coach_nommable(v_ai.created_by);
end;
$$;

-- ── Carte « Invitations en attente » : le coach, pour le destinataire seulement ──

create function public.invitation_equipe_coach(p_invitation uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.coach_nommable(ti.invited_by_coach_id)
    from public.team_invitations ti
    join public.athletes a on a.id = ti.athlete_id
    join public.teams t on t.id = ti.team_id
    join public.schools s on s.id = t.school_id
   where ti.id = p_invitation
     and a.user_id = auth.uid()
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
$$;

-- ── Courriel de réclamation : le coach s'il est nommable, et le nombre ───────

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
  v_coach      jsonb;
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

    -- Règle RSEQ : le nombre RÉEL de recruteurs, jamais lesquels. Le coach n'est nommé que s'il
    -- est du secondaire ou du civil (coach_nommable) ; sinon rien qui le désigne ne part.
    v_recruteurs := public.recruteurs_suivant_athlete(NEW.athlete_id);
    v_coach := public.coach_nommable(NEW.created_by);

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
      ) || case when v_coach is null then '{}'::jsonb
                else jsonb_build_object('coach_name', v_coach->>'nom', 'coach_ecole', v_coach->>'ecole') end
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

-- ── Courriel d'invitation d'équipe : le coach si l'équipe et lui sont nommables ──

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
  v_coach      jsonb;
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

    -- Règle RSEQ : l'équipe et son école ne sont nommées QUE si c'est une équipe secondaire ou
    -- civile ; le coach, seulement dans ce cas ET s'il est lui-même nommable. Une équipe ou une
    -- école collégiale (ou de type inconnu) n'est jamais nommée, ni rien qui permette de la deviner.
    v_nommable := coalesce(v_team.school_type in ('SECONDAIRE', 'LIGUE_CIVILE'), false);
    v_coach := case when v_nommable then public.coach_nommable(NEW.invited_by_coach_id) end;

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
      ) || case when v_coach is null then '{}'::jsonb
                else jsonb_build_object('coach_name', v_coach->>'nom') end
    );

    NEW.email_sent_at := now();

  exception when others then
    raise warning 'notify_team_invitation_email a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- ── Notification in-app : le coach et l'équipe si nommables ─────────────────

create or replace function public.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_team  record;
  v_coach jsonb;
  v_titre text := 'Invitation à rejoindre une équipe';
begin
  if NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;
  begin
    select t.name, s.type as school_type into v_team
      from public.teams t left join public.schools s on s.id = t.school_id
     where t.id = NEW.team_id;
    -- Règle RSEQ : nommés seulement pour une équipe secondaire ou civile et un coach nommable.
    if coalesce(v_team.school_type in ('SECONDAIRE', 'LIGUE_CIVILE'), false)
       and btrim(coalesce(v_team.name, '')) <> '' then
      v_coach := public.coach_nommable(NEW.invited_by_coach_id);
      if v_coach is not null then
        v_titre := (v_coach->>'nom') || ' t''invite à rejoindre ' || btrim(v_team.name);
      end if;
    end if;

    insert into public.athlete_notifications (athlete_id, type, title, metadata)
    values (
      NEW.athlete_id,
      'TEAM_INVITATION',
      v_titre,
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

revoke all on function public.coach_nommable(uuid) from public, anon, authenticated;
revoke all on function public.invitation_coach_nomme(text) from public, anon, authenticated;
grant execute on function public.invitation_coach_nomme(text) to anon, authenticated;
revoke all on function public.invitation_equipe_coach(uuid) from public, anon, authenticated;
grant execute on function public.invitation_equipe_coach(uuid) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('coach_nommable', 'invitation_coach_nomme', 'invitation_equipe_coach')
  loop
    veut := case r.proname when 'coach_nommable' then array['postgres', 'service_role']
                           when 'invitation_equipe_coach' then array['authenticated', 'postgres', 'service_role']
                           else array['anon', 'authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('notify_invitation_email', 'notify_team_invitation_email', 'notify_team_invitation')
        and position('coach_nommable(' in prosrc) > 0) <> 3 then
    raise exception 'NEXUS: un trigger d''invitation nomme le coach sans passer par coach_nommable';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('notify_invitation_email', 'notify_team_invitation_email')
        and position('courriel_desabonnements_adresses' in prosrc) > 0
        and position('courriel_desabonnements d' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: un courriel d''invitation ignore la désinscription';
  end if;
  if (select count(*) from pg_trigger where tgname in ('trg_notify_invitation_email', 'trg_notify_team_invitation_email', 'trg_notify_team_invitation')) <> 3 then
    raise exception 'NEXUS: triggers d''invitation absents';
  end if;
  raise notice 'NEXUS invitations : coach nommé seulement s''il est du secondaire ou du civil — OK';
end $$;

-- ===== FIN 20261015125824_invitations_coach_nomme.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _cn_texte as select $CNMIG$-- Invitations : le coach du SECONDAIRE ou du CIVIL peut être nommé (correction BP du 2026-10-15).
-- Règle RSEQ précisée : seuls les recruteurs, les cégeps et les coachs d'équipes COLLÉGIALES ne sont
-- jamais nommés à un athlète. Le nombre de recruteurs reste le seul fait sur eux, jamais lesquels.
--
--  · coach_nommable(coach) : { nom, ecole } SEULEMENT si le compte est un COACH dont l'école
--    (users.school_id) est SECONDAIRE ou LIGUE_CIVILE et qui n'entraîne AUCUNE équipe d'un autre
--    type (collégiale, ou école inconnue). Sinon null : indéterminé = jamais nommé. Serveur seulement.
--  · invitation_coach_nomme(jeton) : la même chose pour la page /claim, seulement pour un jeton
--    d'invitation valide (même règle que invitation_recruteurs_suivent) ; sinon null.
--  · invitation_equipe_coach(invitation) : pour la carte « Invitations en attente » — le coach
--    nommable d'une invitation d'équipe, SEULEMENT pour l'athlète destinataire (son compte) et si
--    l'équipe est secondaire ou civile ; sinon null.
--  · notify_invitation_email : transmet coach_name / coach_ecole quand le coach est nommable.
--  · notify_team_invitation_email : transmet coach_name quand l'équipe ET le coach sont nommables.
--  · notify_team_invitation : « {Coach} t'invite à rejoindre {Équipe} » dans ce même cas ; sinon le
--    titre générique.
-- La désinscription (20261015114923) est conservée telle quelle.

do $$
begin
  if to_regprocedure('public.coach_nommable(uuid)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (coach_nommable existe)';
  end if;
  -- Versions remplacées (celles de 20261015114923), empreinte SANS commentaires ni espaces.
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_invitation_email()'::regprocedure)
     is distinct from '1a4763db8ab134709a116532a949a196' then
    raise exception 'NEXUS: notify_invitation_email ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation()'::regprocedure)
     is distinct from 'd426a638bfac7ea08e17407759b2c09a' then
    raise exception 'NEXUS: notify_team_invitation ne correspond pas au relevé';
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.notify_team_invitation_email()'::regprocedure)
     is distinct from '6f9b30afda372be7b6dd101e830c9bb2' then
    raise exception 'NEXUS: notify_team_invitation_email ne correspond pas au relevé';
  end if;
end $$;

-- ── Qui peut être nommé : un coach du secondaire ou du civil, rien d'autre ───

create function public.coach_nommable(p_coach uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select jsonb_build_object(
           'nom',   btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')),
           'ecole', btrim(coalesce(s.name, '')))
    from public.users u
    join public.schools s on s.id = u.school_id
   where u.id = p_coach
     and u.role = 'COACH'::public.user_role
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
     and btrim(coalesce(u.first_name, '') || coalesce(u.last_name, '')) <> ''
     -- Une seule équipe collégiale (ou d'école inconnue) suffit : jamais nommé.
     and not exists (
       select 1
         from public.team_coaches tc
         join public.teams t on t.id = tc.team_id
         left join public.schools s2 on s2.id = t.school_id
        where tc.coach_id = p_coach
          and coalesce(s2.type, '') not in ('SECONDAIRE', 'LIGUE_CIVILE'))
$$;

-- ── /claim : le coach nommable, seulement pour un jeton valide ───────────────

create function public.invitation_coach_nomme(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_ai record;
begin
  select ai.athlete_id, ai.created_by, ai.status, ai.expires_at into v_ai
    from public.athlete_invitations ai where ai.token = p_token limit 1;
  if v_ai.athlete_id is null
     or v_ai.status <> 'PENDING' or v_ai.expires_at <= now()
     or exists (select 1 from public.athletes a where a.id = v_ai.athlete_id and a.user_id is not null) then
    return null;
  end if;
  return public.coach_nommable(v_ai.created_by);
end;
$$;

-- ── Carte « Invitations en attente » : le coach, pour le destinataire seulement ──

create function public.invitation_equipe_coach(p_invitation uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.coach_nommable(ti.invited_by_coach_id)
    from public.team_invitations ti
    join public.athletes a on a.id = ti.athlete_id
    join public.teams t on t.id = ti.team_id
    join public.schools s on s.id = t.school_id
   where ti.id = p_invitation
     and a.user_id = auth.uid()
     and s.type in ('SECONDAIRE', 'LIGUE_CIVILE')
$$;

-- ── Courriel de réclamation : le coach s'il est nommable, et le nombre ───────

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
  v_coach      jsonb;
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

    -- Règle RSEQ : le nombre RÉEL de recruteurs, jamais lesquels. Le coach n'est nommé que s'il
    -- est du secondaire ou du civil (coach_nommable) ; sinon rien qui le désigne ne part.
    v_recruteurs := public.recruteurs_suivant_athlete(NEW.athlete_id);
    v_coach := public.coach_nommable(NEW.created_by);

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
      ) || case when v_coach is null then '{}'::jsonb
                else jsonb_build_object('coach_name', v_coach->>'nom', 'coach_ecole', v_coach->>'ecole') end
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

-- ── Courriel d'invitation d'équipe : le coach si l'équipe et lui sont nommables ──

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
  v_coach      jsonb;
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

    -- Règle RSEQ : l'équipe et son école ne sont nommées QUE si c'est une équipe secondaire ou
    -- civile ; le coach, seulement dans ce cas ET s'il est lui-même nommable. Une équipe ou une
    -- école collégiale (ou de type inconnu) n'est jamais nommée, ni rien qui permette de la deviner.
    v_nommable := coalesce(v_team.school_type in ('SECONDAIRE', 'LIGUE_CIVILE'), false);
    v_coach := case when v_nommable then public.coach_nommable(NEW.invited_by_coach_id) end;

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
      ) || case when v_coach is null then '{}'::jsonb
                else jsonb_build_object('coach_name', v_coach->>'nom') end
    );

    NEW.email_sent_at := now();

  exception when others then
    raise warning 'notify_team_invitation_email a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

-- ── Notification in-app : le coach et l'équipe si nommables ─────────────────

create or replace function public.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_team  record;
  v_coach jsonb;
  v_titre text := 'Invitation à rejoindre une équipe';
begin
  if NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;
  begin
    select t.name, s.type as school_type into v_team
      from public.teams t left join public.schools s on s.id = t.school_id
     where t.id = NEW.team_id;
    -- Règle RSEQ : nommés seulement pour une équipe secondaire ou civile et un coach nommable.
    if coalesce(v_team.school_type in ('SECONDAIRE', 'LIGUE_CIVILE'), false)
       and btrim(coalesce(v_team.name, '')) <> '' then
      v_coach := public.coach_nommable(NEW.invited_by_coach_id);
      if v_coach is not null then
        v_titre := (v_coach->>'nom') || ' t''invite à rejoindre ' || btrim(v_team.name);
      end if;
    end if;

    insert into public.athlete_notifications (athlete_id, type, title, metadata)
    values (
      NEW.athlete_id,
      'TEAM_INVITATION',
      v_titre,
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

revoke all on function public.coach_nommable(uuid) from public, anon, authenticated;
revoke all on function public.invitation_coach_nomme(text) from public, anon, authenticated;
grant execute on function public.invitation_coach_nomme(text) to anon, authenticated;
revoke all on function public.invitation_equipe_coach(uuid) from public, anon, authenticated;
grant execute on function public.invitation_equipe_coach(uuid) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('coach_nommable', 'invitation_coach_nomme', 'invitation_equipe_coach')
  loop
    veut := case r.proname when 'coach_nommable' then array['postgres', 'service_role']
                           when 'invitation_equipe_coach' then array['authenticated', 'postgres', 'service_role']
                           else array['anon', 'authenticated', 'postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('notify_invitation_email', 'notify_team_invitation_email', 'notify_team_invitation')
        and position('coach_nommable(' in prosrc) > 0) <> 3 then
    raise exception 'NEXUS: un trigger d''invitation nomme le coach sans passer par coach_nommable';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('notify_invitation_email', 'notify_team_invitation_email')
        and position('courriel_desabonnements_adresses' in prosrc) > 0
        and position('courriel_desabonnements d' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: un courriel d''invitation ignore la désinscription';
  end if;
  if (select count(*) from pg_trigger where tgname in ('trg_notify_invitation_email', 'trg_notify_team_invitation_email', 'trg_notify_team_invitation')) <> 3 then
    raise exception 'NEXUS: triggers d''invitation absents';
  end if;
  raise notice 'NEXUS invitations : coach nommé seulement s''il est du secondaire ou du civil — OK';
end $$;
$CNMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _cn_texte' using '20261015125824', 'invitations_coach_nomme', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _cn_texte' using '20261015125824', 'invitations_coach_nomme';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _cn_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015125824')
     is distinct from 'e1bf4215cc441627301cc15599aa2742' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coach_nommable', 'invitation_coach_nomme', 'invitation_equipe_coach', 'notify_invitation_email',
                       'notify_team_invitation_email', 'notify_team_invitation')
) t
  ) e;
  if v_empreinte is distinct from '00000000000000000000000000000000' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.athlete_invitations) || '|' || (select count(*) from public.team_invitations)
       || '|' || (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.courriel_desabonnements)
       || '|' || (select count(*) from public.courriel_desabonnements_adresses) <> (select donnees from _cn_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _cn_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.athlete_invitations) || '|' || (select count(*) from public.team_invitations)
       || '|' || (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.courriel_desabonnements)
       || '|' || (select count(*) from public.courriel_desabonnements_adresses),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261015125824'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261015125824'),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                    and proname in ('coach_nommable', 'invitation_coach_nomme', 'invitation_equipe_coach', 'notify_invitation_email',
                                    'notify_team_invitation_email', 'notify_team_invitation')),
     'meme_transaction', (select txid from _cn_releve) = txid_current())
) as resultat_lot_coach_nomme;
