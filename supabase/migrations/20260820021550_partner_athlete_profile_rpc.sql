-- 20260820021550_partner_athlete_profile_rpc
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration (jamais db push).
-- Nom de fichier aligne sur la version REELLE : apply_migration pose son propre
-- horodatage. Chercher par `name` dans schema_migrations, jamais par `version`.
--
-- ⚠ AMENDEE IMMEDIATEMENT APRES par 20260820021732_..._card_fields, qui DROP
-- puis recree cette fonction avec 4 colonnes de plus. Ce fichier documente
-- l'etat intermediaire ; la definition VIVANTE est celle de la migration
-- suivante. Rejouer l'historique dans l'ordre donne le bon resultat.
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Point 5a du chantier RLS partenaire : la projection.
--
-- La fiche /partenaire/athletes/[id] lisait `athletes` par DEUX chemins :
--   1. PageClient:77 -> loadAthleteRaw = 58 colonnes racine, dont les 11
--      interdites (email, telephone, date_naissance, nom_parent,
--      telephone_parent, moyenne_generale, programme_cegep_vise,
--      regions_cegep_preferees, notes_coach, consentement_parental, et
--      rapport_entraineur via l'embed evaluations).
--   2. AthleteRecruiterProfileBody:456 = requete propre, deja partiellement
--      durcie (date_naissance exclue pour le partenaire), mais qui laissait
--      encore passer moyenne_generale, programme_cegep_vise,
--      regions_cegep_preferees, notes_coach et l'embed evaluations a 18
--      colonnes.
--
-- ── CE QUI NE SORT JAMAIS ────────────────────────────────────────────────────
--   date_naissance   -> l'age est DERIVE cote serveur
--   email, telephone, nom_parent, telephone_parent
--   moyenne_generale, mentions_academiques, matieres_fortes,
--   programme_cegep_vise, regions_cegep_preferees, ouvert_cegep_*
--   notes_coach, rapport_entraineur -> texte libre d'un adulte sur un mineur,
--                        hors perimetre DEFINITIVEMENT (arbitrage BP 2026-08-19)
--
-- Inclus sur arbitrage BP : taille_pieds, taille_pouces, poids_lbs (attributs
-- sportifs publiables) et bio (texte ecrit par l'athlete pour etre lu).
--
-- ── GATE INTERNE ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER : la fonction contourne la RLS, donc elle porte ses deux
-- conditions elle-meme. is_approved_partner IGNORE son argument (il lit
-- auth.uid(), verrouille par f6_c2_lock_parameterized_helpers) — on lui passe
-- null pour que ce soit explicite plutot que trompeur.
-- is_partner_eligible_athlete utilise bien le sien : opt-in ET (18 ans OU
-- consentement parental) — la condition COMPLETE, celle des vues, pas celle de
-- la policy athletes qui n'exige que l'opt-in.

create or replace function public.partner_athlete_profile(p_athlete_id uuid)
returns table (
  id uuid, first_name text, last_name text, photo_url text,
  numero_jersey text, age integer, genre text, annee_diplomation integer,
  verified boolean, cote_globale numeric,
  taille_pieds integer, taille_pouces integer, poids_lbs numeric, bio text,
  sport_nom text, position_nom text, position_abbr text,
  school_name text, school_region text, school_city text, school_type text,
  distinctions jsonb,
  video_faits_saillants_url text, hudl_url text, youtube_url text
)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $fn$
  select
    a.id, a.first_name, a.last_name, a.photo_url, a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre, a.annee_diplomation, a.verified, a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs, a.bio,
    s.nom, p.nom, p.abreviation,
    sch.name, sch.region, sch.city, sch.type,
    e.distinctions,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  left join lateral (
    select ev.distinctions from public.evaluations ev
    where ev.athlete_id = a.id order by ev.created_at desc limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$fn$;

comment on function public.partner_athlete_profile(uuid) is
$c$Projection partenaire de la fiche athlete. 24 colonnes, contre 42 pour la RPC
recruteur : le partenaire recoit strictement moins.

NE PROJETTE JAMAIS : date_naissance (age derive), email, telephone, nom_parent,
telephone_parent, moyenne_generale, mentions_academiques, matieres_fortes,
programme_cegep_vise, regions_cegep_preferees, notes_coach, rapport_entraineur.

SECURITY DEFINER avec gate interne : is_approved_partner (qui ignore son
argument et lit auth.uid()) ET is_partner_eligible_athlete (opt-in ET 18 ans OU
consentement parental — la condition COMPLETE, celle des vues, pas celle de la
policy athletes qui n'exige que l'opt-in).

Remplace les deux lectures directes de la fiche partenaire : loadAthleteRaw
(58 colonnes) et la requete propre de AthleteRecruiterProfileBody.$c$;

revoke all on function public.partner_athlete_profile(uuid) from public;
revoke all on function public.partner_athlete_profile(uuid) from anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated;
