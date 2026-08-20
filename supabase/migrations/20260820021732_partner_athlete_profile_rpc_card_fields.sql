-- 20260820021732_partner_athlete_profile_rpc_card_fields
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration. Nom de fichier
-- aligne sur la version REELLE. Chercher par `name`, jamais par `version`.
--
-- C'EST LA DEFINITION VIVANTE de partner_athlete_profile. La migration
-- precedente (20260820021550) documente l'etat intermediaire a 24 colonnes.
--
-- ── POURQUOI CET AMENDEMENT ──────────────────────────────────────────────────
-- AthletePlayerCard — la carte telechargeable que la fiche partenaire rend en
-- deux formats (publication + story) — consomme 15 champs, dont 4 que la
-- projection initiale n'avait pas : last_profile_validation, is_civil,
-- team_name, league_name.
--
-- Sans eux la carte perdait le nom d'equipe, le libelle de ligue et
-- l'indicateur de fraicheur de validation : une difference VISIBLE, alors que
-- le critere d'acceptation du point 5a etait que la fiche affiche la meme chose
-- qu'avant pour un oeil humain.
--
-- Les quatre sont NON SENSIBLES : nom d'equipe et libelle de ligue sont de
-- l'information sportive publique, et last_profile_validation est une date de
-- fraicheur deja projetee par la RPC recruteur.
--
-- Semantique reprise A L'IDENTIQUE de mapToRecruiterView
-- (app/coach/athletes/_data/loadAthleteFromSupabase.ts:371-385) :
--   is_civil    = pas d'ecole OU ecole de type LIGUE_CIVILE
--   team_name   = teams.name de l'equipe rattachee
--   league_name = teams.league
--
-- `returns table` change => Postgres impose un DROP avant le CREATE. Aucun
-- appelant a ce stade (le cablage front suivait). Les FONCTIONS n'ont pas de
-- reloptions : le piege du CREATE OR REPLACE VIEW ne s'applique pas ici.
--
-- ── PREUVES RUNTIME, EN PROD (JWT partenaire reel) ───────────────────────────
--   colonnes interdites dans la signature ......... 0   (lu au catalogue)
--   partenaire -> Athlete Nexus, age 14, promo 2026, cote 5.00,
--                 Basketball / PG, Nexus Secondaire / Montreal,
--                 equipe « Dragons Juvenile », verifie, distinctions presentes
--   coach (non-partenaire) -> 0 ligne
--
-- L'age sort a 14 SANS que date_naissance ne franchisse la frontiere : c'est un
-- mineur, laisse passer parce que son consentement parental est au dossier —
-- le gate complet fonctionne.

drop function if exists public.partner_athlete_profile(uuid);

create function public.partner_athlete_profile(p_athlete_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  photo_url text,
  numero_jersey text,
  age integer,
  genre text,
  annee_diplomation integer,
  verified boolean,
  last_profile_validation timestamptz,
  cote_globale numeric,
  taille_pieds integer,
  taille_pouces integer,
  poids_lbs numeric,
  bio text,
  sport_nom text,
  position_nom text,
  position_abbr text,
  school_name text,
  school_region text,
  school_city text,
  school_type text,
  is_civil boolean,
  team_name text,
  league_name text,
  distinctions jsonb,
  video_faits_saillants_url text,
  hudl_url text,
  youtube_url text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
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
    a.youtube_url
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : jointure 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    select ev.distinctions
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$fn$;

comment on function public.partner_athlete_profile(uuid) is
$c$Projection partenaire de la fiche athlete. 28 colonnes, contre 42 pour la RPC
recruteur equivalente : le partenaire recoit strictement moins.

NE PROJETTE JAMAIS : date_naissance (l'age est derive cote serveur), email,
telephone, nom_parent, telephone_parent, moyenne_generale, mentions_academiques,
matieres_fortes, programme_cegep_vise, regions_cegep_preferees, notes_coach,
rapport_entraineur. Ces trois derniers sont du texte libre ecrit par un adulte
sur un mineur — hors perimetre DEFINITIVEMENT (arbitrage BP 2026-08-19).

SECURITY DEFINER avec gate interne : is_approved_partner (qui IGNORE son
argument et lit auth.uid() — on lui passe null pour que ce soit explicite) ET
is_partner_eligible_athlete (opt-in ET 18 ans OU consentement parental : la
condition COMPLETE, celle des vues, pas celle de la policy athletes qui n'exige
que l'opt-in).

Remplace les deux lectures directes de la fiche partenaire : loadAthleteRaw
(58 colonnes racine, dont les 11 interdites) et la requete propre de
AthleteRecruiterProfileBody (dont l'embed evaluations a 18 colonnes).$c$;

revoke all on function public.partner_athlete_profile(uuid) from public;
revoke all on function public.partner_athlete_profile(uuid) from anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated;
