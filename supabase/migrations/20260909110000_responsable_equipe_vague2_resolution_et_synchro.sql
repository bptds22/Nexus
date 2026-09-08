-- ═══════════════════════════════════════════════════════════════════════════
-- RESPONSABLE D'ÉQUIPE — VAGUE 2 : résolution + synchronisation de coach_id
--
-- ⚠ NON APPLIQUÉE — réservée au release 1.4.1. C'est l'INTERRUPTEUR DE
--   COMPORTEMENT : elle rend athletes.coach_id dérivé, et elle part avec le
--   frontend (Lots C/D/E/F), jamais avant.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DOCTRINE — IDENTITÉ vs POINTEUR CALCULÉ (BP, 2026-09-09, arbitrage T3)
--
-- La règle du 2026-09-08 (migration 20260908151616, suppression de
-- reset_athlete_anchor_on_team_remove) protège l'IDENTITÉ, pas les champs
-- dérivés.
--
--   school_id  = ANCRAGE DURABLE. Qui est ce jeune, à quel club il appartient.
--                AUCUN geste d'équipe ne le touche, jamais. C'est ce que la
--                migration du 8/09 a gravé, et ça reste entier.
--
--   coach_id   = POINTEUR CALCULÉ. Qui répond pour ce jeune EN CE MOMENT.
--                Maintenu par triggers DANS LES DEUX SENS — arrivée ET départ.
--                Un pointeur dérivé qui ne se recalcule qu'à l'arrivée n'est
--                pas dérivé : il est PÉRIMÉ. Ne rien faire au retrait
--                recréerait exactement le mal qu'on soigne — un recruteur
--                routé vers un coach qui n'a plus le jeune.
--
-- Test de cohérence : A3 mute déjà coach_id sur INSERT/UPDATE de team_athletes
-- sans que personne n'y voie une violation du 8/09 — parce que chacun a
-- compris intuitivement que la règle porte sur l'ancrage. On ne fait que
-- l'écrire noir sur blanc.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Lots couverts : A3 (fn_resolve_team_referent + triggers), B (backfill coach_id).
-- Prérequis : vague 1 appliquée (vocabulaire head_coach_interim + index unique).
--
-- I2  athletes.coach_id = responsable de l'équipe du jeune
--                       ; sinon DIRECTEUR de l'école/club
--                       ; sinon NULL (aucun staff connecté).
-- I3  Un jeune qui change d'équipe : coach_id suit le responsable de la destination.
-- I4  Les conversations restent à la PERSONNE — aucun fil n'est réassigné ici.
--     Évaluations et réputation : attachées à la personne, intactes.
--
-- ── CE QUE CETTE VAGUE NE RÉPARE PAS (mesuré, à ne pas découvrir en recette) ──
-- Sur les 53 athlètes ACTIF en équipe, APRÈS vague 1 + vague 2 :
--     head_coach 1 (1,9%) | intérim 8 (15,1%) | directeur 1 (1,9%) | PERSONNE 43 (81,1%)
-- Le trou de 81 % est STRUCTUREL : 39 des 42 équipes concernées n'ont aucun
-- coach, et 7 écoles sur 38 ont un directeur. Aucune règle de résolution ne crée
-- du staff. Accepté comme état nominal (arbitrage T2) ; c'est pourquoi le Lot F2
-- (« Le staff de cette équipe n'est pas encore sur Nexus ») est le cas DOMINANT
-- côté recruteur, pas un cas limite.
--
-- ── LOT B : un no-op mesuré, conservé volontairement ─────────────────────────
-- Simulation post-vague-1 des 53 : 43 « les deux NULL » + 10 « déjà conforme »,
-- 0 à poser, 0 conflit. Le backfill écrira DONC ZÉRO LIGNE aujourd'hui.
-- Il est gardé (décision BP) comme filet et comme trace d'intention.
-- ⚠ Sa garde `coach_id IS NULL` est INVERSE de la sémantique « champ dérivé » :
-- elle ne peut pas corriger un désaccord owner<>référent, seulement combler un
-- trou. Zéro occurrence aujourd'hui ; si un conflit apparaît plus tard, ce
-- backfill ne le verra pas. Conservée en connaissance de cause.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── A3.1 — LA résolution, une seule implémentation ──────────────────────────
-- Toute surface qui demande « qui est le référent de cet athlète » passe ici.
-- Ne jamais réécrire cette cascade ailleurs : c'est la cause racine du bug
-- « visible ici, vide là » que la session du 8/09 a passé à refermer.
CREATE OR REPLACE FUNCTION public.fn_resolve_team_referent(p_team_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  SELECT COALESCE(
    (SELECT tc.coach_id FROM public.team_coaches tc
      WHERE tc.team_id = p_team_id AND tc.role = 'head_coach' LIMIT 1),
    (SELECT tc.coach_id FROM public.team_coaches tc
      WHERE tc.team_id = p_team_id AND tc.role = 'head_coach_interim' LIMIT 1),
    (SELECT sc.coach_id FROM public.school_coaches sc
       JOIN public.teams t ON t.school_id = sc.school_id
      WHERE t.id = p_team_id
        AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM') LIMIT 1)
  );
$function$;

REVOKE ALL ON FUNCTION public.fn_resolve_team_referent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_resolve_team_referent(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_resolve_team_referent(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.fn_resolve_team_referent(uuid) FROM service_role;


-- ── A3.2 — resynchronisation de tous les athlètes d'une équipe ──────────────
CREATE OR REPLACE FUNCTION public.fn_resync_team_coach_id(p_team_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  UPDATE public.athletes a
     SET coach_id = public.fn_resolve_team_referent(p_team_id)
    FROM public.team_athletes ta
   WHERE ta.team_id = p_team_id
     AND a.id = ta.athlete_id
     AND a.coach_id IS DISTINCT FROM public.fn_resolve_team_referent(p_team_id);
$function$;

REVOKE ALL ON FUNCTION public.fn_resync_team_coach_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_resync_team_coach_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_resync_team_coach_id(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.fn_resync_team_coach_id(uuid) FROM service_role;


-- ── A3.3 — team_coaches : arrivée d'un coach ────────────────────────────────
-- DOUBLE GARDE (arbitrage T5) : on ne promeut d'office QUE
--   · un rôle 'assistant' — jamais un head_coach ni un coordinator explicites ;
--   · une AUTO-JOINTURE — le coach s'inscrit lui-même (coach_id = auth.uid()),
--     jamais quand un tiers l'ajoute à une équipe.
-- Sans ces gardes, un « + Ajouter un entraîneur » ferait d'un assistant le
-- responsable à l'insu des deux parties.
CREATE OR REPLACE FUNCTION public.trg_team_coaches_referent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'assistant'
       AND NEW.coach_id = auth.uid()
       AND NOT EXISTS (SELECT 1 FROM public.team_coaches x
                        WHERE x.team_id = NEW.team_id
                          AND x.id <> NEW.id
                          AND x.role IN ('head_coach', 'head_coach_interim'))
    THEN
      UPDATE public.team_coaches SET role = 'head_coach_interim' WHERE id = NEW.id;
    END IF;
    PERFORM public.fn_resync_team_coach_id(NEW.team_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      PERFORM public.fn_resync_team_coach_id(NEW.team_id);
      IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
        PERFORM public.fn_resync_team_coach_id(OLD.team_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- DELETE : repli per I2. AUCUNE auto-promotion d'un autre coach — décision
  -- BP explicite ; l'équipe reste sans responsable et l'UI porte le bandeau.
  PERFORM public.fn_resync_team_coach_id(OLD.team_id);
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_team_coaches_referent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_team_coaches_referent() FROM anon;
REVOKE ALL ON FUNCTION public.trg_team_coaches_referent() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_team_coaches_referent() FROM service_role;

DROP TRIGGER IF EXISTS team_coaches_referent_sync ON public.team_coaches;
CREATE TRIGGER team_coaches_referent_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.team_coaches
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_coaches_referent();


-- ── A3.4 — team_athletes : arrivée / déplacement d'un jeune (I3) ────────────
CREATE OR REPLACE FUNCTION public.trg_team_athletes_referent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  UPDATE public.athletes a
     SET coach_id = public.fn_resolve_team_referent(NEW.team_id)
   WHERE a.id = NEW.athlete_id
     AND a.coach_id IS DISTINCT FROM public.fn_resolve_team_referent(NEW.team_id);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_team_athletes_referent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent() FROM anon;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent() FROM service_role;

DROP TRIGGER IF EXISTS team_athletes_referent_sync ON public.team_athletes;
CREATE TRIGGER team_athletes_referent_sync
  AFTER INSERT OR UPDATE OF team_id ON public.team_athletes
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_athletes_referent();


-- ── A3.5 — team_athletes : RETRAIT (T3, option (b) arbitrée le 2026-09-09) ──
-- Le jeune quitte l'équipe → son référent est re-dérivé : directeur de l'école
-- de l'équipe quittée, sinon NULL. Voir la DOCTRINE en tête : c'est le pendant
-- obligatoire de A3.4. Sans lui, coach_id resterait figé sur un responsable qui
-- n'a plus le jeune, et le routage recruteur enverrait au mauvais interlocuteur.
--
-- ⚠ Ce trigger mute `athletes` sur un DELETE de `team_athletes` — le MÊME motif
--   que celui supprimé le 8/09. La différence est le CHAMP, pas la forme :
--   school_id (identité, intouchable) vs coach_id (pointeur, recalculé).
--   `school_id` n'apparaît nulle part ci-dessous, et c'est délibéré.
CREATE OR REPLACE FUNCTION public.trg_team_athletes_referent_remove()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_school uuid;
  v_ref    uuid;
BEGIN
  -- L'équipe peut déjà être partie (cascade) : dans ce cas plus d'école à
  -- interroger, le repli est NULL. Silencieux, jamais une exception.
  SELECT t.school_id INTO v_school FROM public.teams t WHERE t.id = OLD.team_id;

  IF v_school IS NOT NULL THEN
    SELECT sc.coach_id INTO v_ref
    FROM public.school_coaches sc
    WHERE sc.school_id = v_school
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
    LIMIT 1;
  END IF;

  -- Ne réécrit QUE coach_id. school_id n'est pas touché — c'est l'ancrage.
  UPDATE public.athletes a
     SET coach_id = v_ref
   WHERE a.id = OLD.athlete_id
     AND a.coach_id IS DISTINCT FROM v_ref
     -- Garde anti-course : si le jeune a déjà rejoint une autre équipe dans la
     -- même transaction (déplacement fait en DELETE+INSERT par un chemin tiers),
     -- A3.4 a déjà posé le bon référent — on ne l'écrase pas.
     AND NOT EXISTS (SELECT 1 FROM public.team_athletes ta
                      WHERE ta.athlete_id = OLD.athlete_id);

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_team_athletes_referent_remove() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent_remove() FROM anon;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent_remove() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_team_athletes_referent_remove() FROM service_role;

DROP TRIGGER IF EXISTS team_athletes_referent_remove ON public.team_athletes;
CREATE TRIGGER team_athletes_referent_remove
  AFTER DELETE ON public.team_athletes
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_athletes_referent_remove();


-- ── LOT F1 — le routage recruteur passe par la résolution ───────────────────
-- `notify_first_recruiter_contact` lisait `athletes.coach_id` en direct. Ça
-- reste correct une fois coach_id dérivé, mais ça fige la règle à deux
-- endroits : la fonction de notification et fn_resolve_team_referent
-- pourraient diverger au premier changement de cascade.
--
-- Elle interroge donc désormais la résolution, avec un repli sur coach_id pour
-- l'athlète SANS équipe (que la résolution, qui part d'un team_id, ne peut pas
-- traiter). Le cas NULL restant signifie alors ce qu'il dit : personne du staff
-- de cette équipe n'est sur Nexus — c'est le message du Lot F2 côté client,
-- plus le silence d'aujourd'hui.
--
-- ⚠ Le reste du corps est repris À L'IDENTIQUE de la version en production
-- (gardes IS NOT NULL, branche PARENT, envoi push, EXCEPTION WHEN OTHERS).
-- Seule la résolution de v_coach change.
CREATE OR REPLACE FUNCTION public.notify_first_recruiter_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $function$
DECLARE
  v_coach        uuid;
  v_parent_email text;
  v_secret       text;
  v_url          text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
BEGIN
  IF NEW.conversation_type <> 'RECRUTEUR_ATHLETE' THEN
    RETURN NEW;
  END IF;

  -- Référent de l'équipe du jeune ; à défaut d'équipe, son coach_id courant.
  SELECT COALESCE(
           (SELECT public.fn_resolve_team_referent(ta.team_id)
              FROM public.team_athletes ta
             WHERE ta.athlete_id = NEW.athlete_id
             LIMIT 1),
           a.coach_id),
         nullif(a.parent_email, '')
    INTO v_coach, v_parent_email
  FROM public.athletes a WHERE a.id = NEW.athlete_id;

  IF v_coach IS NOT NULL THEN
    INSERT INTO public.recruiter_contact_notifications (conversation_id, athlete_id, recruiter_id, notified_role, notified_ref)
    VALUES (NEW.id, NEW.athlete_id, NEW.recruiter_id, 'COACH', v_coach::text);
  END IF;
  IF v_parent_email IS NOT NULL THEN
    INSERT INTO public.recruiter_contact_notifications (conversation_id, athlete_id, recruiter_id, notified_role, notified_ref)
    VALUES (NEW.id, NEW.athlete_id, NEW.recruiter_id, 'PARENT', v_parent_email);
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
    IF v_secret IS NOT NULL AND v_coach IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-push-secret',v_secret),
        body := jsonb_build_object(
          'user_id', v_coach, 'title', 'Nexus',
          'body', 'Un recruteur a contacté votre athlète.',
          'data', jsonb_build_object('type','recruiter_contact','conversation_id', NEW.id))
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_first_recruiter_contact: livraison échouée conv %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;


-- ── LOT B — backfill coach_id (no-op mesuré, cf. en-tête) ───────────────────
UPDATE public.athletes a
   SET coach_id = public.fn_resolve_team_referent(ta.team_id),
       updated_at = now()
  FROM public.team_athletes ta
 WHERE ta.athlete_id = a.id
   AND a.coach_id IS NULL
   AND public.fn_resolve_team_referent(ta.team_id) IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — modèle 20260908152452 : DEFINER + proconfig pinné + ACL complète.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  r          record;
  v_acl      text[];
  v_acl_veut text[] := ARRAY['postgres'];
BEGIN
  -- 1-3. Les 4 fonctions : DEFINER, les deux réglages pinnés, ACL = {postgres}.
  FOR r IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname IN ('fn_resolve_team_referent', 'fn_resync_team_coach_id',
                        'trg_team_coaches_referent', 'trg_team_athletes_referent',
                        'trg_team_athletes_referent_remove')
  LOOP
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'NEXUS: % n''est pas SECURITY DEFINER', r.proname;
    END IF;
    IF r.proconfig IS NULL
       OR NOT ('search_path=public' = ANY (r.proconfig))
       OR NOT ('row_security=off'  = ANY (r.proconfig)) THEN
      RAISE EXCEPTION 'NEXUS: proconfig incomplet sur % : %', r.proname,
        COALESCE(r.proconfig::text, '<NULL>');
    END IF;

    SELECT array_agg(g ORDER BY g) INTO v_acl
    FROM pg_proc pr,
         LATERAL (SELECT COALESCE(NULLIF(split_part(x,'=',1),''),'PUBLIC') AS g
                    FROM unnest(pr.proacl::text[]) AS x) t
    WHERE pr.oid = r.oid;

    IF v_acl IS DISTINCT FROM v_acl_veut THEN
      RAISE EXCEPTION 'NEXUS: ACL de % = %, attendu %', r.proname,
        COALESCE(v_acl::text, '<NULL = defaut, donc PUBLIC>'), v_acl_veut::text;
    END IF;
  END LOOP;

  -- 4. Prérequis vague 1 : le vocabulaire et le verrou d'unicité sont là.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.team_coaches'::regclass
                    AND conname='team_coaches_role_check') THEN
    RAISE EXCEPTION 'NEXUS: vague 1 absente (team_coaches_role_check manquante)';
  END IF;

  -- 5. Les TROIS triggers sont attachés, avec le bon timing et le bon événement.
  --    Le trigger de retrait est celui qu'on oublie : sans lui, coach_id est
  --    périmé au départ d'un jeune (doctrine en tête de fichier).
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname = 'team_athletes'
       AND tg.tgname = 'team_athletes_referent_remove'
       AND (tg.tgtype::int & 8) > 0   -- DELETE
       AND (tg.tgtype::int & 2) = 0   -- AFTER
  ) THEN
    RAISE EXCEPTION 'NEXUS: trigger team_athletes_referent_remove absent ou mal typé (AFTER DELETE attendu)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname = 'team_athletes'
       AND tg.tgname = 'team_athletes_referent_sync'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     WHERE NOT tg.tgisinternal AND c.relname = 'team_coaches'
       AND tg.tgname = 'team_coaches_referent_sync'
  ) THEN
    RAISE EXCEPTION 'NEXUS: trigger de synchronisation manquant (team_athletes_referent_sync / team_coaches_referent_sync)';
  END IF;

  -- 6. L'ancrage reste intouché : AUCUNE des fonctions de cette vague n'écrit
  --    school_id. C'est la doctrine, vérifiée mécaniquement plutôt que promise.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
       AND p.proname IN ('fn_resolve_team_referent', 'fn_resync_team_coach_id',
                         'trg_team_coaches_referent', 'trg_team_athletes_referent',
                         'trg_team_athletes_referent_remove')
       -- Cible les ÉCRITURES, pas les lectures : une cible d'UPDATE SET est un
       -- `school_id` NU, alors que toute jointure/condition ici est qualifiée
       -- (`t.school_id`, `sc.school_id`). Exiger l'absence de préfixe évite le
       -- faux positif sur `ON t.school_id = sc.school_id`.
       AND pg_get_functiondef(p.oid) ~* '[^.[:alnum:]_]school_id[[:space:]]*='
  ) THEN
    RAISE EXCEPTION 'NEXUS: une fonction de la vague 2 écrit school_id — violation de la doctrine identité/pointeur';
  END IF;

  RAISE NOTICE 'NEXUS: vague 2 — 6/6 gates verts.';
END
$gate$;
