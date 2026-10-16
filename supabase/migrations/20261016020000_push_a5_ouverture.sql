-- Push A5 (lot mobile 1.4.5) — ouverture au clic, et une ligne dans la cloche pour chaque push A4a.
--
--  · push_destination(genre) : ce que le push porte EN PLUS de `type: 'announcement'` —
--    `nx_type` (le genre A4a) et `route` (l'écran à ouvrir). La 1.4.4 ne lit que `type` et
--    ouvre l'accueil, comme avant ; la 1.4.5 ouvre la route, prise dans SA liste blanche.
--  · push_traiter_file : seul l'objet `data` du push change.
--  · push_mettre_en_file : crée la notification de la cloche (athlete_notifications) au
--    moment de la mise en file — pas à l'envoi : la cloche reçoit aussi ce que les heures
--    calmes, une préférence coupée ou l'absence d'appareil retiennent. Un groupe (même jeune,
--    même clé, encore en attente) garde UNE notification, réécrite au texte du push groupé
--    (« 3 nouveaux badges… ») et remise à non lue.
--      BADGE_COACH → COACH_DISTINCTION_ADDED       EVALUATION_COACH → COACH_EVALUATION_UPDATED
--      BADGE_PARTENAIRE → PARTENAIRE_BADGE         EVALUATION_PARTENAIRE → PARTENAIRE_EVALUATION_RECUE
--      CARTE_PARTENAIRE : déjà la sienne (PARTENAIRE_EVALUATION, prospect_partenaire_proposer).
--    Mêmes textes que le push (push_textes) : jamais de cote, de grade, de recruteur ni de cégep.
--  · push_sur_evaluation_coach : sur une mise à jour, la cloche a déjà sa ligne
--    (notify_athlete_evaluation_updated) — `{"cloche": false}` évite le doublon.
--  · athlete_notifications_type_check : + PARTENAIRE_BADGE, PARTENAIRE_EVALUATION_RECUE.
-- Rollback : supabase/rollback/20261016020000_rollback_push_a5_ouverture.sql

do $$
begin
  if to_regprocedure('public.push_destination(text)') is not null then
    raise exception 'NEXUS: migration A5 déjà appliquée (push_destination existe)';
  end if;
  -- Versions remplacées : celles d'A4a, octet pour octet (relevé prod du 2026-10-16).
  if (select md5(prosrc) from pg_proc where oid = 'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)'::regprocedure)
     is distinct from '59788585bc8844cbc0f714ba8d01034e' then
    raise exception 'NEXUS: push_mettre_en_file ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_traiter_file(timestamptz)'::regprocedure)
     is distinct from 'd3449a69b0e21a4eb6dbdb1630835275' then
    raise exception 'NEXUS: push_traiter_file ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_sur_evaluation_coach()'::regprocedure)
     is distinct from '33085a230937a93adea444b1de560a60' then
    raise exception 'NEXUS: push_sur_evaluation_coach ne correspond pas au relevé';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check')
     is distinct from 'CHECK ((type = ANY (ARRAY[' || (select string_agg(quote_literal(t) || '::text', ', ')
                                                       from unnest(array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION']) t) || '])))' then
    raise exception 'NEXUS: athlete_notifications_type_check ne correspond pas au relevé';
  end if;
end $$;

-- ── Types de la cloche ──────────────────────────────────────────────────────

alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE']));

-- ── Ce que le push porte pour l'ouverture au clic ───────────────────────────
-- Les routes sont celles de la liste blanche du client (lib/push/pushIntent.ts) ; un genre
-- inconnu mène aux notifications.

create function public.push_destination(p_genre text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'nx_type', coalesce(p_genre, ''),
    'route', case p_genre
               when 'BADGE_COACH'           then '/athlete/profil/apercu?section=badges'
               when 'BADGE_PARTENAIRE'      then '/athlete/profil/apercu?section=badges'
               when 'EVALUATION_COACH'      then '/athlete/profil/apercu?section=evaluation'
               when 'EVALUATION_PARTENAIRE' then '/athlete/profil/apercu?section=evaluation'
               when 'CARTE_PARTENAIRE'      then '/athlete/cartes-partenaires'
               else '/athlete/notifications'
             end)
$$;

-- ── Mise en file + la cloche ────────────────────────────────────────────────

create or replace function public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text,
                                                      p_source_nom text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user  uuid;
  v_type  text;
  v_notif uuid;
  v_n     integer;
  v_titre text;
  v_texte text;
begin
  select a.user_id into v_user from public.athletes a where a.id = p_athlete;
  if v_user is null then
    return;
  end if;

  v_type := case p_genre
              when 'BADGE_COACH'           then 'COACH_DISTINCTION_ADDED'
              when 'EVALUATION_COACH'      then 'COACH_EVALUATION_UPDATED'
              when 'BADGE_PARTENAIRE'      then 'PARTENAIRE_BADGE'
              when 'EVALUATION_PARTENAIRE' then 'PARTENAIRE_EVALUATION_RECUE'
            end;
  if v_type is not null and coalesce((p_detail->>'cloche')::boolean, true) then
    begin
      -- Le groupe en cours (même jeune, même clé, encore en attente) garde sa notification.
      select (f.detail->>'notification_id')::uuid into v_notif
        from public.push_file f
       where f.user_id = v_user and f.cle = p_cle and f.statut = 'EN_ATTENTE' and f.detail ? 'notification_id'
       order by f.id
       limit 1;
      v_n := 1 + (select count(*) from public.push_file f
                   where f.user_id = v_user and f.cle = p_cle and f.statut = 'EN_ATTENTE');
      select t.titre, t.texte into v_titre, v_texte
        from public.push_textes(p_genre, nullif(btrim(coalesce(p_source_nom, '')), ''), v_n,
                                p_detail->>'libelle') t;
      if v_notif is not null then
        update public.athlete_notifications
           set title = v_titre, message = v_texte, read = false
         where id = v_notif and athlete_id = p_athlete;
        if not found then
          v_notif := null;
        end if;
      end if;
      if v_notif is null then
        insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
        values (p_athlete, v_type, v_titre, v_texte,
                jsonb_build_object('push_cle', p_cle) || public.push_destination(p_genre))
        returning id into v_notif;
      end if;
    exception when others then
      raise warning 'push_mettre_en_file (cloche): % pour athlète % — %', p_genre, p_athlete, SQLERRM;
      v_notif := null;
    end;
  end if;

  insert into public.push_file (user_id, categorie, genre, cle, source_nom, detail)
  values (v_user, p_categorie, p_genre, p_cle, nullif(btrim(coalesce(p_source_nom, '')), ''),
          (coalesce(p_detail, '{}'::jsonb) - 'cloche')
          || case when v_notif is not null then jsonb_build_object('notification_id', v_notif) else '{}'::jsonb end);
exception when others then
  raise warning 'push_mettre_en_file: % pour athlète % — %', p_genre, p_athlete, SQLERRM;
end;
$$;

-- ── Traitement de la file : + nx_type et route dans le push ─────────────────

create or replace function public.push_traiter_file(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi)
                || public.push_destination(g.genre),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$$;

-- ── Évaluation du coach : pas de doublon dans la cloche sur une mise à jour ─

create or replace function public.push_sur_evaluation_coach()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- La cote globale est calculée par calc_cote_globale (BEFORE) : un push quand elle apparaît ou
  -- change, jamais pour une écriture qui ne la touche pas (miroir des distinctions, commentaires).
  if NEW.cote_globale is not null
     and (tg_op = 'INSERT' or NEW.cote_globale is distinct from OLD.cote_globale) then
    -- A5 : sur une MISE À JOUR, la cloche a déjà sa ligne (notify_athlete_evaluation_updated,
    -- COACH_EVALUATION_UPDATED) ; seule la création en demande une.
    perform public.push_mettre_en_file(NEW.athlete_id, 'BADGES_EVALUATIONS', 'EVALUATION_COACH',
              'eval:coach:' || coalesce(NEW.coach_id::text, '-'),
              public.coach_nommable(NEW.coach_id)->>'nom',
              case when tg_op = 'UPDATE' then '{"cloche": false}'::jsonb else '{}'::jsonb end);
  end if;
  return null;
exception when others then
  raise warning 'push_sur_evaluation_coach: %', SQLERRM;
  return null;
end;
$$;

-- ── Droits (create or replace garde ceux d'A4a ; push_destination est nouvelle) ─

revoke all on function public.push_destination(text) from public, anon, authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r   record;
  vus text[];
begin
  for r in
    select * from (values
      ('push_destination(text)', array['postgres', 'service_role']),
      ('push_mettre_en_file(uuid,text,text,text,text,jsonb)', array['postgres', 'service_role']),
      ('push_traiter_file(timestamptz)', array['postgres', 'service_role']),
      ('push_sur_evaluation_coach()', array['postgres', 'service_role'])
    ) as v(fn, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc p,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(p.proacl::text[]) as x) t
     where p.oid = ('public.' || r.fn)::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.fn, vus, r.veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('push_mettre_en_file', 'push_traiter_file', 'push_destination')) <> 3 then
    raise exception 'NEXUS: une fonction de push existe en plusieurs signatures';
  end if;
  if public.push_destination('BADGE_COACH') <> '{"nx_type": "BADGE_COACH", "route": "/athlete/profil/apercu?section=badges"}'::jsonb then
    raise exception 'NEXUS: push_destination inattendue';
  end if;
end $$;
