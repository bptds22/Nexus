-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — VOLET 2 : l'unicité des conversations devient une contrainte de BASE
--
-- Le volet 1 a nettoyé les quatre doublons existants. Sans index, rien
-- n'empêche les suivants : les quatre étaient nés de quatre clics, à
-- 36 secondes d'intervalle, parce que le code crée la conversation sans
-- vérifier qu'elle existe déjà. Le volet 4 du chantier CODE corrigera les
-- chemins d'appel ; celui-ci pose le filet en dessous.
--
-- ── RELEVÉ PROD DU 2026-09-11, AVANT POSE ─────────────────────────────────
--   RECRUTEUR_COACH    : 8 lignes, 1 seul groupe en doublon (les 4 du volet 1)
--                        recruiter_id / coach_id / athlete_id : AUCUN NULL
--   RECRUTEUR_ATHLETE  : 2 lignes, ZÉRO doublon
--                        coach_id : NULL sur les 2 (normal, il n'y a pas de
--                        coach dans une conversation recruteur↔athlète)
--
-- ── POURQUOI LES DEUX INDEX N'ONT PAS LA MÊME FORME ───────────────────────
-- ⚠️ C'est le piège de ce volet. Un index unique traite chaque NULL comme une
-- valeur DISTINCTE : deux lignes (r1, NULL, a1) ne se collisionnent jamais.
-- Reprendre la forme à trois colonnes pour RECRUTEUR_ATHLETE, dont le
-- `coach_id` est NULL par construction, aurait donc posé un index qui ne
-- refuse RIEN — vert au déploiement, inerte à l'usage, et personne pour s'en
-- apercevoir avant le prochain doublon.
-- La clé naturelle de chaque type est donc nommée explicitement :
--   RECRUTEUR_COACH   → (recruiter_id, coach_id, athlete_id)
--   RECRUTEUR_ATHLETE → (recruiter_id, athlete_id)
--
-- ── CE VOLET FERME LES DEUX DERNIERS TROUS D'UN MOTIF DÉJÀ EN PLACE ───────
-- Relevé des index uniques existants sur `conversations` (prod, 2026-09-11) :
--   ADMIN_USER     → conversations_admin_athlete_uniq / _admin_coach_uniq /
--                    _admin_recruiter_uniq   (3 index, chacun gardé par
--                    « AND <colonne> IS NOT NULL » — la parade au piège NULL)
--   ATHLETE_COACH  → uq_conversations_athlete_coach  (athlete_id, coach_id)
--   COACH_COACH    → uq_conversations_coach_coach
--                    (LEAST(coach_id, coach_b_id), GREATEST(…),
--                     COALESCE(athlete_id, '000…0')) — LEAST/GREATEST parce
--                    que la relation est SYMÉTRIQUE, COALESCE pour la même
--                    raison NULL que ci-dessus
--   PARENT_COACH   → uq_conversations_parent_coach  (parent_id, coach_id, athlete_id)
--   GROUP          → uq_group_staff / uq_group_team
--
-- Autrement dit : les SEULS types sans garde-fou étaient RECRUTEUR_COACH et
-- RECRUTEUR_ATHLETE. Ce n'est donc pas une nouvelle politique, c'est la fin
-- d'une exception — et elle explique pourquoi les quatre doublons sont
-- apparus là et nulle part ailleurs.
--
-- Les deux index posés ici suivent la maison : prédicat sur le type, clé
-- naturelle nommée colonne par colonne, aucune colonne nullable dans la clé.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PRÉ-VOL : refuser de poser un index qui échouerait, avec un message
--    lisible plutôt qu'une violation d'unicité brute.
DO $$
DECLARE v_rc int; v_ra int;
BEGIN
  SELECT count(*) INTO v_rc FROM (
    SELECT 1 FROM public.conversations WHERE conversation_type = 'RECRUTEUR_COACH'
     GROUP BY recruiter_id, coach_id, athlete_id HAVING count(*) > 1) x;
  SELECT count(*) INTO v_ra FROM (
    SELECT 1 FROM public.conversations WHERE conversation_type = 'RECRUTEUR_ATHLETE'
     GROUP BY recruiter_id, athlete_id HAVING count(*) > 1) y;

  IF v_rc > 0 THEN
    RAISE EXCEPTION 'NEXUS D6/2 : % groupe(s) RECRUTEUR_COACH encore en doublon. Passer le volet 1 d''abord.', v_rc;
  END IF;
  IF v_ra > 0 THEN
    RAISE EXCEPTION 'NEXUS D6/2 : % groupe(s) RECRUTEUR_ATHLETE en doublon — non prévu, à dédoublonner avant.', v_ra;
  END IF;
  RAISE NOTICE 'D6/2 pré-vol : 0 doublon RECRUTEUR_COACH, 0 doublon RECRUTEUR_ATHLETE.';
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_recruteur_coach
  ON public.conversations (recruiter_id, coach_id, athlete_id)
  WHERE conversation_type = 'RECRUTEUR_COACH';

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_recruteur_athlete
  ON public.conversations (recruiter_id, athlete_id)
  WHERE conversation_type = 'RECRUTEUR_ATHLETE';

COMMENT ON INDEX public.uq_conversations_recruteur_coach IS
  'D6/2 — une seule conversation par (recruteur, coach, athlète). Le code doit rattraper le 23505 et rendre la conversation existante (chantier CODE volet 4).';
COMMENT ON INDEX public.uq_conversations_recruteur_athlete IS
  'D6/2 — une seule conversation par (recruteur, athlète). PAS de coach_id dans la clé : il est NULL par construction sur ce type, et un NULL dans un index unique ne collisionne jamais.';
