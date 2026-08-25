-- =====================================================================
-- CE FICHIER N'EST PAS UNE MIGRATION.
-- Ne le déplacez PAS et ne le copiez PAS dans supabase/migrations/.
-- Il n'est pas destiné à être rejoué par `supabase db push` ni par
-- `supabase db reset`. C'est une pièce d'archive, rien d'autre.
-- =====================================================================
--
-- OBJET : copie de sauvegarde de la définition RÉELLE, en production
--         (projet Supabase nrloizyemulbhujrqhgx / nexus-prod), de la
--         fonction public.apply_approved_suggestion(), telle que lue
--         le 2026-08-25.
--
-- POURQUOI CETTE SAUVEGARDE EXISTE — ET CE QU'ELLE NE PROUVE PAS
--
--   AVERTISSEMENT. Ce fichier a été ouvert sur la crainte que la fonction
--   n'existe QUE en production. VÉRIFICATION FAITE, CETTE CRAINTE EST
--   INFONDÉE. Le texte est conservé quand même, mais pour une autre raison,
--   expliquée ci-dessous. Ne citez pas ce fichier comme la preuve d'une
--   dérive : il en est la réfutation.
--
--   Ce que l'on constate. Le texte ci-dessous n'apparaît littéralement dans
--   AUCUN fichier de supabase/migrations/. C'est vrai, et c'est ce qui a
--   alerté. Mais la cause n'est pas une modification à la main sur la prod :
--   c'est la FORME de la migration qui l'a produit.
--
--   La migration
--       supabase/migrations/20260825144302_badges_contexte_forme_et_suggestions_vers_athlete_badges.sql
--   ne réécrit pas la fonction par un CREATE OR REPLACE complet. Elle lit la
--   définition en place — pg_get_functiondef('public.apply_approved_suggestion')
--   — remplace TEXTUELLEMENT deux branches du CASE (« Distinctions » et
--   « Distinction personnalisée »), puis EXECUTE le résultat. Le corps final
--   n'existe donc nulle part comme texte source : il est CALCULÉ au moment
--   où la migration s'applique, à partir du corps posé par
--       supabase/migrations/20260824134148_suggestions_champ_accepte_noms_de_colonne.sql
--
--   Preuve de la reproductibilité (faite le 2026-08-25) : en appliquant au
--   corps de production la substitution INVERSE des deux branches, on
--   retombe sur un texte présent VERBATIM dans la migration 20260824134148.
--   Autrement dit : prod == 20260824134148 + exactement les deux
--   substitutions de 20260825144302, sans le moindre écart.
--
--   Donc un `supabase db reset` NE dégrade PAS la fonction. La chaîne
--   134148 → 144302 rejoue et reproduit ce corps à l'identique. Et si le
--   corps de départ venait à changer, 144302 ne « rate » pas en silence :
--   elle lève
--       NEXUS: branche 'Distinctions' introuvable — le corps déployé a changé
--   puis un garde-fou revérifie qu'aucune écriture de evaluations.distinctions
--   ne subsiste et que les 47 branches WHEN sont intactes.
--
--   LA VRAIE RAISON DE GARDER CE FICHIER. La forme « lire la définition
--   déployée, la modifier au texte, la réexécuter » est commode mais fragile :
--   le résultat dépend de l'état de la base au moment du rejeu, et aucun
--   fichier du dépôt ne montre le corps final tel qu'il tourne. Ce fichier
--   comble ce trou de lisibilité : il donne, en clair, le texte réellement
--   exécuté en production le 2026-08-25. C'est une pièce de LECTURE et de
--   COMPARAISON, pas une pièce de rejeu.
--
-- CE QUE CE FICHIER NE DÉCIDE PAS
--
--   Faut-il remplacer la substitution textuelle par un CREATE OR REPLACE
--   complet et lisible dans une prochaine migration ? C'est une décision qui
--   appartient à la session qui a produit le chantier badges, pas à celle qui
--   a archivé le texte. Voir docs/derive-migrations-badges-20260825.md.
--
-- CONTENU (pour que le rejeu, s'il a lieu un jour, soit COMPLET)
--
--   1. La fonction — 1 seule surcharge en production :
--        public.apply_approved_suggestion()  RETURNS trigger
--        LANGUAGE plpgsql, SECURITY DEFINER,
--        SET row_security TO 'off', SET search_path TO 'public'
--
--   2. Le trigger qui la câble — 1 seul :
--        trg_apply_suggestion  BEFORE UPDATE ON public.athlete_suggestions
--        FOR EACH ROW
--
--   3. Les droits d'exécution constatés (5 lignes dans
--      information_schema.routine_privileges) :
--        postgres       EXECUTE
--        anon           EXECUTE
--        authenticated  EXECUTE
--        service_role   EXECUTE
--        PUBLIC         EXECUTE
--      (PUBLIC EXECUTE est le défaut PostgreSQL ; les rôles Supabase
--       l'héritent. Aucun REVOKE n'a été constaté.)
--
--   DÉPENDANCE À NE PAS OUBLIER : le corps appelle
--   public.appliquer_distinctions_suggerees(uuid, uuid, jsonb, boolean).
--   Rejouer la fonction ci-dessous sans que cette fonction-là existe
--   produirait une erreur à la première approbation d'une distinction.
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. DÉFINITION DE LA FONCTION (production, 2026-08-25)
-- ---------------------------------------------------------------------

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
        -- 2026-08-25 : écrivait evaluations.distinctions, colonne désormais
        -- DÉRIVÉE (le miroir la reconstruit depuis athlete_badges). Toute
        -- approbation y était effacée au badge suivant. Remplacement = la
        -- suggestion porte le jeu COMPLET voulu par l'athlète.
        PERFORM public.appliquer_distinctions_suggerees(
          NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb, true);

      WHEN 'Distinction personnalisée' THEN
        -- 2026-08-25 : insérait dans custom_distinctions, table VIDE que
        -- rien ne lit ni n'alimente (0 ligne, 0 suggestion de ce champ).
        -- Rebranchée sur nexus-x, dont le contexte tient lieu de libellé.
        -- Ajout, pas remplacement : la sémantique d'origine était additive.
        PERFORM public.appliquer_distinctions_suggerees(
          NEW.athlete_id, v_coach_id,
          jsonb_build_array(jsonb_build_object('badge', 'nexus-x', 'detail', NEW.valeur_proposee)),
          false);

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


-- ---------------------------------------------------------------------
-- 2. TRIGGER QUI CÂBLE LA FONCTION (1 seul, production 2026-08-25)
-- ---------------------------------------------------------------------

-- DROP TRIGGER IF EXISTS trg_apply_suggestion ON public.athlete_suggestions;
CREATE TRIGGER trg_apply_suggestion
  BEFORE UPDATE ON public.athlete_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION apply_approved_suggestion();


-- ---------------------------------------------------------------------
-- 3. DROITS D'EXÉCUTION CONSTATÉS (production 2026-08-25)
-- ---------------------------------------------------------------------
-- Ces GRANT reflètent l'état lu ; PUBLIC EXECUTE est le défaut PostgreSQL
-- attribué automatiquement à la création de la fonction. Aucun REVOKE
-- n'a été constaté.

GRANT EXECUTE ON FUNCTION public.apply_approved_suggestion() TO postgres;
GRANT EXECUTE ON FUNCTION public.apply_approved_suggestion() TO anon;
GRANT EXECUTE ON FUNCTION public.apply_approved_suggestion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_approved_suggestion() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_approved_suggestion() TO PUBLIC;

-- FIN DE LA COPIE DE SAUVEGARDE.
