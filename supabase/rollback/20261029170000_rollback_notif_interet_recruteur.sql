-- Rollback de 20261029170000_notif_interet_recruteur.sql — une transaction.
--
-- Remet push_heure_calme (21 h – 8 h), push_textes et push_mettre_en_file tels que relevés
-- en prod le 2026-10-29 (corps octet pour octet),
-- débranche les déclencheurs d'intérêt, supprime les fonctions créées et rebranche
-- trg_notify_favorited (cloche favori avec région, migration 20261028120000).
-- Les éléments de file des nouveaux genres encore en attente sont ANNULÉS (l'ancienne
-- push_textes ne sait pas les écrire) ; les contraintes reviennent en NOT VALID pour garder
-- l'historique. Les notifications déjà créées restent (types existants).
\set ON_ERROR_STOP 1
begin;

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

commit;
