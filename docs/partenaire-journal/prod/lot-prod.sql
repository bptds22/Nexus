-- LOT PROD journal partenaire — généré par docs/partenaire-journal/prod/construire-lot.mjs
-- Fichier : supabase/migrations/20261016150000_partenaire_journal.sql — md5 77b4533bf6e8eaee7a0a4ac5b15b3aea
-- Empreinte attendue des objets : d18a6ca68ce7ec68b09a3faa47cd9d51
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pj_releve as
select txid_current() as txid,
       (select count(*) from public.partner_profile_views) || '|' || (select count(*) from public.partner_card_downloads)
       || '|' || (select count(*) from public.media_partners) as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261016150000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pj_releve) <> 0 then
    raise exception 'NEXUS LOT: migration journal partenaire déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT 20261016150000_partenaire_journal.sql =====
-- Journal partenaire par fonction en base — vues de fiche et téléchargements de carte (lot mobile 1.4.5, B1).
--
-- Le web journalise par deux routes Next (/api/partner/profile-views/log, /api/partner/cards/log-download).
-- Une appli en export statique n'embarque AUCUNE route API : sur mobile, ni la vue ni le téléchargement
-- ne seraient tracés (Loi 25 : l'athlète lit ce journal). La même règle passe donc dans UNE fonction,
-- appelée par le web ET par l'appli :
--
--   partenaire_journaliser(p_athlete_id, p_action, p_format)
--     · p_action = 'VUE'            → une ligne partner_profile_views ;
--     · p_action = 'TELECHARGEMENT' → une ligne partner_card_downloads (p_format 'publication' | 'story').
--   Mêmes gardes que les routes, dans le même ordre : session, partenaire APPROUVÉ (celui de auth.uid(),
--   jamais un identifiant passé par le client), paramètres, athlète admissible (is_partner_eligible_athlete).
--   Un refus lève une erreur « NEXUS: … » et n'écrit rien.
--
-- Aucune table, aucune policy, aucune fonction existante modifiée. Aucune donnée écrite par la migration.
do $$
begin
  if to_regprocedure('public.partenaire_journaliser(uuid,text,text)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (journal partenaire)';
  end if;
  if to_regprocedure('public.is_partner_eligible_athlete(uuid)') is null
     or to_regclass('public.partner_profile_views') is null
     or to_regclass('public.partner_card_downloads') is null then
    raise exception 'NEXUS: objets du portail partenaire absents';
  end if;
end $$;

create function public.partenaire_journaliser(p_athlete_id uuid, p_action text, p_format text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_partenaire uuid;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: non authentifié' using errcode = '42501';
  end if;

  select mp.id into v_partenaire
    from public.media_partners mp
   where mp.user_id = auth.uid() and mp.status = 'APPROVED';
  if v_partenaire is null then
    raise exception 'NEXUS: accès refusé — partenaire non approuvé' using errcode = '42501';
  end if;

  if p_athlete_id is null
     or p_action is null or p_action not in ('VUE', 'TELECHARGEMENT')
     or (p_action = 'TELECHARGEMENT' and (p_format is null or p_format not in ('publication', 'story')))
     or (p_action = 'VUE' and p_format is not null) then
    raise exception 'NEXUS: paramètres invalides' using errcode = '22023';
  end if;

  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non disponible' using errcode = '42501';
  end if;

  if p_action = 'VUE' then
    insert into public.partner_profile_views (partner_id, athlete_id) values (v_partenaire, p_athlete_id);
  else
    insert into public.partner_card_downloads (partner_id, athlete_id, format) values (v_partenaire, p_athlete_id, p_format);
  end if;
  return true;
end;
$$;

comment on function public.partenaire_journaliser(uuid, text, text) is
  'Journal Loi 25 du portail partenaire (web et appli) : VUE de fiche ou TELECHARGEMENT de carte, '
  'par le partenaire APPROUVÉ de la session, sur un athlète admissible. Remplace les deux routes Next.';

-- ── Droits ───────────────────────────────────────────────────────────────────
revoke all on function public.partenaire_journaliser(uuid, text, text) from public, anon, authenticated;
grant execute on function public.partenaire_journaliser(uuid, text, text) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────
do $$
declare
  vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL partenaire_journaliser = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) then
    raise exception 'NEXUS: partenaire_journaliser doit être SECURITY DEFINER';
  end if;
  if (select position('is_partner_eligible_athlete(' in prosrc) from pg_proc
       where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) = 0 then
    raise exception 'NEXUS: partenaire_journaliser ne vérifie pas l''admissibilité';
  end if;
  raise notice 'NEXUS journal partenaire : partenaire_journaliser (VUE, TELECHARGEMENT) — OK';
end $$;

-- ===== FIN 20261016150000_partenaire_journal.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _pj_texte as select $PJMIG$-- Journal partenaire par fonction en base — vues de fiche et téléchargements de carte (lot mobile 1.4.5, B1).
--
-- Le web journalise par deux routes Next (/api/partner/profile-views/log, /api/partner/cards/log-download).
-- Une appli en export statique n'embarque AUCUNE route API : sur mobile, ni la vue ni le téléchargement
-- ne seraient tracés (Loi 25 : l'athlète lit ce journal). La même règle passe donc dans UNE fonction,
-- appelée par le web ET par l'appli :
--
--   partenaire_journaliser(p_athlete_id, p_action, p_format)
--     · p_action = 'VUE'            → une ligne partner_profile_views ;
--     · p_action = 'TELECHARGEMENT' → une ligne partner_card_downloads (p_format 'publication' | 'story').
--   Mêmes gardes que les routes, dans le même ordre : session, partenaire APPROUVÉ (celui de auth.uid(),
--   jamais un identifiant passé par le client), paramètres, athlète admissible (is_partner_eligible_athlete).
--   Un refus lève une erreur « NEXUS: … » et n'écrit rien.
--
-- Aucune table, aucune policy, aucune fonction existante modifiée. Aucune donnée écrite par la migration.
do $$
begin
  if to_regprocedure('public.partenaire_journaliser(uuid,text,text)') is not null then
    raise exception 'NEXUS: migration déjà appliquée (journal partenaire)';
  end if;
  if to_regprocedure('public.is_partner_eligible_athlete(uuid)') is null
     or to_regclass('public.partner_profile_views') is null
     or to_regclass('public.partner_card_downloads') is null then
    raise exception 'NEXUS: objets du portail partenaire absents';
  end if;
end $$;

create function public.partenaire_journaliser(p_athlete_id uuid, p_action text, p_format text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
set row_security = off
as $$
declare
  v_partenaire uuid;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: non authentifié' using errcode = '42501';
  end if;

  select mp.id into v_partenaire
    from public.media_partners mp
   where mp.user_id = auth.uid() and mp.status = 'APPROVED';
  if v_partenaire is null then
    raise exception 'NEXUS: accès refusé — partenaire non approuvé' using errcode = '42501';
  end if;

  if p_athlete_id is null
     or p_action is null or p_action not in ('VUE', 'TELECHARGEMENT')
     or (p_action = 'TELECHARGEMENT' and (p_format is null or p_format not in ('publication', 'story')))
     or (p_action = 'VUE' and p_format is not null) then
    raise exception 'NEXUS: paramètres invalides' using errcode = '22023';
  end if;

  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non disponible' using errcode = '42501';
  end if;

  if p_action = 'VUE' then
    insert into public.partner_profile_views (partner_id, athlete_id) values (v_partenaire, p_athlete_id);
  else
    insert into public.partner_card_downloads (partner_id, athlete_id, format) values (v_partenaire, p_athlete_id, p_format);
  end if;
  return true;
end;
$$;

comment on function public.partenaire_journaliser(uuid, text, text) is
  'Journal Loi 25 du portail partenaire (web et appli) : VUE de fiche ou TELECHARGEMENT de carte, '
  'par le partenaire APPROUVÉ de la session, sur un athlète admissible. Remplace les deux routes Next.';

-- ── Droits ───────────────────────────────────────────────────────────────────
revoke all on function public.partenaire_journaliser(uuid, text, text) from public, anon, authenticated;
grant execute on function public.partenaire_journaliser(uuid, text, text) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────
do $$
declare
  vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL partenaire_journaliser = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) then
    raise exception 'NEXUS: partenaire_journaliser doit être SECURITY DEFINER';
  end if;
  if (select position('is_partner_eligible_athlete(' in prosrc) from pg_proc
       where oid = 'public.partenaire_journaliser(uuid,text,text)'::regprocedure) = 0 then
    raise exception 'NEXUS: partenaire_journaliser ne vérifie pas l''admissibilité';
  end if;
  raise notice 'NEXUS journal partenaire : partenaire_journaliser (VUE, TELECHARGEMENT) — OK';
end $$;
$PJMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pj_texte' using '20261016150000', 'partenaire_journal', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pj_texte' using '20261016150000', 'partenaire_journal';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016150000')
     is distinct from '77b4533bf6e8eaee7a0a4ac5b15b3aea' then
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
     and p.proname = 'partenaire_journaliser'
  union all
  select 'pol:' || c.relname || '|' || pol.polname || '|' || pol.polcmd::text
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relname in ('partner_profile_views', 'partner_card_downloads')
) t
  ) e;
  if v_empreinte is distinct from 'd18a6ca68ce7ec68b09a3faa47cd9d51' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.partner_profile_views) || '|' || (select count(*) from public.partner_card_downloads)
       || '|' || (select count(*) from public.media_partners) <> (select donnees from _pj_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _pj_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.partner_profile_views) || '|' || (select count(*) from public.partner_card_downloads)
       || '|' || (select count(*) from public.media_partners),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016150000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016150000'),
     'fonction', to_regprocedure('public.partenaire_journaliser(uuid,text,text)')::text,
     'meme_transaction', (select txid from _pj_releve) = txid_current())
) as resultat_lot_journal_partenaire;
