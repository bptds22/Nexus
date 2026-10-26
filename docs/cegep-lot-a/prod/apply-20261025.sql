-- ════════════════════════════════════════════════════════════════════════════
-- Lot A cégep — APPLY RÉEL EN PROD, version 20261026030400 (GO BP 2026-10-25).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-a-rejeu-blanc.sh <date> apply : la migration y est
-- embarquée telle quelle (même texte que celui du rejeu à blanc du 2026-10-25, md5 gardé).
--
-- UNE transaction : gardes avant → migration → gardes après (md5, policies, preuve sous vrai
-- JWT) → inscription (schema_migrations + admin_operations) → COMMIT. Toute garde qui échoue
-- (RAISE « NEXUS: ») ou toute erreur arrête psql (ON_ERROR_STOP) AVANT le COMMIT : rien n'est
-- appliqué. Lancer SANS -1.
-- Rollback : supabase/rollback/20261026030400_rollback_cegep_lot_a_base.sql, par
-- docs/cegep-lot-a/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-apply-lot-a';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
declare r record; n int; v text;
begin
  -- Jamais le mardi ou le mercredi avant 5 h (heure de Montréal).
  if extract(isodow from now() at time zone 'America/Toronto') in (2, 3)
     and extract(hour from now() at time zone 'America/Toronto') < 5 then
    raise exception 'NEXUS: pas d''apply le mardi ou le mercredi avant 5 h';
  end if;

  if to_regprocedure('public.athlete_est_cegepien(uuid)') is not null
     or to_regprocedure('public.peut_voir_cegepiens()') is not null
     or to_regprocedure('public.unite_voit_cegepiens(uuid)') is not null then
    raise exception 'NEXUS: une fonction-règle du lot A existe déjà';
  end if;
  select count(*) into n from pg_policies where policyname = 'cegepiens_masques_recruteurs';
  if n <> 0 then raise exception 'NEXUS: % policy(ies) cegepiens_masques_recruteurs déjà présente(s)', n; end if;

  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261026030400') then
    raise exception 'NEXUS: version 20261026030400 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261026030400' then raise exception 'NEXUS: version 20261026030400 pas après la dernière (%)', v; end if;

  -- Corps prod des 18 fonctions touchées : ceux du rejeu (relevés 2026-10-20 et 2026-10-25).
  for r in select * from (values
    ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '1d04401fe73aed88764c0899a22d76f7'),
    ('public.recruiter_athlete_profile(uuid)', '0b58d368f76a81cd0cb066404e8d77e0'),
    ('public.recruiter_athlete_cards(uuid[])', '18ab33af6d239268c0d80e2f5ccc02c3'),
    ('public.athletes_targeting_my_cegep()', '564a2e940ad9d187b3e0b8f4c16631e0'),
    ('public.matchs_profils_nexus(uuid[])', 'b94ab615cf14a4fa104f28bce1213abf'),
    ('public.depistage_profils_match(uuid)', 'ad18404a95b8ee3713d2d2acef79d7b6'),
    ('public.rapprochement_candidats(uuid,uuid)', '7a71383b81597b9c6b21fe4530670623'),
    ('public.rapprochements_unite(uuid)', 'dd4be21b51d7f25cc7e2305137a73da0'),
    ('public.rapprochements_refuses_unite()', 'a5d84a05834fc1fd293f7ee85c9210dd'),
    ('public.fusionner_carte(uuid,uuid)', '38f4f1a78a4c6635c8f5244df033e5a1'),
    ('public.athletes_nom_proche(text,text,uuid)', '492f6f32bdd04bd5099ab706a3eb55b3'),
    ('public.athlete_nexus_par_courriel(text)', '6f4023f8437a354d3cc64c62a1a7540f'),
    ('public.agenda_flux(text)', '6c1e9e2cb301ba8db313c72a2c68a47d'),
    ('public.matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '9674fbf129c1f0f0b93d05948e2659dd'),
    ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)', 'f6c6f67a42a18711011c377bd93bb19e'),
    ('public.log_new_athlete()', '6fc96267a5d89574a305f3da137e2b24'),
    ('public.log_athlete_update()', 'cda68b5c35a432d7957f4b8fca5c9b2c'),
    ('public.log_coach_reply()', '2fe3a0ef413037a4fc13d993c2a4f601')) t(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) <> r.md5 then
      raise exception 'NEXUS: % a bougé depuis le rejeu (md5 %, attendu %)', r.sig, md5(pg_get_functiondef(r.sig::regprocedure)), r.md5;
    end if;
  end loop;
end $$;

-- Le témoin et un recruteur collégial qui avait une ligne de journal sur lui (relus avant).
select set_config('nexus.temoin', (select (details->>'athlete_id') from public.admin_operations
                                    where operation = 'RATTACHEMENT_CEGEPIEN_TEST_LOT_A' order by le desc limit 1), true) is not null as temoin_trouve;
select set_config('nexus.collegial', (select l.recruiter_id::text from public.recruiter_activity_log l
                                        join public.users u on u.id = l.recruiter_id
                                        join public.schools s on s.id = u.school_id
                                       where l.athlete_id = current_setting('nexus.temoin')::uuid
                                         and u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'CEGEP'
                                       order by l.recruiter_id limit 1), true) is not null as collegial_trouve;
select (select count(*) from public.recruiter_activity_log where athlete_id = current_setting('nexus.temoin')::uuid) as journal_temoin_avant;

-- ── 1. La migration, texte gardé par son md5 ────────────────────────────────
create temp table _lot_a on commit drop as
select '20261026030400'::text as version, $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT A « BASE » (décisions BP 2026-10-20). TIMESTAMP PROVISOIRE.
--
-- Un « cégépien » = athlète dont l'école d'ANCRAGE (athletes.school_id) est de type CEGEP.
-- Il joue aussi en ligue civile ? Il reste un cégépien.
-- Voient les cégépiens : l'admin (is_admin()), les partenaires (rôle PARTNER), et plus tard les
-- recruteurs universitaires (école de type 'UNIVERSITE' — valeur qui n'existe pas encore : on
-- compare en ::text, on n'ajoute rien, c'est le lot D). Tous les autres recruteurs — collégiaux
-- et sans école — n'en voient AUCUN, même ceux de leur propre cégep.
-- Les MATCHS collégiaux restent visibles au recruteur ; seules les données d'athlètes
-- disparaissent (noms, fiches, nombre de profils Nexus, étoile « cible »).
-- Surfaces partenaire et coach : inchangées.
--
-- DORMANCE : au 2026-10-20, 0 athlète ancré sur un cégep et 0 école UNIVERSITE en prod →
-- chaque compte voit exactement la même chose avant et après.
--
-- Contenu :
--   1. trois fonctions-règles : athlete_est_cegepien(uuid), peut_voir_cegepiens(),
--      unite_voit_cegepiens(uuid) (la même règle lue sur une ÉCOLE, pour les deux fonctions
--      qui n'ont pas d'appelant authentifié : rapprochement_candidats et agenda_flux) ;
--   2. 15 fonctions REBASÉES SUR LE CORPS PROD (pg_get_functiondef relevé le 2026-10-20),
--      CREATE OR REPLACE, même signature, aucun DROP — garde md5 avant d'écraser ;
--   3. une policy RESTRICTIVE « cegepiens_masques_recruteurs » TO authenticated : FOR SELECT sur athletes,
--      team_athletes, athlete_badges, evaluations ; FOR ALL sur recruiter_athlete_views (les vues
--      de fiche du recruteur : « Athlètes tendance » les lit, et ouvrir l'URL d'une fiche en écrit
--      une même quand la fiche ne se charge pas). AUCUNE policy existante n'est modifiée.
--      Pourquoi pas un ALTER des quals existants : trois d'entre elles sont TO public et anon a
--      SELECT sur athletes/evaluations/team_athletes ; PostgreSQL vérifie EXECUTE à
--      l'initialisation de l'expression, même dans une branche qui ne peut pas être vraie —
--      anon aurait pris « permission denied for function athlete_est_cegepien » (sondé en local).
--      Une restrictive TO authenticated n'est jamais initialisée pour anon.
--   4. gate d'ACL en LISTE COMPLÈTE TRIÉE, relevée AVANT, attendue identique APRÈS.
--   5. (ajout GO BP 2026-10-25) recruiter_activity_log, seule table qui recopie le nom d'un
--      athlète et qu'un recruteur peut lire : même policy RESTRICTIVE, FOR SELECT (son
--      historique, le journal partagé de l'unité, la lecture par l'admin du cégep) — on
--      n'efface rien ; et filtre à l'écriture dans les trois déclencheurs qui écrivent sans
--      geste du recruteur (log_new_athlete, log_athlete_update, log_coach_reply), rebasés sur
--      le corps prod relevé le 2026-10-25 (garde md5) : plus d'entrée pour un cégépien chez un
--      recruteur qui ne voit pas les cégépiens. newsroom_events, activities et les tables
--      admin/athlète/parent : hors périmètre.
--
-- Rollback : supabase/rollback/20261020190000_rollback_cegep_lot_a_base.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes : rien d'inconnu ne sera écrasé ─────────────────────────────────
do $$
begin
  if to_regprocedure('public.athlete_est_cegepien(uuid)') is not null
     or to_regprocedure('public.peut_voir_cegepiens()') is not null
     or to_regprocedure('public.unite_voit_cegepiens(uuid)') is not null then
    raise exception 'NEXUS: 20261020190000 déjà appliquée';
  end if;
  if to_regprocedure('public.is_admin()') is null or to_regprocedure('public.is_recruiter()') is null then
    raise exception 'NEXUS: préalables absents';
  end if;
end $$;

create temp table _cegep_lot_a_releve (sig text, md5 text, acl text[]);
insert into _cegep_lot_a_releve values
  ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '1d04401fe73aed88764c0899a22d76f7', array['authenticated', 'postgres', 'service_role']),
  ('public.recruiter_athlete_profile(uuid)', '0b58d368f76a81cd0cb066404e8d77e0', array['authenticated', 'postgres', 'service_role']),
  ('public.recruiter_athlete_cards(uuid[])', '18ab33af6d239268c0d80e2f5ccc02c3', array['authenticated', 'postgres', 'service_role']),
  ('public.athletes_targeting_my_cegep()', '564a2e940ad9d187b3e0b8f4c16631e0', array['authenticated', 'postgres', 'service_role']),
  ('public.matchs_profils_nexus(uuid[])', 'b94ab615cf14a4fa104f28bce1213abf', array['authenticated', 'postgres', 'service_role']),
  ('public.depistage_profils_match(uuid)', 'ad18404a95b8ee3713d2d2acef79d7b6', array['authenticated', 'postgres', 'service_role']),
  ('public.rapprochement_candidats(uuid,uuid)', '7a71383b81597b9c6b21fe4530670623', array['postgres', 'service_role']),
  ('public.rapprochements_unite(uuid)', 'dd4be21b51d7f25cc7e2305137a73da0', array['authenticated', 'postgres', 'service_role']),
  ('public.rapprochements_refuses_unite()', 'a5d84a05834fc1fd293f7ee85c9210dd', array['authenticated', 'postgres', 'service_role']),
  ('public.fusionner_carte(uuid,uuid)', '38f4f1a78a4c6635c8f5244df033e5a1', array['authenticated', 'postgres', 'service_role']),
  ('public.athletes_nom_proche(text,text,uuid)', '492f6f32bdd04bd5099ab706a3eb55b3', array['authenticated', 'postgres', 'service_role']),
  ('public.athlete_nexus_par_courriel(text)', '6f4023f8437a354d3cc64c62a1a7540f', array['authenticated', 'postgres', 'service_role']),
  ('public.agenda_flux(text)', '6c1e9e2cb301ba8db313c72a2c68a47d', array['postgres', 'service_role']),
  ('public.matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '9674fbf129c1f0f0b93d05948e2659dd', array['authenticated', 'postgres', 'service_role']),
  ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)', 'f6c6f67a42a18711011c377bd93bb19e', array['authenticated', 'postgres', 'service_role']),
  -- Déclencheurs du journal (relevé prod 2026-10-25). ACL d'origine, PUBLIC compris : inchangée.
  ('public.log_new_athlete()',    '6fc96267a5d89574a305f3da137e2b24', array['PUBLIC', 'anon', 'authenticated', 'postgres', 'service_role']),
  ('public.log_athlete_update()', 'cda68b5c35a432d7957f4b8fca5c9b2c', array['PUBLIC', 'anon', 'authenticated', 'postgres', 'service_role']),
  ('public.log_coach_reply()',    '2fe3a0ef413037a4fc13d993c2a4f601', array['PUBLIC', 'anon', 'authenticated', 'postgres', 'service_role']);

-- Relevé AVANT : corps et ACL de chaque fonction, en liste complète triée.
create temp table _cegep_lot_a_avant as
select r.sig, md5(pg_get_functiondef(r.sig::regprocedure)) as md5_avant,
       (select array_agg(t.g order by t.g)
          from pg_proc pr,
               lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                          from unnest(pr.proacl::text[]) as x) t
         where pr.oid = r.sig::regprocedure) as acl_avant
  from _cegep_lot_a_releve r;

-- Policies existantes des quatre tables : empreinte AVANT (rien ne doit bouger).
create temp table _cegep_lot_a_polices_avant as
select tablename, policyname, cmd, permissive, roles::text as roles,
       md5(coalesce(qual, '')) as q, md5(coalesce(with_check, '')) as w
  from pg_policies
 where schemaname = 'public' and tablename in ('athletes', 'team_athletes', 'athlete_badges', 'evaluations', 'recruiter_athlete_views', 'recruiter_activity_log');

do $$
declare r record; veut text[];
begin
  for r in select l.sig, l.md5, l.acl, a.md5_avant, a.acl_avant
             from _cegep_lot_a_releve l join _cegep_lot_a_avant a using (sig) loop
    if r.md5_avant is distinct from r.md5 then
      raise exception 'NEXUS: % ne correspond pas au corps relevé en prod (md5 %, attendu %) — ne pas écraser une version inconnue',
        r.sig, r.md5_avant, r.md5;
    end if;
    select array_agg(x order by x) into veut from unnest(r.acl) x;
    if r.acl_avant is distinct from veut then
      raise exception 'NEXUS: ACL AVANT de % = %, attendu %', r.sig, r.acl_avant, veut;
    end if;
  end loop;
end $$;

-- ── 1. Les fonctions-règles ──────────────────────────────────────────────────
-- STABLE, SECURITY DEFINER, search_path épinglé, row_security off : elles servent DANS une
-- policy d'athletes ; row_security off empêche toute récursion.

-- La règle lue sur une ÉCOLE (unité de carte, recruteur d'un jeton d'agenda).
-- Aujourd'hui : aucune école 'UNIVERSITE' → toujours faux. Lot D : ajouter la valeur.
create function public.unite_voit_cegepiens(p_ecole uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.schools s
                  where s.id = p_ecole and s.type::text = 'UNIVERSITE')
$$;

create function public.athlete_est_cegepien(p_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (select 1 from public.athletes a
                   join public.schools s on s.id = a.school_id
                  where a.id = p_athlete and s.type::text = 'CEGEP')
$$;

create function public.peut_voir_cegepiens()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.is_admin()
      or exists (select 1 from public.users u
                  where u.id = auth.uid()
                    and (u.role = 'PARTNER'::public.user_role
                         or (u.role = 'RECRUTEUR'::public.user_role
                             and public.unite_voit_cegepiens(u.school_id))))
$$;

-- ACL : calque d'is_partner_eligible_athlete (aide de policy appelée par authenticated) —
-- {authenticated, postgres, service_role}, jamais anon ni PUBLIC. unite_voit_cegepiens n'est
-- appelée que depuis des fonctions SECURITY DEFINER : {postgres, service_role}.
revoke all on function public.athlete_est_cegepien(uuid) from public, anon, authenticated;
revoke all on function public.peut_voir_cegepiens()      from public, anon, authenticated;
revoke all on function public.unite_voit_cegepiens(uuid) from public, anon, authenticated;
grant execute on function public.athlete_est_cegepien(uuid) to authenticated, service_role;
grant execute on function public.peut_voir_cegepiens()      to authenticated, service_role;
grant execute on function public.unite_voit_cegepiens(uuid) to service_role;

-- ── 2. Les 15 fonctions, rebasées sur le corps prod ──

-- recruiter_search_athletes
CREATE OR REPLACE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text, cote_partenaire numeric, cote_partenaire_organisation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
  v_mots    text[];
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- RECHERCHE TEXTE — ouverte a TOUS les paliers depuis le 2026-09-17, mais la
  -- branche NOM du predicat reste Pro (et identite visible) : voir l'en-tete
  -- de la migration 20260917120000. Mots sans accent, jokers LIKE echappes.
  -- NULL si la saisie est vide.
  SELECT array_agg(replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, m),
           '\', '\\'), '%', '\%'), '_', '\_'))
    INTO v_mots
    FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS m
   WHERE m <> '';

  -- Oracle ferme pour les Free : le tri alphabetique est rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assoupli. La vitrine sort de toute facon en
  -- tete du tri par cote.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  -- Une liste a zero doit toujours pouvoir dire POURQUOI elle est a zero.
  IF p_offert_par_mon_cegep THEN
    SELECT u.school_id INTO v_school FROM public.users u WHERE u.id = auth.uid();
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'NEXUS: aucun cegep rattache a ce compte — le filtre « offert par mon cegep » est indisponible'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_programs sp WHERE sp.school_id = v_school) THEN
      RAISE EXCEPTION 'NEXUS: aucun programme au catalogue de ce cegep — le filtre « offert par mon cegep » ne peut rien rendre'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    -- « A une vidéo » : l'un des CINQ liens vidéo, non vide (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    -- Badges SANS évaluation (2026-10-03) : l'agrégat ne passait que par
    -- evaluations — un athlète badgé mais jamais évalué perdait ses badges sur
    -- la carte ET dans « Avec distinction » (1 cas en prod). Repli : une ligne
    -- qui ne porte QUE les badges, sans cote (le client n'en lit que les
    -- distinctions).
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
     (SELECT jsonb_build_array(jsonb_build_object(
               'cote_globale', NULL,
               'distinctions', jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) ORDER BY b2.ordre),
               'updated_at',   NULL))
        FROM public.athlete_badges ab JOIN public.badges b2 ON b2.id = ab.badge_id
       WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL
      HAVING count(*) > 0)),
    tm.gender,
    -- Projection : sans elle le filtre est aveugle. Le LIBELLE choisi par
    -- l'athlete, pas le nom ministeriel.
    (SELECT jsonb_agg(jsonb_build_object(
              'id', l.id, 'label', l.label, 'code', p.code, 'program_id', p.id)
              ORDER BY idx.ord)
       FROM unnest(a.programmes_vises) WITH ORDINALITY AS idx(lid, ord)
       JOIN public.cegep_program_labels l ON l.id = idx.lid
       JOIN public.cegep_programs       p ON p.id = l.program_id),
    -- LOT 3 — meme jointure qu'au-dessus, quatre colonnes de plus.
    tm.division,
    tm.league,
    (tm.rseq_team_id IS NOT NULL),
    tsc.type,
    -- W2 — l'évaluation PARTENAIRE, à part : jamais fusionnée dans cote_globale
    -- (qui reste la note du coach, lue telle quelle par les binaires mobiles).
    pe.cote_globale,
    pe.organisation
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  -- L'ecole de L'EQUIPE, pas celle de l'athlete : les deux divergent deja en
  -- prod (2 athletes au 2026-09-07). `teams.school_id` est NOT NULL, donc
  -- `team_school_type` non nul <=> l'athlete a une equipe.
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  -- W2 — la plus récente évaluation d'un partenaire APPROUVÉ. Une seule ligne
  -- (LIMIT 1) : le join ne multiplie rien.
  LEFT JOIN LATERAL (
    SELECT pev.cote_globale, mp.organization_name AS organisation
      FROM public.partner_evaluations pev
      JOIN public.media_partners mp ON mp.id = pev.partner_id AND mp.status = 'APPROVED'
     WHERE pev.athlete_id = a.id
       AND COALESCE(public.is_partner_eligible_athlete(a.id), false)  -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
     ORDER BY pev.updated_at DESC, pev.id DESC
     LIMIT 1) pe ON true
  WHERE a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20) : un cégépien n'est rendu qu'à qui peut_voir_cegepiens().
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id))
    -- D1b (2026-10-15) : une fiche sans prénom, sans nom, ou au nom recopié de Google et pas encore
    -- confirmé par l'athlète, n'apparaît pas dans la recherche.
    AND COALESCE(btrim(a.first_name), '') <> '' AND COALESCE(btrim(a.last_name), '') <> ''
    AND NOT a.nom_a_confirmer
    -- RECHERCHE PAR MOTS (2026-09-17). Lu : « aucun mot saisi n'est introuvable ».
    -- Un mot est trouve s'il figure dans :
    --   · le prenom ou le nom — PRO SEULEMENT et IDENTITE VISIBLE (oracle ferme) ;
    --   · l'ecole de l'athlete, l'ecole de son equipe, ou son equipe — tous paliers.
    AND (v_mots IS NULL OR NOT EXISTS (
          SELECT 1
            FROM unnest(v_mots) AS mot
           WHERE NOT COALESCE(
                   (    v_tier_ok
                    AND public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                    AND (   extensions.unaccent('extensions.unaccent'::regdictionary, a.first_name) ILIKE '%' || mot || '%'
                         OR extensions.unaccent('extensions.unaccent'::regdictionary, a.last_name)  ILIKE '%' || mot || '%'))
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, sc.name)  ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tsc.name) ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tm.name)  ILIKE '%' || mot || '%',
                 false)))
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL))
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    -- W2 — cote du coach si elle existe, sinon celle du partenaire (décision BP),
    -- seulement si l'appelant le demande (web). Sinon : cote du coach seule,
    -- comme avant W2 (binaires mobiles publiés).
    AND (p_min_rating IS NULL OR
         CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
              ELSE a.cote_globale_entraineur END >= p_min_rating)
    AND (NOT p_ouvert_demenager  OR a.pret_changer_region = true)
    AND (NOT p_ouvert_prive      OR a.ouvert_cegep_prive = true)
    AND (NOT p_ouvert_anglophone OR a.ouvert_cegep_anglophone = true)
    AND (NOT p_new_only OR a.created_at >= now() - INTERVAL '10 days')
    -- Comparaison au niveau du PROGRAMME, pas du libelle.
    AND (p_programme_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.cegep_program_labels l
           WHERE l.id = ANY(a.programmes_vises)
             AND l.program_id = ANY(p_programme_ids)))
    AND (NOT p_offert_par_mon_cegep OR EXISTS (
          SELECT 1
            FROM public.cegep_program_labels l
            JOIN public.school_programs spx ON spx.program_id = l.program_id
           WHERE l.id = ANY(a.programmes_vises)
             AND spx.school_id = v_school
             AND spx.is_displayed))
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;

-- recruiter_athlete_profile
CREATE OR REPLACE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, profile_completion integer, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, matieres_fortes jsonb, programme_cegep_vise jsonb, regions_cegep_preferees jsonb, ouvert_cegep_prive boolean, ouvert_cegep_anglophone boolean, pret_changer_region boolean, bio text, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, video_faits_saillants_url text, hudl_url text, youtube_url text, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_city text, school_type text, committed_school_name text, evaluations jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.genre,
    a.annee_diplomation, a.verified, a.profile_completion, a.last_profile_validation,
    a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques, a.matieres_fortes,
    a.programme_cegep_vise, a.regions_cegep_preferees,
    a.ouvert_cegep_prive, a.ouvert_cegep_anglophone, a.pret_changer_region,
    a.bio,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.city, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale',        ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'rapport_entraineur',  ev.rapport_entraineur,
              'updated_at',          ev.updated_at,
              'leadership',          ev.leadership,
              'discipline',          ev.discipline,
              'coachabilite',        ev.coachabilite,
              'intelligence_jeu',    ev.intelligence_jeu,
              'competitivite',       ev.competitivite,
              'esprit_equipe',       ev.esprit_equipe,
              'resilience',          ev.resilience,
              'attitude_mentalite',  ev.attitude_mentalite,
              'vitesse_explosivite', ev.vitesse_explosivite,
              'force_puissance',     ev.force_puissance,
              'endurance_cardio',    ev.endurance_cardio,
              'agilite_coordination',ev.agilite_coordination,
              'vision_du_jeu',       ev.vision_du_jeu,
              'sens_tactique',       ev.sens_tactique))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;

-- recruiter_athlete_cards
CREATE OR REPLACE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation,
    a.verified,
    a.last_profile_validation,
    a.cote_globale_entraineur,
    a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text,
    a.statut_recrutement_override,
    a.open_to_offers,
    -- « A une vidéo » : même définition que recruiter_search_athletes (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;

-- athletes_targeting_my_cegep
CREATE OR REPLACE FUNCTION public.athletes_targeting_my_cegep()
 RETURNS TABLE(athlete_id uuid, targeted_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_school uuid;
begin
  -- ALLOWLIST EXPLICITE (MIGRATION SAFETY CHECKLIST, règle 11).
  -- Seul un RECRUTEUR a un « mon cégep » au sens de cette fonction. Le
  -- test `role = 'RECRUTEUR'` est écrit même s'il paraît redondant : un
  -- coach porte lui aussi un `users.school_id`, celui de son école
  -- SECONDAIRE. Il ne remonterait rien aujourd'hui (les 57 écoles ciblées
  -- en prod sont toutes de type CEGEP), mais s'appuyer sur cette
  -- coïncidence de données, c'est laisser la garde dépendre d'un fait qui
  -- peut changer sans que personne ne relise cette fonction.
  select u.school_id
    into v_school
    from public.users u
   where u.id = (select auth.uid())
     and u.role = 'RECRUTEUR'::public.user_role;

  -- Recruteur sans cégep rattaché : 8 comptes sur 25 en prod au
  -- 2026-09-22. On rend ZÉRO LIGNE, on ne lève pas.
  -- `recruiter_search_athletes` lève pour `p_offert_par_mon_cegep`, mais
  -- ce n'est pas le même geste : là-bas l'utilisateur DEMANDE un filtre
  -- qui exige un cégep ; ici la fonction est appelée au chargement du
  -- tableau de bord, et lever casserait la page de ces 8 comptes.
  -- L'UI décide d'afficher ou de MASQUER le bloc en relisant
  -- `users.school_id` (via `useCurrentUser`) — jamais en interprétant un
  -- zéro, qui ne distingue pas « aucun cégep » de « aucune cible ».
  if v_school is null then
    return;
  end if;

  return query
    select t.athlete_id, t.created_at
      from public.athlete_targets t
      join public.athletes a on a.id = t.athlete_id
     where t.school_id = v_school
       -- MIROIR OBLIGATOIRE de `recruiter_athlete_cards` (l. 54 :
       -- `AND a.status = 'ACTIF'`). Sans ce filtre, le bloc du tableau de
       -- bord annoncerait « 5 athlètes te ciblent » et seules 3 cartes se
       -- résoudraient — un écart muet, du type que ce projet paie cher.
       -- Mesuré au 2026-09-22 : 46 athlètes ciblent, 44 sont ACTIF.
       and a.status = 'ACTIF'::public.account_status
       -- Lot A cégep (2026-10-20)
       and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
     order by t.created_at desc;
end;
$function$;

-- matchs_profils_nexus
CREATE OR REPLACE FUNCTION public.matchs_profils_nexus(p_games uuid[])
 RETURNS TABLE(game_id uuid, athlete_id uuid, prenom text, nom text, "position" text, promotion integer, cote text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     or not public.user_has_pro() then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_games), 0) > 500 then
    raise exception 'NEXUS: 500 matchs au plus par appel (reçu %)', cardinality(p_games) using errcode = '22023';
  end if;

  return query
  select distinct on (x.game_id, a.id)
         x.game_id, a.id, a.first_name, a.last_name,
         coalesce(nullif(btrim(p.abreviation), ''), p.nom),
         a.annee_diplomation, x.cote
    from (
      select g.id as game_id, g.home_team_id as team_id, 'DOMICILE'::text as cote
        from public.games g where g.id = any (p_games) and g.home_team_id is not null
      union all
      select g.id, g.visitor_team_id, 'VISITEUR'
        from public.games g where g.id = any (p_games) and g.visitor_team_id is not null
    ) x
    join public.team_athletes ta on ta.team_id = x.team_id
    join public.athletes a on a.id = ta.athlete_id
    left join public.positions p on p.id = a.position_id
   where a.status = 'ACTIF'
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
   order by x.game_id, a.id, x.cote;
end $function$;

-- depistage_profils_match
CREATE OR REPLACE FUNCTION public.depistage_profils_match(p_game uuid)
 RETURNS TABLE(athlete_id uuid, prenom text, nom text, cote text, source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     or not public.user_has_pro() then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;

  return query
  with cotes as (
    select g.home_team_id as team_id, 'DOMICILE'::text as cote from public.games g where g.id = p_game and g.home_team_id is not null
    union all
    select g.visitor_team_id, 'VISITEUR' from public.games g where g.id = p_game and g.visitor_team_id is not null
  ), mt as (
    select c.cote, t.id as team_id, t.school_id, t.sport_id, coalesce(t.age_group, '') as groupe
      from cotes c join public.teams t on t.id = c.team_id
  ), candidats as (
    -- 1 et 2 : inscrits de l'équipe du match, ou d'une équipe sœur (même école, sport, groupe d'âge).
    select mt.cote, ta.athlete_id, case when t2.id = mt.team_id then 'EQUIPE' else 'EQUIPE_SOEUR' end as source
      from mt
      join public.teams t2 on t2.school_id = mt.school_id and t2.sport_id = mt.sport_id
                          and (t2.id = mt.team_id or coalesce(t2.age_group, '') = mt.groupe)
      join public.team_athletes ta on ta.team_id = t2.id
    union all
    -- 3 : de l'école et du sport, sans aucune équipe.
    select mt.cote, a.id, 'ECOLE'
      from mt
      join public.athletes a on a.school_id = mt.school_id and a.sport_id = mt.sport_id
     where not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
  )
  select distinct on (x.cote, a.id) a.id, a.first_name, a.last_name, x.cote, x.source
    from candidats x
    join public.athletes a on a.id = x.athlete_id
   where a.status = 'ACTIF'
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
   order by x.cote, a.id, case x.source when 'EQUIPE' then 0 when 'EQUIPE_SOEUR' then 1 else 2 end
   limit 400;
end $function$;

-- rapprochement_candidats
CREATE OR REPLACE FUNCTION public.rapprochement_candidats(p_athlete uuid, p_carte uuid)
 RETURNS TABLE(carte_id uuid, athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid, critere text, force text, promotion_concorde boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with ath as (
    select a.id, a.first_name, a.school_id, a.sport_id, a.annee_diplomation,
           public.nom_normalise(a.last_name) as nom_n,
           nullif(lower(btrim(a.email)), '')        as courriel_fiche,
           nullif(lower(btrim(a.parent_email)), '') as courriel_parent,
           nullif(lower(btrim(u.email)), '')        as courriel_compte,
           public.telephone_normalise(a.telephone)        as tel_fiche,
           public.telephone_normalise(a.telephone_parent) as tel_parent
      from public.athletes a
      left join public.users u on u.id = a.user_id
     where a.status = 'ACTIF'::public.account_status
       and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
       and (p_athlete is null or a.id = p_athlete)
  ), car as (
    select c.id, c.unite_cegep_id, c.unite_sport_id, c.sport_athlete_id, c.team_id, c.prenom, c.promotion,
           public.nom_normalise(c.nom) as nom_n,
           nullif(lower(btrim(c.courriel)), '') as courriel,
           nullif(lower(btrim(c.parent_courriel)), '') as parent_courriel,
           c.telephone as tel,
           coalesce(t.school_id, c.school_id) as ecole
      from public.cartes_prospect c
      left join public.teams t on t.id = c.team_id
     where (p_carte is null or c.id = p_carte)
       and c.fusionnee_le is null
  ), paires as (
    select car.*, ath.id as ath_id, ath.first_name, ath.school_id as ath_ecole, ath.sport_id as ath_sport,
           ath.annee_diplomation, ath.nom_n as ath_nom, ath.courriel_fiche, ath.courriel_parent, ath.courriel_compte,
           ath.tel_fiche, ath.tel_parent
      from car join ath
        on (car.courriel is not null and car.courriel in (ath.courriel_compte, ath.courriel_fiche, ath.courriel_parent))
        or (car.parent_courriel is not null and car.parent_courriel = ath.courriel_parent)
        or (car.tel is not null and car.tel in (ath.tel_fiche, ath.tel_parent))
        or (car.nom_n <> '' and (car.nom_n = ath.nom_n or public.noms_proches(car.nom_n, ath.nom_n)))
  ), qualifiees as (
    -- Ce que chaque paire réunit ; le critère se lit ensuite, du plus fort au plus faible.
    select p.*,
      p.nom_n = p.ath_nom as nom_exact,
      public.prenoms_compatibles(p.prenom, p.first_name) as prenom_ok,
      public.prenoms_proches(p.prenom, p.first_name) as prenom_proche,
      (p.team_id is not null
       and exists (select 1 from public.team_athletes ta where ta.athlete_id = p.ath_id and ta.team_id = p.team_id)) as meme_equipe,
      (p.ecole is not null
       and (p.ath_ecole = p.ecole
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.school_id = p.ecole))
       and (p.ath_sport = p.sport_athlete_id
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.sport_id = p.sport_athlete_id))) as meme_ecole_sport
      from paires p
  ), notees as (
    select q.*,
      case
        when q.courriel is not null and q.courriel in (q.courriel_compte, q.courriel_fiche) then 'COURRIEL'
        when q.courriel is not null and q.courriel = q.courriel_parent and q.prenom_ok then 'COURRIEL_PARENT'
        -- Courriel du PARENT de la carte = courriel du parent de la fiche, prénom compatible
        -- (un parent a souvent plusieurs enfants) : même niveau que l'adresse principale.
        when q.parent_courriel is not null and q.parent_courriel = q.courriel_parent and q.prenom_ok then 'COURRIEL_PARENT_CARTE'
        when q.tel is not null and q.tel = q.tel_fiche then 'TELEPHONE'
        when q.tel is not null and q.tel = q.tel_parent and q.prenom_ok then 'TELEPHONE_PARENT'
        when q.prenom_ok and q.meme_equipe and q.nom_exact then 'EQUIPE'
        when q.prenom_ok and q.meme_equipe then 'EQUIPE_PROCHE'
        when q.prenom_ok and q.team_id is null and q.meme_ecole_sport and q.nom_exact then 'ETABLISSEMENT'
        when q.prenom_ok and q.meme_ecole_sport and q.nom_exact then 'ECOLE'
        when q.prenom_ok and q.meme_ecole_sport then 'ECOLE_PROCHE'
        -- Prénom à une lettre près : jamais plus haut que « Possible » (FAIBLE),
        -- même avec le nom exact. Jamais par le parent (garde fratrie).
        when not q.prenom_ok and q.prenom_proche and q.meme_equipe then 'EQUIPE_PROCHE'
        when not q.prenom_ok and q.prenom_proche and q.meme_ecole_sport then 'ECOLE_PROCHE'
      end as critere
      from qualifiees q
  )
  select n.id, n.ath_id, n.unite_cegep_id, n.unite_sport_id, n.critere,
         case n.critere when 'EQUIPE' then 'MOYENNE' when 'ETABLISSEMENT' then 'MOYENNE' when 'EQUIPE_PROCHE' then 'FAIBLE'
                        when 'ECOLE' then 'FAIBLE' when 'ECOLE_PROCHE' then 'FAIBLE' else 'FORTE' end,
         case when n.promotion is null or n.annee_diplomation is null then null
              else n.promotion = n.annee_diplomation end
    from notees n
   where n.critere is not null
     -- Lot A cégep (2026-10-20) : sans appelant, la règle se lit sur l'unité de la carte.
     and (public.unite_voit_cegepiens(n.unite_cegep_id) or not public.athlete_est_cegepien(n.ath_id))
     and not exists (select 1 from public.rapprochements r where r.carte_id = n.id and r.athlete_id = n.ath_id)
$function$;

-- rapprochements_unite
CREATE OR REPLACE FUNCTION public.rapprochements_unite(p_carte uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, force text, critere text, promotion_concorde boolean, cree_le timestamp with time zone, carte_id uuid, carte_prenom text, carte_nom text, carte_equipe text, carte_ecole text, carte_promotion integer, carte_position text, carte_courriel_present boolean, athlete_id uuid, athlete_prenom text, athlete_nom text, athlete_ecole text, athlete_equipes text, athlete_promotion integer, athlete_position text, athlete_photo_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select r.id, r.force, r.critere, r.promotion_concorde, r.cree_le,
         c.id, c.prenom, c.nom, t.name, ts.name, c.promotion, pc.abreviation, c.courriel is not null,
         a.id, a.first_name, a.last_name, sa.name,
         (select string_agg(tt.name, ' · ' order by tt.name) from public.team_athletes ta
            join public.teams tt on tt.id = ta.team_id where ta.athlete_id = a.id),
         a.annee_diplomation, pa.abreviation, a.photo_url
    from public.rapprochements r
    join public.cartes_prospect c on c.id = r.carte_id
    join public.athletes a on a.id = r.athlete_id
    left join public.teams t on t.id = c.team_id
    left join public.schools ts on ts.id = coalesce(t.school_id, c.school_id)
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
   where r.statut = 'PROPOSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and (p_carte is null or r.carte_id = p_carte)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'COURRIEL_PARENT_CARTE' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'ETABLISSEMENT' then 5
                           when 'EQUIPE_PROCHE' then 6 when 'ECOLE' then 7 else 8 end, r.cree_le
$function$;

-- rapprochements_refuses_unite
CREATE OR REPLACE FUNCTION public.rapprochements_refuses_unite()
 RETURNS TABLE(id uuid, force text, critere text, promotion_concorde boolean, cree_le timestamp with time zone, carte_id uuid, carte_prenom text, carte_nom text, carte_equipe text, carte_ecole text, carte_promotion integer, carte_position text, carte_courriel_present boolean, athlete_id uuid, athlete_prenom text, athlete_nom text, athlete_ecole text, athlete_equipes text, athlete_promotion integer, athlete_position text, athlete_photo_url text, decide_le timestamp with time zone, decide_par_nom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select r.id, r.force, r.critere, r.promotion_concorde, r.cree_le,
         c.id, c.prenom, c.nom, t.name, ts.name, c.promotion, pc.abreviation, c.courriel is not null,
         a.id, a.first_name, a.last_name, sa.name,
         (select string_agg(tt.name, ' · ' order by tt.name) from public.team_athletes ta
            join public.teams tt on tt.id = ta.team_id where ta.athlete_id = a.id),
         a.annee_diplomation, pa.abreviation, a.photo_url,
         r.decide_le, nullif(trim(concat_ws(' ', u.first_name, u.last_name)), '')
    from public.rapprochements r
    join public.cartes_prospect c on c.id = r.carte_id
    join public.athletes a on a.id = r.athlete_id
    left join public.teams t on t.id = c.team_id
    left join public.schools ts on ts.id = coalesce(t.school_id, c.school_id)
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
    left join public.users u on u.id = r.decide_par
   where r.statut = 'REFUSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
   order by r.decide_le desc nulls last
   limit 200
$function$;

-- fusionner_carte
CREATE OR REPLACE FUNCTION public.fusionner_carte(p_carte uuid, p_athlete uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_moi uuid := auth.uid();
  c record; a record; r record; t record; n record;
  v_existait boolean;
  v_ligne_moi uuid; v_ligne_creee boolean := false;
  v_etape text; v_moved timestamptz; v_relance date; v_relance_note text; v_visite timestamptz; v_drapeau boolean;
  v_grade_avant text; v_grade_ecrit text; v_grade_ligne uuid;
  v_notes jsonb := '[]'::jsonb; v_membres uuid[] := '{}'; v_caduques uuid[] := '{}';
  v_logs_avant uuid[]; v_note_id uuid; v_auteur_ok boolean; v_auteur_nom text;
  v_fusion uuid := gen_random_uuid();
begin
  if v_moi is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;

  select * into c from public.cartes_prospect where id = p_carte for update;
  if not found or c.fusionnee_le is not null
     or not public.acces_carte_ecriture(c.unite_cegep_id, c.unite_sport_id) then
    raise exception 'NEXUS: carte introuvable' using errcode = '42501';
  end if;
  select * into a from public.athletes where id = p_athlete;
  if not found or a.status <> 'ACTIF'::public.account_status
     or not public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20) : même réponse qu'un profil absent (pas d'oracle).
     or not ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id)) then
    raise exception 'NEXUS: profil introuvable' using errcode = '42501';
  end if;
  select * into r from public.rapprochements where carte_id = p_carte and athlete_id = p_athlete for update;
  if not found or r.statut <> 'PROPOSEE' then
    raise exception 'NEXUS: aucune proposition ouverte pour cette paire' using errcode = '22023';
  end if;

  -- Les lignes de journal déjà là pour cet athlète dans cette transaction ne
  -- sont pas les nôtres : on ne remplacera que celles que la fusion écrit.
  select coalesce(array_agg(id), '{}') into v_logs_avant from public.recruiter_activity_log
   where athlete_id = p_athlete and created_at = now();

  -- ── Dossier : la tête de l'unité, puis les valeurs réunies ──
  select * into t from public.recruiter_pipeline p
   where p.unite_cegep_id = c.unite_cegep_id and p.unite_sport_id = c.unite_sport_id and p.athlete_id = p_athlete
   order by public.rang_etape(p.stage) desc, p.moved_at desc nulls last limit 1;
  v_existait := found;

  if v_existait and public.rang_etape(t.stage) >= public.rang_etape(c.etape) then
    v_etape := t.stage; v_moved := t.moved_at;
  else
    v_etape := c.etape; v_moved := c.etape_le;
  end if;
  if v_existait and (t.next_action_at is not null or t.next_action_note is not null) then
    v_relance := t.next_action_at; v_relance_note := t.next_action_note;
  else
    v_relance := c.relance_le; v_relance_note := c.relance_note;
  end if;
  v_visite  := case when v_existait then coalesce(t.visit_at, c.visite_le) else c.visite_le end;
  v_drapeau := coalesce(case when v_existait then t.flagged end, false) or c.drapeau;

  select id into v_ligne_moi from public.recruiter_pipeline where recruiter_id = v_moi and athlete_id = p_athlete;
  if found then
    update public.recruiter_pipeline
       set stage = v_etape, moved_at = v_moved, next_action_at = v_relance, next_action_note = v_relance_note,
           visit_at = v_visite, flagged = v_drapeau, updated_at = now()
     where id = v_ligne_moi;
  else
    insert into public.recruiter_pipeline (recruiter_id, athlete_id, stage, moved_at, next_action_at, next_action_note, visit_at, flagged)
    values (v_moi, p_athlete, v_etape, v_moved, v_relance, v_relance_note, v_visite, v_drapeau)
    returning id into v_ligne_moi;
    v_ligne_creee := true;
  end if;

  -- ── Cote : celle de l'unité gagne ──
  select g.grade into v_grade_avant from public.recruiter_athlete_grades g
   where g.unite_cegep_id = c.unite_cegep_id and g.unite_sport_id = c.unite_sport_id
     and g.athlete_id = p_athlete and g.grade is not null
   order by g.updated_at desc limit 1;
  if v_grade_avant is null and c.grade is not null then
    insert into public.recruiter_athlete_grades (recruiter_id, athlete_id, grade)
    values (v_moi, p_athlete, c.grade)
    on conflict (recruiter_id, athlete_id) do update set grade = excluded.grade
    returning id into v_grade_ligne;
    v_grade_ecrit := c.grade;
  end if;

  -- ── Notes : signées, datées ──
  for n in select * from public.cartes_prospect_notes where carte_id = p_carte order by created_at loop
    select exists (select 1 from public.users u
                    where u.id = n.auteur and u.role = 'RECRUTEUR'::public.user_role
                      and u.school_id = c.unite_cegep_id and u.sport_id = c.unite_sport_id)
      into v_auteur_ok;
    if not v_auteur_ok then
      select nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')
        into v_auteur_nom from public.users u where u.id = n.auteur;
    end if;
    insert into public.recruiter_notes (recruiter_id, athlete_id, content, created_at, updated_at)
    values (case when v_auteur_ok then n.auteur else v_moi end, p_athlete,
            case when v_auteur_ok then n.contenu
                 else '[Note de la carte prospect' || coalesce(', de ' || v_auteur_nom, '') || '] ' || n.contenu end,
            n.created_at, n.updated_at)
    returning id into v_note_id;
    v_notes := v_notes || jsonb_build_object('id', v_note_id,
      'content', case when v_auteur_ok then n.contenu
                      else '[Note de la carte prospect' || coalesce(', de ' || v_auteur_nom, '') || '] ' || n.contenu end);
  end loop;

  -- ── Listes suivies ──
  with ajout as (
    insert into public.recruiter_list_members (list_id, athlete_id)
    select cl.list_id, p_athlete from public.cartes_prospect_listes cl where cl.carte_id = p_carte
    on conflict (list_id, athlete_id) do nothing
    returning id
  ) select coalesce(array_agg(id), '{}') into v_membres from ajout;

  -- ── Propositions ──
  update public.rapprochements set statut = 'ACCEPTEE', decide_par = v_moi, decide_le = now() where id = r.id;
  with cad as (
    update public.rapprochements set statut = 'CADUQUE', decide_par = v_moi, decide_le = now()
     where carte_id = p_carte and id <> r.id and statut = 'PROPOSEE'
    returning id
  ) select coalesce(array_agg(id), '{}') into v_caduques from cad;
  update public.notifications_unite set traitee_le = now()
   where type = 'RAPPROCHEMENT' and traitee_le is null and objet_id = any (v_caduques || r.id);

  -- ── Une ligne de journal ──
  delete from public.recruiter_activity_log
   where athlete_id = p_athlete and created_at = now() and id <> all (v_logs_avant);
  insert into public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details, unite_cegep_id, unite_sport_id)
  values (v_moi, p_athlete, 'PIPELINE_CHANGED',
          jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name,
                             'new_stage', v_etape,
                             'before_stage', case when v_existait and t.stage is distinct from v_etape then t.stage end,
                             'unite', true,
                             'fusion', jsonb_build_object('id', v_fusion, 'carte', c.prenom || ' ' || c.nom)),
          c.unite_cegep_id, c.unite_sport_id);

  -- ── La carte disparaît ──
  perform set_config('nexus.fusion_carte', 'on', true);
  update public.cartes_prospect set fusionnee_le = now(), fusionnee_avec = p_athlete where id = p_carte;
  perform set_config('nexus.fusion_carte', 'off', true);

  insert into public.fusions_cartes (id, rapprochement_id, carte_id, carte_libelle, athlete_id,
                                     unite_cegep_id, unite_sport_id, acteur, snapshot)
  values (v_fusion, r.id, p_carte, c.prenom || ' ' || c.nom, p_athlete, c.unite_cegep_id, c.unite_sport_id, v_moi,
          jsonb_build_object(
            'dossier', jsonb_build_object(
              'existait', v_existait,
              'ligne_moi', v_ligne_moi, 'ligne_creee', v_ligne_creee,
              'avant', case when v_existait then jsonb_build_object(
                         'stage', t.stage, 'moved_at', t.moved_at, 'flagged', t.flagged,
                         'next_action_at', t.next_action_at, 'next_action_note', t.next_action_note,
                         'visit_at', t.visit_at) end,
              'ecrit', jsonb_build_object(
                         'stage', v_etape, 'flagged', v_drapeau, 'next_action_at', v_relance,
                         'next_action_note', v_relance_note, 'visit_at', v_visite)),
            'grade', jsonb_build_object('ecrit', v_grade_ecrit, 'ligne', v_grade_ligne),
            'notes', v_notes,
            'membres', to_jsonb(v_membres),
            'caduques', to_jsonb(v_caduques)));
  return v_fusion;
end $function$;

-- athletes_nom_proche
CREATE OR REPLACE FUNCTION public.athletes_nom_proche(p_prenom text, p_nom text, p_ecole uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select a.id, a.first_name, a.last_name
    from public.athletes a
   where exists (select 1 from public.users u
                  where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     and public.user_has_pro()
     and p_ecole is not null
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
     and public.noms_proches(public.nom_normalise(p_nom), public.nom_normalise(a.last_name))
     and public.prenoms_compatibles(p_prenom, a.first_name)
     and (a.school_id = p_ecole
          or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                      where ta.athlete_id = a.id and t.school_id = p_ecole))
   order by extensions.similarity(public.nom_normalise(p_nom), public.nom_normalise(a.last_name)) desc
   limit 5
$function$;

-- athlete_nexus_par_courriel
CREATE OR REPLACE FUNCTION public.athlete_nexus_par_courriel(p_courriel text)
 RETURNS TABLE(id uuid, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.first_name, a.last_name
    from public.athletes a
   where p_courriel is not null
     and lower(btrim(a.email)) = lower(btrim(p_courriel))
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     -- Lot A cégep (2026-10-20)
     and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
     and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     and public.user_has_pro()
   limit 1
$function$;

-- agenda_flux
CREATE OR REPLACE FUNCTION public.agenda_flux(p_jeton text)
 RETURNS TABLE(type text, cible text, cible_id uuid, nom text, jour date, instant timestamp with time zone, note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_j public.agenda_jetons%rowtype;
  v_u public.users%rowtype;
  v_depuis date := current_date - 60;
begin
  select * into v_j from public.agenda_jetons where jeton_hash = public.agenda_hacher(p_jeton);
  if v_j.user_id is null then return; end if;
  select * into v_u from public.users where id = v_j.user_id;
  -- Flux VIDE : plus recruteur, plus Pro, ou unité changée depuis le jeton.
  if v_u.id is null or v_u.role <> 'RECRUTEUR'::public.user_role
     or not public.agenda_est_pro(v_u.id)
     or v_u.school_id is distinct from v_j.unite_cegep_id
     or v_u.sport_id  is distinct from v_j.unite_sport_id then
    return;
  end if;

  return query
  with cible as (
    select p.*
      from public.recruiter_pipeline p
     where (p.unite_cegep_id = v_j.unite_cegep_id and p.unite_sport_id = v_j.unite_sport_id)
        or (p.unite_cegep_id is null and p.recruiter_id = v_u.id)
  ),
  -- Même ligne retenue que unite_pipeline() : l'étape la plus avancée.
  meilleure as (
    select distinct on (c.athlete_id, c.unite_cegep_id, c.unite_sport_id) c.*
      from cible c
     order by c.athlete_id, c.unite_cegep_id, c.unite_sport_id,
              public.rang_etape(c.stage::text) desc, c.moved_at desc nulls last
  ),
  athl as (
    select m.*,
           case when public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                then nullif(trim(concat_ws(' ', a.first_name, a.last_name)), '')
           end as nom_visible
      from meilleure m
      join public.athletes a on a.id = m.athlete_id and a.status = 'ACTIF'::public.account_status
       -- Lot A cégep (2026-10-20) : appel par jeton, sans auth.uid() — la règle se lit sur le recruteur du jeton.
       and (public.unite_voit_cegepiens(v_u.school_id) or not public.athlete_est_cegepien(a.id))
  )
  select 'RELANCE', 'athlete', x.athlete_id, coalesce(x.nom_visible, 'Identité réservée'),
         x.next_action_at, null::timestamptz, nullif(trim(coalesce(x.next_action_note, '')), '')
    from athl x
   where x.next_action_at is not null and x.next_action_at >= v_depuis
  union all
  select 'VISITE', 'athlete', x.athlete_id, coalesce(x.nom_visible, 'Identité réservée'),
         null::date, x.visit_at, null
    from athl x
   where x.visit_at is not null and x.visit_at >= v_depuis
  union all
  select 'RELANCE', 'carte', c.id, nullif(trim(concat_ws(' ', c.prenom, c.nom)), ''),
         c.relance_le, null::timestamptz, nullif(trim(coalesce(c.relance_note, '')), '')
    from public.cartes_prospect c
   where c.unite_cegep_id = v_j.unite_cegep_id and c.unite_sport_id = v_j.unite_sport_id
     and c.fusionnee_le is null and c.relance_le is not null and c.relance_le >= v_depuis
  union all
  select 'VISITE', 'carte', c.id, nullif(trim(concat_ws(' ', c.prenom, c.nom)), ''),
         null::date, c.visite_le, null
    from public.cartes_prospect c
   where c.unite_cegep_id = v_j.unite_cegep_id and c.unite_sport_id = v_j.unite_sport_id
     and c.fusionnee_le is null and c.visite_le is not null and c.visite_le >= v_depuis;
end $function$;

-- matchs_recherche
CREATE OR REPLACE FUNCTION public.matchs_recherche(p_debut date, p_fin date, p_sport text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_texte text DEFAULT NULL::text, p_equipes uuid[] DEFAULT NULL::uuid[], p_lieux text[] DEFAULT NULL::text[], p_mes_matchs boolean DEFAULT false)
 RETURNS TABLE(id uuid, jour date, heure text, domicile text, visiteur text, terrain text, sport text, categorie text, division text, zone text, ligue text, type text, lat double precision, lon double precision, nb_profils integer, cible boolean, ajoute boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
#variable_conflict use_column
declare
  v_mots text[];
  -- Au moins une pastille Équipe / Terrain (BP 2026-10-09) : la saison à venir entière.
  v_pastilles boolean := coalesce(cardinality(p_equipes), 0) + coalesce(cardinality(p_lieux), 0) > 0;
  -- PARTENAIRE (BP 2026-10-09) : rôle PARTNER et fiche APPROVED. Même moteur ; la branche
  -- partenaire ne touche ni l'unité, ni les suivis, ni les cartes prospect.
  v_partenaire boolean := public.partenaire_admis();
  -- « Mes matchs » : seulement les matchs ajoutés (au partenaire, ou à l'unité du
  -- recruteur), sur la saison à venir, comme une pastille.
  v_saison boolean := v_pastilles or coalesce(p_mes_matchs, false);
begin
  if not v_partenaire
     and (auth.uid() is null
          or not exists (select 1 from public.users u
                          where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
          or not public.user_has_pro()) then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then
    raise exception 'NEXUS: plage de dates invalide' using errcode = '22023';
  end if;
  -- 31 jours au plus (BP 2026-10-09) : 360 ms côté base sur la période à venir la plus chargée
  -- (2026-10-09 → 11-08, 3 804 matchs, ~418 terrains), mesure prod du 2026-10-09.
  if not v_saison and p_fin - p_debut > 30 then
    raise exception 'NEXUS: 31 jours au plus (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
  end if;
  -- Avec pastilles : une saison, pas davantage (borne de sûreté).
  if v_saison and p_fin - p_debut > 400 then
    raise exception 'NEXUS: 401 jours au plus avec une équipe ou un terrain (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
  end if;

  v_mots := array_remove(string_to_array(coalesce(public.lieu_normalise(p_texte), ''), ' '), '');

  return query
  with moi as (
    select u.id as uid, u.school_id, u.sport_id from public.users u where u.id = auth.uid()
  ),
  ath_suivis as (
    -- 2026-10-18 : un athlète RETIRÉ par l'unité n'est plus suivi (repère « cible »).
    select s.athlete_id from (
      select p.athlete_id from public.recruiter_pipeline p, moi
       where (p.unite_cegep_id = moi.school_id and p.unite_sport_id = moi.sport_id)
          or (p.unite_cegep_id is null and p.recruiter_id = moi.uid)
      union
      select f.athlete_id from public.recruiter_favorites f, moi
       where (f.unite_cegep_id = moi.school_id and f.unite_sport_id = moi.sport_id)
          or (f.unite_cegep_id is null and f.recruiter_id = moi.uid)
      union
      select lm.athlete_id from public.recruiter_list_members lm
        join public.recruiter_lists l on l.id = lm.list_id, moi
       where l.recruiter_id = moi.uid
          or (l.unite_cegep_id = moi.school_id and l.unite_sport_id = moi.sport_id)
    ) s
     where not exists (select 1 from public.recruiter_pipeline r, moi m2
                        where r.athlete_id = s.athlete_id and r.stage = 'RETIRE'
                          and ((r.unite_cegep_id = m2.school_id and r.unite_sport_id = m2.sport_id)
                               or (r.unite_cegep_id is null and r.recruiter_id = m2.uid)))
  ),
  equipes_suivies as (
    select ta.team_id from public.team_athletes ta
      join ath_suivis s on s.athlete_id = ta.athlete_id
      join public.athletes a on a.id = ta.athlete_id and a.status = 'ACTIF'::public.account_status
       -- Lot A cégep (2026-10-20) : un cégépien suivi n'allume pas l'étoile « cible ».
       and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))
    union
    select cp.team_id from public.cartes_prospect cp, moi
     where cp.team_id is not null and cp.fusionnee_le is null
       and cp.unite_cegep_id = moi.school_id and cp.unite_sport_id = moi.sport_id
       and cp.etape <> 'RETIRE'
  ),
  g as (
    select gm.*,
           case
             when gm.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                  or (gm.sector is null and gm.source_nom is distinct from 'RSEQ') then 'CIVIL'
             when public.lieu_normalise(gm.sector) = 'collegial' then 'COLLEGIAL'
             when public.lieu_normalise(gm.sector) = 'secondaire' then 'SECONDAIRE'
           end as le_type
      from public.games gm
     where gm.game_date between p_debut and p_fin
       -- ALIAS (BP 2026-10-09) : le RSEQ publie « Ultimate » (secondaire) et « Ultimate frisbee »
       -- (collégial 2026-2027) pour le même sport ; même repli que rseq_family_key().
       -- LES FILTRES S'APPLIQUENT PARTOUT (BP 2026-10-09, retour sur « la pastille gagne ») :
       -- Sport et Type filtrent aussi les matchs d'une pastille (Catégorie et Division sont
       -- filtrées côté page, de même). Seul le texte libre est ignoré avec une pastille : il sert
       -- alors à chercher la pastille suivante.
       and (public.lieu_normalise(p_sport) is null
            or (case when public.lieu_normalise(gm.sport) like 'ultimate%' then 'ultimate'
                     else public.lieu_normalise(gm.sport) end)
             = (case when public.lieu_normalise(p_sport) like 'ultimate%' then 'ultimate'
                     else public.lieu_normalise(p_sport) end))
       -- PASTILLES (BP 2026-10-09) : un match passe s'il touche AU MOINS UNE pastille —
       -- une équipe choisie, à domicile ou au visiteur, ou un terrain choisi. Sans pastille,
       -- le prédicat est vrai : résultats identiques à 20261009171716.
       and (not v_pastilles
            or gm.home_team_id = any (coalesce(p_equipes, '{}'))
            or gm.visitor_team_id = any (coalesce(p_equipes, '{}'))
            or (coalesce(cardinality(p_lieux), 0) > 0 and public.lieu_normalise(gm.venue) = any (p_lieux)))
       -- MES MATCHS : ceux du partenaire, ou ceux de l'unité du recruteur.
       and (not coalesce(p_mes_matchs, false)
            or (v_partenaire and exists (select 1 from public.matchs_ajoutes_partenaire mp
                                          where mp.game_id = gm.id and mp.partenaire_id = auth.uid()))
            or (not v_partenaire and exists (select 1 from public.matchs_ajoutes ma, public.users u
                                              where u.id = auth.uid() and ma.game_id = gm.id
                                                and ma.unite_cegep_id = u.school_id and ma.unite_sport_id = u.sport_id)))
  ),
  n as (
    select g.*,
           coalesce(case when g.source_nom = 'NLS' then nullif(btrim(g.home_name_raw), '') end,
                    nullif(btrim(th.name), ''), nullif(btrim(g.home_name_raw), ''), 'Équipe à confirmer') as nom_dom,
           coalesce(case when g.source_nom = 'NLS' then nullif(btrim(g.visitor_name_raw), '') end,
                    nullif(btrim(tv.name), ''), nullif(btrim(g.visitor_name_raw), ''), 'Équipe à confirmer') as nom_vis
      from g
      left join public.teams th on th.id = g.home_team_id
      left join public.teams tv on tv.id = g.visitor_team_id
     where p_types is null or g.le_type = any (p_types)
  ),
  f as (
    select n.* from n
     where v_pastilles or cardinality(v_mots) = 0
        or (select bool_and(strpos(coalesce(public.lieu_normalise(n.nom_dom || ' ' || n.nom_vis || ' ' || coalesce(n.venue, '')), ''), m) > 0)
              from unnest(v_mots) m)
  )
  select f.id,
         f.game_date,
         nullif(btrim(f.game_time), ''),
         f.nom_dom,
         f.nom_vis,
         nullif(btrim(f.venue), ''),
         f.sport,
         f.category,
         f.division,
         f.zone,
         f.league_name,
         f.le_type,
         case when ok.gps then f.venue_lat::double precision else lg.lat end,
         case when ok.gps then f.venue_lon::double precision else lg.lon end,
         (select count(distinct ta.athlete_id)::int
            from public.team_athletes ta
            join public.athletes a on a.id = ta.athlete_id
           where ta.team_id in (f.home_team_id, f.visitor_team_id)
             and a.status = 'ACTIF'::public.account_status
             -- Recruteur : identité visible seulement (inchangé). Partenaire : TOUS les
             -- actifs, nommés ou non (BP) ; les noms passent par matchs_profils_partenaire.
             and (v_partenaire or public.athlete_identity_ok(a.date_naissance, a.consentement_parental))
             -- Lot A cégep (2026-10-20) : les cégépiens ne comptent pas dans « profils Nexus » ; le match reste.
             and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))),
         -- L'étoile « joueur suivi » n'existe pas pour un partenaire.
         (not v_partenaire) and coalesce(f.home_team_id in (select team_id from equipes_suivies)
                  or f.visitor_team_id in (select team_id from equipes_suivies), false),
         case when v_partenaire
              then exists (select 1 from public.matchs_ajoutes_partenaire mp
                            where mp.game_id = f.id and mp.partenaire_id = auth.uid())
              else exists (select 1 from public.matchs_ajoutes ma, moi
                            where ma.game_id = f.id
                              and ma.unite_cegep_id = moi.school_id and ma.unite_sport_id = moi.sport_id)
         end
    from f
    cross join lateral (
      select (f.venue_lat is not null and f.venue_lon is not null
              and f.venue_lat <> 0 and f.venue_lon <> 0
              and f.venue_lat between 44 and 63 and f.venue_lon between -80 and -57) as gps
    ) ok
    left join public.lieux_geocodes lg
      on not ok.gps and lg.nom_normalise = public.lieu_normalise(f.venue)
   order by f.game_date,
            (substring(f.game_time from '^\s*(\d{1,2})[:h]'))::int nulls last,
            (substring(f.game_time from '^\s*\d{1,2}[:h](\d{2})'))::int nulls last,
            f.nom_dom;
end $function$;

-- match_notes_lier
CREATE OR REPLACE FUNCTION public.match_notes_lier(p_seance uuid, p_cote text, p_numero text, p_prenom text, p_athlete_id uuid, p_carte_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_n integer;
begin
  if not public.match_seance_acces(p_seance) then raise exception 'NEXUS: séance hors de ton unité'; end if;
  if num_nonnulls(p_athlete_id, p_carte_id) > 1 then raise exception 'NEXUS: un athlète OU une carte'; end if;
  if p_carte_id is not null and not public.carte_ecriture_ok(p_carte_id) then
    raise exception 'NEXUS: carte hors de ton unité';
  end if;
  if p_athlete_id is not null and not exists (
       select 1 from public.athletes a where a.id = p_athlete_id and a.status = 'ACTIF'::public.account_status
          -- Lot A cégep (2026-10-20)
          and ((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))) then
    raise exception 'NEXUS: athlète introuvable';
  end if;

  update public.match_notes n
     set athlete_id = p_athlete_id, carte_id = p_carte_id, lie_par = auth.uid(), lie_le = now()
   where n.seance_id = p_seance and n.cote = p_cote
     and (case when nullif(trim(coalesce(p_numero, '')), '') is not null
               then n.numero = trim(p_numero)
               else n.numero is null and lower(trim(n.prenom)) = lower(trim(coalesce(p_prenom, ''))) end);
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

-- ── 2 bis. Déclencheurs du journal recruteur : filtre à l'écriture ──────────────
-- Corps prod du 2026-10-25, seul ajout : le filtre. Le destinataire est jugé comme la policy
-- juge le lecteur : un RECRUTEUR dont l'école ne voit pas les cégépiens (collégial, sans école)
-- ne reçoit plus d'entrée pour un cégépien. Les autres destinataires : inchangés.

-- log_new_athlete
CREATE OR REPLACE FUNCTION public.log_new_athlete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cegepien boolean := public.athlete_est_cegepien(NEW.id);
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT DISTINCT rf.recruiter_id, NEW.id, 'NEW_ATHLETE',
    jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name)
  FROM recruiter_favorites rf
  WHERE NOT v_cegepien
     OR NOT EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = rf.recruiter_id
                       AND u.role = 'RECRUTEUR'::public.user_role
                       AND NOT public.unite_voit_cegepiens(u.school_id));
  RETURN NEW;
END;
$function$;

-- log_athlete_update
CREATE OR REPLACE FUNCTION public.log_athlete_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cegepien boolean;
BEGIN
  IF OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url OR OLD.verified IS DISTINCT FROM NEW.verified OR OLD.cote_globale_entraineur IS DISTINCT FROM NEW.cote_globale_entraineur THEN
    v_cegepien := public.athlete_est_cegepien(NEW.id);
    INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
    SELECT rf.recruiter_id, NEW.id,
      CASE WHEN OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url AND NEW.video_faits_saillants_url IS NOT NULL THEN 'VIDEO_ADDED'
           WHEN OLD.verified IS DISTINCT FROM NEW.verified AND NEW.verified = true THEN 'ATHLETE_VERIFIED'
           ELSE 'PROFILE_UPDATED' END,
      jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name)
    FROM recruiter_favorites rf
    WHERE rf.athlete_id = NEW.id
      AND (NOT v_cegepien
           OR NOT EXISTS (SELECT 1 FROM public.users u
                           WHERE u.id = rf.recruiter_id
                             AND u.role = 'RECRUTEUR'::public.user_role
                             AND NOT public.unite_voit_cegepiens(u.school_id)));
  END IF;
  RETURN NEW;
END;
$function$;

-- log_coach_reply
CREATE OR REPLACE FUNCTION public.log_coach_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT c.recruiter_id, c.athlete_id, 'COACH_REPLY',
    jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'conversation_id', c.id)
  FROM public.conversations c
  LEFT JOIN public.users u ON u.id = NEW.sender_id
  WHERE c.id = NEW.conversation_id
    AND c.conversation_type = 'RECRUTEUR_COACH'
    AND NEW.sender_id = c.coach_id
    AND NEW.sender_id <> c.recruiter_id
    AND (c.athlete_id IS NULL
         OR NOT public.athlete_est_cegepien(c.athlete_id)
         OR NOT EXISTS (SELECT 1 FROM public.users r
                         WHERE r.id = c.recruiter_id
                           AND r.role = 'RECRUTEUR'::public.user_role
                           AND NOT public.unite_voit_cegepiens(r.school_id)));
  RETURN NEW;
END;
$function$;

-- ── 3. Lecture directe : une policy RESTRICTIVE par table ─────────────────────
-- Ne touche que les recruteurs COLLÉGIAUX et sans école (peut_voir_cegepiens() faux). Le
-- recruteur UNIVERSITAIRE passe par peut_voir_cegepiens() (lot D). Coach, athlète, parent,
-- partenaire, admin : not is_recruiter() → inchangés.

create policy "cegepiens_masques_recruteurs" on public.athletes
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(id)
  );

create policy "cegepiens_masques_recruteurs" on public.team_athletes
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  );

create policy "cegepiens_masques_recruteurs" on public.athlete_badges
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  );

create policy "cegepiens_masques_recruteurs" on public.evaluations
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  );

create policy "cegepiens_masques_recruteurs" on public.recruiter_athlete_views
  as restrictive
  for all
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  )
  with check (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  );

-- Le journal : les lignes d'un cégépien deviennent illisibles au recruteur collégial (son
-- historique, l'unité, l'admin du cégep). Rien n'est effacé ; lignes sans athlète : inchangées.
create policy "cegepiens_masques_recruteurs" on public.recruiter_activity_log
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_recruiter())
    or (select public.peut_voir_cegepiens())
    or not public.athlete_est_cegepien(athlete_id)
  );

-- ── 4. Gates ──────────────────────────────────────────────────────────────────
do $$
declare r record; vus text[]; veut text[]; f text; n int;
begin
  -- ACL des fonctions réécrites : identique, liste complète triée.
  for r in select sig, acl_avant from _cegep_lot_a_avant loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl_avant then
      raise exception 'NEXUS: ACL APRÈS de % = %, attendu % (relevé avant)', r.sig, vus, r.acl_avant;
    end if;
  end loop;

  -- ACL des fonctions-règles : liste complète triée.
  foreach f in array array['public.athlete_est_cegepien(uuid)', 'public.peut_voir_cegepiens()'] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f::regprocedure;
    select array_agg(x order by x) into veut from unnest(array['authenticated', 'postgres', 'service_role']) x;
    if vus is distinct from veut then raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut; end if;
  end loop;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.unite_voit_cegepiens(uuid)'::regprocedure;
  select array_agg(x order by x) into veut from unnest(array['postgres', 'service_role']) x;
  if vus is distinct from veut then raise exception 'NEXUS: ACL de unite_voit_cegepiens = %, attendu %', vus, veut; end if;

  -- Réglages des fonctions-règles.
  select count(*) into n from pg_proc pr
   where pr.oid in ('public.athlete_est_cegepien(uuid)'::regprocedure, 'public.peut_voir_cegepiens()'::regprocedure,
                    'public.unite_voit_cegepiens(uuid)'::regprocedure)
     and pr.prosecdef and pr.provolatile = 's'
     and pr.proconfig @> array['search_path=public', 'row_security=off'];
  if n <> 3 then raise exception 'NEXUS: fonctions-règles mal réglées (% sur 3)', n; end if;

  -- Policies existantes : aucune n'a bougé.
  select count(*) into n
    from _cegep_lot_a_polices_avant a
    left join pg_policies p on p.schemaname = 'public' and p.tablename = a.tablename and p.policyname = a.policyname
   where p.policyname is null or p.cmd <> a.cmd or p.permissive <> a.permissive or p.roles::text <> a.roles
      or md5(coalesce(p.qual, '')) <> a.q or md5(coalesce(p.with_check, '')) <> a.w;
  if n <> 0 then raise exception 'NEXUS: % policy(ies) existante(s) modifiée(s)', n; end if;

  -- Exactement une policy de plus par table, restrictive, authenticated ; SELECT sur les quatre
  -- tables de l'athlète et sur le journal, ALL sur recruiter_athlete_views.
  select count(*) into n from pg_policies
   where schemaname = 'public' and policyname = 'cegepiens_masques_recruteurs'
     and tablename in ('athletes', 'team_athletes', 'athlete_badges', 'evaluations', 'recruiter_athlete_views', 'recruiter_activity_log')
     and permissive = 'RESTRICTIVE' and roles::text = '{authenticated}'
     and cmd = case when tablename = 'recruiter_athlete_views' then 'ALL' else 'SELECT' end;
  if n <> 6 then raise exception 'NEXUS: % policy(ies) restrictive(s) sur 6', n; end if;
  select count(*) into n from pg_policies p
   where p.schemaname = 'public' and p.tablename in ('athletes', 'team_athletes', 'athlete_badges', 'evaluations', 'recruiter_athlete_views', 'recruiter_activity_log')
     and not exists (select 1 from _cegep_lot_a_polices_avant a where a.tablename = p.tablename and a.policyname = p.policyname);
  if n <> 6 then raise exception 'NEXUS: % policy(ies) nouvelle(s), attendu 6', n; end if;

  -- Déclencheurs du journal : toujours SECURITY DEFINER, search_path inchangé, toujours branchés.
  select count(*) into n from pg_proc pr
   where pr.oid in ('public.log_new_athlete()'::regprocedure, 'public.log_athlete_update()'::regprocedure,
                    'public.log_coach_reply()'::regprocedure)
     and pr.prosecdef and pr.proconfig = array['search_path=public'];
  if n <> 3 then raise exception 'NEXUS: déclencheurs du journal mal réglés (% sur 3)', n; end if;
  select count(*) into n from pg_trigger t
   where not t.tgisinternal and t.tgenabled = 'O'
     and (t.tgname, t.tgrelid, t.tgfoid) in (
       ('trg_log_new_athlete',    'public.athletes'::regclass, 'public.log_new_athlete()'::regprocedure),
       ('trg_log_athlete_update', 'public.athletes'::regclass, 'public.log_athlete_update()'::regprocedure),
       ('trg_log_coach_reply',    'public.messages'::regclass, 'public.log_coach_reply()'::regprocedure));
  if n <> 3 then raise exception 'NEXUS: déclencheurs du journal débranchés (% sur 3)', n; end if;

  -- Dormance : la règle ne vise aujourd'hui personne.
  select count(*) into n from public.athletes a join public.schools s on s.id = a.school_id where s.type::text = 'CEGEP';
  raise notice 'NEXUS lot A : % athlète(s) ancré(s) sur un cégep au moment de l''application.', n;
end $$;

drop table _cegep_lot_a_releve, _cegep_lot_a_avant, _cegep_lot_a_polices_avant;
$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot_a) <> 'ce98b188fac2feb9b50f066297e79e30' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lot_a);
  end if;
  execute (select contenu from _lot_a);
end $apply$;
select clock_timestamp() as fin_migration;

-- ── 2. Gardes APRÈS : les corps attendus (identiques au local et au rejeu prod) ─
do $$
declare r record; n int;
begin
  for r in select * from (values
    ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '0bfe461f7ef3c277796ccadc9dc4f3b4'),
    ('public.recruiter_athlete_profile(uuid)', '90dd1734451b9cd2017193fd9fba56a5'),
    ('public.recruiter_athlete_cards(uuid[])', '83edcd33fd085fb3d3750338665433d2'),
    ('public.athletes_targeting_my_cegep()', 'ddd4f17140902ccbd76318682e74de3a'),
    ('public.matchs_profils_nexus(uuid[])', 'f8404ce1015afe98912a670cf58c433b'),
    ('public.depistage_profils_match(uuid)', '01a05c483eeeb9ef40fa6bcf6ea199a5'),
    ('public.rapprochement_candidats(uuid,uuid)', 'f0f48daf500a3f12ed1aaa489406d227'),
    ('public.rapprochements_unite(uuid)', 'c9a5819e84d9bff5235443eabb60725d'),
    ('public.rapprochements_refuses_unite()', 'aaddce48d4247293b1af5c316c42db67'),
    ('public.fusionner_carte(uuid,uuid)', 'ccac55c88a0fb44dd76737562ca9dc72'),
    ('public.athletes_nom_proche(text,text,uuid)', '1ab37c3c47bbd70de790d27b7676bffa'),
    ('public.athlete_nexus_par_courriel(text)', '0c0cee48b51459649559fe0bd7f42852'),
    ('public.agenda_flux(text)', 'e66aa71a38527be3a3222a21a837f19b'),
    ('public.matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '82ac7e3aebbb103335346d8799bf596e'),
    ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)', '3402b892940b6a7049fa7ba262a5af11'),
    ('public.log_new_athlete()', 'd69c225b3fc04007d527ef0a69717d04'),
    ('public.log_athlete_update()', '7b927d3036f7ca1e6d24090c7202c672'),
    ('public.log_coach_reply()', '8d37af1940e9062e69f5170a7cf21be9'),
    ('public.athlete_est_cegepien(uuid)', '64d1f6e988444fd2fdd915beab11da2d'),
    ('public.peut_voir_cegepiens()', 'bf3463481d1b2862acc6367f2640b3b1'),
    ('public.unite_voit_cegepiens(uuid)', 'e6c978a07191e40681a89c1ebfa3d1b7')) t(sig, md5) loop
    if md5(pg_get_functiondef(r.sig::regprocedure)) <> r.md5 then
      raise exception 'NEXUS: après migration, % = md5 %, attendu %', r.sig, md5(pg_get_functiondef(r.sig::regprocedure)), r.md5;
    end if;
  end loop;
  select count(*) into n from pg_policies
   where schemaname = 'public' and policyname = 'cegepiens_masques_recruteurs' and permissive = 'RESTRICTIVE';
  if n <> 6 then raise exception 'NEXUS: % policy(ies) restrictive(s), attendu 6', n; end if;
end $$;

-- ── 3. Preuve sous vrai JWT, avant le COMMIT ─────────────────────────────────
-- Le recruteur collégial ne voit plus le témoin ni sa ligne de journal ; l'admin, si.
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('nexus.collegial'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t uuid := current_setting('nexus.temoin')::uuid; n int;
begin
  select count(*) into n from public.athletes where id = t;
  if n <> 0 then raise exception 'NEXUS: le recruteur collégial lit encore le témoin (athletes = %)', n; end if;
  select count(*) into n from public.recruiter_search_athletes() where id = t;
  if n <> 0 then raise exception 'NEXUS: le témoin sort encore dans la recherche du collégial'; end if;
  select count(*) into n from public.recruiter_athlete_profile(t);
  if n <> 0 then raise exception 'NEXUS: la fiche du témoin s''ouvre encore au collégial'; end if;
  select count(*) into n from public.recruiter_activity_log where athlete_id = t;
  if n <> 0 then raise exception 'NEXUS: le collégial lit encore % ligne(s) de journal du témoin', n; end if;
end $$;
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare t uuid := current_setting('nexus.temoin')::uuid; n int;
begin
  select count(*) into n from public.athletes where id = t;
  if n <> 1 then raise exception 'NEXUS: l''admin ne lit plus le témoin (athletes = %)', n; end if;
  select count(*) into n from public.recruiter_activity_log where athlete_id = t;
  if n <> 5 then raise exception 'NEXUS: l''admin lit % ligne(s) de journal du témoin, attendu 5', n; end if;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
select (select count(*) from public.recruiter_activity_log where athlete_id = current_setting('nexus.temoin')::uuid) as journal_temoin_apres;

-- ── 4. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_a_base', array[contenu], 'bptds22@gmail.com' from _lot_a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_LOT_A_CEGEPIENS_MASQUES',
       'Lot A cégep : cégépiens masqués aux recruteurs collégiaux et sans école — 3 fonctions-règles, 15 RPC rebasées, 3 déclencheurs du journal filtrés, 6 policies RESTRICTIVE (GO BP 2026-10-25)',
       jsonb_build_object(
         'nom', 'cegep_lot_a_base',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_a_base.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_a_base.sql',
         'md5_fichier', 'ce98b188fac2feb9b50f066297e79e30',
         'md5_rollback', '3ff81629983ee40ff2b8eb9155f0a5a6',
         'voie', 'psql (session pooler), fichier trop gros pour le connecteur MCP',
         'rejeu_blanc', '2026-10-25 22 h : rollback 0/0 sur 1095 lignes, journal du témoin 1 -> 0 chez 5 collégiaux, admin 5',
         'preuve_avant_commit', 'collégial : témoin 0 (lecture, recherche, fiche, journal) ; admin : témoin 1, journal 5'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _lot_a;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261026030400' and name = 'cegep_lot_a_base') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_LOT_A_CEGEPIENS_MASQUES') <> 1 then
    raise exception 'NEXUS: ligne admin_operations absente ou en double';
  end if;
end $$;

select version as version_inscrite, clock_timestamp() as avant_commit from _lot_a;
commit;
\echo '== COMMIT fait : lot A en prod.'
