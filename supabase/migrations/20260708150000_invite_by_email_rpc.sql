-- create_athlete_invitation refait : ajoute l'envoi d'email d'invitation +
-- le gate d'âge DUR <14 (Loi 25).
--
-- Signature étendue (uuid, text DEFAULT NULL) — RÉTRO-COMPATIBLE : l'appel
-- copy-link existant create_athlete_invitation(p_athlete_id) résout vers
-- p_email = NULL → comportement inchangé (pas d'email, pas de trigger d'envoi).
--
-- Quand p_email est fourni :
--   • nouvelle invite → INSERT (…, email) → trigger BEFORE INSERT envoie.
--   • réutilisation d'un token PENDING → UPDATE (email, email_sent_at=NULL) →
--     trigger BEFORE UPDATE re-envoie (renvoi).
--
-- Gate <14 DUR : RAISE EXCEPTION AVANT tout INSERT/retour → bloque nouvelle
-- invite ET réutilisation (aucune row, aucun token retourné). 1re barrière ;
-- notify_invitation_email a la 2e (silencieuse). Ne bloque que si DOB CONNUE
-- et <14 (cohérent isUnder14("")=false côté front).

-- Signature changée (ajout d'un paramètre) → DROP de l'ancienne (uuid) puis
-- CREATE de la nouvelle. Idempotent (DROP IF EXISTS + CREATE OR REPLACE).
drop function if exists public.create_athlete_invitation(uuid);

create or replace function public.create_athlete_invitation(
  p_athlete_id uuid,
  p_email      text default null
)
 returns text
 language plpgsql
 security definer
 set row_security to 'off'
 set search_path to 'public'
as $function$
declare
  v_caller   uuid;
  v_coach_id uuid;
  v_user_id  uuid;
  v_dob      date;
  v_token    text;
  -- '' → NULL : évite de stocker un email vide qui déclencherait le trigger
  -- pour rien (Resend rejetterait un destinataire vide).
  v_email    text := nullif(trim(p_email), '');
begin
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select coach_id, user_id, date_naissance
    into v_coach_id, v_user_id, v_dob
  from public.athletes where id = p_athlete_id;

  if not found or v_coach_id is null then
    raise exception 'ATHLETE_NOT_FOUND';
  end if;

  if v_coach_id <> v_caller then
    raise exception 'NOT_OWNER';
  end if;

  if v_user_id is not null then
    raise exception 'ALREADY_CLAIMED';
  end if;

  -- Gate <14 DUR (Loi 25) : AVANT tout INSERT/retour → bloque nouvelle invite
  -- ET réutilisation. Ne bloque que si DOB connue et <14.
  if v_dob is not null and extract(year from age(v_dob))::int < 14 then
    raise exception 'ATHLETE_UNDER_14';
  end if;

  -- Réutilisation d'un token PENDING non expiré s'il existe.
  select token into v_token
  from public.athlete_invitations
  where athlete_id = p_athlete_id
    and status = 'PENDING'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_token is not null then
    -- Renvoi : si un email est demandé, on (re)pose email + reset email_sent_at
    -- sur la row existante → le trigger BEFORE UPDATE renvoie. Sans email
    -- (copy-link), on ne touche pas la row (comportement inchangé).
    if v_email is not null then
      update public.athlete_invitations
      set email = v_email, email_sent_at = null
      where token = v_token;
    end if;
    return v_token;
  end if;

  -- Nouvelle invite. email = v_email (NULL en copy-link → trigger inerte ;
  -- non-NULL → trigger BEFORE INSERT envoie).
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.athlete_invitations (token, athlete_id, created_by, email)
  values (v_token, p_athlete_id, v_caller, v_email);

  return v_token;
end;
$function$;
