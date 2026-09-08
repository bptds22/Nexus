-- 20260906120000_recruiter_search_athletes_division_ligue
--
-- ⚠ NON APPLIQUEE. Presentee a BP le 2026-09-06, revue le 2026-09-07 (4e
-- colonne, team_school_type). En attente de son GO.
-- Au moment de l'apply : renommer le fichier sur l'horodatage assigne par MCP
-- (apply_migration pose le sien), puis verifier en lecture seule.
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Lot 3 du chantier « facettes Division + Ligue ». La recherche recruteur doit
-- pouvoir filtrer sur la DIVISION et la LIGUE de l'equipe de l'athlete, comme
-- le fait deja la page coach/directeur (Lot 2, aucune DDL — elle lit un embed
-- PostgREST).
--
-- La RPC ne les projette pas. Elle joint POURTANT deja l'equipe :
--     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
--     LEFT JOIN public.teams         tm ON tm.id = ta.team_id
-- et en tire `tm.gender` (colonne `team_gender`, le filtre « Genre d'equipe »).
-- Cette migration ajoute QUATRE colonnes autour de cette jointure. Aucune
-- table, aucune colonne, aucun index, aucune policy ne bouge.
--
-- ── CE QUI CHANGE, EXACTEMENT ────────────────────────────────────────────────
--   + team_division  text     -> tm.division, BRUT (normalise cote lecture)
--   + team_league    text     -> tm.league,   BRUT (idem)
--   + team_is_rseq   boolean  -> (tm.rseq_team_id IS NOT NULL)
--   + team_school_type text   -> tsc.type, via un LEFT JOIN schools SUR L'EQUIPE
-- 34 colonnes projetees -> 38.
-- (Compte VERIFIE en base avant l'apply, pas a l'oeil : la premiere redaction
--  annoncait 33 -> 37, et le gate aurait fait echouer la migration.)
--
-- POURQUOI `team_school_type` — le 4e repli, arbitre le 2026-09-07 : « l'athlete
-- A une equipe + equipe d'ecole SECONDAIRE/CEGEP + ligue inconnue => RSEQ ».
-- Mesure en prod : sur 8 182 equipes rattachees a une ecole, ZERO joue dans une
-- ligue nommee qui ne soit pas RSEQ. Sans cette colonne le module ne peut pas
-- appliquer la regle : `team_division`, `team_league` et `team_is_rseq` valent
-- null/false AUSSI BIEN pour « equipe sans ligue » que pour « aucune equipe »,
-- et confondre les deux ferait INVENTER une ligue a 15 athletes sans equipe.
-- `teams.school_id` etant NOT NULL, une seule colonne porte les deux signaux :
-- non nulle <=> il y a une equipe, et sa valeur dit le type d'ecole.
--
-- ⚠ L'ECOLE DE L'EQUIPE, PAS CELLE DE L'ATHLETE. Les deux divergent deja en
-- prod (2 athletes au 2026-09-07 : school_id nul cote athlete, equipe rattachee
-- a un club civil). `a.school_id` / `sc.type`, deja projetes, ne sont donc PAS
-- un substitut — d'ou une jointure `schools` supplementaire, la cinquieme.
--
-- POURQUOI `team_is_rseq` ET PAS `rseq_team_id` : la page n'a aucun usage de
-- l'identifiant du pont, seulement de l'INFORMATION « cette equipe vient du
-- RSEQ ». Un booleen dit ca sans exporter une cle technique d'un systeme tiers.
--
-- POURQUOI LES VALEURS SONT BRUTES : la normalisation vit dans
-- `lib/config/team-taxonomy.ts` (arbitrage BP du 2026-09-05 — normalisation en
-- LECTURE, jamais en base). `teams.division` et `teams.league` font partie de
-- `teams_identity_unique`; les reecrire changerait l'identite d'une equipe.
-- La RPC projette donc ce qui existe, et le module decide de ce que ca veut
-- dire. Une seule regle, partagee par le coach et le recruteur.
--
-- POURQUOI AUCUN NOUVEAU PARAMETRE `p_division` / `p_league` : le filtrage
-- reste CLIENT, exactement comme le filtre « Genre d'equipe » qui projette
-- `team_gender` sans `p_gender`. Deux raisons : les valeurs demandent une
-- normalisation (D1 / « Division 1 », RSEQ tape / RSEQ ponte) qui n'a pas a
-- etre dupliquee en SQL, et un changement de filtre ne doit pas refaire un
-- aller-retour reseau — le cache de recherche reste stable.
--
-- ── LES QUATRE COLONNES SONT AJOUTEES EN FIN DE TABLE ────────────────────────
-- Volontairement, plutot qu'a cote de `team_gender` ou elles se liraient mieux.
-- Aucune position existante ne bouge : un appelant qui lirait par position (il
-- n'y en a pas — supabase-js rend des objets nommes) ne casse pas. C'est la
-- discipline expand : on ajoute a la fin, on ne deplace rien.
--
-- ── POURQUOI `DROP` PUIS `CREATE`, ET PAS `CREATE OR REPLACE` ────────────────
-- Postgres REFUSE de changer le type de retour d'une fonction avec
-- `CREATE OR REPLACE` (« cannot change return type of existing function »).
-- Ajouter une colonne a un RETURNS TABLE EST un changement de type de retour.
-- Le DROP est donc obligatoire, pas un raccourci.
--
-- CE QUE LE DROP EMPORTE, ET QU'IL FAUT REPOSER :
--   · les privileges. ACL relevee en prod le 2026-09-06 :
--       {postgres=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--     PUBLIC a ete REVOQUE — ne pas le laisser revenir par le defaut Postgres,
--     qui accorde EXECUTE a PUBLIC sur toute fonction creee.
--   · le COMMENT, repose a l'identique augmente de la mention du Lot 3.
-- Dependances verifiees : 0 (`pg_depend` deptype='n'). Une seule surcharge.
--
-- ⚠ FENETRE D'INDISPONIBILITE : entre le DROP et le CREATE, la fonction
-- n'existe pas. Les deux ordres partent dans la MEME transaction (apply_migration
-- en ouvre une), donc aucune session concurrente ne voit l'intervalle — elle
-- attend le COMMIT. La fenetre est verrouillee, pas ouverte.
--
-- ── CE QUI NE CHANGE PAS — verifie avant d'ecrire ────────────────────────────
--   · Le masquage Loi 25 / palier : `identity_visible` et les CASE sur
--     first_name / last_name / photo_url / numero_jersey sont repris MOT POUR
--     MOT. Division et ligue ne sont PAS de l'identite — c'est l'equipe, une
--     information partagee par tout un effectif, au meme titre que l'ecole, la
--     position ou le genre d'equipe. Elles restent donc HORS du masquage, et le
--     filtre fonctionne aussi en Free. Meme raisonnement que `team_gender`.
--   · Les deux oracles fermes pour les Free (recherche par nom neutralisee,
--     tri name_asc rabattu sur la cote) : inchanges.
--   · Le garde-fou « offert par mon cegep » et ses deux RAISE : inchanges,
--     prefixe « NEXUS: » compris.
--   · La signature d'appel : les 15 parametres, leurs noms, leur ordre et leurs
--     defauts sont identiques. Aucun appelant existant n'a a changer.
--   · Aucune duplication de ligne : `team_athletes` porte UNIQUE (athlete_id),
--     la jointure est 1:0..1. C'est la meme jointure qu'avant ; la cinquieme
--     jointure `schools` pend a `tm.school_id`, elle est 1:0..1 elle aussi
--     (`teams.school_id` est NOT NULL et `schools.id` est la PK).

drop function if exists public.recruiter_search_athletes(
  text, uuid, integer, boolean, boolean, numeric, numeric,
  boolean, boolean, boolean, boolean, text, integer, uuid[], boolean
);

create function public.recruiter_search_athletes(
  p_search                text    default null,
  p_sport_id              uuid    default null,
  p_promotion             integer default null,
  p_verified_only         boolean default false,
  p_with_video_only       boolean default false,
  p_min_gpa               numeric default null,
  p_min_rating            numeric default null,
  p_ouvert_demenager      boolean default false,
  p_ouvert_prive          boolean default false,
  p_ouvert_anglophone     boolean default false,
  p_new_only              boolean default false,
  p_sort_by               text    default 'rating_desc',
  p_limit                 integer default null,
  p_programme_ids         uuid[]  default null,
  p_offert_par_mon_cegep  boolean default false
)
returns table (
  id uuid, identity_visible boolean, first_name text, last_name text,
  photo_url text, numero_jersey text, age integer, annee_diplomation integer,
  verified boolean, last_profile_validation timestamptz, cote_globale numeric,
  profile_completion integer, taille_pieds integer, taille_pouces integer,
  poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb,
  recruitment_status text, statut_recrutement_override text,
  open_to_offers boolean, a_une_video boolean, context text,
  created_at timestamptz, sport_nom text, position_nom text,
  position_abbr text, school_id uuid, school_name text, school_region text,
  school_type text, committed_school_name text, evaluations jsonb,
  team_gender text, programmes jsonb,
  -- LOT 3 — division / ligue. Brutes : le sens est donne par team-taxonomy.ts.
  team_division text, team_league text, team_is_rseq boolean,
  -- 4e repli : type d'ecole de L'EQUIPE. Non nul <=> l'athlete A une equipe.
  team_school_type text
)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
DECLARE
  v_tier_ok boolean;
  v_search  text;
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- Deux oracles fermes pour les Free : le filtre par nom est
  -- neutralise, et le tri alphabetique rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assouplis. La vitrine sort de toute
  -- facon en tete du tri par cote ; rouvrir la recherche par nom pour
  -- un Free n'apporterait rien et rouvrirait une surface d'oracle.
  v_search := CASE WHEN v_tier_ok THEN NULLIF(btrim(COALESCE(p_search, '')), '') END;

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
    (a.video_faits_saillants_url IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
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
    tsc.type
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
  WHERE a.status = 'ACTIF'::public.account_status
    AND (v_search IS NULL
         OR a.first_name ILIKE '%' || v_search || '%'
         OR a.last_name  ILIKE '%' || v_search || '%')
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR a.video_faits_saillants_url IS NOT NULL)
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    AND (p_min_rating IS NULL OR a.cote_globale_entraineur >= p_min_rating)
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
    CASE WHEN v_sort = 'rating_desc' THEN a.cote_globale_entraineur END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN a.cote_globale_entraineur END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;

-- ── PRIVILEGES — reposes a l'identique de l'ACL relevee avant le DROP ────────
-- Le defaut Postgres accorde EXECUTE a PUBLIC sur toute fonction creee. L'ACL
-- d'origine ne contenait PAS PUBLIC : on le revoque explicitement.
revoke all on function public.recruiter_search_athletes(
  text, uuid, integer, boolean, boolean, numeric, numeric,
  boolean, boolean, boolean, boolean, text, integer, uuid[], boolean
) from public;

grant execute on function public.recruiter_search_athletes(
  text, uuid, integer, boolean, boolean, numeric, numeric,
  boolean, boolean, boolean, boolean, text, integer, uuid[], boolean
) to authenticated, service_role;

comment on function public.recruiter_search_athletes(
  text, uuid, integer, boolean, boolean, numeric, numeric,
  boolean, boolean, boolean, boolean, text, integer, uuid[], boolean
) is
$c$Recherche recruteur projetee. Loi 25 prime sur le tier. Ferme deux oracles pour les Free (filtre par nom neutralise, tri name_asc rabattu). T2 : filtre par programme CEGEP (p_programme_ids, p_offert_par_mon_cegep) + projection programmes — DELIBEREMENT NON gate par palier, le programme vise n'est pas de l'identite. Leve plutot que de rendre zero quand le cegep du recruteur n'a pas de catalogue. LOT 3 : projette team_division / team_league / team_is_rseq — valeurs BRUTES, normalisees en lecture par lib/config/team-taxonomy.ts (teams.division et teams.league appartiennent a teams_identity_unique, on ne les reecrit pas). Hors masquage identite, comme team_gender : c'est l'equipe, pas la personne.$c$;

-- ── GATE INTERNE — echoue la migration plutot que de laisser passer ──────────
do $$
declare
  n_out      int;
  manquantes text[];
  acl        text;
begin
  select count(*) into n_out
    from pg_proc pr, unnest(pr.proargmodes, pr.proargnames) as u(mode, nom)
   where pr.oid = 'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean)'::regprocedure
     and u.mode = 't';

  if n_out <> 38 then
    raise exception 'NEXUS: recruiter_search_athletes projette % colonnes, 38 attendues', n_out;
  end if;

  -- Les trois colonnes du lot, nommees exactement comme le client les lit.
  select array_agg(x.attendu order by x.attendu) into manquantes
    from unnest(array['team_division','team_league','team_is_rseq','team_school_type']) as x(attendu)
   where not exists (
     select 1 from pg_proc pr, unnest(pr.proargnames) as u(nom)
      where pr.oid = 'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean)'::regprocedure
        and u.nom = x.attendu);

  if manquantes is not null then
    raise exception 'NEXUS: colonnes du Lot 3 absentes de la projection : %', manquantes;
  end if;

  -- Le DROP emporte les privileges : verifier qu'ils sont bien reposes, et que
  -- PUBLIC n'est PAS revenu par le defaut Postgres.
  select coalesce(pr.proacl::text, '(defaut = PUBLIC ouvert)') into acl
    from pg_proc pr
   where pr.oid = 'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean)'::regprocedure;

  if acl not like '%authenticated=X%' or acl not like '%service_role=X%' then
    raise exception 'NEXUS: privileges non reposes apres le DROP — ACL = %', acl;
  end if;
  if acl like '%,=X%' or acl like '{=X%' then
    raise exception 'NEXUS: PUBLIC a repris EXECUTE — ACL = %', acl;
  end if;

  raise notice 'NEXUS: recruiter_search_athletes — 38 colonnes, Lot 3 en place, ACL conforme.';
end $$;
