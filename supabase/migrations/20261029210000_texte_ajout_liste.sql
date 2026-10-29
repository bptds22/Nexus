-- Texte du push et de la cloche AJOUT_LISTE (décision BP du 2026-10-29) :
--   « Ton profil a été ajouté à une liste » → « Ton profil a été ajouté à une liste de suivi ».
-- Ne change que push_textes (une ligne). Le push garde le titre « Nexus » ; la cloche prend la phrase
-- pour titre et message (push_mettre_en_file, inchangée : v_cloche = v_texte pour AJOUT_LISTE).
-- Les notifications déjà écrites gardent l'ancien texte. Droits inchangés (create or replace).
-- Rollback : supabase/rollback/20261029210000_rollback_texte_ajout_liste.sql

do $$
begin
  if to_regprocedure('public.push_sur_vue_profil()') is null then
    raise exception 'NEXUS: préalable 20261029170000 (notif intérêt recruteur) absent';
  end if;
  -- Version remplacée : 20261029170000, relevée en prod le 2026-10-29 20 h 07 UTC.
  if (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
     is distinct from '1438de505102325941cc079324fec348' then
    raise exception 'NEXUS: push_textes ne correspond pas au relevé (déjà appliquée ?)';
  end if;
end $$;

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
      when p_genre = 'AJOUT_LISTE' then 'Ton profil a été ajouté à une liste de suivi'
    end
$function$;

-- Garde de sortie : le nouveau texte, et les droits comparés en ENTIER.
do $$
declare
  vus text[];
begin
  if (select t.texte from public.push_textes('AJOUT_LISTE', null, 1, null) t) is distinct from 'Ton profil a été ajouté à une liste de suivi'
     or (select t.titre from public.push_textes('AJOUT_LISTE', null, 1, null) t) is distinct from 'Nexus' then
    raise exception 'NEXUS: texte AJOUT_LISTE inattendu';
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.push_textes(text,text,integer,text)'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de push_textes = %, attendu {postgres,service_role}', vus;
  end if;
end $$;
