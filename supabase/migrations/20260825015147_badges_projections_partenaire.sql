-- ═══════════════════════════════════════════════════════════════
-- Accès partenaire aux badges — par les projections, PAS par une policy.
--
-- athlete_badges n'a VOLONTAIREMENT aucune branche partenaire dans sa policy
-- de lecture : les partenaires ne touchent jamais les tables en direct, ils
-- passent par des projections qui filtrent sur is_approved_partner ET
-- is_partner_eligible_athlete (opt-in + consentement parental). Ouvrir une
-- policy directe contournerait ce second filtre.
--
-- ── VÉRIFICATION DEMANDÉE SUR LA VUE ─────────────────────────────
-- top_athletes_view : reloptions = NULL relevé avant écriture. Elle n'a donc
-- NI security_invoker NI security_barrier — un CREATE OR REPLACE VIEW n'efface
-- ici rien du tout. C'est aussi ce qui explique qu'elle lise déjà evaluations
-- sans policy partenaire : sans security_invoker, une vue s'exécute avec les
-- droits de son propriétaire (postgres) et contourne RLS. Le même mécanisme
-- porte athlete_badges.
--
-- ── POURQUOI UNE COLONNE `badges` EN PLUS, ET NON À LA PLACE ─────
-- `distinctions` reste, inchangée. Y émettre les nouveaux codes ferait
-- disparaître TOUS les badges côté partenaire : le composant d'affichage
-- filtre sur un catalogue de 7 codes anciens et jette le reste. Les deux
-- colonnes coexistent le temps que la surface partenaire soit recâblée :
--   distinctions → 6 codes anciens, entretenue par le miroir (app 1.2, web)
--   badges       → les 22, vérité complète
-- ═══════════════════════════════════════════════════════════════

create or replace function public.badges_json(p_athlete_id uuid)
  returns jsonb language sql stable
  security definer set row_security to 'off' set search_path to 'public', 'pg_temp'
as $fn$
  select coalesce(jsonb_agg(x order by x.rang, x.ordre, x.created_at), '[]'::jsonb)
  from (
    select b.code, b.libelle, b.famille, ab.contexte, ab.created_at,
           case b.famille when 'honneur' then 0 when 'universel' then 1 else 2 end as rang,
           b.ordre
    from public.athlete_badges ab
    join public.badges b on b.id = ab.badge_id
    where ab.athlete_id = p_athlete_id and ab.retire_le is null
  ) x;
$fn$;

-- SECURITY DEFINER + row_security off = cette fonction voit TOUS les badges de
-- TOUT athlète. Elle n'est donc appelable par personne en direct : seules la
-- vue et la projection, qui s'exécutent avec les droits de postgres, y accèdent.
revoke all on function public.badges_json(uuid) from public, anon, authenticated;

-- ── 1. La vue ────────────────────────────────────────────────────
-- Colonnes existantes reproduites À L'IDENTIQUE (CREATE OR REPLACE VIEW
-- l'exige) ; `badges` ajoutée EN FIN, seule position autorisée.
create or replace view public.top_athletes_view as
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
    a.video_faits_saillants_url,
    a.video_match_complet_url,
    a.video_entrainement_url,
    a.genre,
    public.badges_json(a.id) AS badges
   FROM ((((athletes a
     LEFT JOIN sports s ON ((s.id = a.sport_id)))
     LEFT JOIN positions p ON ((p.id = a.position_id)))
     LEFT JOIN schools sch ON ((sch.id = a.school_id)))
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM evaluations
          WHERE (evaluations.athlete_id = a.id)
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON (true))
  WHERE (is_partner_eligible_athlete(a.id) AND is_approved_partner(auth.uid()))
  ORDER BY a.cote_globale_entraineur DESC;

-- ── 2. La projection de profil ───────────────────────────────────
-- DROP puis CREATE : CREATE OR REPLACE FUNCTION refuse un type de retour
-- différent, et on ajoute une colonne. Sans CASCADE, volontairement — si un
-- objet en dépendait, la migration doit échouer plutôt que l'emporter.
drop function if exists public.partner_athlete_profile(uuid);

create function public.partner_athlete_profile(p_athlete_id uuid)
 returns table(id uuid, first_name text, last_name text, photo_url text,
   numero_jersey text, age integer, genre text, annee_diplomation integer,
   verified boolean, last_profile_validation timestamp with time zone,
   cote_globale numeric, taille_pieds integer, taille_pouces integer,
   poids_lbs numeric, bio text, sport_nom text, position_nom text,
   position_abbr text, school_name text, school_region text, school_city text,
   school_type text, is_civil boolean, team_name text, league_name text,
   distinctions jsonb, video_faits_saillants_url text, hudl_url text,
   youtube_url text, badges jsonb)
 language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre,
    a.annee_diplomation,
    a.verified,
    a.last_profile_validation,
    a.cote_globale_entraineur,
    a.taille_pieds,
    a.taille_pouces,
    a.poids_lbs,
    a.bio,
    s.nom,
    p.nom,
    p.abreviation,
    sch.name,
    sch.region,
    sch.city,
    sch.type,
    (a.school_id is null or sch.type = 'LIGUE_CIVILE') as is_civil,
    t.name  as team_name,
    t.league as league_name,
    e.distinctions,
    a.video_faits_saillants_url,
    a.hudl_url,
    a.youtube_url,
    public.badges_json(a.id) as badges
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : la jointure est 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    -- NOTE : `created_at desc` ici, alors que selectBestEvaluation (frontend)
    -- retient `updated_at desc`. Divergence PRÉEXISTANTE, non corrigée ici.
    -- Elle cesse de porter à conséquence POUR LES BADGES : le miroir écrit le
    -- même jeu sur TOUTES les lignes d'un athlète, donc les deux règles
    -- rendent désormais les mêmes distinctions. Elle reste ouverte pour les
    -- autres colonnes d'évaluation.
    select ev.distinctions
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;

revoke all on function public.partner_athlete_profile(uuid) from public, anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated, service_role;