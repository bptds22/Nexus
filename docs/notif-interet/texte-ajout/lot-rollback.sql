-- LOT ROLLBACK texte AJOUT_LISTE — généré par docs/notif-interet/texte-ajout/construire-lots.mjs (sources lues par git show, LF)
-- Migration md5 784801cd0e738bde44064f2c759f4af1 ; rollback md5 f6c37b2d516db215f8cb444071e4a8a1
-- État de départ attendu : 431ce1164bba28694c21be5ec04d3435|59 ; arrivée : 619e5f2e9620c07c15d7fb66b9388f80|59
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Relevé avant (dans la transaction)
create temp table _tx_releve on commit drop as
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
       (select count(*) filter (where operation = 'MIGRATION_TEXTE_AJOUT_LISTE') - count(*) filter (where operation = 'ROLLBACK_TEXTE_AJOUT_LISTE')
          from public.admin_operations) as lot_applique,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261029210000') as version_la;

-- 2. Garde AVANT toute écriture
do $gtx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_la from _tx_releve) <> 1 or (select lot_applique from _tx_releve) <> 1 then
    raise exception 'NEXUS LOT: version 20261029210000 absente ou lot non appliqué — rien n''est défait';
  end if;
  if (select etat_objets from _tx_releve) is distinct from '431ce1164bba28694c21be5ec04d3435|59' then
    raise exception 'NEXUS LOT: objets de départ ≠ état migré (%) — rien n''est défait', (select etat_objets from _tx_releve);
  end if;
end $gtx$;

-- 3. ===== DÉBUT 20261029210000_rollback_texte_ajout_liste.sql =====
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

-- ===== FIN 20261029210000_rollback_texte_ajout_liste.sql =====

-- 4. Retrait de la version et trace du geste
delete from supabase_migrations.schema_migrations where version = '20261029210000';
insert into public.admin_operations (operation, motif, details, par)
select 'ROLLBACK_TEXTE_AJOUT_LISTE', 'Rollback du texte AJOUT_LISTE (retour à « Ton profil a été ajouté à une liste ») (GO BP)',
       jsonb_build_object('version', '20261029210000', 'md5_rollback', 'f6c37b2d516db215f8cb444071e4a8a1', 'etat_depart', '431ce1164bba28694c21be5ec04d3435|59',
                          'etat_arrivee', '619e5f2e9620c07c15d7fb66b9388f80|59'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $ftx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
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
) x) is distinct from '619e5f2e9620c07c15d7fb66b9388f80|59' then
    raise exception 'NEXUS LOT: objets ≠ état d''avant le texte — tout est annulé';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029210000') then
    raise exception 'NEXUS LOT: version 20261029210000 encore inscrite — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _tx_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $ftx$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select etat_objets, operations, version_la from _tx_releve) r),
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
     'versions', (select count(*) from supabase_migrations.schema_migrations where version = '20261029210000'),
     'texte', (select t.titre || ' / ' || t.texte from public.push_textes('AJOUT_LISTE', null, 1, null) t),
     'meme_transaction', (select txid from _tx_releve) = txid_current())
) as resultat_lot_rollback_texte_ajout;
