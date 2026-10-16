-- LOT PROD 20261016170000 — généré par docs/cote-partenaire-carte/prod/construire-lot.mjs
-- Fichier : supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql — md5 1ee801ea4be50260434b4a198ff4fd2d
-- Empreinte attendue des objets : 386e556c5e11b483441b9063f694dae8
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _cote_releve as
select txid_current() as txid,
       (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners)
       || '|' || (select count(*) from public.athletes where partner_visibility_opt_in)
       || '|' || (select count(*) from public.partenaire_prospects) as donnees,
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
-- Cote partenaire sur la carte, filtres « Mes athlètes », Loi 25 (retrait d'opt-in respecté partout)
-- et demande de visibilité au jeune. Décisions BP du 2026-10-16. UNE migration, un lot.
--
-- A. Cartes et « Mes athlètes »
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes (cartes :
--    favoris, fiche, aperçu). SECURITY INVOKER : délègue athlète par athlète à
--    evaluations_partenaires_athlete() — aucune règle propre, aucun nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE, + poste / poste_abr (recherche), + badge_ref par
--    badge (filtre « Distinctions »). Corps W4d inchangé sinon.
--
-- B. Loi 25 — un retrait d'opt-in est respecté IMMÉDIATEMENT (décision BP)
--    Opt-in retiré (is_partner_eligible_athlete faux) = plus rien du partenaire n'est visible,
--    nulle part, pour personne d'autre que l'ADMIN. Les données restent en base : l'opt-in revient,
--    tout réapparaît. Lectures resserrées (corps d'origine + la seule condition d'admissibilité) :
--  · evaluations_partenaires_athlete (fiche, section et ligne ; et par délégation le lot A) ;
--  · badges_partenaires_athlete (badges partenaire sur la fiche) ;
--  · recruiter_search_athletes : le LATERAL partenaire → cote_partenaire, filtre « 4+ étoiles » et
--    tri lisent la même ligne, désormais vide sans opt-in actif ;
--  · partenaire_badges_nexus_admissibles : nommait le partenaire d'un badge déjà posé.
--    partenaire_mes_athletes était déjà gardée (partenaire_voit_athlete).
--
-- C. Demande de visibilité au jeune (cloche + push par la file A4a)
--    Les écritures partenaire directes (W2/W3/W3b) exigent déjà l'opt-in : le seul chemin par lequel
--    un partenaire évalue ou badge un jeune SANS opt-in actif est la carte prospect confirmée qui
--    attend (CONFIRMEE_ATTENTE_OPTIN, W4a). C'est donc là que la demande naît (trigger sur
--    partenaire_prospects, aucune fonction W4 redéfinie) :
--  · « {Partenaire} t'a évalué. » / « Accepte d'être visible des partenaires pour que ton
--    évaluation s'affiche. » — jamais la cote ni les badges ;
--  · UNE demande ouverte par (jeune, partenaire) ; une 2e carte du même partenaire s'y ajoute ;
--  · pas de doublon avec W4 : la notification de PROPOSITION de la carte (PARTENAIRE_EVALUATION,
--    « C'est toi ? ») est CONVERTIE en demande, pas doublée ; le push part par la file 10 min plus
--    tard et est ANNULÉ si le jeune a déjà accepté (dans l'écran de la carte, par exemple) ;
--  · jeune qui a RETIRÉ son opt-in : une seule demande après le retrait, tous partenaires confondus ;
--  · « Accepter » → accepter_visibilite_partenaire() : set_my_partner_visibility (chemin
--    existant) ; sous 14 ans, la demande part au parent (parent_notifications) au lieu d'activer.
--  · la demande se règle seule : ACCEPTEE à l'activation (paramètres, parent, carte), CADUQUE si
--    la carte disparaît sans activation.
--
-- Rollback : supabase/rollback/20261016170000_rollback_cote_partenaire_carte_mes_athletes.sql

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null
     or to_regprocedure('public.accepter_visibilite_partenaire(uuid,text)') is not null then
    raise exception 'NEXUS: lot 20261016170000 déjà appliqué';
  end if;
  -- Chaque objet redéfini ou dont on dépend doit être EXACTEMENT celui relevé (local = prod,
  -- 2026-10-16 ; empreinte du corps sans retours chariot : la prod garde des CRLF).
  if exists (
    select 1
      from (values
        ('public.partenaire_mes_athletes()', '71a92e788d13bc85ee8d9d9baa675e30'),
        ('public.evaluations_partenaires_athlete(uuid)', '33d0544f27a8b62fa9e21902f2e62310'),
        ('public.badges_partenaires_athlete(uuid)', '6baa5e2d5c2f219a0bd1baac97f99e72'),
        ('public.partenaire_badges_nexus_admissibles(uuid)', 'd55783f816d54757ee2e18c94e7d3757'),
        ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '957289faec17d8e027681a155ba80bc7'),
        ('public.push_textes(text,text,integer,text)', 'd8b270c9d129866b636e4d9ee1bbe8a3'),
        ('public.push_traiter_file(timestamptz)', '8e7bfc261e8041074486d5395f17b198'),
        ('public.set_my_partner_visibility(boolean,text)', '8c48d5b5e480a9690770678308aab5ba'),
        ('public.emit_parent_notification(uuid,text,text,text,jsonb)', 'fb08a829e1d2fcf0d0983eeaa50f98ec'),
        ('public.is_partner_eligible_athlete(uuid)', '1a196afeb23165c25ac7ac9dcc7855ad')
      ) as v(f, attendu)
     where (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure(v.f)) is distinct from v.attendu)
  then
    raise exception 'NEXUS: une fonction ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'athlete_notifications_type_check')
       is distinct from 'f7c3e05c8d78780c77afe27967fedb61'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'parent_notifications_type_check')
       is distinct from '521852a6656bff4344aae982c7623209'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'push_file_genre_check')
       is distinct from '2e673d7536774b4c181d9897db778521' then
    raise exception 'NEXUS: contraintes de type des notifications / de la file ≠ relevé';
  end if;
end $$;

-- ═══ A. Cartes et « Mes athlètes » ══════════════════════════════════════════

-- A1. Cotes partenaires d'un lot d'athlètes (délégation pure à W2, donc à B1).
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

-- A2. « Mes athlètes » : la position et la référence des badges.
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

-- ═══ B. Loi 25 : rien du partenaire sans opt-in actif, sauf pour l'admin ═════
-- CREATE OR REPLACE, signatures et RETURNS inchangés : l'ACL est conservée (comparée en fin de lot).

-- B1. Évaluations partenaires (fiche ; et le lot A1 par délégation).
CREATE OR REPLACE FUNCTION public.evaluations_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, organisation text, cote_globale numeric, leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer, competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer, vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric, agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric, grille_id uuid, updated_at timestamp with time zone, est_la_mienne boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select (
         public.is_admin()
      or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
      or public.coach_can_read_athlete_evals(p_athlete_id)
      or public.is_director_of_athlete_school(p_athlete_id)
      or exists (select 1 from public.athletes a
                  where a.id = p_athlete_id and a.user_id = auth.uid())
    ) as tout,
    public.is_admin() as admin,
    -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
    coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible
  )
  select pe.id, mp.organization_name, pe.cote_globale,
         pe.leadership, pe.discipline, pe.coachabilite, pe.intelligence_jeu,
         pe.competitivite, pe.esprit_equipe, pe.resilience, pe.attitude_mentalite,
         pe.vitesse_explosivite, pe.force_puissance, pe.endurance_cardio,
         pe.agilite_coordination, pe.vision_du_jeu, pe.sens_tactique,
         pe.grille_id, pe.updated_at,
         (mp.user_id is not distinct from auth.uid())
    from public.partner_evaluations pe
    join public.media_partners mp on mp.id = pe.partner_id and mp.status = 'APPROVED'
    cross join lecteur
   where pe.athlete_id = p_athlete_id
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (lecteur.admin or lecteur.admissible)
   order by pe.updated_at desc
$function$;

-- B2. Badges partenaire sur la fiche.
CREATE OR REPLACE FUNCTION public.badges_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, badge_id uuid, libelle text, icone_path text, organisation text, created_at timestamp with time zone, est_masque boolean, est_le_mien boolean, peut_masquer boolean, badge_code text, est_nexus boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout,
      -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
      coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible
  )
  select x.id, coalesce(b.id, n.id), coalesce(b.libelle, n.libelle), b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach),
         n.code,
         (n.id is not null)
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id and mp.status = 'APPROVED'
    left join public.partner_badges b on b.id = x.partner_badge_id
    left join public.badges n on n.id = x.badge_id
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and (b.actif or n.actif)
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
     and (lecteur.admin or lecteur.admissible)
   order by x.created_at
$function$;

-- B3. Badges Nexus admissibles (portail partenaire) : nommait le partenaire d'un badge déjà posé.
CREATE OR REPLACE FUNCTION public.partenaire_badges_nexus_admissibles(p_athlete_id uuid)
 RETURNS TABLE(badge_id uuid, code text, libelle text, famille text, deja_par text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_sport  uuid;
  v_mp     uuid;
begin
  select a.sport_id into v_sport from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    select mp.id into v_mp from public.media_partners mp where mp.user_id = auth.uid();
    if v_mp is null or not public.partenaire_peut_evaluer(v_mp, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;
  -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
  if not public.is_admin() and not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  return query
  select b.id, b.code, b.libelle, b.famille,
         case
           when exists (select 1 from public.athlete_badges ab
                         where ab.athlete_id = p_athlete_id and ab.badge_id = b.id and ab.retire_le is null)
             then 'son coach'
           else (select coalesce(mp.organization_name, 'un partenaire')
                   from public.partner_athlete_badges x
                   join public.media_partners mp on mp.id = x.partner_id
                  where x.athlete_id = p_athlete_id and x.badge_id = b.id and x.retire_le is null
                  limit 1)
         end
    from public.badges b
   where b.actif
     and b.famille in ('universel', 'sport')
     and not b.requiert_contexte
     and (b.famille = 'universel'
          or exists (select 1 from public.badge_sports bs where bs.badge_id = b.id and bs.sport_id = v_sport))
   order by case b.famille when 'universel' then 0 else 1 end, b.ordre, b.libelle;
end $function$;

-- B4. Recherche recruteur : la ligne partenaire du LATERAL exige l'opt-in actif. cote_partenaire,
--     le filtre « 4+ étoiles » et le tri lisent cette même ligne. La plus récente (règle confirmée
--     par BP), départagée par l'identifiant à date égale — comme le client (retenirCotePartenaire).
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

-- ═══ C. Demande de visibilité au jeune ══════════════════════════════════════

-- C1. Types de notification : jeune et parent (listes complètes, l'ancienne + un).
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE', 'PARTENAIRE_VISIBILITE_DEMANDE']::text[]));
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED', 'CHILD_PARTNER_VISIBILITY_REQUEST']::text[]));
alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE', 'VISIBILITE_PARTENAIRE']::text[]));

-- C2. Le texte du push (une seule source, jamais de cote ni de badge).
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
$function$;

-- C3. La file : un push de demande ne part pas si la demande n'attend plus le jeune.
CREATE OR REPLACE FUNCTION public.push_traiter_file(p_maintenant timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Demande de visibilité qui n'attend plus le jeune (acceptée, au parent, caduque) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'VISIBILITE_PARTENAIRE'
     and not exists (
       select 1 from public.athlete_notifications n
        where n.id::text = f.detail->>'notification_id'
          and n.metadata->>'etat' = 'EN_ATTENTE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi)
                || public.push_destination(g.genre),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$function$;

-- C4. Naissance d'une demande, pour une carte qui attend l'opt-in du jeune.
create function public.partenaire_demander_visibilite(p_carte uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_ath   public.athletes%rowtype;
  v_org   text;
  v_notif uuid;
  v_titre text;
  v_texte constant text := 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.';
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte;
  if not found or v_carte.statut <> 'CONFIRMEE_ATTENTE_OPTIN' or v_carte.reservee_athlete is null then
    return null;
  end if;
  -- Rien à rendre visible : pas de demande.
  if v_carte.cote_globale is null
     and coalesce(cardinality(v_carte.badges_partenaire), 0) + coalesce(cardinality(v_carte.badges_nexus), 0) = 0 then
    return null;
  end if;
  select * into v_ath from public.athletes where id = v_carte.reservee_athlete;
  if not found or coalesce(public.is_partner_eligible_athlete(v_ath.id), false) then
    return null;
  end if;
  select organization_name into v_org from public.media_partners where id = v_carte.partner_id;
  v_titre := coalesce(nullif(btrim(v_org), ''), 'Un partenaire') || ' t''a évalué.';

  -- Une seule demande ouverte par (jeune, partenaire) : la nouvelle carte s'y ajoute.
  update public.athlete_notifications n
     set metadata = jsonb_set(n.metadata, '{cartes}',
                              (n.metadata->'cartes') || jsonb_build_array(p_carte::text))
   where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and n.metadata->>'partner_id' = v_carte.partner_id::text
     and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
     and not (n.metadata->'cartes') ? p_carte::text
  returning n.id into v_notif;
  if v_notif is not null
     or exists (select 1 from public.athlete_notifications n
                 where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                   and n.metadata->>'partner_id' = v_carte.partner_id::text
                   and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')) then
    return v_notif;
  end if;

  -- A RETIRÉ son opt-in (il l'a déjà eu : la date d'activation reste après un retrait) : une seule
  -- demande après le retrait, tous partenaires confondus. Une demande née après la dernière
  -- activation est forcément née après le retrait (entre les deux, le jeune était visible).
  if v_ath.partner_visibility_opted_in_at is not null
     and exists (select 1 from public.athlete_notifications n
                  where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                    and n.created_at >= v_ath.partner_visibility_opted_in_at) then
    return null;
  end if;

  -- Pas de doublon avec W4 : la proposition « C'est toi ? » de cette carte devient la demande.
  update public.athlete_notifications n
     set type = 'PARTENAIRE_VISIBILITE_DEMANDE', title = v_titre, message = v_texte, read = false,
         metadata = n.metadata || jsonb_build_object(
           'partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
           'etat', 'EN_ATTENTE', 'depuis_proposition', true)
   where n.id = (select n2.id from public.athlete_notifications n2
                  where n2.athlete_id = v_ath.id and n2.type = 'PARTENAIRE_EVALUATION'
                    and n2.metadata->>'carte_id' = p_carte::text
                  order by n2.created_at desc limit 1)
  returning n.id into v_notif;
  if v_notif is null then
    insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
    values (v_ath.id, 'PARTENAIRE_VISIBILITE_DEMANDE', v_titre, v_texte,
            jsonb_build_object('partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
                               'etat', 'EN_ATTENTE'))
    returning id into v_notif;
  end if;

  perform public.push_mettre_en_file(v_ath.id, 'CARTES_PARTENAIRES', 'VISIBILITE_PARTENAIRE',
            'visibilite:' || v_carte.partner_id, v_org,
            jsonb_build_object('cloche', false, 'notification_id', v_notif));
  return v_notif;
end $$;

comment on function public.partenaire_demander_visibilite(uuid) is
  'Demande de visibilité au jeune pour une carte qui attend son opt-in : une par (jeune, partenaire), une seule après un retrait, convertit la proposition W4. Interne.';

-- C5. Une demande se règle : ACCEPTEE si le jeune est devenu visible, sinon CADUQUE quand plus
--     aucune de ses cartes n'attend.
create function public.partenaire_regler_demandes_visibilite(p_athlete uuid)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if coalesce(public.is_partner_eligible_athlete(p_athlete), false) then
    update public.athlete_notifications
       set metadata = metadata || jsonb_build_object('etat', 'ACCEPTEE', 'reglee_le', now()), read = true
     where athlete_id = p_athlete and type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT');
  else
    update public.athlete_notifications n
       set metadata = n.metadata || jsonb_build_object('etat', 'CADUQUE', 'reglee_le', now())
     where n.athlete_id = p_athlete and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
       and not exists (select 1 from public.partenaire_prospects c
                        where c.reservee_athlete = p_athlete and c.statut = 'CONFIRMEE_ATTENTE_OPTIN'
                          and (n.metadata->'cartes') ? c.id::text);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- C6. Triggers : ils ne bloquent JAMAIS l'écriture qui les déclenche.
create function public.trg_partenaire_demande_sur_carte()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    if tg_op = 'UPDATE' and new.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.statut is distinct from new.statut then
      perform public.partenaire_demander_visibilite(new.id);
    elsif old.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.reservee_athlete is not null
          and (tg_op = 'DELETE' or new.statut is distinct from old.statut) then
      perform public.partenaire_regler_demandes_visibilite(old.reservee_athlete);
    end if;
  exception when others then
    raise warning 'trg_partenaire_demande_sur_carte: carte % — %', coalesce(new.id, old.id), sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_carte
after update of statut or delete on public.partenaire_prospects
for each row execute function public.trg_partenaire_demande_sur_carte();

create function public.trg_partenaire_demande_sur_optin()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    perform public.partenaire_regler_demandes_visibilite(new.id);
  exception when others then
    raise warning 'trg_partenaire_demande_sur_optin: athlète % — %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_optin
after update of partner_visibility_opt_in, partner_visibility_parental_consent on public.athletes
for each row
when (old.partner_visibility_opt_in is distinct from new.partner_visibility_opt_in
      or old.partner_visibility_parental_consent is distinct from new.partner_visibility_parental_consent)
execute function public.trg_partenaire_demande_sur_optin();

-- C7. « Accepter » : le chemin existant (set_my_partner_visibility) ; sous 14 ans, la demande part
--     au parent lié (portail parent) au lieu d'activer. Jamais la cote ni les badges au parent.
create function public.accepter_visibilite_partenaire(p_notification uuid, p_policy_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_notif public.athlete_notifications%rowtype;
  v_ath   public.athletes%rowtype;
  v_res   jsonb;
  v_org   text;
begin
  select n.* into v_notif
    from public.athlete_notifications n join public.athletes a on a.id = n.athlete_id
   where n.id = p_notification and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and a.user_id = auth.uid() and auth.uid() is not null
   for update of n;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'introuvable');
  end if;
  if v_notif.metadata->>'etat' is distinct from 'EN_ATTENTE' then
    return jsonb_build_object('ok', false, 'reason', 'deja_traitee', 'etat', v_notif.metadata->>'etat');
  end if;
  select * into v_ath from public.athletes where id = v_notif.athlete_id;

  v_res := public.set_my_partner_visibility(true, p_policy_version);
  if coalesce((v_res->>'ok')::boolean, false) then
    perform public.partenaire_regler_demandes_visibilite(v_ath.id);
    return jsonb_build_object('ok', true, 'etat', 'ACCEPTEE');
  end if;
  if v_res->>'reason' is distinct from 'parent_required' then
    return v_res;
  end if;

  if not exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_ath.id) then
    return jsonb_build_object('ok', false, 'reason', 'parent_absent');
  end if;
  select organization_name into v_org from public.media_partners where id::text = v_notif.metadata->>'partner_id';
  if not exists (select 1 from public.parent_notifications pn
                  where pn.athlete_id = v_ath.id and pn.type = 'CHILD_PARTNER_VISIBILITY_REQUEST' and not pn.read) then
    perform public.emit_parent_notification(
      v_ath.id, 'CHILD_PARTNER_VISIBILITY_REQUEST', 'Demande de visibilité partenaires',
      coalesce(nullif(btrim(v_ath.first_name), ''), 'Votre enfant') || ' aimerait être visible des partenaires de Nexus ('
        || coalesce(nullif(btrim(v_org), ''), 'un partenaire') || ' l''a évalué). Votre accord est requis : rendez-vous dans Consentements.',
      jsonb_build_object('athlete_id', v_ath.id, 'route', '/parent/consentements'));
  end if;
  update public.athlete_notifications
     set metadata = metadata || jsonb_build_object('etat', 'DEMANDE_PARENT', 'reglee_le', now()), read = true
   where id = v_notif.id;
  return jsonb_build_object('ok', true, 'etat', 'DEMANDE_PARENT');
end $$;

comment on function public.accepter_visibilite_partenaire(uuid, text) is
  'Bouton « Accepter » d''une demande de visibilité : set_my_partner_visibility(true) ; sous 14 ans, demande au parent lié (parent_notifications).';

-- C8. Droits.
revoke all on function public.partenaire_demander_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_regler_demandes_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_carte() from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_optin() from public, anon, authenticated;
revoke all on function public.accepter_visibilite_partenaire(uuid, text) from public, anon, authenticated;
grant execute on function public.partenaire_demander_visibilite(uuid) to service_role;
grant execute on function public.partenaire_regler_demandes_visibilite(uuid) to service_role;
grant execute on function public.accepter_visibilite_partenaire(uuid, text) to authenticated, service_role;

-- C9. Les cartes qui attendent déjà (prod au 2026-10-16 : aucune).
select public.partenaire_demander_visibilite(c.id)
  from public.partenaire_prospects c where c.statut = 'CONFIRMEE_ATTENTE_OPTIN';

-- ═══ Gardes finales : ACL comparées EN ENTIER, signatures uniques ════════════
do $$
declare
  r    record;
  vus  text[];
begin
  for r in select * from (values
      ('public.cotes_partenaires_athletes(uuid[])', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_mes_athletes()', array['authenticated', 'postgres', 'service_role']),
      ('public.evaluations_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.badges_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_badges_nexus_admissibles(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', array['authenticated', 'postgres', 'service_role']),
      ('public.push_textes(text,text,integer,text)', array['postgres', 'service_role']),
      ('public.push_traiter_file(timestamptz)', array['postgres', 'service_role']),
      ('public.partenaire_demander_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.partenaire_regler_demandes_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_carte()', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_optin()', array['postgres', 'service_role']),
      ('public.accepter_visibilite_partenaire(uuid,text)', array['authenticated', 'postgres', 'service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = to_regprocedure(r.f);
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'recruiter_search_athletes',
                        'evaluations_partenaires_athlete', 'badges_partenaires_athlete', 'accepter_visibilite_partenaire')) <> 6 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS lot 20261016170000 : cartes, Loi 25, demande de visibilité — fonctions et ACL exactes — OK';
end $$;

-- ===== FIN 20261016170000_cote_partenaire_carte_mes_athletes.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _cote_texte as select $COTEMIG$-- Cote partenaire sur la carte, filtres « Mes athlètes », Loi 25 (retrait d'opt-in respecté partout)
-- et demande de visibilité au jeune. Décisions BP du 2026-10-16. UNE migration, un lot.
--
-- A. Cartes et « Mes athlètes »
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes (cartes :
--    favoris, fiche, aperçu). SECURITY INVOKER : délègue athlète par athlète à
--    evaluations_partenaires_athlete() — aucune règle propre, aucun nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE, + poste / poste_abr (recherche), + badge_ref par
--    badge (filtre « Distinctions »). Corps W4d inchangé sinon.
--
-- B. Loi 25 — un retrait d'opt-in est respecté IMMÉDIATEMENT (décision BP)
--    Opt-in retiré (is_partner_eligible_athlete faux) = plus rien du partenaire n'est visible,
--    nulle part, pour personne d'autre que l'ADMIN. Les données restent en base : l'opt-in revient,
--    tout réapparaît. Lectures resserrées (corps d'origine + la seule condition d'admissibilité) :
--  · evaluations_partenaires_athlete (fiche, section et ligne ; et par délégation le lot A) ;
--  · badges_partenaires_athlete (badges partenaire sur la fiche) ;
--  · recruiter_search_athletes : le LATERAL partenaire → cote_partenaire, filtre « 4+ étoiles » et
--    tri lisent la même ligne, désormais vide sans opt-in actif ;
--  · partenaire_badges_nexus_admissibles : nommait le partenaire d'un badge déjà posé.
--    partenaire_mes_athletes était déjà gardée (partenaire_voit_athlete).
--
-- C. Demande de visibilité au jeune (cloche + push par la file A4a)
--    Les écritures partenaire directes (W2/W3/W3b) exigent déjà l'opt-in : le seul chemin par lequel
--    un partenaire évalue ou badge un jeune SANS opt-in actif est la carte prospect confirmée qui
--    attend (CONFIRMEE_ATTENTE_OPTIN, W4a). C'est donc là que la demande naît (trigger sur
--    partenaire_prospects, aucune fonction W4 redéfinie) :
--  · « {Partenaire} t'a évalué. » / « Accepte d'être visible des partenaires pour que ton
--    évaluation s'affiche. » — jamais la cote ni les badges ;
--  · UNE demande ouverte par (jeune, partenaire) ; une 2e carte du même partenaire s'y ajoute ;
--  · pas de doublon avec W4 : la notification de PROPOSITION de la carte (PARTENAIRE_EVALUATION,
--    « C'est toi ? ») est CONVERTIE en demande, pas doublée ; le push part par la file 10 min plus
--    tard et est ANNULÉ si le jeune a déjà accepté (dans l'écran de la carte, par exemple) ;
--  · jeune qui a RETIRÉ son opt-in : une seule demande après le retrait, tous partenaires confondus ;
--  · « Accepter » → accepter_visibilite_partenaire() : set_my_partner_visibility (chemin
--    existant) ; sous 14 ans, la demande part au parent (parent_notifications) au lieu d'activer.
--  · la demande se règle seule : ACCEPTEE à l'activation (paramètres, parent, carte), CADUQUE si
--    la carte disparaît sans activation.
--
-- Rollback : supabase/rollback/20261016170000_rollback_cote_partenaire_carte_mes_athletes.sql

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null
     or to_regprocedure('public.accepter_visibilite_partenaire(uuid,text)') is not null then
    raise exception 'NEXUS: lot 20261016170000 déjà appliqué';
  end if;
  -- Chaque objet redéfini ou dont on dépend doit être EXACTEMENT celui relevé (local = prod,
  -- 2026-10-16 ; empreinte du corps sans retours chariot : la prod garde des CRLF).
  if exists (
    select 1
      from (values
        ('public.partenaire_mes_athletes()', '71a92e788d13bc85ee8d9d9baa675e30'),
        ('public.evaluations_partenaires_athlete(uuid)', '33d0544f27a8b62fa9e21902f2e62310'),
        ('public.badges_partenaires_athlete(uuid)', '6baa5e2d5c2f219a0bd1baac97f99e72'),
        ('public.partenaire_badges_nexus_admissibles(uuid)', 'd55783f816d54757ee2e18c94e7d3757'),
        ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '957289faec17d8e027681a155ba80bc7'),
        ('public.push_textes(text,text,integer,text)', 'd8b270c9d129866b636e4d9ee1bbe8a3'),
        ('public.push_traiter_file(timestamptz)', '8e7bfc261e8041074486d5395f17b198'),
        ('public.set_my_partner_visibility(boolean,text)', '8c48d5b5e480a9690770678308aab5ba'),
        ('public.emit_parent_notification(uuid,text,text,text,jsonb)', 'fb08a829e1d2fcf0d0983eeaa50f98ec'),
        ('public.is_partner_eligible_athlete(uuid)', '1a196afeb23165c25ac7ac9dcc7855ad')
      ) as v(f, attendu)
     where (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure(v.f)) is distinct from v.attendu)
  then
    raise exception 'NEXUS: une fonction ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'athlete_notifications_type_check')
       is distinct from 'f7c3e05c8d78780c77afe27967fedb61'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'parent_notifications_type_check')
       is distinct from '521852a6656bff4344aae982c7623209'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'push_file_genre_check')
       is distinct from '2e673d7536774b4c181d9897db778521' then
    raise exception 'NEXUS: contraintes de type des notifications / de la file ≠ relevé';
  end if;
end $$;

-- ═══ A. Cartes et « Mes athlètes » ══════════════════════════════════════════

-- A1. Cotes partenaires d'un lot d'athlètes (délégation pure à W2, donc à B1).
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

-- A2. « Mes athlètes » : la position et la référence des badges.
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

-- ═══ B. Loi 25 : rien du partenaire sans opt-in actif, sauf pour l'admin ═════
-- CREATE OR REPLACE, signatures et RETURNS inchangés : l'ACL est conservée (comparée en fin de lot).

-- B1. Évaluations partenaires (fiche ; et le lot A1 par délégation).
CREATE OR REPLACE FUNCTION public.evaluations_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, organisation text, cote_globale numeric, leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer, competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer, vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric, agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric, grille_id uuid, updated_at timestamp with time zone, est_la_mienne boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select (
         public.is_admin()
      or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
      or public.coach_can_read_athlete_evals(p_athlete_id)
      or public.is_director_of_athlete_school(p_athlete_id)
      or exists (select 1 from public.athletes a
                  where a.id = p_athlete_id and a.user_id = auth.uid())
    ) as tout,
    public.is_admin() as admin,
    -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
    coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible
  )
  select pe.id, mp.organization_name, pe.cote_globale,
         pe.leadership, pe.discipline, pe.coachabilite, pe.intelligence_jeu,
         pe.competitivite, pe.esprit_equipe, pe.resilience, pe.attitude_mentalite,
         pe.vitesse_explosivite, pe.force_puissance, pe.endurance_cardio,
         pe.agilite_coordination, pe.vision_du_jeu, pe.sens_tactique,
         pe.grille_id, pe.updated_at,
         (mp.user_id is not distinct from auth.uid())
    from public.partner_evaluations pe
    join public.media_partners mp on mp.id = pe.partner_id and mp.status = 'APPROVED'
    cross join lecteur
   where pe.athlete_id = p_athlete_id
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (lecteur.admin or lecteur.admissible)
   order by pe.updated_at desc
$function$;

-- B2. Badges partenaire sur la fiche.
CREATE OR REPLACE FUNCTION public.badges_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, badge_id uuid, libelle text, icone_path text, organisation text, created_at timestamp with time zone, est_masque boolean, est_le_mien boolean, peut_masquer boolean, badge_code text, est_nexus boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout,
      -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
      coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) as admissible
  )
  select x.id, coalesce(b.id, n.id), coalesce(b.libelle, n.libelle), b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach),
         n.code,
         (n.id is not null)
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id and mp.status = 'APPROVED'
    left join public.partner_badges b on b.id = x.partner_badge_id
    left join public.badges n on n.id = x.badge_id
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and (b.actif or n.actif)
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
     and (lecteur.admin or lecteur.admissible)
   order by x.created_at
$function$;

-- B3. Badges Nexus admissibles (portail partenaire) : nommait le partenaire d'un badge déjà posé.
CREATE OR REPLACE FUNCTION public.partenaire_badges_nexus_admissibles(p_athlete_id uuid)
 RETURNS TABLE(badge_id uuid, code text, libelle text, famille text, deja_par text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_sport  uuid;
  v_mp     uuid;
begin
  select a.sport_id into v_sport from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    select mp.id into v_mp from public.media_partners mp where mp.user_id = auth.uid();
    if v_mp is null or not public.partenaire_peut_evaluer(v_mp, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;
  -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
  if not public.is_admin() and not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  return query
  select b.id, b.code, b.libelle, b.famille,
         case
           when exists (select 1 from public.athlete_badges ab
                         where ab.athlete_id = p_athlete_id and ab.badge_id = b.id and ab.retire_le is null)
             then 'son coach'
           else (select coalesce(mp.organization_name, 'un partenaire')
                   from public.partner_athlete_badges x
                   join public.media_partners mp on mp.id = x.partner_id
                  where x.athlete_id = p_athlete_id and x.badge_id = b.id and x.retire_le is null
                  limit 1)
         end
    from public.badges b
   where b.actif
     and b.famille in ('universel', 'sport')
     and not b.requiert_contexte
     and (b.famille = 'universel'
          or exists (select 1 from public.badge_sports bs where bs.badge_id = b.id and bs.sport_id = v_sport))
   order by case b.famille when 'universel' then 0 else 1 end, b.ordre, b.libelle;
end $function$;

-- B4. Recherche recruteur : la ligne partenaire du LATERAL exige l'opt-in actif. cote_partenaire,
--     le filtre « 4+ étoiles » et le tri lisent cette même ligne. La plus récente (règle confirmée
--     par BP), départagée par l'identifiant à date égale — comme le client (retenirCotePartenaire).
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

-- ═══ C. Demande de visibilité au jeune ══════════════════════════════════════

-- C1. Types de notification : jeune et parent (listes complètes, l'ancienne + un).
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE', 'PARTENAIRE_VISIBILITE_DEMANDE']::text[]));
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED', 'CHILD_PARTNER_VISIBILITY_REQUEST']::text[]));
alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE', 'VISIBILITE_PARTENAIRE']::text[]));

-- C2. Le texte du push (une seule source, jamais de cote ni de badge).
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
$function$;

-- C3. La file : un push de demande ne part pas si la demande n'attend plus le jeune.
CREATE OR REPLACE FUNCTION public.push_traiter_file(p_maintenant timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Demande de visibilité qui n'attend plus le jeune (acceptée, au parent, caduque) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'VISIBILITE_PARTENAIRE'
     and not exists (
       select 1 from public.athlete_notifications n
        where n.id::text = f.detail->>'notification_id'
          and n.metadata->>'etat' = 'EN_ATTENTE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi)
                || public.push_destination(g.genre),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$function$;

-- C4. Naissance d'une demande, pour une carte qui attend l'opt-in du jeune.
create function public.partenaire_demander_visibilite(p_carte uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_ath   public.athletes%rowtype;
  v_org   text;
  v_notif uuid;
  v_titre text;
  v_texte constant text := 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.';
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte;
  if not found or v_carte.statut <> 'CONFIRMEE_ATTENTE_OPTIN' or v_carte.reservee_athlete is null then
    return null;
  end if;
  -- Rien à rendre visible : pas de demande.
  if v_carte.cote_globale is null
     and coalesce(cardinality(v_carte.badges_partenaire), 0) + coalesce(cardinality(v_carte.badges_nexus), 0) = 0 then
    return null;
  end if;
  select * into v_ath from public.athletes where id = v_carte.reservee_athlete;
  if not found or coalesce(public.is_partner_eligible_athlete(v_ath.id), false) then
    return null;
  end if;
  select organization_name into v_org from public.media_partners where id = v_carte.partner_id;
  v_titre := coalesce(nullif(btrim(v_org), ''), 'Un partenaire') || ' t''a évalué.';

  -- Une seule demande ouverte par (jeune, partenaire) : la nouvelle carte s'y ajoute.
  update public.athlete_notifications n
     set metadata = jsonb_set(n.metadata, '{cartes}',
                              (n.metadata->'cartes') || jsonb_build_array(p_carte::text))
   where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and n.metadata->>'partner_id' = v_carte.partner_id::text
     and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
     and not (n.metadata->'cartes') ? p_carte::text
  returning n.id into v_notif;
  if v_notif is not null
     or exists (select 1 from public.athlete_notifications n
                 where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                   and n.metadata->>'partner_id' = v_carte.partner_id::text
                   and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')) then
    return v_notif;
  end if;

  -- A RETIRÉ son opt-in (il l'a déjà eu : la date d'activation reste après un retrait) : une seule
  -- demande après le retrait, tous partenaires confondus. Une demande née après la dernière
  -- activation est forcément née après le retrait (entre les deux, le jeune était visible).
  if v_ath.partner_visibility_opted_in_at is not null
     and exists (select 1 from public.athlete_notifications n
                  where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                    and n.created_at >= v_ath.partner_visibility_opted_in_at) then
    return null;
  end if;

  -- Pas de doublon avec W4 : la proposition « C'est toi ? » de cette carte devient la demande.
  update public.athlete_notifications n
     set type = 'PARTENAIRE_VISIBILITE_DEMANDE', title = v_titre, message = v_texte, read = false,
         metadata = n.metadata || jsonb_build_object(
           'partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
           'etat', 'EN_ATTENTE', 'depuis_proposition', true)
   where n.id = (select n2.id from public.athlete_notifications n2
                  where n2.athlete_id = v_ath.id and n2.type = 'PARTENAIRE_EVALUATION'
                    and n2.metadata->>'carte_id' = p_carte::text
                  order by n2.created_at desc limit 1)
  returning n.id into v_notif;
  if v_notif is null then
    insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
    values (v_ath.id, 'PARTENAIRE_VISIBILITE_DEMANDE', v_titre, v_texte,
            jsonb_build_object('partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
                               'etat', 'EN_ATTENTE'))
    returning id into v_notif;
  end if;

  perform public.push_mettre_en_file(v_ath.id, 'CARTES_PARTENAIRES', 'VISIBILITE_PARTENAIRE',
            'visibilite:' || v_carte.partner_id, v_org,
            jsonb_build_object('cloche', false, 'notification_id', v_notif));
  return v_notif;
end $$;

comment on function public.partenaire_demander_visibilite(uuid) is
  'Demande de visibilité au jeune pour une carte qui attend son opt-in : une par (jeune, partenaire), une seule après un retrait, convertit la proposition W4. Interne.';

-- C5. Une demande se règle : ACCEPTEE si le jeune est devenu visible, sinon CADUQUE quand plus
--     aucune de ses cartes n'attend.
create function public.partenaire_regler_demandes_visibilite(p_athlete uuid)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if coalesce(public.is_partner_eligible_athlete(p_athlete), false) then
    update public.athlete_notifications
       set metadata = metadata || jsonb_build_object('etat', 'ACCEPTEE', 'reglee_le', now()), read = true
     where athlete_id = p_athlete and type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT');
  else
    update public.athlete_notifications n
       set metadata = n.metadata || jsonb_build_object('etat', 'CADUQUE', 'reglee_le', now())
     where n.athlete_id = p_athlete and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
       and not exists (select 1 from public.partenaire_prospects c
                        where c.reservee_athlete = p_athlete and c.statut = 'CONFIRMEE_ATTENTE_OPTIN'
                          and (n.metadata->'cartes') ? c.id::text);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- C6. Triggers : ils ne bloquent JAMAIS l'écriture qui les déclenche.
create function public.trg_partenaire_demande_sur_carte()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    if tg_op = 'UPDATE' and new.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.statut is distinct from new.statut then
      perform public.partenaire_demander_visibilite(new.id);
    elsif old.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.reservee_athlete is not null
          and (tg_op = 'DELETE' or new.statut is distinct from old.statut) then
      perform public.partenaire_regler_demandes_visibilite(old.reservee_athlete);
    end if;
  exception when others then
    raise warning 'trg_partenaire_demande_sur_carte: carte % — %', coalesce(new.id, old.id), sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_carte
after update of statut or delete on public.partenaire_prospects
for each row execute function public.trg_partenaire_demande_sur_carte();

create function public.trg_partenaire_demande_sur_optin()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    perform public.partenaire_regler_demandes_visibilite(new.id);
  exception when others then
    raise warning 'trg_partenaire_demande_sur_optin: athlète % — %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_optin
after update of partner_visibility_opt_in, partner_visibility_parental_consent on public.athletes
for each row
when (old.partner_visibility_opt_in is distinct from new.partner_visibility_opt_in
      or old.partner_visibility_parental_consent is distinct from new.partner_visibility_parental_consent)
execute function public.trg_partenaire_demande_sur_optin();

-- C7. « Accepter » : le chemin existant (set_my_partner_visibility) ; sous 14 ans, la demande part
--     au parent lié (portail parent) au lieu d'activer. Jamais la cote ni les badges au parent.
create function public.accepter_visibilite_partenaire(p_notification uuid, p_policy_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_notif public.athlete_notifications%rowtype;
  v_ath   public.athletes%rowtype;
  v_res   jsonb;
  v_org   text;
begin
  select n.* into v_notif
    from public.athlete_notifications n join public.athletes a on a.id = n.athlete_id
   where n.id = p_notification and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and a.user_id = auth.uid() and auth.uid() is not null
   for update of n;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'introuvable');
  end if;
  if v_notif.metadata->>'etat' is distinct from 'EN_ATTENTE' then
    return jsonb_build_object('ok', false, 'reason', 'deja_traitee', 'etat', v_notif.metadata->>'etat');
  end if;
  select * into v_ath from public.athletes where id = v_notif.athlete_id;

  v_res := public.set_my_partner_visibility(true, p_policy_version);
  if coalesce((v_res->>'ok')::boolean, false) then
    perform public.partenaire_regler_demandes_visibilite(v_ath.id);
    return jsonb_build_object('ok', true, 'etat', 'ACCEPTEE');
  end if;
  if v_res->>'reason' is distinct from 'parent_required' then
    return v_res;
  end if;

  if not exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_ath.id) then
    return jsonb_build_object('ok', false, 'reason', 'parent_absent');
  end if;
  select organization_name into v_org from public.media_partners where id::text = v_notif.metadata->>'partner_id';
  if not exists (select 1 from public.parent_notifications pn
                  where pn.athlete_id = v_ath.id and pn.type = 'CHILD_PARTNER_VISIBILITY_REQUEST' and not pn.read) then
    perform public.emit_parent_notification(
      v_ath.id, 'CHILD_PARTNER_VISIBILITY_REQUEST', 'Demande de visibilité partenaires',
      coalesce(nullif(btrim(v_ath.first_name), ''), 'Votre enfant') || ' aimerait être visible des partenaires de Nexus ('
        || coalesce(nullif(btrim(v_org), ''), 'un partenaire') || ' l''a évalué). Votre accord est requis : rendez-vous dans Consentements.',
      jsonb_build_object('athlete_id', v_ath.id, 'route', '/parent/consentements'));
  end if;
  update public.athlete_notifications
     set metadata = metadata || jsonb_build_object('etat', 'DEMANDE_PARENT', 'reglee_le', now()), read = true
   where id = v_notif.id;
  return jsonb_build_object('ok', true, 'etat', 'DEMANDE_PARENT');
end $$;

comment on function public.accepter_visibilite_partenaire(uuid, text) is
  'Bouton « Accepter » d''une demande de visibilité : set_my_partner_visibility(true) ; sous 14 ans, demande au parent lié (parent_notifications).';

-- C8. Droits.
revoke all on function public.partenaire_demander_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_regler_demandes_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_carte() from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_optin() from public, anon, authenticated;
revoke all on function public.accepter_visibilite_partenaire(uuid, text) from public, anon, authenticated;
grant execute on function public.partenaire_demander_visibilite(uuid) to service_role;
grant execute on function public.partenaire_regler_demandes_visibilite(uuid) to service_role;
grant execute on function public.accepter_visibilite_partenaire(uuid, text) to authenticated, service_role;

-- C9. Les cartes qui attendent déjà (prod au 2026-10-16 : aucune).
select public.partenaire_demander_visibilite(c.id)
  from public.partenaire_prospects c where c.statut = 'CONFIRMEE_ATTENTE_OPTIN';

-- ═══ Gardes finales : ACL comparées EN ENTIER, signatures uniques ════════════
do $$
declare
  r    record;
  vus  text[];
begin
  for r in select * from (values
      ('public.cotes_partenaires_athletes(uuid[])', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_mes_athletes()', array['authenticated', 'postgres', 'service_role']),
      ('public.evaluations_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.badges_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_badges_nexus_admissibles(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', array['authenticated', 'postgres', 'service_role']),
      ('public.push_textes(text,text,integer,text)', array['postgres', 'service_role']),
      ('public.push_traiter_file(timestamptz)', array['postgres', 'service_role']),
      ('public.partenaire_demander_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.partenaire_regler_demandes_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_carte()', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_optin()', array['postgres', 'service_role']),
      ('public.accepter_visibilite_partenaire(uuid,text)', array['authenticated', 'postgres', 'service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = to_regprocedure(r.f);
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'recruiter_search_athletes',
                        'evaluations_partenaires_athlete', 'badges_partenaires_athlete', 'accepter_visibilite_partenaire')) <> 6 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS lot 20261016170000 : cartes, Loi 25, demande de visibilité — fonctions et ACL exactes — OK';
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
     is distinct from '1ee801ea4be50260434b4a198ff4fd2d' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || replace(p.prosrc, E'\r', '')
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'evaluations_partenaires_athlete',
                       'badges_partenaires_athlete', 'partenaire_badges_nexus_admissibles', 'recruiter_search_athletes',
                       'push_textes', 'push_traiter_file', 'partenaire_demander_visibilite',
                       'partenaire_regler_demandes_visibilite', 'trg_partenaire_demande_sur_carte',
                       'trg_partenaire_demande_sur_optin', 'accepter_visibilite_partenaire', 'partenaire_voit_athlete')
  union all
  select 'ck:' || conname || '|' || pg_get_constraintdef(oid)
    from pg_constraint
   where conname in ('athlete_notifications_type_check', 'parent_notifications_type_check', 'push_file_genre_check')
  union all
  select 'tg:' || tgrelid::regclass::text || '|' || pg_get_triggerdef(oid)
    from pg_trigger
   where not tgisinternal and tgname in ('trg_partenaire_demande_sur_carte', 'trg_partenaire_demande_sur_optin')
) t
  ) e;
  if v_empreinte is distinct from '386e556c5e11b483441b9063f694dae8' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners)
       || '|' || (select count(*) from public.athletes where partner_visibility_opt_in)
       || '|' || (select count(*) from public.partenaire_prospects) <> (select donnees from _cote_releve) then
    raise exception 'NEXUS LOT: une donnée partenaire a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _cote_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_badges) || '|' || (select count(*) from public.media_partners)
       || '|' || (select count(*) from public.athletes where partner_visibility_opt_in)
       || '|' || (select count(*) from public.partenaire_prospects),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016170000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016170000'),
     'demandes_creees|cartes_en_attente', (select count(*) from public.athlete_notifications where type = 'PARTENAIRE_VISIBILITE_DEMANDE')
       || '|' || (select count(*) from public.partenaire_prospects where statut = 'CONFIRMEE_ATTENTE_OPTIN'),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                    and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'accepter_visibilite_partenaire',
                                    'partenaire_demander_visibilite', 'partenaire_regler_demandes_visibilite')),
     'meme_transaction', (select txid from _cote_releve) = txid_current())
) as resultat_lot_cote_partenaire;
