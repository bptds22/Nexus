-- LOT PROD 20261016170000 — généré par docs/cote-partenaire-carte/prod/construire-lot.mjs
-- Fichier : supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql — md5 ed4812c526da2edaee5c75ed181ec02f
-- Empreinte attendue des objets : 96eee4fbb89eeb86c173c8dec9387476
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _cote_releve as
select txid_current() as txid,
       (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners) as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261016170000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _cote_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _cote_releve) <> 0 then
    raise exception 'NEXUS LOT: 20261016170000 déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261016170000_cote_partenaire_carte_mes_athletes.sql =====
-- Cote partenaire sur la carte du joueur + filtres de « Mes athlètes » (demande BP du 2026-10-16).
--
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes, pour les
--    cartes (favoris, fiche, aperçu). AUCUNE règle nouvelle : la fonction est SECURITY INVOKER et
--    appelle, athlète par athlète, evaluations_partenaires_athlete() (W2), qui arbitre déjà qui lit
--    quoi. Elle ne rend que ce que l'appelant obtiendrait déjà en l'appelant lui-même une fois par
--    athlète — moins les critères, dont une carte n'a pas besoin. Pas de nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE (le RETURNS TABLE change). Deux colonnes à la fin,
--    poste et poste_abr (la position, pour la recherche) ; dans chaque badge, badge_ref (l'identifiant
--    du badge du catalogue — badges.id pour un badge Nexus, partner_badges.id pour un badge propre —
--    pour le filtre « Distinctions »). Corps IDENTIQUE à W4d sinon ; même règle de visibilité
--    (partenaire_voit_athlete). L'ACL est reposée et comparée EN ENTIER (règle du 2026-09-07).

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null then
    raise exception 'NEXUS: cotes_partenaires_athletes existe déjà — lot déjà appliqué ?';
  end if;
  -- Les fonctions dont on dépend ou qu'on remplace doivent être EXACTEMENT celles relevées
  -- (local = prod, relevé du 2026-10-16).
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_mes_athletes()'::regprocedure)
     is distinct from '71a92e788d13bc85ee8d9d9baa675e30' then
    raise exception 'NEXUS: partenaire_mes_athletes ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.evaluations_partenaires_athlete(uuid)'::regprocedure)
     is distinct from '33d0544f27a8b62fa9e21902f2e62310' then
    raise exception 'NEXUS: evaluations_partenaires_athlete ne correspond pas au relevé — la règle de lecture a changé';
  end if;
end $$;

-- ── 1. Cotes partenaires d'un lot d'athlètes ─────────────────────────────────
create function public.cotes_partenaires_athletes(p_athlete_ids uuid[])
returns table (id uuid, athlete_id uuid, organisation text, cote_globale numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, i.athlete_id, e.organisation, e.cote_globale, e.updated_at
    from (select distinct x as athlete_id from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null) i
    cross join lateral public.evaluations_partenaires_athlete(i.athlete_id) e
$$;

comment on function public.cotes_partenaires_athletes(uuid[]) is
  'Cartes : évaluations partenaires (organisation, cote, date) d''un lot d''athlètes. INVOKER : délègue à evaluations_partenaires_athlete(), aucune règle propre.';

revoke all on function public.cotes_partenaires_athletes(uuid[]) from public, anon, authenticated;
grant execute on function public.cotes_partenaires_athletes(uuid[]) to authenticated, service_role;

-- ── 2. « Mes athlètes » : la position et la référence des badges ─────────────
drop function public.partenaire_mes_athletes();

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz,
  poste text, poste_abr text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'badge_ref', coalesce(pab.badge_id, pab.partner_badge_id),
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null)),
         po.nom, po.abreviation
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join public.positions po on po.id = a.position_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

comment on function public.partenaire_mes_athletes() is
  'W4d + filtres (2026-10-16) : athlètes évalués ou badgés par le partenaire appelant, s''ils lui sont encore visibles. poste/poste_abr et badges[].badge_ref pour la recherche et le filtre Distinctions.';

revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

-- ── Gardes : ACL comparées EN ENTIER, signatures uniques ──────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  foreach f in array array[
    'public.cotes_partenaires_athletes(uuid[])'::regprocedure,
    'public.partenaire_mes_athletes()'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')) <> 2 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS cote partenaire / Mes athlètes : fonctions et ACL exactes — OK';
end $$;

-- ===== FIN 20261016170000_cote_partenaire_carte_mes_athletes.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _cote_texte as select $COTEMIG$-- Cote partenaire sur la carte du joueur + filtres de « Mes athlètes » (demande BP du 2026-10-16).
--
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes, pour les
--    cartes (favoris, fiche, aperçu). AUCUNE règle nouvelle : la fonction est SECURITY INVOKER et
--    appelle, athlète par athlète, evaluations_partenaires_athlete() (W2), qui arbitre déjà qui lit
--    quoi. Elle ne rend que ce que l'appelant obtiendrait déjà en l'appelant lui-même une fois par
--    athlète — moins les critères, dont une carte n'a pas besoin. Pas de nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE (le RETURNS TABLE change). Deux colonnes à la fin,
--    poste et poste_abr (la position, pour la recherche) ; dans chaque badge, badge_ref (l'identifiant
--    du badge du catalogue — badges.id pour un badge Nexus, partner_badges.id pour un badge propre —
--    pour le filtre « Distinctions »). Corps IDENTIQUE à W4d sinon ; même règle de visibilité
--    (partenaire_voit_athlete). L'ACL est reposée et comparée EN ENTIER (règle du 2026-09-07).

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null then
    raise exception 'NEXUS: cotes_partenaires_athletes existe déjà — lot déjà appliqué ?';
  end if;
  -- Les fonctions dont on dépend ou qu'on remplace doivent être EXACTEMENT celles relevées
  -- (local = prod, relevé du 2026-10-16).
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_mes_athletes()'::regprocedure)
     is distinct from '71a92e788d13bc85ee8d9d9baa675e30' then
    raise exception 'NEXUS: partenaire_mes_athletes ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.evaluations_partenaires_athlete(uuid)'::regprocedure)
     is distinct from '33d0544f27a8b62fa9e21902f2e62310' then
    raise exception 'NEXUS: evaluations_partenaires_athlete ne correspond pas au relevé — la règle de lecture a changé';
  end if;
end $$;

-- ── 1. Cotes partenaires d'un lot d'athlètes ─────────────────────────────────
create function public.cotes_partenaires_athletes(p_athlete_ids uuid[])
returns table (id uuid, athlete_id uuid, organisation text, cote_globale numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, i.athlete_id, e.organisation, e.cote_globale, e.updated_at
    from (select distinct x as athlete_id from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null) i
    cross join lateral public.evaluations_partenaires_athlete(i.athlete_id) e
$$;

comment on function public.cotes_partenaires_athletes(uuid[]) is
  'Cartes : évaluations partenaires (organisation, cote, date) d''un lot d''athlètes. INVOKER : délègue à evaluations_partenaires_athlete(), aucune règle propre.';

revoke all on function public.cotes_partenaires_athletes(uuid[]) from public, anon, authenticated;
grant execute on function public.cotes_partenaires_athletes(uuid[]) to authenticated, service_role;

-- ── 2. « Mes athlètes » : la position et la référence des badges ─────────────
drop function public.partenaire_mes_athletes();

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz,
  poste text, poste_abr text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'badge_ref', coalesce(pab.badge_id, pab.partner_badge_id),
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null)),
         po.nom, po.abreviation
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join public.positions po on po.id = a.position_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

comment on function public.partenaire_mes_athletes() is
  'W4d + filtres (2026-10-16) : athlètes évalués ou badgés par le partenaire appelant, s''ils lui sont encore visibles. poste/poste_abr et badges[].badge_ref pour la recherche et le filtre Distinctions.';

revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

-- ── Gardes : ACL comparées EN ENTIER, signatures uniques ──────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  foreach f in array array[
    'public.cotes_partenaires_athletes(uuid[])'::regprocedure,
    'public.partenaire_mes_athletes()'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')) <> 2 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS cote partenaire / Mes athlètes : fonctions et ACL exactes — OK';
end $$;
$COTEMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _cote_texte' using '20261016170000', 'cote_partenaire_carte_mes_athletes', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _cote_texte' using '20261016170000', 'cote_partenaire_carte_mes_athletes';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _cote_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016170000')
     is distinct from 'ed4812c526da2edaee5c75ed181ec02f' then
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
     and p.proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'evaluations_partenaires_athlete', 'partenaire_voit_athlete')
) t
  ) e;
  if v_empreinte is distinct from '96eee4fbb89eeb86c173c8dec9387476' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners) <> (select donnees from _cote_releve) then
    raise exception 'NEXUS LOT: une donnée partenaire a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _cote_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016170000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016170000'),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                    and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes')),
     'meme_transaction', (select txid from _cote_releve) = txid_current())
) as resultat_lot_cote_partenaire;
