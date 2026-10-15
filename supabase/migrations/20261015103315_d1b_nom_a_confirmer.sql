-- D1b — Fiches athlètes sans nom, et nom copié de Google À CONFIRMER (base). Décisions BP 2026-10-15.
--
-- Diagnostic : 9 fiches en prod sans prénom ni nom. Toutes : connexion Google + inscription dans
-- l'appli. Google ne fournit que full_name ; handle_new_auth_user ne lit que first_name/last_name ;
-- l'inscription de l'appli ne demande pas le nom et recopie celui du compte (vide).
--
--  · users.nom_a_confirmer / athletes.nom_a_confirmer : le drapeau « nom à confirmer ».
--  · trg_users_nom_google (BEFORE INSERT sur users) : compte Google sans prénom ni nom → le nom
--    complet est coupé (premier mot = prénom, le reste = nom) et marqué À CONFIRMER. Jamais
--    d'écrasement d'un nom déjà présent. handle_new_auth_user n'est PAS redéfinie. L'appli déjà
--    publiée recopie le nom du compte dans la fiche : elle reçoit donc ce nom, sans build.
--  · trg_athletes_nom_a_confirmer (BEFORE INSERT/UPDATE sur athletes) :
--      - une fiche créée avec le nom à confirmer de son compte est marquée à confirmer ;
--      - toute MODIFICATION du prénom ou du nom par l'athlète lui-même confirme (c'est la
--        confirmation de l'appli publiée) ; réenregistrer le même nom ne confirme pas ;
--      - le drapeau ne se change pas à la main (ni coach, ni athlète, ni admin par l'API) :
--        seuls ce trigger et confirmer_mon_nom() le font.
--  · mon_nom_a_confirmer() / confirmer_mon_nom() : le bandeau web « Est-ce bien toi : X Y ? ».
--    La proposition pour une fiche sans nom vient du compte, sinon du nom complet Google du
--    compte de l'APPELANT (jamais d'un autre).
--  · recruiter_search_athletes : une fiche sans prénom, sans nom ou au nom à confirmer est
--    retirée de la recherche recruteur (web ET appli publiée : même fonction). Même signature,
--    CREATE OR REPLACE : l'ACL est conservée, et comparée en entier à la fin.
-- Aucune fiche existante n'est modifiée ; les 9 fiches sans nom sont retirées de la recherche
-- par la règle « sans nom ».

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name in ('users', 'athletes') and column_name = 'nom_a_confirmer') then
    raise exception 'NEXUS: D1b déjà appliquée (nom_a_confirmer existe)';
  end if;
  -- La recherche recruteur doit être EXACTEMENT celle relevée en prod le 2026-10-15.
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure(
        'public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from 'c03ca63e3c48e323e09643e675d17939' then
    raise exception 'NEXUS: recruiter_search_athletes ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  -- handle_new_auth_user (non redéfinie ici) : le trigger D1b suppose qu'elle crée la ligne
  -- users depuis first_name/last_name SEULEMENT. Prod et local diffèrent par les commentaires
  -- (md5 90ddd9d5… en prod) : on vérifie le comportement, pas les octets.
  if (select position('full_name' in prosrc) > 0
             or position('INSERT INTO public.users' in prosrc) = 0
             or position('NEW.raw_user_meta_data->>''first_name''' in prosrc) = 0
        from pg_proc where oid = 'public.handle_new_auth_user()'::regprocedure) is distinct from false then
    raise exception 'NEXUS: handle_new_auth_user a changé (lit full_name, ou ne crée plus users) — revoir D1b';
  end if;
end $$;

-- ── Les drapeaux ─────────────────────────────────────────────────────────────

alter table public.users    add column nom_a_confirmer boolean not null default false;
alter table public.athletes add column nom_a_confirmer boolean not null default false;
comment on column public.users.nom_a_confirmer is
  'D1b — le prénom/nom de ce compte ont été coupés du nom complet Google, pas saisis : à confirmer par la personne.';
comment on column public.athletes.nom_a_confirmer is
  'D1b — nom recopié de Google, pas encore confirmé par l''athlète : la fiche est retirée des recherches recruteur et coach. Ne se change que par trg_athletes_nom_a_confirmer et confirmer_mon_nom().';

-- ── Couper un nom complet ────────────────────────────────────────────────────

create or replace function public.couper_nom_complet(p text)
returns table (prenom text, nom text)
language sql
immutable
set search_path = public
as $$
  select nullif(split_part(t, ' ', 1), ''),
         nullif(btrim(substr(t, length(split_part(t, ' ', 1)) + 1)), '')
    from (select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) as t) x;
$$;

-- ── Compte Google : recopier le nom complet, à confirmer ─────────────────────

create or replace function public.users_nom_google()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text;
  v_complet  text;
  v_prenom   text;
  v_nom      text;
begin
  -- Jamais d'écrasement : un prénom OU un nom présent laisse tout tel quel.
  if coalesce(btrim(new.first_name), '') <> '' or coalesce(btrim(new.last_name), '') <> '' then
    return new;
  end if;
  select u.raw_app_meta_data->>'provider',
         coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.raw_user_meta_data->>'name'), ''))
    into v_provider, v_complet
    from auth.users u where u.id = new.id;
  if v_provider is distinct from 'google' or v_complet is null then
    return new;
  end if;
  select c.prenom, c.nom into v_prenom, v_nom from public.couper_nom_complet(v_complet) c;
  new.first_name := v_prenom;
  new.last_name := v_nom;
  new.nom_a_confirmer := true;
  return new;
end;
$$;

create trigger trg_users_nom_google
  before insert on public.users
  for each row execute function public.users_nom_google();

-- ── Fiche athlète : marquer, confirmer, verrouiller le drapeau ───────────────

create or replace function public.athletes_nom_a_confirmer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmation boolean := coalesce(current_setting('nexus.confirmer_nom', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    -- Fiche créée avec le nom À CONFIRMER de son compte (l'appli le recopie tel quel).
    new.nom_a_confirmer := exists (
      select 1 from public.users u
       where u.id = new.user_id and u.nom_a_confirmer
         and public.nexus_normaliser_nom(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''))
           = public.nexus_normaliser_nom(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')));
    return new;
  end if;

  -- Le drapeau ne se pose ni ne se lève à la main.
  new.nom_a_confirmer := old.nom_a_confirmer;
  if not old.nom_a_confirmer then
    return new;
  end if;
  -- Confirmation : confirmer_mon_nom(), ou une vraie modification du nom par l'athlète lui-même.
  if v_confirmation
     or (auth.uid() is not null and auth.uid() = new.user_id
         and (old.first_name is distinct from new.first_name or old.last_name is distinct from new.last_name)) then
    new.nom_a_confirmer := false;
    update public.users set nom_a_confirmer = false where id = new.user_id and nom_a_confirmer;
  end if;
  return new;
end;
$$;

create trigger trg_athletes_nom_a_confirmer
  before insert or update on public.athletes
  for each row execute function public.athletes_nom_a_confirmer();

-- ── Le bandeau web : « Est-ce bien toi : X Y ? » ─────────────────────────────

create or replace function public.mon_nom_a_confirmer()
returns table (etat text, prenom text, nom text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a     record;
  u     record;
  c     record;
begin
  if v_uid is null then return; end if;
  select id, first_name, last_name, nom_a_confirmer into a
    from public.athletes where user_id = v_uid and status <> 'SUPPRIME'::public.account_status
   order by created_at desc limit 1;
  if a.id is null then return; end if;
  if coalesce(btrim(a.first_name), '') <> '' and coalesce(btrim(a.last_name), '') <> '' then
    if a.nom_a_confirmer then
      return query select 'A_CONFIRMER'::text, a.first_name, a.last_name;
    end if;
    return;
  end if;
  -- Fiche sans nom : proposer le nom du compte, sinon le nom complet Google de l'APPELANT.
  select first_name, last_name into u from public.users where id = v_uid;
  if coalesce(btrim(u.first_name), '') <> '' then
    return query select 'MANQUANT'::text, u.first_name, u.last_name;
    return;
  end if;
  select x.prenom, x.nom into c
    from auth.users au, public.couper_nom_complet(coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name')) x
   where au.id = v_uid;
  return query select 'MANQUANT'::text, c.prenom, c.nom;
end;
$$;

create or replace function public.confirmer_mon_nom(p_prenom text, p_nom text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null or coalesce(btrim(p_prenom), '') = '' or coalesce(btrim(p_nom), '') = '' then
    raise exception 'NEXUS: prénom et nom obligatoires';
  end if;
  select id into v_id from public.athletes
   where user_id = v_uid and status <> 'SUPPRIME'::public.account_status
   order by created_at desc limit 1;
  if v_id is null then
    raise exception 'NEXUS: aucune fiche athlète pour ce compte';
  end if;
  perform set_config('nexus.confirmer_nom', 'on', true);
  update public.athletes set first_name = btrim(p_prenom), last_name = btrim(p_nom) where id = v_id;
  perform set_config('nexus.confirmer_nom', '', true);
  update public.users set first_name = btrim(p_prenom), last_name = btrim(p_nom), nom_a_confirmer = false
   where id = v_uid;
  return true;
end;
$$;

-- ── Recherche recruteur : sans nom ou nom à confirmer → hors de la recherche ──
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
     ORDER BY pev.updated_at DESC
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

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.couper_nom_complet(text) from public, anon, authenticated;
revoke all on function public.users_nom_google() from public, anon, authenticated;
revoke all on function public.athletes_nom_a_confirmer() from public, anon, authenticated;
revoke all on function public.mon_nom_a_confirmer() from public, anon, authenticated;
revoke all on function public.confirmer_mon_nom(text, text) from public, anon, authenticated;
grant execute on function public.mon_nom_a_confirmer() to authenticated;
grant execute on function public.confirmer_mon_nom(text, text) to authenticated;

-- ── Garde finale : ACL comparées EN ENTIER (règle du 2026-09-07) ─────────────

do $$
declare
  r record;
  vus text[];
  veut text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('couper_nom_complet', 'users_nom_google', 'athletes_nom_a_confirmer',
                                'mon_nom_a_confirmer', 'confirmer_mon_nom', 'recruiter_search_athletes')
  loop
    veut := case when r.proname in ('mon_nom_a_confirmer', 'confirmer_mon_nom', 'recruiter_search_athletes')
                 then array['authenticated', 'postgres', 'service_role']
                 else array['postgres', 'service_role'] end;
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.proname, vus, veut;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('couper_nom_complet', 'users_nom_google', 'athletes_nom_a_confirmer',
                        'mon_nom_a_confirmer', 'confirmer_mon_nom', 'recruiter_search_athletes')) <> 6 then
    raise exception 'NEXUS: 6 fonctions D1b attendues (une seule recruiter_search_athletes)';
  end if;
  if (select count(*) from pg_trigger where tgname in ('trg_users_nom_google', 'trg_athletes_nom_a_confirmer')) <> 2 then
    raise exception 'NEXUS: triggers D1b absents';
  end if;
  if exists (select 1 from public.users where nom_a_confirmer) or exists (select 1 from public.athletes where nom_a_confirmer) then
    raise exception 'NEXUS: aucun compte ni aucune fiche existants ne doivent être marqués';
  end if;
  raise notice 'NEXUS D1b : drapeaux, recopie Google, confirmation, recherche recruteur filtrée, ACL exactes — OK';
end $$;
