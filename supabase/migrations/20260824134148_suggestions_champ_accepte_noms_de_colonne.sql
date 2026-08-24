-- ═══════════════════════════════════════════════════════════════
-- Découpler la CLÉ du LIBELLÉ dans athlete_suggestions.champ
--
-- POURQUOI
-- `champ` porte aujourd'hui le libellé français affiché, et
-- apply_approved_suggestion fait un CASE dessus. Le chantier des grilles
-- d'évaluation par position rend 5 des 14 libellés VARIABLES (la grille de
-- l'athlète les fournit) et en renomme 4 parmi les fixes. Les libellés
-- cesseraient donc de correspondre aux WHEN : la suggestion s'insère bien,
-- mais l'APPROBATION tombe dans le ELSE -> RAISE -> transaction annulée ->
-- suggestion coincée en EN_ATTENTE, sans message lisible à l'écran.
--
-- Fix : accepter les 14 NOMS DE COLONNE comme valeurs de `champ`, EN PLUS des
-- libellés FR — jamais à leur place. Le libellé redevient de l'affichage.
--
-- STRICTEMENT ADDITIF. Les 33 WHEN existants sont recopiés à l'identique
-- (corps déployé relu via pg_get_functiondef, md5 22b4ed024214c15727ed8136bde6e88c,
-- conforme à 20260616000000_apply_suggestion_new_traits.sql — aucune dérive).
-- Aucune reprise de données : l'app mobile 1.2 en magasin n'émet que des
-- libellés FR et continue de fonctionner à l'identique.
--
-- Les 14 nouvelles branches sont des CLONES EXACTS de leurs jumelles FR :
-- même colonne, même cast ::int, même GET DIAGNOSTICS, même INSERT ... ON
-- CONFLICT de repli. Rien n'est « amélioré » au passage.
--
-- ── SEUL CHANGEMENT DE COMPORTEMENT : le préfixe NEXUS: sur le ELSE ─────────
-- Un RAISE sans ce préfixe n'atteint jamais l'écran du coach. Mesuré avant
-- application : les 225 lignes de athlete_suggestions (197 EN_ATTENTE,
-- 28 APPROUVEE) correspondent toutes aux 34 littéraux gérés — AUCUNE ne
-- tomberait dans le ELSE. Le préfixe est donc inerte sur l'existant ; il
-- arme le message pour la suite.
--
-- ── notify_athlete_suggestion_result (option D2, arbitrage BP) ──────────────
-- v_is_rating passe de 15 à 29 entrées (les 14 clés colonne ajoutées), et un
-- CASE STATIQUE traduit la clé colonne en libellé FR pour l'affichage. Sans
-- lui, l'athlète lirait « Ton coach a approuvé ta suggestion : vision_du_jeu
-- mis à jour (4/5) » — NEW.champ est interpolé littéralement dans le titre.
-- La métadonnée jsonb conserve NEW.champ BRUT (c'est de la donnée, pas de
-- l'affichage).
--
-- Corrigé au passage sur GO explicite : 'Endurance / Cardio' -> 'Endurance
-- cardio' dans v_is_rating. Cette entrée ne correspondait à AUCUN champ émis
-- ni géré (apply utilise 'Endurance cardio') — bug avéré, 0 ligne concernée.
--
-- DETTE ASSUMÉE (D2) : le CASE est statique. Un athlète de Basketball dont le
-- slot 4 s'affiche « Défense » recevra une notification disant « Vision du
-- jeu ». Décalage réel mais borné. D1 — résoudre le libellé via
-- evaluation_grilles + position de l'athlète — a été REFUSÉ : ça rendrait une
-- fonction de notification dépendante d'un chantier non livré. À reprendre
-- avec le frontend des grilles.
--
-- DETTE CONSIGNÉE, NON CORRIGÉE ICI : les 6 colonnes vitesse_explosivite,
-- force_puissance, endurance_cardio, agilite_coordination, vision_du_jeu et
-- sens_tactique sont numeric(3,1) mais le trigger caste ::int — une valeur
-- décimale lève invalid input syntax. Inerte (l'UI n'émet que des entiers).
-- Rejoint la cible produit « 0 à 5 partout », qui exigera aussi un changement
-- de TYPE sur competitivite, esprit_equipe et resilience. Migration séparée.
--
-- Compteurs attendus après application :
--   apply_approved_suggestion : 47 WHEN au total, dont 28 sur les traits
--                               (14 FR + 14 colonnes), préfixe NEXUS: présent
--   notify_...                : v_is_rating à 29 entrées
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.apply_approved_suggestion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coach_id UUID;
  v_rows_updated INT;
  v_is_detailed BOOLEAN;
  v_sport_id UUID;
  v_position_id UUID;
BEGIN
  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
    SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
    IF v_coach_id IS NULL THEN v_coach_id := NEW.coach_id; END IF;

    CASE NEW.champ
      WHEN 'Taille' THEN
        UPDATE athletes SET taille_pieds = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 1), '')::int,
          taille_pouces = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 2), '')::int
          WHERE id = NEW.athlete_id;
      WHEN 'Poids' THEN UPDATE athletes SET poids_lbs = NULLIF(replace(NEW.valeur_proposee, ' lbs', ''), '')::numeric WHERE id = NEW.athlete_id;
      WHEN 'Envergure' THEN UPDATE athletes SET envergure = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Taille mains' THEN UPDATE athletes SET taille_mains = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Main dominante' THEN UPDATE athletes SET main_dominante = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Pied dominant' THEN UPDATE athletes SET pied_dominant = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN '40 yards' THEN UPDATE athletes SET test_40_verges = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut vertical' THEN UPDATE athletes SET saut_vertical = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut longueur' THEN UPDATE athletes SET saut_longueur = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Développé couché' THEN UPDATE athletes SET developpe_couche = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Navette' THEN UPDATE athletes SET navette_agilite = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Sprint 100m' THEN UPDATE athletes SET sprint_100m = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Numéro' THEN UPDATE athletes SET numero_jersey = replace(NEW.valeur_proposee, '#', '') WHERE id = NEW.athlete_id;

      WHEN 'Sport principal' THEN
        SELECT id INTO v_sport_id FROM sports WHERE lower(nom) = lower(NEW.valeur_proposee);
        IF v_sport_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: sport principal "%" introuvable', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET sport_id = v_sport_id WHERE id = NEW.athlete_id;

      -- Champs RETIRÉS (sport/position secondaire → remplacés par parcours_equipes).
      -- NO-OP : une suggestion héritée en attente s'approuve sans erreur.
      WHEN 'Sport secondaire', 'Position secondaire' THEN
        NULL;

      WHEN 'Position' THEN
        SELECT p.id INTO v_position_id
        FROM positions p JOIN athletes a ON a.id = NEW.athlete_id
        WHERE p.sport_id = a.sport_id AND lower(p.nom) = lower(NEW.valeur_proposee);
        IF v_position_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: position "%" introuvable pour le sport principal de cet athlète', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET position_id = v_position_id WHERE id = NEW.athlete_id;

      WHEN 'Cote globale' THEN
        SELECT (leadership IS NOT NULL OR discipline IS NOT NULL OR coachabilite IS NOT NULL OR intelligence_jeu IS NOT NULL OR competitivite IS NOT NULL OR esprit_equipe IS NOT NULL OR resilience IS NOT NULL OR attitude_mentalite IS NOT NULL)
          INTO v_is_detailed FROM evaluations WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        IF v_is_detailed THEN
          RAISE EXCEPTION 'Impossible d''appliquer une cote globale plate : l''évaluation détaillée est active pour cet athlète.';
        END IF;
        UPDATE athletes SET cote_globale_entraineur = NEW.valeur_proposee::numeric WHERE id = NEW.athlete_id;
        UPDATE evaluations SET cote_globale = NEW.valeur_proposee::numeric WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN
          INSERT INTO evaluations (athlete_id, coach_id, cote_globale) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::numeric)
            ON CONFLICT (coach_id, athlete_id) DO UPDATE SET cote_globale = EXCLUDED.cote_globale;
        END IF;

      WHEN 'Leadership' THEN
        UPDATE evaluations SET leadership = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, leadership) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET leadership = EXCLUDED.leadership; END IF;
      WHEN 'Discipline' THEN
        UPDATE evaluations SET discipline = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, discipline) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET discipline = EXCLUDED.discipline; END IF;
      WHEN 'Coachabilité' THEN
        UPDATE evaluations SET coachabilite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, coachabilite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET coachabilite = EXCLUDED.coachabilite; END IF;
      WHEN 'Intelligence de jeu' THEN
        UPDATE evaluations SET intelligence_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, intelligence_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET intelligence_jeu = EXCLUDED.intelligence_jeu; END IF;
      WHEN 'Compétitivité' THEN
        UPDATE evaluations SET competitivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, competitivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET competitivite = EXCLUDED.competitivite; END IF;
      WHEN 'Esprit d''équipe' THEN
        UPDATE evaluations SET esprit_equipe = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, esprit_equipe) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET esprit_equipe = EXCLUDED.esprit_equipe; END IF;
      WHEN 'Résilience' THEN
        UPDATE evaluations SET resilience = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, resilience) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET resilience = EXCLUDED.resilience; END IF;
      WHEN 'Attitude / Mentalité' THEN
        UPDATE evaluations SET attitude_mentalite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, attitude_mentalite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET attitude_mentalite = EXCLUDED.attitude_mentalite; END IF;

      WHEN 'Vitesse / Explosivité' THEN
        UPDATE evaluations SET vitesse_explosivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vitesse_explosivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vitesse_explosivite = EXCLUDED.vitesse_explosivite; END IF;
      WHEN 'Force / Puissance' THEN
        UPDATE evaluations SET force_puissance = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, force_puissance) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET force_puissance = EXCLUDED.force_puissance; END IF;
      WHEN 'Endurance cardio' THEN
        UPDATE evaluations SET endurance_cardio = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, endurance_cardio) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET endurance_cardio = EXCLUDED.endurance_cardio; END IF;
      WHEN 'Agilité / Coordination' THEN
        UPDATE evaluations SET agilite_coordination = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, agilite_coordination) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET agilite_coordination = EXCLUDED.agilite_coordination; END IF;
      WHEN 'Vision du jeu' THEN
        UPDATE evaluations SET vision_du_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vision_du_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vision_du_jeu = EXCLUDED.vision_du_jeu; END IF;
      WHEN 'Sens tactique' THEN
        UPDATE evaluations SET sens_tactique = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, sens_tactique) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET sens_tactique = EXCLUDED.sens_tactique; END IF;

      -- ═══════════════════════════════════════════════════════════
      -- CLÉS STABLES — les 14 noms de colonne. AJOUT, jamais un
      -- remplacement : les 14 WHEN en libellé FR ci-dessus restent
      -- actifs pour l'app mobile 1.2 en magasin. Chaque branche est le
      -- clone exact de sa jumelle FR (même colonne, même ::int, même
      -- repli INSERT ... ON CONFLICT).
      -- ═══════════════════════════════════════════════════════════
      WHEN 'leadership' THEN
        UPDATE evaluations SET leadership = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, leadership) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET leadership = EXCLUDED.leadership; END IF;
      WHEN 'discipline' THEN
        UPDATE evaluations SET discipline = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, discipline) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET discipline = EXCLUDED.discipline; END IF;
      WHEN 'coachabilite' THEN
        UPDATE evaluations SET coachabilite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, coachabilite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET coachabilite = EXCLUDED.coachabilite; END IF;
      WHEN 'intelligence_jeu' THEN
        UPDATE evaluations SET intelligence_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, intelligence_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET intelligence_jeu = EXCLUDED.intelligence_jeu; END IF;
      WHEN 'competitivite' THEN
        UPDATE evaluations SET competitivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, competitivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET competitivite = EXCLUDED.competitivite; END IF;
      WHEN 'esprit_equipe' THEN
        UPDATE evaluations SET esprit_equipe = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, esprit_equipe) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET esprit_equipe = EXCLUDED.esprit_equipe; END IF;
      WHEN 'resilience' THEN
        UPDATE evaluations SET resilience = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, resilience) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET resilience = EXCLUDED.resilience; END IF;
      WHEN 'attitude_mentalite' THEN
        UPDATE evaluations SET attitude_mentalite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, attitude_mentalite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET attitude_mentalite = EXCLUDED.attitude_mentalite; END IF;
      WHEN 'vitesse_explosivite' THEN
        UPDATE evaluations SET vitesse_explosivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vitesse_explosivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vitesse_explosivite = EXCLUDED.vitesse_explosivite; END IF;
      WHEN 'force_puissance' THEN
        UPDATE evaluations SET force_puissance = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, force_puissance) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET force_puissance = EXCLUDED.force_puissance; END IF;
      WHEN 'endurance_cardio' THEN
        UPDATE evaluations SET endurance_cardio = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, endurance_cardio) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET endurance_cardio = EXCLUDED.endurance_cardio; END IF;
      WHEN 'agilite_coordination' THEN
        UPDATE evaluations SET agilite_coordination = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, agilite_coordination) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET agilite_coordination = EXCLUDED.agilite_coordination; END IF;
      WHEN 'vision_du_jeu' THEN
        UPDATE evaluations SET vision_du_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vision_du_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vision_du_jeu = EXCLUDED.vision_du_jeu; END IF;
      WHEN 'sens_tactique' THEN
        UPDATE evaluations SET sens_tactique = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, sens_tactique) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET sens_tactique = EXCLUDED.sens_tactique; END IF;

      WHEN 'Distinctions' THEN
        UPDATE evaluations SET distinctions = NEW.valeur_proposee::jsonb WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, distinctions) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET distinctions = EXCLUDED.distinctions; END IF;

      WHEN 'Distinction personnalisée' THEN
        INSERT INTO custom_distinctions (athlete_id, coach_id, title) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee);

      ELSE
        RAISE EXCEPTION 'NEXUS: apply_approved_suggestion — champ non géré "%"', NEW.champ;
    END CASE;
  END IF;

  IF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
  END IF;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.notify_athlete_suggestion_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_title TEXT;
  v_is_rating BOOLEAN;
  v_champ_label TEXT;
BEGIN
  -- 29 entrées : 'Cote globale' + les 14 libellés FR + les 14 clés colonne.
  -- 'Endurance / Cardio' corrigé en 'Endurance cardio' — l'ancienne orthographe
  -- ne correspondait ni à ce que le frontend émet ni à ce que apply gère, donc
  -- une suggestion d'endurance perdait le suffixe « /5 ».
  v_is_rating := NEW.champ IN (
    'Cote globale', 'Leadership', 'Discipline', 'Coachabilité',
    'Intelligence de jeu', 'Compétitivité', 'Esprit d''équipe',
    'Résilience', 'Attitude / Mentalité',
    'Vitesse / Explosivité', 'Force / Puissance', 'Endurance cardio',
    'Agilité / Coordination', 'Vision du jeu', 'Sens tactique',
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite',
    'vitesse_explosivite', 'force_puissance', 'endurance_cardio',
    'agilite_coordination', 'vision_du_jeu', 'sens_tactique'
  );

  -- NEW.champ est interpolé LITTÉRALEMENT dans un titre lu par l'athlète.
  -- Sans ce CASE, une clé colonne donnerait « ... : vision_du_jeu mis à jour ».
  -- STATIQUE par décision (option D2) : ne lit PAS evaluation_grilles.
  -- DETTE : un athlète dont la grille renomme le slot lira le libellé
  -- générique (« Vision du jeu » là où son écran dit « Défense »).
  v_champ_label := CASE NEW.champ
    WHEN 'leadership'           THEN 'Leadership'
    WHEN 'discipline'           THEN 'Discipline'
    WHEN 'coachabilite'         THEN 'Coachabilité'
    WHEN 'intelligence_jeu'     THEN 'Intelligence de jeu'
    WHEN 'competitivite'        THEN 'Compétitivité'
    WHEN 'esprit_equipe'        THEN 'Esprit d''équipe'
    WHEN 'resilience'           THEN 'Résilience'
    WHEN 'attitude_mentalite'   THEN 'Attitude / Mentalité'
    WHEN 'vitesse_explosivite'  THEN 'Vitesse / Explosivité'
    WHEN 'force_puissance'      THEN 'Force / Puissance'
    WHEN 'endurance_cardio'     THEN 'Endurance cardio'
    WHEN 'agilite_coordination' THEN 'Agilité / Coordination'
    WHEN 'vision_du_jeu'        THEN 'Vision du jeu'
    WHEN 'sens_tactique'        THEN 'Sens tactique'
    ELSE COALESCE(NEW.champ, '')
  END;

  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    IF NEW.champ = 'Distinctions' THEN
      v_title := 'Ton coach a approuvé ta suggestion : Distinctions mises à jour';
    ELSIF v_is_rating AND COALESCE(NEW.valeur_proposee, '') <> '' THEN
      v_title := 'Ton coach a approuvé ta suggestion : ' || v_champ_label
              || ' mis à jour (' || NEW.valeur_proposee || '/5)';
    ELSE
      v_title := 'Ton coach a approuvé ta suggestion : ' || v_champ_label
              || ' mis à jour';
    END IF;

    -- metadata garde NEW.champ BRUT : c'est de la donnée, pas de l'affichage.
    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_APPROVED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'valeur', NEW.valeur_proposee)
    );

  ELSIF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    v_title := 'Ton coach a rejeté ta suggestion : ' || v_champ_label;

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_REJECTED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'raison', NEW.raison_rejet)
    );
  END IF;

  RETURN NEW;
END;
$function$;


COMMENT ON FUNCTION public.apply_approved_suggestion() IS
$c$Applique une suggestion athlète approuvée. CASE sur athlete_suggestions.champ.

ACCEPTE DEUX ESPACES DE CLÉS, volontairement :
  - les 14 LIBELLÉS FR historiques (Leadership, Compétitivité, Vision du jeu…),
    émis par l'app mobile 1.2 en magasin — NE JAMAIS LES RETIRER tant que cette
    version est distribuée ;
  - les 14 NOMS DE COLONNE (leadership, competitivite, vision_du_jeu…), ajoutés
    le 2026-08-24 pour le chantier des grilles d'évaluation par position, qui
    rend 5 libellés variables et en renomme 4 parmi les fixes.

Les deux familles font exactement la même chose. Les nouvelles branches sont des
clones exacts de leurs jumelles FR, cast ::int compris.

47 WHEN au total, dont 28 sur les traits (14 + 14).

Le ELSE porte le préfixe NEXUS: — sans lui, un champ non géré annulait la
transaction en silence et laissait la suggestion coincée en EN_ATTENTE sans
message lisible côté coach.$c$;

COMMENT ON FUNCTION public.notify_athlete_suggestion_result() IS
$c$Notifie l'athlète du sort de sa suggestion (AFTER UPDATE, donc jamais atteint
si apply_approved_suggestion lève).

v_is_rating (29 entrées) décide du suffixe « (x/5) ». v_champ_label traduit une
clé colonne en libellé FR pour l'affichage — NEW.champ est interpolé
littéralement dans un titre lu par l'athlète.

DETTE (option D2, 2026-08-24) : v_champ_label est STATIQUE. Il ignore la grille
d'évaluation de l'athlète, donc un joueur dont le slot est renommé lira le
libellé générique (« Vision du jeu » quand son écran dit « Défense »). Résoudre
via evaluation_grilles + position_grille rendrait cette fonction dépendante du
chantier grilles — à reprendre AVEC le frontend, pas avant.$c$;