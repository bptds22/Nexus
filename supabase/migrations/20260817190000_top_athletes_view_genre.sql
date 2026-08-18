-- top_athletes_view : ajout de a.genre, et RIEN d'autre.
--
-- POURQUOI athletes.genre ET NON teams.gender
-- Le genre existe aussi via team_athletes -> teams.gender, chemin qu'emploie
-- le portail recruteur. Mesuré sur les athletes eligibles au partenaire :
-- athletes.genre couvre 8 profils sur 9, la voie equipe seulement 4 sur 9.
-- Filtrer par l'equipe ferait donc DISPARAITRE cinq athletes sur neuf des
-- que le partenaire choisit un genre. La colonne directe est deja dans la
-- table selectionnee : aucune jointure, aucun DISTINCT ON, aucune dependance
-- nouvelle aux RLS de team_athletes.
--
-- VOCABULAIRE : 'M' | 'F' | 'X' | NULL, brut. La normalisation vers un
-- libelle lisible se fait a l'AFFICHAGE. On ne normalise pas en base : la
-- colonne est ecrite par quatre formulaires, et une vue qui traduirait
-- creerait un second vocabulaire a maintenir.
--
-- La colonne est ajoutee EN FIN de liste : CREATE OR REPLACE VIEW n'autorise
-- que l'ajout en queue, jamais la reorganisation.
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
    a.genre
   FROM athletes a
     LEFT JOIN sports s ON s.id = a.sport_id
     LEFT JOIN positions p ON p.id = a.position_id
     LEFT JOIN schools sch ON sch.id = a.school_id
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM evaluations
          WHERE evaluations.athlete_id = a.id
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON true
  WHERE is_partner_eligible_athlete(a.id) AND is_approved_partner(auth.uid())
  ORDER BY a.cote_globale_entraineur DESC;
