-- ═══════════════════════════════════════════════════════════════════════════
-- RESPONSABLE D'ÉQUIPE — VAGUE 1 : contraintes + backfill des RÔLES
--
-- Lots couverts : A1 (CHECK role), A2 (index unique partiel), A-bis (backfill).
-- Le Lot A3 (fonction de résolution + triggers de synchro coach_id) et le Lot B
-- (backfill coach_id) sont dans la VAGUE 2, réservée au release 1.4.1 : ce sont
-- eux l'interrupteur de comportement, et ils partent avec le frontend.
--
-- INVARIANTS PRODUIT (BP, 2026-09-08)
--   I1  Une équipe ayant au moins un coach a EXACTEMENT UN responsable
--       (head_coach, sinon head_coach_interim).
--       ⚠ REFORMULATION ARBITRÉE (T7) : le SQL n'impose que « AU PLUS UN »
--       (index unique partiel). « EXACTEMENT un » est une cible PRODUIT, tenue
--       par les triggers de la vague 2 et par l'UI (Lots C/D) — jamais par une
--       contrainte. Un DELETE du responsable laisse volontairement l'équipe
--       sans responsable (aucune auto-promotion) ; c'est un bandeau UI, pas une
--       erreur SQL. Ne pas relire cet index comme une garantie de I1.
--   I2  athletes.coach_id devient DÉRIVÉ (vague 2).
--
-- CE QUE CETTE VAGUE FAIT, ET NE FAIT PAS
--   · Elle prépare le vocabulaire (head_coach_interim) et le verrou d'unicité.
--   · Elle nomme un responsable là où il est NON AMBIGU (équipe mono-coach).
--   · Elle NE TOUCHE PAS athletes.coach_id. Aucun comportement applicatif ne
--     dépend encore du responsable : la vague 1 est sans effet fonctionnel.
--
--   ⚠ SEULE EXCEPTION, ASSUMÉE — l'affichage. Les deux surfaces qui rendent le
--     badge de rôle font `ROLE_LABELS[c.role] || c.role` :
--       app/coach/equipes/[teamId]/PageClient.tsx:722
--       app/coach/equipes/page.tsx:346
--     Un rôle inconnu ne casse pas, il s'affiche BRUT. Les coachs promus ici
--     afficheront donc « HEAD_COACH_INTERIM » jusqu'à la livraison du Lot D.
--     Corrigeable en 2 lignes (ajouter la clé aux deux ROLE_LABELS) si la
--     fenêtre entre les deux vagues est visible par des utilisateurs.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- RELEVÉS PRÉ-MIGRATION (cloud, 2026-09-09, lecture seule)
--
--   A1 — valeurs de team_coaches.role :
--        assistant = 7 | head_coach = 5
--        → aucune valeur hors liste cible, aucun NULL. Le CHECK est satisfait
--          par l'existant ; il n'invalide aucune ligne.
--
--   A2 — équipes portant plus d'un responsable : 0 ligne.
--        → l'index unique partiel se crée sans conflit.
--
--   A-bis — équipes ayant des coachs mais AUCUN responsable : 5, toutes
--        MONO-COACH (donc non ambiguës, promotion automatique) :
--          786a82d7 Wildcats Midget D1        — Chuck Guitard      (6 athlètes)
--          2713b827 Wildcats D2               — Raphaël Lajoie     (2 athlètes)
--          090e0ce0 Wildcats L-L Midget D1    — Chuck Guitard      (0)
--          8afff5da Junior Wildcats           — Chuck Guitard      (0)
--          25bf74a0 Curé-Mercure              — (nom vide, cf. T8) (0)
--        → équipes MULTI-COACH sans responsable : 0. Aucune décision BP requise
--          sur cette vague. Le gate 5 le vérifie et REFUSE toute promotion
--          automatique sur une équipe multi-coach si le cas apparaissait.
--
--   FK — team_coaches.coach_id → users(id) ON DELETE CASCADE, zéro orphelin.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── A1 — vocabulaire fermé ──────────────────────────────────────────────────
-- Le rôle devient PORTEUR D'AUTORITÉ en vague 2 : il désigne le référent de
-- tous les athlètes de l'équipe. Le vocabulaire doit donc rester fermé — et il
-- doit s'ouvrir à head_coach_interim, que l'existant interdit.
--
-- ⚠ IL Y AVAIT DÉJÀ UNE CONTRAINTE. Relevé cloud 2026-09-09 :
--     team_coaches_role_check
--       CHECK ((role = ANY (ARRAY['head_coach','assistant','coordinator'])))
--   `role` n'a JAMAIS été un text libre — un premier audit l'avait conclu à tort
--   en n'interrogeant que pg_type (enum) et pg_attribute (type de colonne),
--   jamais pg_constraint. Conséquence directe : 'head_coach_interim' est
--   INTERDIT par l'existant, et A1 n'AJOUTE pas une contrainte — il en
--   REMPLACE une, pour l'élargir d'une quatrième valeur.
--   PostgreSQL n'a pas d'ALTER pour un CHECK : c'est DROP puis ADD.
--
-- 'coordinator' est CONSERVÉ (arbitrage T6) : rôle DÉCORATIF, jamais responsable.
-- Conséquence assumée : une équipe dont l'unique coach est coordonnateur reste
-- sans responsable — A-bis ne le promeut pas (voir la garde ci-dessous).
ALTER TABLE public.team_coaches
  DROP CONSTRAINT team_coaches_role_check;

ALTER TABLE public.team_coaches
  ADD CONSTRAINT team_coaches_role_check
  CHECK (role IN ('head_coach', 'head_coach_interim', 'assistant', 'coordinator'));


-- ── A2 — au plus un responsable par équipe ──────────────────────────────────
-- Index partiel : il ne contraint QUE les deux rôles responsables, donc autant
-- d'assistants et de coordonnateurs qu'on veut. C'est ce verrou qui rend la
-- passation atomique côté UI (Lot D) : promouvoir B avant de rétrograder A
-- échoue, ce qui force la séquence correcte au lieu de la laisser au hasard.
CREATE UNIQUE INDEX team_coaches_one_referent_per_team
  ON public.team_coaches (team_id)
  WHERE role IN ('head_coach', 'head_coach_interim');


-- ── A-bis — backfill des rôles, cas NON AMBIGU uniquement ───────────────────
-- Règle : une équipe sans responsable dont l'UNIQUE coach est 'assistant' →
-- ce coach devient head_coach_interim.
--
-- Les trois gardes, et pourquoi chacune :
--   role = 'assistant'          → ne rétrograde jamais un head_coach existant,
--                                 et ne réquisitionne pas un 'coordinator'
--                                 (décoratif par arbitrage T6).
--   aucun responsable déjà      → idempotence : rejouer la migration ne fait rien.
--   count(coachs) = 1           → AUCUNE promotion automatique sur une équipe
--                                 multi-coach ; ce cas est une décision BP,
--                                 équipe par équipe. Zéro occurrence aujourd'hui.
UPDATE public.team_coaches tc
   SET role = 'head_coach_interim'
 WHERE tc.role = 'assistant'
   AND NOT EXISTS (
         SELECT 1 FROM public.team_coaches x
          WHERE x.team_id = tc.team_id
            AND x.role IN ('head_coach', 'head_coach_interim'))
   AND (SELECT count(*) FROM public.team_coaches x WHERE x.team_id = tc.team_id) = 1;


-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — comparaison COMPLÈTE, jamais par inclusion (CLAUDE.md).
-- Marqueur NEXUS: obligatoire, sinon le RAISE n'atteint pas l'écran.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  v_check_def text;
  v_idx_def   text;
  v_hors      text;
  v_multi     text;
  v_orphelin  text;
  v_promus    int;
BEGIN
  -- 1. Le CHECK existe, et sa définition est celle attendue (pas seulement
  --    « une contrainte du même nom »).
  SELECT pg_get_constraintdef(c.oid) INTO v_check_def
  FROM pg_constraint c
  WHERE c.conrelid = 'public.team_coaches'::regclass
    AND c.conname  = 'team_coaches_role_check';

  IF v_check_def IS NULL THEN
    RAISE EXCEPTION 'NEXUS: contrainte team_coaches_role_check absente';
  END IF;
  IF v_check_def !~ 'head_coach_interim' OR v_check_def !~ 'coordinator'
     OR v_check_def !~ 'assistant'       OR v_check_def !~ 'head_coach' THEN
    RAISE EXCEPTION 'NEXUS: team_coaches_role_check ne couvre pas les 4 valeurs : %', v_check_def;
  END IF;
  -- L'ANCIENNE contrainte à 3 valeurs ne doit plus exister nulle part : un
  -- DROP raté suivi d'un ADD sous un autre nom laisserait head_coach_interim
  -- interdit tout en faisant passer le test ci-dessus.
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conrelid = 'public.team_coaches'::regclass AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ~ 'role'
       AND pg_get_constraintdef(c.oid) !~ 'head_coach_interim'
  ) THEN
    RAISE EXCEPTION 'NEXUS: une contrainte CHECK sur role interdisant head_coach_interim subsiste';
  END IF;

  -- 2. L'index unique partiel existe, UNIQUE, et porte bien la clause WHERE.
  --    Un index sans son WHERE interdirait plusieurs assistants : régression.
  SELECT indexdef INTO v_idx_def
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'team_coaches'
    AND indexname  = 'team_coaches_one_referent_per_team';

  IF v_idx_def IS NULL THEN
    RAISE EXCEPTION 'NEXUS: index team_coaches_one_referent_per_team absent';
  END IF;
  IF v_idx_def !~* 'UNIQUE' OR v_idx_def !~* 'WHERE' OR v_idx_def !~ 'head_coach_interim' THEN
    RAISE EXCEPTION 'NEXUS: index one_referent mal formé (UNIQUE + WHERE partiel attendus) : %', v_idx_def;
  END IF;

  -- 3. Aucune valeur de rôle hors du vocabulaire — énumération exhaustive,
  --    pas un test d'appartenance sur une liste blanche partielle.
  SELECT string_agg(DISTINCT COALESCE(tc.role, '<NULL>'), ', ') INTO v_hors
  FROM public.team_coaches tc
  WHERE tc.role IS NULL
     OR tc.role NOT IN ('head_coach', 'head_coach_interim', 'assistant', 'coordinator');

  IF v_hors IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: valeurs de role hors vocabulaire : %', v_hors;
  END IF;

  -- 4. Aucune équipe à deux responsables (l'index le garantit, on le PROUVE).
  SELECT string_agg(x.team_id::text, ', ') INTO v_multi
  FROM (SELECT team_id FROM public.team_coaches
         WHERE role IN ('head_coach', 'head_coach_interim')
         GROUP BY team_id HAVING count(*) > 1) x;

  IF v_multi IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: équipes à plusieurs responsables : %', v_multi;
  END IF;

  -- 5. AUCUNE équipe multi-coach n'a été promue automatiquement.
  --    Si une telle équipe existe sans responsable, c'est une décision BP :
  --    la migration doit la SIGNALER, pas la trancher.
  SELECT string_agg(x.team_id::text || ' (' || x.n || ' coachs)', ', ') INTO v_multi
  FROM (SELECT tc.team_id, count(*) AS n
          FROM public.team_coaches tc
         GROUP BY tc.team_id
        HAVING count(*) > 1
           AND NOT EXISTS (SELECT 1 FROM public.team_coaches y
                            WHERE y.team_id = tc.team_id
                              AND y.role IN ('head_coach', 'head_coach_interim'))) x;

  IF v_multi IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: équipes MULTI-COACH sans responsable — arbitrage BP requis, la migration ne tranche pas : %', v_multi;
  END IF;

  -- 6. Plus aucune équipe mono-coach 'assistant' orpheline de responsable.
  SELECT string_agg(x.team_id::text, ', ') INTO v_orphelin
  FROM (SELECT tc.team_id
          FROM public.team_coaches tc
         GROUP BY tc.team_id
        HAVING count(*) = 1
           AND bool_or(tc.role = 'assistant')
           AND NOT EXISTS (SELECT 1 FROM public.team_coaches y
                            WHERE y.team_id = tc.team_id
                              AND y.role IN ('head_coach', 'head_coach_interim'))) x;

  IF v_orphelin IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: équipes mono-coach encore sans responsable après A-bis : %', v_orphelin;
  END IF;

  SELECT count(*) INTO v_promus
  FROM public.team_coaches WHERE role = 'head_coach_interim';

  RAISE NOTICE 'NEXUS: vague 1 — 6/6 gates verts. % responsable(s) intérimaire(s) en place.', v_promus;
END
$gate$;
