-- ════════════════════════════════════════════════════════════════════════════
-- Lot B3 cégep — APPLY RÉEL EN PROD, version 20261026210100 (GO BP après le rejeu à blanc : VERDICT
-- tout à 0, aucun cégépien rendu aux recruteurs, seuls les 5 objets changent, rollback 0/0).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b3/generer.sh <date> apply : la migration y est embarquée telle
-- quelle (fins de ligne LF, même texte que celui du rejeu à blanc, md5 gardé).
--
-- UNE transaction : gardes AVANT → relevé des colonnes d'avant, par compte → migration → mêmes
-- relevés APRÈS, comparés → inscription (schema_migrations + admin_operations MIGRATION_B3_FILTRES)
-- → COMMIT. Toute garde qui échoue (RAISE « NEXUS: ») ou toute erreur arrête psql (ON_ERROR_STOP)
-- AVANT le COMMIT : rien n'est appliqué. Lancer SANS -1, en postgres (propriétaire des objets).
-- Rollback : docs/cegep-lot-b3/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-lot-b3';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
declare v text;
begin
  -- Rien en prod le mardi, ni le mercredi avant midi (heure de Montréal).
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 12) then
    raise exception 'NEXUS: pas d''apply le mardi ni le mercredi avant midi';
  end if;
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres (propriétaire des 5 objets), pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261026210100') then
    raise exception 'NEXUS: version 20261026210100 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261026210100' then raise exception 'NEXUS: version 20261026210100 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_B3_FILTRES', 'ROLLBACK_B3_FILTRES')) then
    raise exception 'NEXUS: le lot B3 a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- Comptes sondés : tous les recruteurs et tous les partenaires admis.
create temp table _c on commit drop as
select u.id as uid, case when u.role = 'RECRUTEUR'::public.user_role then 'R' else 'P' end as genre,
       public.unite_voit_cegepiens(u.school_id) as voit_cegepiens
  from public.users u
 where u.role = 'RECRUTEUR'::public.user_role
    or (u.role = 'PARTNER'::public.user_role
        and exists (select 1 from public.media_partners mp where mp.user_id = u.id and mp.status = 'APPROVED'));
create temp table _cg on commit drop as
select a.id from public.athletes a where a.status = 'ACTIF' and public.athlete_est_cegepien(a.id);
create temp table _ath on commit drop as
select array_agg(a.id order by a.id) as ids from public.athletes a where a.status = 'ACTIF';

-- Relevé, par compte : les colonnes d'AVANT (ligne JSON moins les colonnes ajoutées) et les cégépiens rendus.
create function pg_temp.releve(p_uid uuid, p_genre text)
returns text
language plpgsql
as $$
declare v text;
  -- Lus AVANT de changer de rôle : _ath et _cg sont des tables temporaires de postgres.
  ids uuid[] := (select ids from _ath);
  cg uuid[] := (select coalesce(array_agg(id), '{}') from _cg);
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    if p_genre = 'R' then
      select 'recherche=' || count(*) || '/' || md5(coalesce(string_agg((to_jsonb(r) - 'team_age_group')::text, '|' order by r.id), ''))
             || '/' || count(*) filter (where r.id = any(cg))
             || ';cartes=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(c) - 'team_school_type' - 'team_age_group')::text, '|' order by c.id), ''))
                                      || '/' || count(*) filter (where c.id = any(cg))
                                 from public.recruiter_athlete_cards(ids) c)
        into v from public.recruiter_search_athletes() r;
    else
      select 'top=' || count(*) || '/' || md5(coalesce(string_agg((to_jsonb(t) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by t.id), ''))
             || ';tendances=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(d) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by d.id), ''))
                                    from public.trending_athletes_view d)
        into v from public.top_athletes_view t;
    end if;
    raise exception using errcode = 'NX000', message = coalesce(v, '·');
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus=' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
end $$;

create temp table _r on commit drop as
select c.uid, c.genre, c.voit_cegepiens, pg_temp.releve(c.uid, c.genre) as avant, null::text as apres from _c c;
do $$
begin
  if exists (select 1 from _r where avant like 'refus=%') then
    raise exception 'NEXUS: un relevé AVANT a été refusé : %', (select avant from _r where avant like 'refus=%' limit 1);
  end if;
end $$;
select genre, count(*) as comptes from _r group by genre order by genre;

-- ── 1. La migration, texte gardé par son md5 (elle vérifie elle-même les 5 objets avant et après) ─
create temp table _lot_b3 on commit drop as
select '20261026210100'::text as version, $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B3 « base des filtres » Type + Catégorie (GO BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement (jamais le mardi, ni le mercredi avant midi).
--
-- Rend, en COLONNES AJOUTÉES EN FIN, le type de l'école d'ancrage, le type de l'école de l'équipe
-- et la catégorie de l'équipe (teams.age_group), pour que B4 (web) et B5 (mobile) filtrent sans
-- autre changement de base :
--   · recruiter_search_athletes : + team_age_group (school_type et team_school_type existent déjà) ;
--   · recruiter_athlete_profile, recruiter_athlete_cards : + team_school_type, team_age_group ;
--   · top_athletes_view, trending_athletes_view : + school_type, team_school_type, team_age_group.
-- L'équipe d'un athlète vient de team_athletes, UNIQUE (athlete_id) : au plus une ligne, aucune
-- ligne ajoutée ni retirée (gardé ci-dessous).
--
-- Rien d'autre ne change : corps d'origine (prod) repris À LA LETTRE, seules les colonnes de fin et
-- la jointure d'équipe s'ajoutent. Masquage du lot A intact (peut_voir_cegepiens /
-- athlete_est_cegepien dans les 3 fonctions) ; les 2 vues restent réservées aux partenaires admis,
-- qui voient les cégépiens par décision. Aucune règle Collégial dans la carte des matchs (BP 1).
--
-- Les 3 fonctions changent de type de retour : DROP + CREATE. ACL rétablies À L'IDENTIQUE (texte
-- exact, ordre compris), commentaires reposés. Aucun objet n'en dépend (relevé prod 2026-10-26).
-- Les 2 vues : CREATE OR REPLACE (colonnes ajoutées en fin) ; ACL et commentaires conservés ;
-- top_athletes_view sans reloptions, trending_athletes_view avec security_barrier (restatée).
--
-- Rollback : supabase/rollback/20261026210100_rollback_cegep_lot_b3_filtres.sql
-- ════════════════════════════════════════════════════════════════════════════

-- pg_get_viewdef dépend du search_path : les md5 des vues sont relevés sous celui-ci.
set local search_path = public, extensions;

-- ── 0. Gardes : les 5 objets sont ceux relevés en prod le 2026-10-26 ────────────
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from 'aba2e501dd8c62f323adfb857150b5a6' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '0fccf321625808a8561968231abe85ca' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from 'ba26d8b8bb57246110388dd63e41ac6d' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) is distinct from 'b677336de698551f2d5b733bc7f70bab' then
    raise exception 'NEXUS: top_athletes_view n''est pas la définition prod relevée le 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if md5(pg_get_viewdef('public.trending_athletes_view'::regclass)) is distinct from 'b45eb0030c789288a79dddbdd020d060' then
    raise exception 'NEXUS: trending_athletes_view n''est pas la définition prod relevée le 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')) is distinct from 'e1c17f94928a14a388dc07e03ea4a2fc' then
    raise exception 'NEXUS: commentaire de recruiter_search_athletes inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')) is distinct from '4a6be07c0b1f51c8e7189d525b6e9507' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_profile inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc')) is distinct from 'a2e22b53f4031df7aa0397bb997c51ba' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_cards inattendu';
  end if;
  if exists (select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
              where d.refobjid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)
                and r.ev_class not in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)) then
    raise exception 'NEXUS: un objet dépend d''une des 2 vues';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.team_athletes'::regclass and contype = 'u'
                    and pg_get_constraintdef(oid) = 'UNIQUE (athlete_id)') then
    raise exception 'NEXUS: team_athletes n''est plus UNIQUE (athlete_id) : la jointure d''équipe multiplierait des lignes';
  end if;
end $$;

create temp table _b3_com (sig text primary key, texte text);
insert into _b3_com
select 'public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')
union all
select 'public.recruiter_athlete_profile(uuid)', obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')
union all
select 'public.recruiter_athlete_cards(uuid[])', obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc');

-- ── recruiter_search_athletes ──
drop function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean);
CREATE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text, cote_partenaire numeric, cote_partenaire_organisation text, team_age_group text)
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
    pe.organisation,
    -- Lot B3 cégep (filtre Catégorie) : catégorie de l'équipe. Le type de l'école d'ancrage
    -- (school_type) et celui de l'école de l'équipe (team_school_type) sont déjà rendus.
    tm.age_group
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
revoke all on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to authenticated;

-- ── recruiter_athlete_profile ──
drop function public.recruiter_athlete_profile(uuid);
CREATE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, profile_completion integer, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, matieres_fortes jsonb, programme_cegep_vise jsonb, regions_cegep_preferees jsonb, ouvert_cegep_prive boolean, ouvert_cegep_anglophone boolean, pret_changer_region boolean, bio text, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, video_faits_saillants_url text, hudl_url text, youtube_url text, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_city text, school_type text, committed_school_name text, evaluations jsonb, team_school_type text, team_age_group text)
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
      WHERE ev.athlete_id = a.id),
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école de l'équipe et catégorie de
    -- l'équipe. Le type de l'école d'ancrage est school_type, plus haut.
    tsc.type,
    tm.age_group
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  -- Lot B3 cégep : l'équipe de l'athlète. team_athletes est UNIQUE (athlete_id) : au plus une
  -- ligne, le jeu de lignes ne change pas.
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_profile(uuid) to authenticated;
grant execute on function public.recruiter_athlete_profile(uuid) to service_role;

-- ── recruiter_athlete_cards ──
drop function public.recruiter_athlete_cards(uuid[]);
CREATE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_school_type text, team_age_group text)
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
      WHERE ev.athlete_id = a.id),
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école de l'équipe et catégorie de
    -- l'équipe. Le type de l'école d'ancrage est school_type, plus haut.
    tsc.type,
    tm.age_group
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  -- Lot B3 cégep : l'équipe de l'athlète. team_athletes est UNIQUE (athlete_id) : au plus une
  -- ligne, le jeu de lignes ne change pas.
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_cards(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_cards(uuid[]) to authenticated;
grant execute on function public.recruiter_athlete_cards(uuid[]) to service_role;

do $$
declare c record;
begin
  for c in select * from _b3_com where texte is not null loop
    execute format('comment on function %s is %L', c.sig, c.texte);
  end loop;
end $$;
drop table _b3_com;

-- ── Les 2 vues partenaire ──
CREATE OR REPLACE VIEW public.top_athletes_view AS
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.cote_globale_entraineur,
    a.annee_diplomation,
    sch.region,
    a.sport_id,
    a.position_id,
    a.school_id,
    a.photo_url,
    s.nom AS sport_name,
    p.nom AS position_name,
    sch.name AS school_name,
    e.distinctions,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_faits_saillants_url END AS video_faits_saillants_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_match_complet_url END AS video_match_complet_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_entrainement_url END AS video_entrainement_url,
    a.genre,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('code', x.code, 'libelle', x.libelle, 'famille', x.famille, 'contexte', x.contexte, 'attribue_le', x.attribue_le) ORDER BY x.rang, x.ordre, x.attribue_le), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT b2.code,
                    b2.libelle,
                    b2.famille,
                    ab.contexte,
                    ab.created_at AS attribue_le,
                    b2.ordre,
                        CASE b2.famille
                            WHEN 'honneur'::text THEN 0
                            WHEN 'universel'::text THEN 1
                            ELSE 2
                        END AS rang
                   FROM public.athlete_badges ab
                     JOIN public.badges b2 ON b2.id = ab.badge_id
                  WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL) x) AS badges,
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école d'ancrage, type de l'école de
    -- l'équipe, catégorie de l'équipe.
    sch.type AS school_type,
    tsc.type AS team_school_type,
    tm.age_group AS team_age_group
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.positions p ON p.id = a.position_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     -- Lot B3 : team_athletes est UNIQUE (athlete_id), au plus une ligne.
     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
     LEFT JOIN public.teams tm ON tm.id = ta.team_id
     LEFT JOIN public.schools tsc ON tsc.id = tm.school_id
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM public.evaluations
          WHERE evaluations.athlete_id = a.id
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON true
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid())
  ORDER BY a.cote_globale_entraineur DESC;

CREATE OR REPLACE VIEW public.trending_athletes_view
  WITH (security_barrier = true) AS
 WITH recent_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_last_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), prior_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_prior_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '14 days'::interval) AND recruiter_athlete_views.viewed_at < (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), recent_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_last_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        ), prior_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_prior_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '14 days'::interval) AND recruiter_favorites.created_at < (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        )
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.cote_globale_entraineur,
    sch.region,
    sch.name AS school_name,
    a.annee_diplomation,
    s.nom AS sport_name,
    COALESCE(rv.views_last_7d, 0::bigint) AS views_7d,
    COALESCE(pv.views_prior_7d, 0::bigint) AS views_prior_7d,
    COALESCE(rv.views_last_7d, 0::bigint) - COALESCE(pv.views_prior_7d, 0::bigint) AS views_delta,
    COALESCE(rfv.favs_last_7d, 0::bigint) AS favs_7d,
    COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_prior_7d,
    COALESCE(rfv.favs_last_7d, 0::bigint) - COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_delta,
    a.sport_id,
    a.position_id,
    a.genre,
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école d'ancrage, type de l'école de
    -- l'équipe, catégorie de l'équipe.
    sch.type AS school_type,
    tsc.type AS team_school_type,
    tm.age_group AS team_age_group
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     -- Lot B3 : team_athletes est UNIQUE (athlete_id), au plus une ligne.
     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
     LEFT JOIN public.teams tm ON tm.id = ta.team_id
     LEFT JOIN public.schools tsc ON tsc.id = tm.school_id
     LEFT JOIN recent_views rv ON rv.athlete_id = a.id
     LEFT JOIN prior_views pv ON pv.athlete_id = a.id
     LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
     LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid());

-- ── Gardes APRÈS ─────────────────────────────────────────────────────────────
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '8ff1f67effeb583d2ef100b7f76560f9' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '4ce325480f3d9d85fbf728e963049d57' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '230f7047875868d7e3d81dd9b3fcb508' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')) is distinct from 'e1c17f94928a14a388dc07e03ea4a2fc' then
    raise exception 'NEXUS: commentaire de recruiter_search_athletes inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')) is distinct from '4a6be07c0b1f51c8e7189d525b6e9507' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_profile inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc')) is distinct from 'a2e22b53f4031df7aa0397bb997c51ba' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_cards inattendu';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)')) not like '%, cote_partenaire_organisation text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_search_athletes inattendues';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_athlete_profile(uuid)')) not like '%, evaluations jsonb, team_school_type text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_athlete_profile inattendues';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_athlete_cards(uuid[])')) not like '%, evaluations jsonb, team_school_type text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_athlete_cards inattendues';
  end if;
  if (select string_agg(attname, ',' order by attnum) from (select attname, attnum from pg_attribute
        where attrelid = 'public.top_athletes_view'::regclass and attnum > 0 order by attnum desc limit 3) x)
     is distinct from 'school_type,team_school_type,team_age_group' then
    raise exception 'NEXUS: colonnes de fin de top_athletes_view inattendues';
  end if;
  if (select string_agg(attname, ',' order by attnum) from (select attname, attnum from pg_attribute
        where attrelid = 'public.trending_athletes_view'::regclass and attnum > 0 order by attnum desc limit 3) x)
     is distinct from 'school_type,team_school_type,team_age_group' then
    raise exception 'NEXUS: colonnes de fin de trending_athletes_view inattendues';
  end if;
end $$;

notify pgrst, 'reload schema';
$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot_b3) <> 'a4f8ea9d2fb4efef5889f05da0507ca9' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lot_b3);
  end if;
  execute (select contenu from _lot_b3);
end $apply$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

-- ── 2. Gardes APRÈS : colonnes d'avant identiques pour chaque compte, aucun cégépien rendu ───
update _r set apres = pg_temp.releve(uid, genre);
do $$
declare n int;
begin
  select count(*) into n from _r where apres is distinct from avant;
  if n <> 0 then
    raise exception 'NEXUS: % compte(s) voient des colonnes d''avant différentes après la migration', n;
  end if;
  select count(*) into n from _r
   where genre = 'R' and not voit_cegepiens
     and (split_part(split_part(apres, ';', 1), '/', 3) <> '0' or split_part(split_part(apres, ';', 2), '/', 3) <> '0');
  if n <> 0 then
    raise exception 'NEXUS: % recruteur(s) collégial(aux) reçoivent un cégépien', n;
  end if;
end $$;
select genre, count(*) as comptes, count(*) filter (where apres = avant) as identiques from _r group by genre order by genre;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_b3_filtres', array[contenu], 'bptds22@gmail.com' from _lot_b3;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_B3_FILTRES',
       'Lot B3 cégep : les 3 fonctions recruteur et les 2 vues partenaire rendent le type de l''école d''ancrage, le type de l''école de l''équipe et la catégorie de l''équipe, colonnes ajoutées en fin (GO BP 2026-10-26)',
       jsonb_build_object(
         'nom', 'cegep_lot_b3_filtres',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_b3_filtres.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_b3_filtres.sql',
         'md5_fichier', 'a4f8ea9d2fb4efef5889f05da0507ca9',
         'md5_rollback', 'b2c1c1262a9e395ed9d2cab643a34345',
         'comptes_verifies', (select count(*) from _r),
         'voie', 'psql (session pooler)',
         'rejeu_blanc', 'VERDICT tout à 0, aucun cégépien rendu aux recruteurs, seuls les 5 objets changent, rollback 0/0'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _lot_b3;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261026210100' and name = 'cegep_lot_b3_filtres') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_B3_FILTRES') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_B3_FILTRES absente ou en double';
  end if;
end $$;

select version as version_inscrite, (select count(*) from _r) as comptes_verifies, clock_timestamp() as avant_commit from _lot_b3;
commit;
\echo '== COMMIT fait : B3 en prod.'
