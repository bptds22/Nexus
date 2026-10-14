-- W2 en prod par psql — GARDES + ENREGISTREMENT, dans LA MÊME transaction que
-- la migration (psql -1 -f <W2> -f <ce fichier>). Une garde qui échoue
-- (RAISE « NEXUS: ») annule TOUT : W2, l'historique et admin_operations.
-- Références = relevé avant pris en prod le 2026-10-14 (avant l'envoi MCP).
-- La chaîne dollar-quotée de _w2 (§3) est le fichier W2 copié OCTET POUR OCTET depuis
-- git show : ne pas éditer ce fichier à la main (le md5 de garde casserait).

-- ── 1. Objets W2 et ce que W2 ne doit jamais toucher ───────────────────────
do $$
declare
  v text;
  f regprocedure;
begin
  if to_regclass('public.partner_evaluations') is null then
    raise exception 'NEXUS: partner_evaluations absente';
  end if;
  if (select count(*) from public.partner_evaluations) <> 0 then
    raise exception 'NEXUS: partner_evaluations non vide';
  end if;
  if (select count(*) from public.media_partners where peut_evaluer) <> 0 then
    raise exception 'NEXUS: un partenaire a peut_evaluer = true';
  end if;

  select string_agg(md5(pg_get_functiondef(p.oid)), ',') into v
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes';
  if v is distinct from 'c15481a07a3b98e3ae72f8917763a45a' then
    raise exception 'NEXUS: md5 recruiter_search_athletes = %, attendu c15481a0… (relevé local)', v;
  end if;

  -- Droits d'exécution : liste COMPLÈTE, pas d'inclusion.
  foreach f in array array[
    'public.partenaire_evaluer_athlete(uuid, numeric, jsonb)'::regprocedure,
    'public.partenaire_evaluation_contexte(uuid)'::regprocedure,
    'public.evaluations_partenaires_athlete(uuid)'::regprocedure,
    'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean, boolean)'::regprocedure]
  loop
    select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
      into v from pg_proc p, lateral aclexplode(p.proacl) a where p.oid = f;
    if v is distinct from 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE' then
      raise exception 'NEXUS: droits % = %', f, v;
    end if;
  end loop;

  select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || cote_globale::text || updated_at::text, ',' order by id), ''))
    into v from public.evaluations;
  if v <> '14 0ac022c953c3572bba6e0c0027a314dd' then
    raise exception 'NEXUS: evaluations a bougé : %', v;
  end if;
  select md5(coalesce(string_agg(id::text || ':' || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id), ''))
    into v from public.athletes;
  if v <> 'acc167b4fa2d9f635a5fac8aedbdaeae' then
    raise exception 'NEXUS: cotes des coachs ont bougé : %', v;
  end if;
  if md5(pg_get_functiondef('public.calc_cote_globale()'::regprocedure)) <> '48b9ec8b4fa8b972dddd1247f9f72fbc' then
    raise exception 'NEXUS: calc_cote_globale a bougé';
  end if;
  if (select string_agg(tgname, ',' order by tgname) from pg_trigger
       where tgrelid = 'public.evaluations'::regclass and not tgisinternal)
     <> 'trg_coach_activity_badge,trg_coach_activity_badge_insert,trg_cote_globale,trg_evaluations_updated_at,trg_notify_evaluation_updated,trg_zz_preserve_updated_at'
     or (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal) <> 17 then
    raise exception 'NEXUS: triggers evaluations/athletes ont bougé';
  end if;
end $$;

-- ── 2. Les 8 recherches de référence du recruteur Pro, SANS le paramètre ───
-- Sous le vrai rôle authenticated, JWT simulé de 16809ad4 (Rémi Test).
select set_config('request.jwt.claims',
  json_build_object('sub', '16809ad4-565c-40ca-8a35-106c073e1e01', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  r record;
  v text;
begin
  for r in select * from (values
    ('',                                              '181 b35ffc53a0fd59a0065956c9a01c916d'),
    ('p_sort_by => ''rating_desc''',                  '181 b35ffc53a0fd59a0065956c9a01c916d'),
    ('p_sort_by => ''name_asc''',                     '181 49e807c6a22a709f6580d614c1d6ef67'),
    ('p_sort_by => ''grad_desc''',                    '181 e6655cd5e5bd6f361d64c6ffd489e15c'),
    ('p_min_rating => 1',                             '6 64c733e2609a4c0e45f925f53c5602ce'),
    ('p_min_rating => 3, p_sort_by => ''rating_asc''', '6 9a490d395e90756044dff18fc3304fa3'),
    ('p_min_rating => 4',                             '1 e2c22eac480ff88e8ec7f1717b83f532'),
    ('p_verified_only => true, p_min_rating => 4',    '1 e2c22eac480ff88e8ec7f1717b83f532')
  ) t(appel, attendu) loop
    execute format($q$select count(*)::text || ' ' || md5(coalesce(string_agg(
                        (to_jsonb(x) - 'cote_partenaire' - 'cote_partenaire_organisation')::text,
                        '|' order by x.ordinality), ''))
                      from public.recruiter_search_athletes(%s) with ordinality x$q$, r.appel)
      into v;
    if v is distinct from r.attendu then
      raise exception 'NEXUS: recherche (%) = %, attendu %', r.appel, v, r.attendu;
    end if;
  end loop;
end $$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ── 3. Enregistrement : historique des migrations + admin_operations ───────
-- statements = le fichier W2 tel que git show (fins de ligne Unix) ; son md5
-- est vérifié ici même : un fichier altéré annule tout.
create temp table _w2 on commit drop as
select to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS') as version,
       $w2$-- ═══════════════════════════════════════════════════════════════════════════
-- W2 — Évaluation PARTENAIRE (« Évaluation de L'Esprit Sportif »).
--
-- Décisions BP (2026-10-13) :
--   · table SÉPARÉE partner_evaluations — une ligne par (partenaire, athlète),
--     modifiable par le partenaire. N'écrit JAMAIS dans evaluations ni dans
--     athletes.cote_globale_entraineur : le trigger calc_cote_globale (sur
--     evaluations) et la newsroom « 5★ » (sur athletes) restent hors d'atteinte.
--   · cote globale obligatoire ; 14 critères facultatifs, même grille par
--     position que le coach. Comme chez le coach (saveAthlete.ts), le DÉTAILLÉ
--     GAGNE : si un critère est noté, la cote est la moyenne des critères notés.
--   · écriture par RPC DEFINER seulement : partenaire_peut_evaluer() (W1) ET
--     is_partner_eligible_athlete() ET athlète ACTIF (le partenaire ne voit que
--     les ACTIF depuis W0 — on n'évalue pas une fiche qu'on ne peut pas lire).
--   · lecture par RPC seulement (aucune policy, aucun privilège direct) :
--     recruteur (athlète ACTIF, opt-in partenaire NON requis), coach / direction
--     de l'athlète, l'athlète lui-même, admin ; le partenaire lit LA SIENNE.
--     Seul le NOM DE L'ORGANISATION sort — jamais la personne (evalue_par).
--   · recherche recruteur : filtre « 4+ » et tri par cote = coach, sinon
--     partenaire — SEULEMENT si l'appelant envoie p_inclure_partenaires = true
--     (le web). Défaut false : les binaires mobiles déjà publiés, qui ne
--     l'envoient pas, gardent exactement le filtre et le tri d'avant W2 (cote
--     du coach seule). `cote_globale` garde son sens (coach seul). Le
--     partenaire sort dans deux colonnes à part (cote_partenaire,
--     cote_partenaire_organisation), ignorées par les vieux binaires.
--
-- Seuls les partenaires APPROVED sont lus : une organisation suspendue ou
-- révoquée cesse d'apparaître (ses lignes restent, rien n'est supprimé).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. La table ────────────────────────────────────────────────────────────
create table public.partner_evaluations (
  id                   uuid primary key default gen_random_uuid(),
  partner_id           uuid not null references public.media_partners(id) on delete cascade,
  athlete_id           uuid not null references public.athletes(id) on delete cascade,
  -- Trace interne (qui, des deux cellulaires du compte partagé, a saisi).
  -- JAMAIS projetée : l'évaluation est signée par l'organisation.
  evalue_par           uuid references public.users(id) on delete set null,
  cote_globale         numeric(3,2) not null check (cote_globale > 0 and cote_globale <= 5),
  leadership           integer check (leadership between 1 and 5),
  discipline           integer check (discipline between 1 and 5),
  coachabilite         integer check (coachabilite between 1 and 5),
  intelligence_jeu     integer check (intelligence_jeu between 1 and 5),
  competitivite        integer check (competitivite between 1 and 5),
  esprit_equipe        integer check (esprit_equipe between 1 and 5),
  resilience           integer check (resilience between 1 and 5),
  attitude_mentalite   integer check (attitude_mentalite between 1 and 5),
  vitesse_explosivite  numeric(3,1) check (vitesse_explosivite > 0 and vitesse_explosivite <= 5),
  force_puissance      numeric(3,1) check (force_puissance > 0 and force_puissance <= 5),
  endurance_cardio     numeric(3,1) check (endurance_cardio > 0 and endurance_cardio <= 5),
  agilite_coordination numeric(3,1) check (agilite_coordination > 0 and agilite_coordination <= 5),
  vision_du_jeu        numeric(3,1) check (vision_du_jeu > 0 and vision_du_jeu <= 5),
  sens_tactique        numeric(3,1) check (sens_tactique > 0 and sens_tactique <= 5),
  grille_id            uuid references public.evaluation_grilles(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint partner_evaluations_partenaire_athlete_key unique (partner_id, athlete_id)
);

comment on table public.partner_evaluations is
  'Évaluation partenaire (W2). Séparée de evaluations : ne touche jamais cote_globale_entraineur. Écriture/lecture par RPC seulement.';

create index partner_evaluations_athlete_idx on public.partner_evaluations (athlete_id);

alter table public.partner_evaluations enable row level security;
-- Aucune policy : tout passe par les fonctions ci-dessous.
revoke all on public.partner_evaluations from public, anon, authenticated;

-- ── 2. Écriture ────────────────────────────────────────────────────────────
-- p_traits : objet { colonne: valeur } ; une valeur null ou 0 = critère non noté.
-- Remplace la saisie précédente du partenaire (un critère absent redevient NULL).
create function public.partenaire_evaluer_athlete(
  p_athlete_id   uuid,
  p_cote_globale numeric,
  p_traits       jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_cols constant text[] := array[
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite',
    'vitesse_explosivite', 'force_puissance', 'endurance_cardio',
    'agilite_coordination', 'vision_du_jeu', 'sens_tactique'];
  -- Les 8 critères entiers (1 à 5), comme dans evaluations.
  v_entiers constant text[] := array[
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite'];
  v_partner uuid;
  v_sport   uuid;
  v_pos     uuid;
  v_status  public.account_status;
  v_k       text;
  v_val     jsonb;
  v_n       numeric;
  v_t       jsonb := '{}'::jsonb;
  v_sum     numeric := 0;
  v_cnt     int := 0;
  v_cote    numeric;
  v_grille  uuid;
  v_id      uuid;
begin
  select mp.id into v_partner from public.media_partners mp where mp.user_id = auth.uid();
  if v_partner is null then
    raise exception 'NEXUS: évaluation réservée aux partenaires' using errcode = '42501';
  end if;

  select a.sport_id, a.position_id, a.status into v_sport, v_pos, v_status
    from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if v_status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;
  if not public.partenaire_peut_evaluer(v_partner, v_sport) then
    raise exception 'NEXUS: évaluation non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
  end if;
  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  p_traits := coalesce(p_traits, '{}'::jsonb);
  if jsonb_typeof(p_traits) <> 'object' then
    raise exception 'NEXUS: p_traits doit être un objet' using errcode = '22023';
  end if;
  for v_k, v_val in select key, value from jsonb_each(p_traits) loop
    if not v_k = any (v_cols) then
      raise exception 'NEXUS: critère inconnu : %', v_k using errcode = '22023';
    end if;
    continue when v_val = 'null'::jsonb;
    if jsonb_typeof(v_val) <> 'number' then
      raise exception 'NEXUS: valeur non numérique pour %', v_k using errcode = '22023';
    end if;
    v_n := (v_val #>> '{}')::numeric;
    continue when v_n = 0;
    if v_k = any (v_entiers) and (v_n <> trunc(v_n) or v_n < 1 or v_n > 5) then
      raise exception 'NEXUS: % attend un entier de 1 à 5', v_k using errcode = '22023';
    end if;
    if v_n < 0 or v_n > 5 then
      raise exception 'NEXUS: % hors de l''échelle (0 à 5)', v_k using errcode = '22023';
    end if;
    v_t := v_t || jsonb_build_object(v_k, v_n);
    v_sum := v_sum + v_n;
    v_cnt := v_cnt + 1;
  end loop;

  -- Le détaillé gagne (miroir de saveAthlete.ts) ; sinon la cote saisie.
  if v_cnt > 0 then
    v_cote := round(v_sum / v_cnt, 1);
  else
    if p_cote_globale is null or p_cote_globale < 1 or p_cote_globale > 5 then
      raise exception 'NEXUS: cote globale obligatoire (1 à 5)' using errcode = '22023';
    end if;
    v_cote := round(p_cote_globale, 2);
  end if;

  -- Grille FIGÉE à la saisie, résolue côté serveur : position → GENERIQUE.
  select pg.grille_id into v_grille from public.position_grille pg where pg.position_id = v_pos;
  if v_grille is null then
    select g.id into v_grille from public.evaluation_grilles g where g.code = 'GENERIQUE';
  end if;

  insert into public.partner_evaluations as pe (
    partner_id, athlete_id, evalue_par, cote_globale,
    leadership, discipline, coachabilite, intelligence_jeu,
    competitivite, esprit_equipe, resilience, attitude_mentalite,
    vitesse_explosivite, force_puissance, endurance_cardio,
    agilite_coordination, vision_du_jeu, sens_tactique, grille_id)
  values (
    v_partner, p_athlete_id, auth.uid(), v_cote,
    (v_t->>'leadership')::int, (v_t->>'discipline')::int,
    (v_t->>'coachabilite')::int, (v_t->>'intelligence_jeu')::int,
    (v_t->>'competitivite')::int, (v_t->>'esprit_equipe')::int,
    (v_t->>'resilience')::int, (v_t->>'attitude_mentalite')::int,
    (v_t->>'vitesse_explosivite')::numeric, (v_t->>'force_puissance')::numeric,
    (v_t->>'endurance_cardio')::numeric, (v_t->>'agilite_coordination')::numeric,
    (v_t->>'vision_du_jeu')::numeric, (v_t->>'sens_tactique')::numeric,
    v_grille)
  on conflict (partner_id, athlete_id) do update set
    evalue_par = excluded.evalue_par,
    cote_globale = excluded.cote_globale,
    leadership = excluded.leadership, discipline = excluded.discipline,
    coachabilite = excluded.coachabilite, intelligence_jeu = excluded.intelligence_jeu,
    competitivite = excluded.competitivite, esprit_equipe = excluded.esprit_equipe,
    resilience = excluded.resilience, attitude_mentalite = excluded.attitude_mentalite,
    vitesse_explosivite = excluded.vitesse_explosivite, force_puissance = excluded.force_puissance,
    endurance_cardio = excluded.endurance_cardio, agilite_coordination = excluded.agilite_coordination,
    vision_du_jeu = excluded.vision_du_jeu, sens_tactique = excluded.sens_tactique,
    grille_id = excluded.grille_id,
    updated_at = now()
  returning pe.id into v_id;

  return v_id;
end;
$$;

comment on function public.partenaire_evaluer_athlete(uuid, numeric, jsonb) is
  'W2 : crée ou remplace l''évaluation du partenaire appelant. Garde : partenaire_peut_evaluer + is_partner_eligible_athlete + athlète ACTIF. N''écrit jamais evaluations / athletes.';

revoke all on function public.partenaire_evaluer_athlete(uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.partenaire_evaluer_athlete(uuid, numeric, jsonb) to authenticated, service_role;

-- ── 3. Contexte du bouton « Évaluer » (portail partenaire) ─────────────────
-- peut_evaluer : les mêmes gardes que l'écriture, pour n'afficher le bouton
-- que s'il aboutira. grille_id : la grille que l'écriture figera.
create function public.partenaire_evaluation_contexte(p_athlete_id uuid)
returns table (peut_evaluer boolean, grille_id uuid)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select
    coalesce(
      a.status = 'ACTIF'::public.account_status
      and public.partenaire_peut_evaluer(mp.id, a.sport_id)
      and public.is_partner_eligible_athlete(a.id),
      false),
    coalesce(
      (select pg.grille_id from public.position_grille pg where pg.position_id = a.position_id),
      (select g.id from public.evaluation_grilles g where g.code = 'GENERIQUE'))
  from public.athletes a
  left join public.media_partners mp on mp.user_id = auth.uid()
  where a.id = p_athlete_id
$$;

revoke all on function public.partenaire_evaluation_contexte(uuid) from public, anon, authenticated;
grant execute on function public.partenaire_evaluation_contexte(uuid) to authenticated, service_role;

-- ── 4. Lecture (section « Évaluation de <organisation> ») ──────────────────
create function public.evaluations_partenaires_athlete(p_athlete_id uuid)
returns table (
  id uuid, organisation text, cote_globale numeric,
  leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer,
  competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer,
  vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric,
  agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric,
  grille_id uuid, updated_at timestamptz, est_la_mienne boolean)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  with lecteur as (
    select (
         public.is_admin()
      or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
      or public.coach_can_read_athlete_evals(p_athlete_id)
      or public.is_director_of_athlete_school(p_athlete_id)
      or exists (select 1 from public.athletes a
                  where a.id = p_athlete_id and a.user_id = auth.uid())
    ) as tout
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
   order by pe.updated_at desc
$$;

comment on function public.evaluations_partenaires_athlete(uuid) is
  'W2 : évaluations partenaires d''un athlète. Recruteur (ACTIF, opt-in non requis), coach/direction, l''athlète, admin ; un partenaire ne lit que la sienne. Organisation seulement, jamais evalue_par.';

revoke all on function public.evaluations_partenaires_athlete(uuid) from public, anon, authenticated;
grant execute on function public.evaluations_partenaires_athlete(uuid) to authenticated, service_role;

-- ── 5. Recherche recruteur : DROP + CREATE (le RETURNS TABLE change) ───────
-- Corps relevé en local, IDENTIQUE à celui en place (sauf les ajouts W2
-- marqués « W2 »). L'ACL est reposée puis vérifiée par liste complète :
-- le CREATE réaccorde EXECUTE à anon via les default privileges.
-- Un 16e paramètre, p_inclure_partenaires DEFAULT false, en DERNIER : un appel
-- par noms qui ne l'envoie pas (binaires publiés) résout cette fonction, et
-- on supprime l'ancienne signature pour qu'aucune surcharge ne reste ambiguë.
drop function public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean);

CREATE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
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

comment on function public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean, boolean) is
  'Recherche recruteur. cote_globale = coach seul ; cote_partenaire(_organisation) = évaluation partenaire à part (W2). Filtre et tri par cote : coach seul par défaut ; coach, sinon partenaire, si p_inclure_partenaires (web).';

revoke all on function public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean, boolean) from public, anon, authenticated;
grant execute on function public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean, boolean) to authenticated, service_role;

-- ── Gates (comparaison complète, jamais par inclusion) ─────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  -- a. ACL des quatre fonctions.
  foreach f in array array[
    'public.partenaire_evaluer_athlete(uuid, numeric, jsonb)'::regprocedure,
    'public.partenaire_evaluation_contexte(uuid)'::regprocedure,
    'public.evaluations_partenaires_athlete(uuid)'::regprocedure,
    'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean, boolean)'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;

  -- a'. Une seule recruiter_search_athletes : pas de surcharge ambiguë.
  if (select count(*) from pg_proc where proname = 'recruiter_search_athletes'
         and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'NEXUS: plusieurs recruiter_search_athletes';
  end if;

  -- b. partner_evaluations : RLS active, aucune policy, aucun privilège direct.
  if not (select relrowsecurity from pg_class where oid = 'public.partner_evaluations'::regclass) then
    raise exception 'NEXUS: RLS inactive sur partner_evaluations';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'partner_evaluations') then
    raise exception 'NEXUS: policy inattendue sur partner_evaluations';
  end if;
  select array_agg(g.nom || ':' || a.privilege_type order by g.nom, a.privilege_type) into vus
    from pg_class c,
         lateral aclexplode(c.relacl) a,
         lateral (select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as nom) g
   where c.oid = 'public.partner_evaluations'::regclass
     and g.nom in ('anon', 'authenticated', 'PUBLIC');
  if vus is not null then
    raise exception 'NEXUS: privilèges directs sur partner_evaluations : %', vus;
  end if;

  -- c. Aucun trigger sur partner_evaluations (rien ne doit cascader vers
  --    evaluations / athletes).
  if exists (select 1 from pg_trigger where tgrelid = 'public.partner_evaluations'::regclass and not tgisinternal) then
    raise exception 'NEXUS: trigger inattendu sur partner_evaluations';
  end if;
end $$;
$w2$::text as contenu;

do $$
begin
  if (select md5(contenu) from _w2) <> 'e82b6d9467689300ca44e50aed91394a' then
    raise exception 'NEXUS: contenu W2 embarqué altéré (md5 %)', (select md5(contenu) from _w2);
  end if;
  if (select version from _w2) <= '20261014021124' then
    raise exception 'NEXUS: version W2 pas après W1';
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'w2_partner_evaluations', array[contenu], 'bptds22@gmail.com' from _w2;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_W2_PARTENAIRE_EVALUATEUR',
       'W2 Partenaire évaluateur : partner_evaluations + 3 RPC + recruiter_search_athletes(p_inclure_partenaires) (GO BP 2026-10-14)',
       jsonb_build_object(
         'nom', 'w2_partner_evaluations',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_w2_partner_evaluations.sql',
         'fichier_local', '20261014020100_w2_partner_evaluations.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_w2_partner_evaluations.sql',
         'voie', 'psql -1 (session pooler), le connecteur MCP échouant (requestState)',
         'md5_fichier', 'e82b6d9467689300ca44e50aed91394a',
         'md5_recruiter_search_athletes', jsonb_build_object('avant', '30b055c99102c77d5e48a34bf732c6ef', 'apres', 'c15481a07a3b98e3ae72f8917763a45a'),
         'acl_fonctions_w2', 'authenticated,postgres,service_role',
         'partner_evaluations_lignes', 0,
         'partenaires_peut_evaluer_true', 0,
         'recherches_reference_identiques', '8/8 (recruteur Pro 16809ad4, 181 lignes par défaut)'),
       'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'
  from _w2;

-- La version à retenir pour renommer le fichier.
select version as version_w2_enregistree from _w2;
