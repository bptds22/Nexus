-- LOT PROD notif intérêt recruteur — généré par docs/notif-interet/prod/construire-lot.mjs — VARIANTE DE PREUVE (empreinte fausse)
-- Fichier : supabase/migrations/20261029170000_notif_interet_recruteur.sql (git, LF) — md5 728c0778d678cfbea89870c707ba098f
-- État de départ attendu : bba20215160886b637ed628bbe4fa293|51 ; attendu après : 00000000000000000000000000000000|59
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Relevé avant (dans la transaction)
create temp table _ni_releve on commit drop as
select txid_current() as txid,
       (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.device_tokens) || '|' || (select count(*) from public.recruiter_favorites)
       || '|' || (select count(*) from public.recruiter_list_members) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.recruiter_athlete_views) || '|' || (select count(*) from public.parent_contact_avis) as donnees,
       (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid) || ' ' || convalidated
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) filter (where operation = 'MIGRATION_NOTIF_INTERET_RECRUTEUR')
              - count(*) filter (where operation = 'ROLLBACK_NOTIF_INTERET_RECRUTEUR')
          from public.admin_operations) as traces_lot,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261029170000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $gni$
begin
  if (select txid from _ni_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _ni_releve) <> 0 or (select traces_lot from _ni_releve) <> 0 then
    raise exception 'NEXUS LOT: version 20261029170000 présente ou lot déjà appliqué (MIGRATION sans ROLLBACK) — rien n''est appliqué';
  end if;
  if (select derniere_version from _ni_releve) >= '20261029170000' then
    raise exception 'NEXUS LOT: version 20261029170000 pas après la dernière (%) — renuméroter', (select derniere_version from _ni_releve);
  end if;
  if (select etat_objets from _ni_releve) is distinct from 'bba20215160886b637ed628bbe4fa293|51' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _ni_releve);
  end if;
end $gni$;

-- 3. ===== DÉBUT 20261029170000_notif_interet_recruteur.sql =====
-- Notifications d'intérêt recruteur (lots A et B) + heures calmes 22 h 00 – 7 h 59 pour tous.
-- Décisions de BP du 2026-10-29.
--
--  · Lot A — « Ton profil a été ajouté à une liste » : un favori, un ajout à une liste ou une
--    entrée dans le processus d'un recruteur ACTIF. Un même geste (une instruction) = UN push :
--    le favori crée aussi la ligne de processus (fav_insert_to_pipeline), la fusion d'une carte
--    prospect écrit processus et listes d'un coup. Ne comptent pas : rejoindre le dossier déjà
--    ouvert de l'unité (nexus.sync_unite, « pas un geste » dans unite_ecrire_dossier) et le
--    processus créé par un message À L'ATHLÈTE (il reçoit déjà le push du message). Un message
--    au coach compte. Retirer puis remettre un favori renotifie (autre transaction).
--  · Lot B — « Ton profil a été consulté » : la première vue d'un recruteur ACTIF dans la
--    journée (la table n'a qu'une ligne par recruteur × athlète × jour). UN push par athlète et
--    par jour. Le « jour » d'une vue est celui où son push peut partir : une vue de 22 h 00 ou
--    plus compte pour le lendemain, si bien qu'une nuit de vues donne UN push à 8 h. Les vues qui
--    arrivent avant le départ rejoignent le groupe (« consulté N fois ») ; après le
--    départ, la notification du jour est réécrite au compte du jour et remise à non lue, sans
--    nouveau push.
--  · Aucun nom de recruteur, de cégep ni de région : le texte ne dépend d'aucune source. Le
--    push a pour titre « Nexus » ; la cloche garde la phrase pour titre.
--  · Heures calmes : 22 h 00 – 7 h 59 (heure de Montréal) pour tout ce qui passe par
--    push_heure_calme() — la file (badges, évaluations, cartes, vues, ajouts), le consentement
--    partenaire, le push parent de contact. Le push attend 8 h, la cloche s'écrit tout de suite.
--  · L'ancienne notification de favori (trg_notify_favorited, qui nommait la région) est
--    débranchée : la cloche vient désormais de la file (push_mettre_en_file). La fonction reste,
--    pour le rollback.
--  · Cloche : types existants, connus du web et des apps 1.4.4 / 1.4.5 —
--      VUE_PROFIL → PROFILE_VIEWED        AJOUT_LISTE → ADDED_TO_FAVORITES
--    Au clic : nx_type inconnu des apps → /athlete/notifications (push_destination inchangée).
-- Rollback : supabase/rollback/20261029170000_rollback_notif_interet_recruteur.sql

do $$
begin
  if to_regprocedure('public.push_sur_vue_profil()') is not null then
    raise exception 'NEXUS: migration notif intérêt recruteur déjà appliquée';
  end if;
  -- Versions remplacées : relevé prod du 2026-10-29 (md5 de prosrc, identique en pile dédiée).
  if (select md5(prosrc) from pg_proc where oid = 'public.push_heure_calme(timestamptz)'::regprocedure)
     is distinct from 'eca3911129c5142603560d0439106e58' then
    raise exception 'NEXUS: push_heure_calme ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
     is distinct from '93a8a713d8cb9a74fd5dbbc8fdc04f4e' then
    raise exception 'NEXUS: push_textes ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)'::regprocedure)
     is distinct from '5e5db786d60a5e67b094fe50b5e14b2a' then
    raise exception 'NEXUS: push_mettre_en_file ne correspond pas au relevé';
  end if;
  -- Comportements sur lesquels les déclencheurs s'appuient (non modifiés ici).
  if (select md5(prosrc) from pg_proc where oid = 'public.fav_insert_to_pipeline()'::regprocedure)
     is distinct from 'd90998f580c957b47506723595ef572e' then
    raise exception 'NEXUS: fav_insert_to_pipeline ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.message_insert_to_pipeline()'::regprocedure)
     is distinct from 'ce144edcd654da278be6e4451bc38f0a' then
    raise exception 'NEXUS: message_insert_to_pipeline ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.unite_ecrire_dossier(uuid,jsonb)'::regprocedure)
     is distinct from '28bc1fbd6795414154d0438df86e515f' then
    raise exception 'NEXUS: unite_ecrire_dossier ne correspond pas au relevé';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited'
                  and tgrelid = 'public.recruiter_favorites'::regclass) then
    raise exception 'NEXUS: trg_notify_favorited absent';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint
       where conrelid = 'public.push_file'::regclass and conname = 'push_file_genre_check')
     is distinct from '30f41e6bb2b1aabf046bb54c3c757883'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint
          where conrelid = 'public.push_file'::regclass and conname = 'push_file_categorie_check')
     is distinct from 'ba2cabfec076ab758efb2615358a9ac4'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint
          where conrelid = 'public.push_preferences'::regclass and conname = 'push_preferences_categorie_check')
     is distinct from 'ba2cabfec076ab758efb2615358a9ac4' then
    raise exception 'NEXUS: contraintes de la file ne correspondent pas au relevé';
  end if;
end $$;

-- ── Genres et catégorie ─────────────────────────────────────────────────────

alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE',
                            'CARTE_PARTENAIRE', 'VISIBILITE_PARTENAIRE', 'VUE_PROFIL', 'AJOUT_LISTE']));
alter table public.push_file drop constraint push_file_categorie_check;
alter table public.push_file add constraint push_file_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES', 'INTERET_RECRUTEURS']));
-- Aucun écran de préférences (décision BP) : la valeur n'est admise que pour rester alignée sur la file.
alter table public.push_preferences drop constraint push_preferences_categorie_check;
alter table public.push_preferences add constraint push_preferences_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES', 'INTERET_RECRUTEURS']));

-- ── Heures calmes ───────────────────────────────────────────────────────────

-- 22 h 00 – 7 h 59, heure de Montréal (America/Toronto, mêmes règles), pour tout le monde.
-- Appelée par push_traiter_file, consentement_partenaire_v2_pousser/relancer et
-- parent_contact_envoyer_push : un push retenu attend 8 h, il n'est pas perdu.
create or replace function public.push_heure_calme(p_moment timestamp with time zone)
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(hour from (p_moment at time zone 'America/Toronto')) >= 22
      or extract(hour from (p_moment at time zone 'America/Toronto')) < 8
$$;

-- ── Textes ──────────────────────────────────────────────────────────────────

create or replace function public.push_textes(p_genre text, p_source_nom text, p_n integer, p_libelle text)
returns table(titre text, texte text)
language sql
immutable
set search_path = public
as $function$
  select
    case
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') and p_n > 1 then p_n || ' nouveaux badges'
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') then 'Nouveau badge'
      when p_genre in ('EVALUATION_COACH', 'EVALUATION_PARTENAIRE') then 'Nouvelle évaluation'
      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'
      when p_genre = 'VISIBILITE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      -- Intérêt recruteur : jamais de source (p_source_nom ignoré) ; titre du push = « Nexus ».
      when p_genre in ('VUE_PROFIL', 'AJOUT_LISTE') then 'Nexus'
    end,
    case
      when p_genre = 'BADGE_PARTENAIRE' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' and nullif(btrim(p_libelle), '') is not null then
        'Tu as reçu le badge ' || btrim(p_libelle) || ' de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' then
        'Tu as reçu un badge de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_COACH' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce('ton coach ' || nullif(btrim(p_source_nom), ''), 'ton entraîneur') || '.'
      when p_genre = 'BADGE_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a donné un badge.'
      when p_genre = 'EVALUATION_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a évalué.'
      when p_genre = 'EVALUATION_PARTENAIRE' then
        coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
      when p_genre = 'VISIBILITE_PARTENAIRE' then 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.'
      when p_genre = 'VUE_PROFIL' and p_n > 1 then 'Ton profil a été consulté ' || p_n || ' fois'
      when p_genre = 'VUE_PROFIL' then 'Ton profil a été consulté'
      when p_genre = 'AJOUT_LISTE' then 'Ton profil a été ajouté à une liste'
    end
$function$;

-- ── Mise en file : les deux genres ont leur type de cloche ──────────────────

create or replace function public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text,
                                                      p_source_nom text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_user  uuid;
  v_type  text;
  v_notif uuid;
  v_n     integer;
  v_titre text;
  v_texte text;
  v_cloche text;
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
              when 'VUE_PROFIL'            then 'PROFILE_VIEWED'
              when 'AJOUT_LISTE'           then 'ADDED_TO_FAVORITES'
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
      -- Intérêt recruteur : le push s'intitule « Nexus », la cloche garde la phrase.
      v_cloche := case when p_genre in ('VUE_PROFIL', 'AJOUT_LISTE') then v_texte else v_titre end;
      if v_notif is not null then
        update public.athlete_notifications
           set title = v_cloche, message = v_texte, read = false
         where id = v_notif and athlete_id = p_athlete;
        if not found then
          v_notif := null;
        end if;
      end if;
      if v_notif is null then
        insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
        values (p_athlete, v_type, v_cloche, v_texte,
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
$function$;

-- ── Lot A : ajouté à une liste ──────────────────────────────────────────────

-- Un geste = UNE instruction du client = un push, quelle que soit la table qui l'écrit en
-- premier. En prod, une requête est une transaction d'une instruction : favori + processus
-- (fav_insert_to_pipeline), ou toute la fusion d'une carte (une RPC), partagent la clé.
-- La clé porte aussi statement_timestamp() pour qu'une transaction de plusieurs gestes
-- (le banc de tests) compte chaque geste.
create function public.push_sur_interet(p_athlete uuid, p_recruteur uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user uuid;
  v_cle  text;
begin
  if not exists (select 1 from public.users u
                  where u.id = p_recruteur and u.role = 'RECRUTEUR'::public.user_role
                    and u.status = 'ACTIF'::public.account_status) then
    return;
  end if;
  select a.user_id into v_user from public.athletes a where a.id = p_athlete;
  if v_user is null then
    return;                           -- fiche sans compte : personne à prévenir
  end if;
  v_cle := 'ajout:' || p_athlete || ':' || txid_current() || ':' || extract(epoch from statement_timestamp());
  if exists (select 1 from public.push_file f where f.user_id = v_user and f.cle = v_cle) then
    return;                           -- même geste, déjà en file
  end if;
  perform public.push_mettre_en_file(p_athlete, 'INTERET_RECRUTEURS', 'AJOUT_LISTE', v_cle, null, '{}'::jsonb);
exception when others then
  raise warning 'push_sur_interet: athlète % — %', p_athlete, SQLERRM;
end;
$$;

create function public.push_sur_interet_favori()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.push_sur_interet(NEW.athlete_id, NEW.recruiter_id);
  return null;
end;
$$;

create function public.push_sur_interet_liste()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.push_sur_interet(NEW.athlete_id, (select l.recruiter_id from public.recruiter_lists l where l.id = NEW.list_id));
  return null;
end;
$$;

create function public.push_sur_interet_processus()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- Rejoindre le dossier déjà ouvert de l'unité : « pas un geste » (unite_ecrire_dossier).
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return null;
  end if;
  -- Processus ouvert par un message À L'ATHLÈTE (message_insert_to_pipeline, déclencheur des
  -- messages, donc profondeur ≥ 2, étape CONTACTE) : le push du message suffit. Le message est
  -- de cette transaction (created_at = now()).
  if pg_trigger_depth() >= 2 and NEW.stage = 'CONTACTE'
     and exists (select 1 from public.messages m
               join public.conversations c on c.id = m.conversation_id
              where c.conversation_type = 'RECRUTEUR_ATHLETE'
                and c.recruiter_id = NEW.recruiter_id and c.athlete_id = NEW.athlete_id
                and m.sender_id = NEW.recruiter_id and m.created_at = now()) then
    return null;
  end if;
  perform public.push_sur_interet(NEW.athlete_id, NEW.recruiter_id);
  return null;
end;
$$;

create trigger trg_push_interet after insert on public.recruiter_favorites
  for each row execute function public.push_sur_interet_favori();
create trigger trg_push_interet after insert on public.recruiter_list_members
  for each row execute function public.push_sur_interet_liste();
create trigger trg_push_interet after insert on public.recruiter_pipeline
  for each row execute function public.push_sur_interet_processus();

-- L'ancienne cloche de favori nommait la région : la file la remplace.
drop trigger trg_notify_favorited on public.recruiter_favorites;

-- ── Lot B : profil consulté, un push par jour ───────────────────────────────

create function public.push_sur_vue_profil()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user  uuid;
  v_jour  date;
  v_cle   text;
  v_notif uuid;
  v_n     integer;
  v_titre text;
  v_texte text;
begin
  if not exists (select 1 from public.users u
                  where u.id = NEW.recruiter_id and u.role = 'RECRUTEUR'::public.user_role
                    and u.status = 'ACTIF'::public.account_status) then
    return null;
  end if;
  select a.user_id into v_user from public.athletes a where a.id = NEW.athlete_id;
  if v_user is null then
    return null;
  end if;
  -- Le jour où le push peut partir : à partir de 22 h, c'est le lendemain (départ à 8 h).
  v_jour := ((coalesce(NEW.viewed_at, now()) at time zone 'America/Toronto') + interval '2 hours')::date;
  v_cle := 'vue:' || NEW.athlete_id || ':' || v_jour;

  -- Le push du jour est déjà traité (parti, sans appareil, annulé) : pas de 2e push. La
  -- notification du jour prend le compte du jour et redevient non lue.
  if exists (select 1 from public.push_file f where f.user_id = v_user and f.cle = v_cle and f.statut <> 'EN_ATTENTE') then
    select (f.detail->>'notification_id')::uuid into v_notif
      from public.push_file f
     where f.user_id = v_user and f.cle = v_cle and f.detail ? 'notification_id'
     order by f.id
     limit 1;
    -- Le compte du jour : les vues des recruteurs actifs, comme celles qui déclenchent.
    select count(*) into v_n
      from public.recruiter_athlete_views v
      join public.users u on u.id = v.recruiter_id
     where v.athlete_id = NEW.athlete_id
       and ((v.viewed_at at time zone 'America/Toronto') + interval '2 hours')::date = v_jour
       and u.role = 'RECRUTEUR'::public.user_role and u.status = 'ACTIF'::public.account_status;
    select t.titre, t.texte into v_titre, v_texte from public.push_textes('VUE_PROFIL', null, v_n, null) t;
    update public.athlete_notifications
       set title = v_texte, message = v_texte, read = false
     where id = v_notif and athlete_id = NEW.athlete_id;
    return null;
  end if;

  perform public.push_mettre_en_file(NEW.athlete_id, 'INTERET_RECRUTEURS', 'VUE_PROFIL', v_cle, null, '{}'::jsonb);
  return null;
exception when others then
  raise warning 'push_sur_vue_profil: athlète % — %', NEW.athlete_id, SQLERRM;
  return null;
end;
$$;

create trigger trg_push_vue_profil after insert on public.recruiter_athlete_views
  for each row execute function public.push_sur_vue_profil();

-- ── Droits : fermés comme le reste de la file ───────────────────────────────
-- Les default privileges de Supabase accordent EXECUTE à anon et authenticated sur toute
-- fonction créée : on retire tout, puis on rend à service_role (comme push_destination).

revoke all on function public.push_sur_interet(uuid, uuid) from public, anon, authenticated;
revoke all on function public.push_sur_interet_favori() from public, anon, authenticated;
revoke all on function public.push_sur_interet_liste() from public, anon, authenticated;
revoke all on function public.push_sur_interet_processus() from public, anon, authenticated;
revoke all on function public.push_sur_vue_profil() from public, anon, authenticated;
grant execute on function public.push_sur_interet(uuid, uuid) to service_role;
grant execute on function public.push_sur_interet_favori() to service_role;
grant execute on function public.push_sur_interet_liste() to service_role;
grant execute on function public.push_sur_interet_processus() to service_role;
grant execute on function public.push_sur_vue_profil() to service_role;

-- Gardes de sortie : ACL comparées en ENTIER (CLAUDE.md, « jamais par inclusion »).
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['postgres', 'service_role'];
begin
  foreach f in array array['public.push_sur_interet(uuid,uuid)',
                           'public.push_sur_interet_favori()', 'public.push_sur_interet_liste()',
                           'public.push_sur_interet_processus()', 'public.push_sur_vue_profil()',
                           'public.push_heure_calme(timestamptz)', 'public.push_textes(text,text,integer,text)',
                           'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)']::regprocedure[] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname in ('trg_push_interet', 'trg_push_vue_profil')) <> 4 then
    raise exception 'NEXUS: déclencheurs d''intérêt incomplets';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited') then
    raise exception 'NEXUS: trg_notify_favorited encore branché';
  end if;
end $$;

-- ===== FIN 20261029170000_notif_interet_recruteur.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _ni_texte on commit drop as select $NXMIG$-- Notifications d'intérêt recruteur (lots A et B) + heures calmes 22 h 00 – 7 h 59 pour tous.
-- Décisions de BP du 2026-10-29.
--
--  · Lot A — « Ton profil a été ajouté à une liste » : un favori, un ajout à une liste ou une
--    entrée dans le processus d'un recruteur ACTIF. Un même geste (une instruction) = UN push :
--    le favori crée aussi la ligne de processus (fav_insert_to_pipeline), la fusion d'une carte
--    prospect écrit processus et listes d'un coup. Ne comptent pas : rejoindre le dossier déjà
--    ouvert de l'unité (nexus.sync_unite, « pas un geste » dans unite_ecrire_dossier) et le
--    processus créé par un message À L'ATHLÈTE (il reçoit déjà le push du message). Un message
--    au coach compte. Retirer puis remettre un favori renotifie (autre transaction).
--  · Lot B — « Ton profil a été consulté » : la première vue d'un recruteur ACTIF dans la
--    journée (la table n'a qu'une ligne par recruteur × athlète × jour). UN push par athlète et
--    par jour. Le « jour » d'une vue est celui où son push peut partir : une vue de 22 h 00 ou
--    plus compte pour le lendemain, si bien qu'une nuit de vues donne UN push à 8 h. Les vues qui
--    arrivent avant le départ rejoignent le groupe (« consulté N fois ») ; après le
--    départ, la notification du jour est réécrite au compte du jour et remise à non lue, sans
--    nouveau push.
--  · Aucun nom de recruteur, de cégep ni de région : le texte ne dépend d'aucune source. Le
--    push a pour titre « Nexus » ; la cloche garde la phrase pour titre.
--  · Heures calmes : 22 h 00 – 7 h 59 (heure de Montréal) pour tout ce qui passe par
--    push_heure_calme() — la file (badges, évaluations, cartes, vues, ajouts), le consentement
--    partenaire, le push parent de contact. Le push attend 8 h, la cloche s'écrit tout de suite.
--  · L'ancienne notification de favori (trg_notify_favorited, qui nommait la région) est
--    débranchée : la cloche vient désormais de la file (push_mettre_en_file). La fonction reste,
--    pour le rollback.
--  · Cloche : types existants, connus du web et des apps 1.4.4 / 1.4.5 —
--      VUE_PROFIL → PROFILE_VIEWED        AJOUT_LISTE → ADDED_TO_FAVORITES
--    Au clic : nx_type inconnu des apps → /athlete/notifications (push_destination inchangée).
-- Rollback : supabase/rollback/20261029170000_rollback_notif_interet_recruteur.sql

do $$
begin
  if to_regprocedure('public.push_sur_vue_profil()') is not null then
    raise exception 'NEXUS: migration notif intérêt recruteur déjà appliquée';
  end if;
  -- Versions remplacées : relevé prod du 2026-10-29 (md5 de prosrc, identique en pile dédiée).
  if (select md5(prosrc) from pg_proc where oid = 'public.push_heure_calme(timestamptz)'::regprocedure)
     is distinct from 'eca3911129c5142603560d0439106e58' then
    raise exception 'NEXUS: push_heure_calme ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
     is distinct from '93a8a713d8cb9a74fd5dbbc8fdc04f4e' then
    raise exception 'NEXUS: push_textes ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)'::regprocedure)
     is distinct from '5e5db786d60a5e67b094fe50b5e14b2a' then
    raise exception 'NEXUS: push_mettre_en_file ne correspond pas au relevé';
  end if;
  -- Comportements sur lesquels les déclencheurs s'appuient (non modifiés ici).
  if (select md5(prosrc) from pg_proc where oid = 'public.fav_insert_to_pipeline()'::regprocedure)
     is distinct from 'd90998f580c957b47506723595ef572e' then
    raise exception 'NEXUS: fav_insert_to_pipeline ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.message_insert_to_pipeline()'::regprocedure)
     is distinct from 'ce144edcd654da278be6e4451bc38f0a' then
    raise exception 'NEXUS: message_insert_to_pipeline ne correspond pas au relevé';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.unite_ecrire_dossier(uuid,jsonb)'::regprocedure)
     is distinct from '28bc1fbd6795414154d0438df86e515f' then
    raise exception 'NEXUS: unite_ecrire_dossier ne correspond pas au relevé';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited'
                  and tgrelid = 'public.recruiter_favorites'::regclass) then
    raise exception 'NEXUS: trg_notify_favorited absent';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint
       where conrelid = 'public.push_file'::regclass and conname = 'push_file_genre_check')
     is distinct from '30f41e6bb2b1aabf046bb54c3c757883'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint
          where conrelid = 'public.push_file'::regclass and conname = 'push_file_categorie_check')
     is distinct from 'ba2cabfec076ab758efb2615358a9ac4'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint
          where conrelid = 'public.push_preferences'::regclass and conname = 'push_preferences_categorie_check')
     is distinct from 'ba2cabfec076ab758efb2615358a9ac4' then
    raise exception 'NEXUS: contraintes de la file ne correspondent pas au relevé';
  end if;
end $$;

-- ── Genres et catégorie ─────────────────────────────────────────────────────

alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE',
                            'CARTE_PARTENAIRE', 'VISIBILITE_PARTENAIRE', 'VUE_PROFIL', 'AJOUT_LISTE']));
alter table public.push_file drop constraint push_file_categorie_check;
alter table public.push_file add constraint push_file_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES', 'INTERET_RECRUTEURS']));
-- Aucun écran de préférences (décision BP) : la valeur n'est admise que pour rester alignée sur la file.
alter table public.push_preferences drop constraint push_preferences_categorie_check;
alter table public.push_preferences add constraint push_preferences_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS', 'VISITES', 'RAPPELS', 'CARTES_PARTENAIRES', 'INTERET_RECRUTEURS']));

-- ── Heures calmes ───────────────────────────────────────────────────────────

-- 22 h 00 – 7 h 59, heure de Montréal (America/Toronto, mêmes règles), pour tout le monde.
-- Appelée par push_traiter_file, consentement_partenaire_v2_pousser/relancer et
-- parent_contact_envoyer_push : un push retenu attend 8 h, il n'est pas perdu.
create or replace function public.push_heure_calme(p_moment timestamp with time zone)
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(hour from (p_moment at time zone 'America/Toronto')) >= 22
      or extract(hour from (p_moment at time zone 'America/Toronto')) < 8
$$;

-- ── Textes ──────────────────────────────────────────────────────────────────

create or replace function public.push_textes(p_genre text, p_source_nom text, p_n integer, p_libelle text)
returns table(titre text, texte text)
language sql
immutable
set search_path = public
as $function$
  select
    case
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') and p_n > 1 then p_n || ' nouveaux badges'
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') then 'Nouveau badge'
      when p_genre in ('EVALUATION_COACH', 'EVALUATION_PARTENAIRE') then 'Nouvelle évaluation'
      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'
      when p_genre = 'VISIBILITE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      -- Intérêt recruteur : jamais de source (p_source_nom ignoré) ; titre du push = « Nexus ».
      when p_genre in ('VUE_PROFIL', 'AJOUT_LISTE') then 'Nexus'
    end,
    case
      when p_genre = 'BADGE_PARTENAIRE' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' and nullif(btrim(p_libelle), '') is not null then
        'Tu as reçu le badge ' || btrim(p_libelle) || ' de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' then
        'Tu as reçu un badge de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_COACH' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce('ton coach ' || nullif(btrim(p_source_nom), ''), 'ton entraîneur') || '.'
      when p_genre = 'BADGE_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a donné un badge.'
      when p_genre = 'EVALUATION_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a évalué.'
      when p_genre = 'EVALUATION_PARTENAIRE' then
        coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
      when p_genre = 'VISIBILITE_PARTENAIRE' then 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.'
      when p_genre = 'VUE_PROFIL' and p_n > 1 then 'Ton profil a été consulté ' || p_n || ' fois'
      when p_genre = 'VUE_PROFIL' then 'Ton profil a été consulté'
      when p_genre = 'AJOUT_LISTE' then 'Ton profil a été ajouté à une liste'
    end
$function$;

-- ── Mise en file : les deux genres ont leur type de cloche ──────────────────

create or replace function public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text,
                                                      p_source_nom text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $function$
declare
  v_user  uuid;
  v_type  text;
  v_notif uuid;
  v_n     integer;
  v_titre text;
  v_texte text;
  v_cloche text;
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
              when 'VUE_PROFIL'            then 'PROFILE_VIEWED'
              when 'AJOUT_LISTE'           then 'ADDED_TO_FAVORITES'
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
      -- Intérêt recruteur : le push s'intitule « Nexus », la cloche garde la phrase.
      v_cloche := case when p_genre in ('VUE_PROFIL', 'AJOUT_LISTE') then v_texte else v_titre end;
      if v_notif is not null then
        update public.athlete_notifications
           set title = v_cloche, message = v_texte, read = false
         where id = v_notif and athlete_id = p_athlete;
        if not found then
          v_notif := null;
        end if;
      end if;
      if v_notif is null then
        insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
        values (p_athlete, v_type, v_cloche, v_texte,
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
$function$;

-- ── Lot A : ajouté à une liste ──────────────────────────────────────────────

-- Un geste = UNE instruction du client = un push, quelle que soit la table qui l'écrit en
-- premier. En prod, une requête est une transaction d'une instruction : favori + processus
-- (fav_insert_to_pipeline), ou toute la fusion d'une carte (une RPC), partagent la clé.
-- La clé porte aussi statement_timestamp() pour qu'une transaction de plusieurs gestes
-- (le banc de tests) compte chaque geste.
create function public.push_sur_interet(p_athlete uuid, p_recruteur uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user uuid;
  v_cle  text;
begin
  if not exists (select 1 from public.users u
                  where u.id = p_recruteur and u.role = 'RECRUTEUR'::public.user_role
                    and u.status = 'ACTIF'::public.account_status) then
    return;
  end if;
  select a.user_id into v_user from public.athletes a where a.id = p_athlete;
  if v_user is null then
    return;                           -- fiche sans compte : personne à prévenir
  end if;
  v_cle := 'ajout:' || p_athlete || ':' || txid_current() || ':' || extract(epoch from statement_timestamp());
  if exists (select 1 from public.push_file f where f.user_id = v_user and f.cle = v_cle) then
    return;                           -- même geste, déjà en file
  end if;
  perform public.push_mettre_en_file(p_athlete, 'INTERET_RECRUTEURS', 'AJOUT_LISTE', v_cle, null, '{}'::jsonb);
exception when others then
  raise warning 'push_sur_interet: athlète % — %', p_athlete, SQLERRM;
end;
$$;

create function public.push_sur_interet_favori()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.push_sur_interet(NEW.athlete_id, NEW.recruiter_id);
  return null;
end;
$$;

create function public.push_sur_interet_liste()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.push_sur_interet(NEW.athlete_id, (select l.recruiter_id from public.recruiter_lists l where l.id = NEW.list_id));
  return null;
end;
$$;

create function public.push_sur_interet_processus()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- Rejoindre le dossier déjà ouvert de l'unité : « pas un geste » (unite_ecrire_dossier).
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return null;
  end if;
  -- Processus ouvert par un message À L'ATHLÈTE (message_insert_to_pipeline, déclencheur des
  -- messages, donc profondeur ≥ 2, étape CONTACTE) : le push du message suffit. Le message est
  -- de cette transaction (created_at = now()).
  if pg_trigger_depth() >= 2 and NEW.stage = 'CONTACTE'
     and exists (select 1 from public.messages m
               join public.conversations c on c.id = m.conversation_id
              where c.conversation_type = 'RECRUTEUR_ATHLETE'
                and c.recruiter_id = NEW.recruiter_id and c.athlete_id = NEW.athlete_id
                and m.sender_id = NEW.recruiter_id and m.created_at = now()) then
    return null;
  end if;
  perform public.push_sur_interet(NEW.athlete_id, NEW.recruiter_id);
  return null;
end;
$$;

create trigger trg_push_interet after insert on public.recruiter_favorites
  for each row execute function public.push_sur_interet_favori();
create trigger trg_push_interet after insert on public.recruiter_list_members
  for each row execute function public.push_sur_interet_liste();
create trigger trg_push_interet after insert on public.recruiter_pipeline
  for each row execute function public.push_sur_interet_processus();

-- L'ancienne cloche de favori nommait la région : la file la remplace.
drop trigger trg_notify_favorited on public.recruiter_favorites;

-- ── Lot B : profil consulté, un push par jour ───────────────────────────────

create function public.push_sur_vue_profil()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user  uuid;
  v_jour  date;
  v_cle   text;
  v_notif uuid;
  v_n     integer;
  v_titre text;
  v_texte text;
begin
  if not exists (select 1 from public.users u
                  where u.id = NEW.recruiter_id and u.role = 'RECRUTEUR'::public.user_role
                    and u.status = 'ACTIF'::public.account_status) then
    return null;
  end if;
  select a.user_id into v_user from public.athletes a where a.id = NEW.athlete_id;
  if v_user is null then
    return null;
  end if;
  -- Le jour où le push peut partir : à partir de 22 h, c'est le lendemain (départ à 8 h).
  v_jour := ((coalesce(NEW.viewed_at, now()) at time zone 'America/Toronto') + interval '2 hours')::date;
  v_cle := 'vue:' || NEW.athlete_id || ':' || v_jour;

  -- Le push du jour est déjà traité (parti, sans appareil, annulé) : pas de 2e push. La
  -- notification du jour prend le compte du jour et redevient non lue.
  if exists (select 1 from public.push_file f where f.user_id = v_user and f.cle = v_cle and f.statut <> 'EN_ATTENTE') then
    select (f.detail->>'notification_id')::uuid into v_notif
      from public.push_file f
     where f.user_id = v_user and f.cle = v_cle and f.detail ? 'notification_id'
     order by f.id
     limit 1;
    -- Le compte du jour : les vues des recruteurs actifs, comme celles qui déclenchent.
    select count(*) into v_n
      from public.recruiter_athlete_views v
      join public.users u on u.id = v.recruiter_id
     where v.athlete_id = NEW.athlete_id
       and ((v.viewed_at at time zone 'America/Toronto') + interval '2 hours')::date = v_jour
       and u.role = 'RECRUTEUR'::public.user_role and u.status = 'ACTIF'::public.account_status;
    select t.titre, t.texte into v_titre, v_texte from public.push_textes('VUE_PROFIL', null, v_n, null) t;
    update public.athlete_notifications
       set title = v_texte, message = v_texte, read = false
     where id = v_notif and athlete_id = NEW.athlete_id;
    return null;
  end if;

  perform public.push_mettre_en_file(NEW.athlete_id, 'INTERET_RECRUTEURS', 'VUE_PROFIL', v_cle, null, '{}'::jsonb);
  return null;
exception when others then
  raise warning 'push_sur_vue_profil: athlète % — %', NEW.athlete_id, SQLERRM;
  return null;
end;
$$;

create trigger trg_push_vue_profil after insert on public.recruiter_athlete_views
  for each row execute function public.push_sur_vue_profil();

-- ── Droits : fermés comme le reste de la file ───────────────────────────────
-- Les default privileges de Supabase accordent EXECUTE à anon et authenticated sur toute
-- fonction créée : on retire tout, puis on rend à service_role (comme push_destination).

revoke all on function public.push_sur_interet(uuid, uuid) from public, anon, authenticated;
revoke all on function public.push_sur_interet_favori() from public, anon, authenticated;
revoke all on function public.push_sur_interet_liste() from public, anon, authenticated;
revoke all on function public.push_sur_interet_processus() from public, anon, authenticated;
revoke all on function public.push_sur_vue_profil() from public, anon, authenticated;
grant execute on function public.push_sur_interet(uuid, uuid) to service_role;
grant execute on function public.push_sur_interet_favori() to service_role;
grant execute on function public.push_sur_interet_liste() to service_role;
grant execute on function public.push_sur_interet_processus() to service_role;
grant execute on function public.push_sur_vue_profil() to service_role;

-- Gardes de sortie : ACL comparées en ENTIER (CLAUDE.md, « jamais par inclusion »).
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['postgres', 'service_role'];
begin
  foreach f in array array['public.push_sur_interet(uuid,uuid)',
                           'public.push_sur_interet_favori()', 'public.push_sur_interet_liste()',
                           'public.push_sur_interet_processus()', 'public.push_sur_vue_profil()',
                           'public.push_heure_calme(timestamptz)', 'public.push_textes(text,text,integer,text)',
                           'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)']::regprocedure[] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname in ('trg_push_interet', 'trg_push_vue_profil')) <> 4 then
    raise exception 'NEXUS: déclencheurs d''intérêt incomplets';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited') then
    raise exception 'NEXUS: trg_notify_favorited encore branché';
  end if;
end $$;
$NXMIG$::text as t;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261029170000', 'notif_interet_recruteur', array[t], 'bptds22@gmail.com' from _ni_texte;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_NOTIF_INTERET_RECRUTEUR',
       'Notifications d''intérêt recruteur (vue de profil, ajout à une liste, titre « Nexus ») et heures calmes 22 h 00 – 7 h 59 pour tous (GO BP)',
       jsonb_build_object('version', '20261029170000', 'md5_fichier', '728c0778d678cfbea89870c707ba098f', 'etat_depart', 'bba20215160886b637ed628bbe4fa293|51',
                          'etat_apres', '00000000000000000000000000000000|59',
                          'rollback', 'supabase/rollback/20261029170000_rollback_notif_interet_recruteur.sql'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $fni$
declare
  v_etat text;
begin
  if (select txid from _ni_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261029170000')
     is distinct from '728c0778d678cfbea89870c707ba098f' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  v_etat := (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid) || ' ' || convalidated
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x);
  if v_etat is distinct from '00000000000000000000000000000000|59' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (%) — tout est annulé', v_etat;
  end if;
  if (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.device_tokens) || '|' || (select count(*) from public.recruiter_favorites)
       || '|' || (select count(*) from public.recruiter_list_members) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.recruiter_athlete_views) || '|' || (select count(*) from public.parent_contact_avis) <> (select donnees from _ni_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _ni_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $fni$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _ni_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.device_tokens) || '|' || (select count(*) from public.recruiter_favorites)
       || '|' || (select count(*) from public.recruiter_list_members) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.recruiter_athlete_views) || '|' || (select count(*) from public.parent_contact_avis),
     'etat_objets', (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid) || ' ' || convalidated
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261029170000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261029170000'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_NOTIF_INTERET_RECRUTEUR' order by le desc limit 1),
     'heure_calme_22h', public.push_heure_calme('2026-10-29 22:00 America/Toronto'::timestamptz),
     'meme_transaction', (select txid from _ni_releve) = txid_current())
) as resultat_lot_notif_interet;
