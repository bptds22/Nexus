-- LOT ROLLBACK notif intérêt recruteur — généré par docs/notif-interet/prod/construire-lot-rollback.mjs
-- Fichier : supabase/rollback/20261029170000_rollback_notif_interet_recruteur.sql (git, LF) — md5 ddf0543770d89fa5bfbce21e691f1f4e ; section exécutée md5 48c04bcc7b9c8b69e35e0b7736cf58bb
--   (le fichier sans « \set ON_ERROR_STOP 1 », « begin; » ni « commit; »).
-- État de départ attendu : 619e5f2e9620c07c15d7fb66b9388f80|59 ; arrivée : bba20215160886b637ed628bbe4fa293|51
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Relevé avant (dans la transaction)
create temp table _rb_releve on commit drop as
select txid_current() as txid,
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
          from public.admin_operations) as lot_applique,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261029170000') as version_la,
       (select count(*) from public.push_file where statut = 'EN_ATTENTE' and genre in ('VUE_PROFIL', 'AJOUT_LISTE')) as file_annulee,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $grb$
begin
  if (select txid from _rb_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_la from _rb_releve) <> 1 or (select lot_applique from _rb_releve) <> 1 then
    raise exception 'NEXUS LOT: version 20261029170000 absente ou lot non appliqué — rien n''est défait';
  end if;
  if (select etat_objets from _rb_releve) is distinct from '619e5f2e9620c07c15d7fb66b9388f80|59' then
    raise exception 'NEXUS LOT: objets de départ ≠ état migré (%) — rien n''est défait', (select etat_objets from _rb_releve);
  end if;
end $grb$;

-- 3. ===== DÉBUT 20261029170000_rollback_notif_interet_recruteur.sql (sans \set, begin, commit) =====
-- Rollback de 20261029170000_notif_interet_recruteur.sql — une transaction.
--
-- Remet push_heure_calme (21 h – 8 h), push_textes et push_mettre_en_file tels que relevés
-- en prod le 2026-10-29 (corps octet pour octet),
-- débranche les déclencheurs d'intérêt, supprime les fonctions créées et rebranche
-- trg_notify_favorited (cloche favori avec région, migration 20261028120000).
-- Les éléments de file des nouveaux genres encore en attente sont ANNULÉS (l'ancienne
-- push_textes ne sait pas les écrire) ; les contraintes reviennent en NOT VALID pour garder
-- l'historique. Les notifications déjà créées restent (types existants).

do $$
begin
  if to_regprocedure('public.push_sur_vue_profil()') is null then
    raise exception 'NEXUS: migration notif intérêt recruteur absente — rien à défaire';
  end if;
end $$;

drop trigger trg_push_interet on public.recruiter_favorites;
drop trigger trg_push_interet on public.recruiter_list_members;
drop trigger trg_push_interet on public.recruiter_pipeline;
drop trigger trg_push_vue_profil on public.recruiter_athlete_views;
create trigger trg_notify_favorited after insert on public.recruiter_favorites
  for each row execute function public.notify_athlete_favorited();

update public.push_file set statut = 'ANNULE', traite_le = now()
 where statut = 'EN_ATTENTE' and genre in ('VUE_PROFIL', 'AJOUT_LISTE');

CREATE OR REPLACE FUNCTION public.push_heure_calme(p_moment timestamp with time zone)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select extract(hour from (p_moment at time zone 'America/Toronto')) >= 21
      or extract(hour from (p_moment at time zone 'America/Toronto')) < 8
$function$
;

CREATE OR REPLACE FUNCTION public.push_textes(p_genre text, p_source_nom text, p_n integer, p_libelle text)
 RETURNS TABLE(titre text, texte text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select
    case
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') and p_n > 1 then p_n || ' nouveaux badges'
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') then 'Nouveau badge'
      when p_genre in ('EVALUATION_COACH', 'EVALUATION_PARTENAIRE') then 'Nouvelle évaluation'
      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'
      when p_genre = 'VISIBILITE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
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
    end
$function$
;

CREATE OR REPLACE FUNCTION public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text, p_source_nom text, p_detail jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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
$function$
;



drop function public.push_sur_vue_profil();
drop function public.push_sur_interet_processus();
drop function public.push_sur_interet_liste();
drop function public.push_sur_interet_favori();
drop function public.push_sur_interet(uuid, uuid);

alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH'::text, 'BADGE_PARTENAIRE'::text, 'EVALUATION_COACH'::text,
                            'EVALUATION_PARTENAIRE'::text, 'CARTE_PARTENAIRE'::text, 'VISIBILITE_PARTENAIRE'::text])) not valid;
alter table public.push_file drop constraint push_file_categorie_check;
alter table public.push_file add constraint push_file_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS'::text, 'VISITES'::text, 'RAPPELS'::text, 'CARTES_PARTENAIRES'::text])) not valid;
alter table public.push_preferences drop constraint push_preferences_categorie_check;
alter table public.push_preferences add constraint push_preferences_categorie_check
  check (categorie = any (array['BADGES_EVALUATIONS'::text, 'VISITES'::text, 'RAPPELS'::text, 'CARTES_PARTENAIRES'::text])) not valid;
-- Validées quand aucune ligne des nouveaux genres n'existe (état exact d'avant) ; sinon elles
-- restent NOT VALID et l'historique est gardé.
do $$
begin
  if not exists (select 1 from public.push_file where genre in ('VUE_PROFIL', 'AJOUT_LISTE')
                                                  or categorie = 'INTERET_RECRUTEURS') then
    alter table public.push_file validate constraint push_file_genre_check;
    alter table public.push_file validate constraint push_file_categorie_check;
  end if;
  if not exists (select 1 from public.push_preferences where categorie = 'INTERET_RECRUTEURS') then
    alter table public.push_preferences validate constraint push_preferences_categorie_check;
  end if;
end $$;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.push_heure_calme(timestamptz)'::regprocedure)
       is distinct from 'eca3911129c5142603560d0439106e58'
     or (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
       is distinct from '93a8a713d8cb9a74fd5dbbc8fdc04f4e'
     or (select md5(prosrc) from pg_proc where oid = 'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)'::regprocedure)
       is distinct from '5e5db786d60a5e67b094fe50b5e14b2a'
     or (select md5(prosrc) from pg_proc where oid = 'public.parent_contact_envoyer_push(timestamptz)'::regprocedure)
       is distinct from '7ea5030e84d103cdd5ba8858d552e9b9' then
    -- (parent_contact_envoyer_push n'est pas modifiée par la migration : on vérifie qu'elle est intacte.)
    raise exception 'NEXUS: rollback — une fonction ne revient pas à son relevé';
  end if;
end $$;


-- ===== FIN 20261029170000_rollback_notif_interet_recruteur.sql =====

-- 4. Retrait de la version et trace du geste
delete from supabase_migrations.schema_migrations where version = '20261029170000';
insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_NOTIF_INTERET_RECRUTEUR',
       'Rollback des notifications d''intérêt recruteur et des heures calmes 22 h 00 – 7 h 59 (GO BP)',
       jsonb_build_object('version', '20261029170000', 'md5_rollback', 'ddf0543770d89fa5bfbce21e691f1f4e', 'etat_depart', '619e5f2e9620c07c15d7fb66b9388f80|59',
                          'etat_arrivee', 'bba20215160886b637ed628bbe4fa293|51', 'file_annulee', (select file_annulee from _rb_releve)),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $frb$
declare
  v_etat text;
begin
  if (select txid from _rb_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if exists (select 1 from public.push_file where genre in ('VUE_PROFIL', 'AJOUT_LISTE') or categorie = 'INTERET_RECRUTEURS')
     or exists (select 1 from public.push_preferences where categorie = 'INTERET_RECRUTEURS') then
    v_etat := (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || case when conname in ('push_file_genre_check', 'push_file_categorie_check', 'push_preferences_categorie_check') then replace(pg_get_constraintdef(oid), ' NOT VALID', '') || ' true'
        else pg_get_constraintdef(oid) || ' ' || convalidated end
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x);
  else
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
  end if;
  if v_etat is distinct from 'bba20215160886b637ed628bbe4fa293|51' then
    raise exception 'NEXUS LOT: objets ≠ état d''avant la migration (%) — tout est annulé', v_etat;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029170000') then
    raise exception 'NEXUS LOT: version 20261029170000 encore inscrite — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _rb_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $frb$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select etat_objets, operations, version_la, file_annulee, pg from _rb_releve) r),
  'apres', json_build_object(
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
     'etat_neutre', (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || case when conname in ('push_file_genre_check', 'push_file_categorie_check', 'push_preferences_categorie_check') then replace(pg_get_constraintdef(oid), ' NOT VALID', '') || ' true'
        else pg_get_constraintdef(oid) || ' ' || convalidated end
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x),
     'lignes_nouveaux_genres', exists (select 1 from public.push_file where genre in ('VUE_PROFIL', 'AJOUT_LISTE') or categorie = 'INTERET_RECRUTEURS')
     or exists (select 1 from public.push_preferences where categorie = 'INTERET_RECRUTEURS'),
     'versions', (select count(*) from supabase_migrations.schema_migrations where version = '20261029170000'),
     'admin_operation', (select id from public.admin_operations where operation = 'ROLLBACK_NOTIF_INTERET_RECRUTEUR' order by le desc limit 1),
     'trg_notify_favorited', exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited' and not tgisinternal),
     'heure_calme_21h', public.push_heure_calme('2026-10-29 21:00 America/Toronto'::timestamptz),
     'meme_transaction', (select txid from _rb_releve) = txid_current())
) as resultat_lot_rollback_notif_interet;
