-- Rollback de 20261016010000_push_a4a_file : rend la base telle qu'avant (versions PROD des fonctions
-- remplacées), retire la file, le journal, les préférences, les triggers et le cron, et remet l'ancien
-- texte des notifications PARTENAIRE_EVALUATION. Une transaction : psql -1 (ou un seul message).
-- Les éléments en file et le journal des envois sont PERDUS (rien d'autre n'en dépend).

do $$
begin
  if to_regclass('public.push_file') is null then
    raise exception 'NEXUS: rollback sans objet (push_file absente)';
  end if;
end $$;

select cron.unschedule('push-file-envoi') where exists (select 1 from cron.job where jobname = 'push-file-envoi');

drop trigger if exists trg_push_evaluation_coach on public.evaluations;
drop trigger if exists trg_push_evaluation_partenaire on public.partner_evaluations;
drop trigger if exists trg_push_badge_partenaire on public.partner_athlete_badges;
drop function public.push_sur_evaluation_coach();
drop function public.push_sur_evaluation_partenaire();
drop function public.push_sur_badge_partenaire();
drop function public.push_traiter_file(timestamptz);
drop function public.push_mettre_en_file(uuid, text, text, text, text, jsonb);
drop function public.push_textes(text, text, integer, text);
drop function public.push_heure_calme(timestamptz);
drop function public.push_preference_definir(text, boolean);
drop function public.push_preferences_miennes();
drop table public.push_file;
drop table public.push_envois;
drop table public.push_preferences;

-- push_to_user : la signature à 4 arguments, délai pg_net par défaut, sans collapse_id.
drop function public.push_to_user(uuid, text, text, jsonb, text);
CREATE OR REPLACE FUNCTION public.push_to_user(p_user_id uuid, p_title text, p_body text, p_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('user_id', p_user_id, 'title', p_title, 'body', p_body, 'data', p_data)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_to_user: livraison échouée pour %: %', p_user_id, SQLERRM;
END;
$function$;
revoke all on function public.push_to_user(uuid, text, text, jsonb) from public, anon, authenticated, service_role;

-- Les trois fonctions remplacées, dans leur version d'avant (= prod au 2026-10-16).
CREATE OR REPLACE FUNCTION public.appliquer_badges_saisie(p_athlete_id uuid, p_entrees jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_auteur uuid;
  v_admin  boolean;
  v_inconnus text;
begin
  v_auteur := auth.uid();
  if v_auteur is null then
    raise exception 'NEXUS: aucune session authentifiée — impossible d''attribuer un badge sans auteur.';
  end if;

  v_admin := public.is_admin();
  if not (v_admin or public.coach_can_award_badge(p_athlete_id)) then
    raise exception
      'NEXUS: vous n''avez pas le droit d''attribuer des badges à cet athlète.';
  end if;

  select string_agg(distinct coalesce(e->>'code', e->>'badge'), ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) is null;

  if v_inconnus is not null then
    raise exception 'NEXUS: badge(s) inconnu(s) au catalogue : %.', v_inconnus;
  end if;

  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.retire_le is null
     and ab.origine <> 'systeme'
     and (
           v_admin
        or (ab.origine = 'saisie' and ab.attribue_par = v_auteur)
        or ab.origine = 'transposition'
     )
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
        where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) = b.code
          and nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), '')
              is not distinct from ab.contexte
     );

  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, origine)
  select p_athlete_id, b.id,
         nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), ''),
         v_auteur, 'saisie'
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  join public.badges b on b.code = public.code_badge_catalogue(coalesce(e->>'code', e->>'badge'))
  on conflict (athlete_id, badge_id, contexte) where retire_le is null
  do nothing;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prospect_partenaire_proposer(p_carte uuid, p_athlete uuid, p_origine text, p_critere text, p_force text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_user  uuid;
  v_org   text;
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte for update;
  if not found or v_carte.statut not in ('A_ENVOYER', 'ENVOYEE') or v_carte.expire_le <= now() then
    raise exception 'NEXUS: cette carte ne peut pas être proposée (déjà réservée ou expirée)' using errcode = '22023';
  end if;
  select a.user_id into v_user
    from public.athletes a join public.users u on u.id = a.user_id
   where a.id = p_athlete and a.status = 'ACTIF'::public.account_status and u.role = 'ATHLETE'::public.user_role;
  if v_user is null then
    raise exception 'NEXUS: cet athlète n''a pas de compte actif à qui proposer la carte' using errcode = '22023';
  end if;
  select organization_name into v_org from public.media_partners where id = v_carte.partner_id;

  update public.partenaire_prospects
     set statut = 'RESERVEE', statut_avant = v_carte.statut, reservation_source = p_origine,
         reservee_par = v_user, reservee_athlete = p_athlete, reservee_le = now(), updated_at = now()
   where id = p_carte;
  insert into public.partenaire_prospects_rapprochements (carte_id, athlete_id, critere, force, origine, statut, decide_par)
  values (p_carte, p_athlete, p_critere, p_force, p_origine, 'PROPOSE', case when p_origine = 'ADMIN' then auth.uid() end)
  on conflict (carte_id, athlete_id) do update
    set statut = 'PROPOSE', origine = excluded.origine, critere = excluded.critere, force = excluded.force,
        decide_par = excluded.decide_par, decide_le = now();
  insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
  values (p_athlete, 'PARTENAIRE_EVALUATION',
          coalesce(v_org, 'Un partenaire') || ' t''a évalué. C''est toi ?',
          'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.',
          jsonb_build_object('carte_id', p_carte));
  perform public.prospect_partenaire_journaliser(p_carte, v_carte.partner_id, 'PROPOSITION_' || p_origine, p_athlete,
            jsonb_build_object('critere', p_critere, 'force', p_force));
end $function$;
CREATE OR REPLACE FUNCTION public.claim_school_athletes(p_athlete_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_school uuid;
  v_nom    text;
  v_ecole  text;
  r        record;
  v_n      integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun utilisateur authentifié';
  END IF;
  IF p_athlete_ids IS NULL OR array_length(p_athlete_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.is_coach() THEN
    RAISE EXCEPTION 'NEXUS: seul un entraîneur peut réclamer un athlète';
  END IF;

  v_school := public.current_user_school_id();
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun établissement rattaché à ton compte';
  END IF;

  SELECT btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
    INTO v_nom FROM public.users u WHERE u.id = v_uid;
  IF v_nom IS NULL OR v_nom = '' THEN v_nom := 'Ton entraîneur'; END IF;

  SELECT s.name INTO v_ecole FROM public.schools s WHERE s.id = v_school;

  -- UN aller-retour : on pose et on récupère les lignes RÉELLEMENT prises. Un
  -- id qu'un autre coach vient de réclamer sort de lui-même du RETURNING —
  -- personne ne reçoit « X t'a pris en charge » pour un claim qui n'a pas eu
  -- lieu.
  FOR r IN
    UPDATE public.athletes a
       SET coach_id = v_uid, updated_at = now()
     WHERE a.id = ANY (p_athlete_ids)
       AND a.coach_id IS NULL
       AND a.school_id = v_school
    RETURNING a.id, a.user_id
  LOOP
    v_n := v_n + 1;

    BEGIN
      INSERT INTO public.athlete_notifications (athlete_id, type, title, message, metadata)
      VALUES (
        r.id,
        'COACH_CLAIMED',
        'Un entraîneur t''a pris en charge',
        format('Le coach %s t''a pris en charge à %s. Ouvre l''app pour voir ton profil. Il peut maintenant gérer ton profil et répondre aux recruteurs pour toi.',
               v_nom, coalesce(v_ecole, 'ton établissement')),
        jsonb_build_object('coach_id', v_uid, 'school_id', v_school)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'claim_school_athletes: notification in-app échouée pour athlète %: %', r.id, SQLERRM;
    END;

    PERFORM public.push_to_user(
      r.user_id,
      'Nexus',
      format('Le coach %s t''a pris en charge à %s. Ouvre l''app pour voir ton profil.',
             v_nom, coalesce(v_ecole, 'ton établissement')),
      jsonb_build_object('type', 'coach_claimed', 'athlete_id', r.id)
    );
  END LOOP;

  RETURN v_n;
END;
$function$;

-- Le texte d'avant sur les notifications PARTENAIRE_EVALUATION.
update public.athlete_notifications
   set message = 'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.'
 where type = 'PARTENAIRE_EVALUATION'
   and message = 'Réponds dans l''appli Nexus ou sur nexussports.ca.';

delete from supabase_migrations.schema_migrations where version = '20261016010000';

do $$
declare
  r   record;
  vus text[];
begin
  for r in select * from (values
      ('push_to_user(uuid,text,text,jsonb)', array['postgres']),
      ('appliquer_badges_saisie(uuid,jsonb)', array['authenticated', 'postgres', 'service_role']),
      ('claim_school_athletes(uuid[])', array['authenticated', 'postgres']),
      ('prospect_partenaire_proposer(uuid,uuid,text,text,text)', array['postgres', 'service_role'])) as v(fn, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc p,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(p.proacl::text[]) as x) t
     where p.oid = ('public.' || r.fn)::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.fn, vus, r.veut;
    end if;
  end loop;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'push\_%' and proname <> 'push_to_user')
     or exists (select 1 from cron.job where jobname = 'push-file-envoi') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS rollback push A4a : base rendue telle qu''avant — OK';
end $$;
