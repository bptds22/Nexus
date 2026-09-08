-- ═══════════════════════════════════════════════════════════════════════════
-- ANCRAGE CIVIL — le retrait d'équipe ne touche PLUS JAMAIS school_id
--
-- INVARIANT PRODUIT (décision BP, 2026-09-08) :
--   Un athlète d'un club civil EXISTANT porte school_id = la ligne `schools`
--   de ce club (type = 'LIGUE_CIVILE'). `school_id IS NULL` signifie
--   « civil SANS club », et rien d'autre.
--
-- CE QUI EXISTAIT ET POURQUOI ON LE RETIRE
-- ----------------------------------------
-- `reset_athlete_anchor_on_team_remove()`, AFTER DELETE FOR EACH ROW sur
-- public.team_athletes, traitait les types d'organisation de façon ASYMÉTRIQUE :
--
--     IF v_team_school_type IN ('SECONDAIRE','CEGEP') THEN RETURN OLD; END IF;
--     -- LIGUE_CIVILE, aucune autre équipe civile :
--     IF v_other_civil_count = 0 THEN
--       UPDATE athletes SET school_id = NULL
--       WHERE id = OLD.athlete_id AND school_id = v_deleted_school_id;
--     ELSE
--       UPDATE athletes SET school_id = (autre club civil le plus récent) ...
--     END IF;
--
-- L'école survivait à la perte d'une équipe ; le CLUB CIVIL, non. Or un club
-- civil est une ligne `schools` aussi durable qu'une école : retirer un athlète
-- d'une équipe ne le fait pas quitter le club. Le trigger détruisait donc un
-- fait vrai, et il le détruisait SANS TRACE — une fois school_id à NULL et la
-- ligne team_athletes supprimée, plus rien ne permet de retrouver le club.
--
-- Coût observé en prod le 2026-09-08 : un athlète (Felix Larocque, 87357e9e)
-- rendu irréparable par ce chemin — `nb_teams = 0`, `parcours_equipes` vide,
-- aucune donnée ne prouve plus son club. Il est explicitement EXCLU de la
-- remédiation (LOT 3) pour cette raison : on ne réécrit pas une inférence.
--
-- Effet de bord en cascade, côté application : `.eq("school_id", …)` écarte
-- silencieusement un NULL (`NULL = x` → UNKNOWN), donc chaque athlète nullé
-- disparaissait des surfaces coach — roster, transfert — tout en restant
-- visible sur la page équipe. Le bug « visible ici, vide là » commençait ICI.
--
-- POURQUOI UN DROP ET PAS UN CREATE OR REPLACE NEUTRALISÉ
-- -------------------------------------------------------
--   1. Retirer la voie LIGUE_CIVILE rend la fonction INTÉGRALEMENT morte : les
--      deux autres chemins (type introuvable → cascade en cours ; SECONDAIRE /
--      CEGEP) font déjà `RETURN OLD`. Il ne resterait qu'un trigger exécuté à
--      chaque DELETE pour ne rien faire.
--   2. La décision est « le retrait d'équipe ne touche JAMAIS l'ancrage ».
--      L'absence de trigger dit exactement ça ; une fonction vide le suggère.
--      Perdre son club redevient un ACTE EXPLICITE : le flow applicatif
--      « Libérer l'athlète » (confirmation UI, renvoi au pool de réclamation)
--      remplace cet effet de bord. Un trigger ne peut pas demander confirmation.
--   3. Piège ACL de CLAUDE.md : tout CREATE relance l'ALTER DEFAULT PRIVILEGES
--      de Supabase sur `public`, qui re-accorde EXECUTE à `anon`. Ne rien créer
--      supprime ce risque à la racine plutôt que de le rattraper au gate.
--
-- REVERT : rejouer la définition d'origine (voir la migration qui a créé
-- `reset_athlete_anchor_on_team_remove`), puis ré-attacher le trigger
-- AFTER DELETE ON public.team_athletes FOR EACH ROW.
--
-- ⚠ CE QUE CETTE MIGRATION NE FAIT PAS
--   · Elle ne répare AUCUNE donnée existante — c'est le LOT 3, et il doit
--     passer APRÈS le LOT 2 (application), sinon les chemins d'écriture
--     re-produisent des NULL sur les lignes qu'on vient de réparer.
--   · Elle ne corrige PAS les 4 INSERT directs dans team_athletes qui
--     n'ancrent jamais (LOT 2b) : à l'ATTACHEMENT, seule la RPC
--     `_apply_team_attachment_core` pose school_id. Tant que le LOT 2 n'est
--     pas livré, un athlète ajouté par la page équipe reste sans ancrage.
--     Cette migration arrête la DESTRUCTION, elle ne crée pas la POSE.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS reset_athlete_anchor_on_team_remove
  ON public.team_athletes;

DROP FUNCTION IF EXISTS public.reset_athlete_anchor_on_team_remove();

-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — structurel uniquement, par comparaison COMPLÈTE (CLAUDE.md).
--
-- Aucune écriture de données de test : la preuve comportementale (« retirer un
-- civil de son équipe conserve school_id ») exige de créer puis supprimer un
-- athlète et une équipe. Sur le cloud c'est interdit. Elle se fait sur Docker
-- local, annoncée avant le geste, hors de cette migration.
--
-- Le gate 3 ne vérifie pas « mon trigger est parti » (gate 1 le fait) mais
-- « AUCUN trigger de team_athletes ne remet school_id à zéro » — une liste
-- blanche vérifiée par inclusion laisse entrer ce qu'elle n'a pas nommé.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  v_trig   int;
  v_func   int;
  v_reste  text;
BEGIN
  -- 1. Le trigger n'est plus attaché à team_athletes.
  SELECT count(*) INTO v_trig
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'team_athletes'
    AND t.tgname  = 'reset_athlete_anchor_on_team_remove';

  IF v_trig <> 0 THEN
    RAISE EXCEPTION
      'NEXUS: le trigger reset_athlete_anchor_on_team_remove est encore attaché à team_athletes (% occurrence(s))', v_trig;
  END IF;

  -- 2. La fonction n'existe plus (aucune surcharge résiduelle).
  SELECT count(*) INTO v_func
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'reset_athlete_anchor_on_team_remove';

  IF v_func <> 0 THEN
    RAISE EXCEPTION
      'NEXUS: la fonction public.reset_athlete_anchor_on_team_remove existe encore (% signature(s))', v_func;
  END IF;

  -- 3. Plus AUCUN trigger de team_athletes n'écrit athletes.school_id.
  --    Comparaison exhaustive : on énumère ce qui reste et on refuse tout
  --    corps qui met à jour athletes en mentionnant school_id.
  SELECT string_agg(t.tgname || ' → ' || p.proname, ', ' ORDER BY t.tgname)
    INTO v_reste
  FROM pg_trigger t
  JOIN pg_class c     ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p      ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname = 'team_athletes'
    AND pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?athletes'
    AND pg_get_functiondef(p.oid) ~* 'school_id';

  IF v_reste IS NOT NULL THEN
    RAISE EXCEPTION
      'NEXUS: un trigger de team_athletes écrit encore athletes.school_id : %', v_reste;
  END IF;

  RAISE NOTICE 'NEXUS: ancrage civil — retrait d''équipe neutralisé, 3/3 gates verts.';
END
$gate$;
