-- Rollback de 20261029210000_texte_ajout_liste.sql — aucune commande psql, aucun begin/commit :
-- s'exécute dans la transaction de l'appelant (lot du connecteur, ou psql -1).
-- Remet push_textes tel que 20261029170000 l'a posé (« Ton profil a été ajouté à une liste »).
-- Les notifications déjà écrites gardent leur texte.

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
     is distinct from '1c33650b63f6b7f108b11b8df6e01228' then
    raise exception 'NEXUS: rollback texte AJOUT_LISTE — push_textes n''est pas celle de 20261029210000';
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
      when p_genre = 'AJOUT_LISTE' then 'Ton profil a été ajouté à une liste'
    end
$function$;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.push_textes(text,text,integer,text)'::regprocedure)
     is distinct from '1438de505102325941cc079324fec348' then
    raise exception 'NEXUS: rollback texte AJOUT_LISTE — push_textes ne revient pas à 20261029170000';
  end if;
end $$;
