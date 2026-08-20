-- 20260820022654_partner_newsroom_events_rpc
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration. Nom de fichier
-- aligne sur la version REELLE. Chercher par `name`, jamais par `version`.
--
-- Point 5b(a) du chantier RLS partenaire.
--
-- /partenaire/newsroom lisait newsroom_events avec un embed
-- `athletes!inner(...)` pour la carte editoriale ET pour QUATRE de ses huit
-- filtres (position, genre, cote min, promotion). L'embed s'appuyait sur la
-- policy « Approved partners read opted-in athletes », supprimee au point
-- 5b(d) (20260820023055). Sans cette fonction, les quatre filtres et toutes
-- les cartes tombaient.
--
-- FONCTION plutot que vue — arbitrage BP 2026-08-19 : ca evite un troisieme
-- objet dont il faudrait surveiller les reloptions a chaque CREATE OR REPLACE.
-- Les fonctions n'ont pas de reloptions.
--
-- LES HUIT FILTRES, ET OU ILS VIVENT
--   event_type -> newsroom_events.event_type   (colonne propre)
--   periode    -> newsroom_events.occurred_at  (colonne propre)
--   sport      -> newsroom_events.sport_id     (denormalise par le trigger)
--   organisme  -> newsroom_events.school_id    (denormalise, FK schools)
--   region     -> schools.region via le school_id de l'EVENEMENT
--   position   -> athletes.position_id             <- passait par l'embed
--   genre      -> athletes.genre                   <- passait par l'embed
--   cote min   -> athletes.cote_globale_entraineur <- passait par l'embed
--   promotion  -> athletes.annee_diplomation       <- passait par l'embed
--
-- La region reste accrochee a l'EVENEMENT : un athlete qui change d'ecole ne
-- reecrit pas la region de ses anciennes nouvelles.
--
-- CE QUI NE SORT PAS : les colonnes d'athletes servant aux filtres sont
-- utilisees dans le WHERE sans etre projetees, sauf celles que la carte
-- affiche. Un filtre n'a pas besoin d'etre rendu. date_naissance, email,
-- telephone, nom_parent, telephone_parent, moyenne_generale, notes_coach,
-- rapport_entraineur : jamais.
--
-- PREUVES (JWT partenaire, prod) : sans filtre 1 · genre=M 1 · genre=F 0 ·
-- cote_min=3 1 · org=scolaire 1 · org=ligue_civile 0 · sport 1 · position 1 ·
-- promo 2026 = 1 · promo 2099 = 0 · region Montreal 1 · periode 7j 1 ·
-- type COMMITMENT 0. Un coach non-partenaire : 0.

create or replace function public.partner_newsroom_events(
  p_event_type  text        default null,
  p_since       timestamptz default null,
  p_sport_id    uuid        default null,
  p_position_id uuid        default null,
  p_genre       text        default null,
  p_org         text        default null,
  p_cote_min    numeric     default null,
  p_year        integer     default null,
  p_region      text        default null,
  p_limit       integer     default 100
)
returns table (
  id uuid,
  event_type text,
  athlete_id uuid,
  metadata jsonb,
  occurred_at timestamptz,
  athlete_first_name text,
  athlete_last_name text,
  athlete_photo_url text,
  athlete_school_name text,
  athlete_sport_nom text,
  athlete_position_abbr text,
  athlete_cote_globale numeric,
  athlete_annee_diplomation integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select
    ne.id, ne.event_type, ne.athlete_id, ne.metadata, ne.occurred_at,
    a.first_name, a.last_name, a.photo_url,
    sch_a.name, s.nom, p.abreviation,
    a.cote_globale_entraineur, a.annee_diplomation
  from public.newsroom_events ne
  -- L'evenement peut ne pas porter d'athlete : LEFT JOIN, et le gate tolere
  -- athlete_id null — meme regle que la policy RLS de newsroom_events.
  left join public.athletes  a     on a.id     = ne.athlete_id
  left join public.sports    s     on s.id     = a.sport_id
  left join public.positions p     on p.id     = a.position_id
  left join public.schools   sch_a on sch_a.id = a.school_id
  left join public.schools   sch_e on sch_e.id = ne.school_id
  where
    public.is_approved_partner(null)
    and (ne.athlete_id is null or public.is_partner_eligible_athlete(ne.athlete_id))
    and (p_event_type  is null or ne.event_type = p_event_type)
    and (p_since       is null or ne.occurred_at >= p_since)
    and (p_sport_id    is null or ne.sport_id = p_sport_id)
    and (p_position_id is null or a.position_id = p_position_id)
    and (p_genre       is null or a.genre = p_genre)
    and (p_org         is null
         or (p_org = 'scolaire'     and ne.school_id is not null)
         or (p_org = 'ligue_civile' and ne.school_id is null))
    and (p_cote_min    is null or a.cote_globale_entraineur >= p_cote_min)
    and (p_year        is null or a.annee_diplomation = p_year)
    and (p_region      is null or sch_e.region = p_region)
  order by ne.occurred_at desc
  limit coalesce(p_limit, 100);
$fn$;

comment on function public.partner_newsroom_events is
$c$Fil d'actualite partenaire. Remplace la lecture directe de newsroom_events
avec embed athletes!inner, qui dependait de la policy « Approved partners read
opted-in athletes » supprimee au point 5b(d).

Porte les HUIT filtres de l'ecran. Quatre d'entre eux (position, genre, cote
min, promotion) passaient par l'embed athlete et auraient casse sans cette
fonction.

Les colonnes d'athletes servant aux filtres sont utilisees dans le WHERE sans
etre projetees, sauf celles que la carte affiche. NE PROJETTE JAMAIS :
date_naissance, email, telephone, nom_parent, telephone_parent,
moyenne_generale, notes_coach, rapport_entraineur.

SECURITY DEFINER avec gate interne : is_approved_partner ET
is_partner_eligible_athlete, ce dernier tolerant un athlete_id null (evenement
sans athlete) — meme regle que la policy RLS de newsroom_events, qui reste en
place.$c$;

revoke all on function public.partner_newsroom_events(text, timestamptz, uuid, uuid, text, text, numeric, integer, text, integer) from public;
revoke all on function public.partner_newsroom_events(text, timestamptz, uuid, uuid, text, text, numeric, integer, text, integer) from anon;
grant execute on function public.partner_newsroom_events(text, timestamptz, uuid, uuid, text, text, numeric, integer, text, integer) to authenticated;
