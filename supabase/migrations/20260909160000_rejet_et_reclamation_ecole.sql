-- ═══════════════════════════════════════════════════════════════════════════
-- REJET ET RÉCLAMATION D'ÉTABLISSEMENT — la file « À réclamer » répond
--
-- ⚠ NON APPLIQUÉE à l'écriture. Miroir + gate d'abord, apply sur GO de BP.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- EXEMPTION À LA DOCTRINE D'ANCRAGE — RÈGLE 11 (CLAUDE.md), écrite, pas héritée
--
-- `athletes.school_id` est l'ANCRAGE DURABLE : qui est ce jeune, à quel
-- établissement il appartient. La migration 20260908151616 a supprimé le
-- trigger qui l'effaçait au retrait d'équipe, et la vague 2 (20260909133830) a
-- gravé la règle : AUCUN geste d'équipe ne touche ce champ, jamais.
--
-- `reject_school_athlete` ci-dessous est la SEULE ÉCRITURE VOLONTAIRE DE
-- `school_id` HORS ATTACHEMENT. Ce n'est pas une entorse : la règle porte sur
-- les gestes d'ÉQUIPE, et un rejet d'établissement est un acte de GOUVERNANCE
-- — un directeur déclare que ce jeune n'est pas de chez lui. L'exemption est
-- déclarée ici ET en tête de la fonction pour qu'elle ne s'évapore pas :
-- quiconque durcira la règle demain doit la relire et décider, pas la
-- découvrir en cassant ce chemin.
--
-- Les deux autres fonctions n'écrivent PAS school_id comme une décision :
--   · `cancel_school_rejection` le REPOSE à sa valeur d'avant — une annulation ;
--   · `claim_school_athletes` ne touche que `coach_id`.
-- Le gate le vérifie mécaniquement plutôt que de le promettre.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE CE CHANTIER FAIT, ET CE QU'IL NE FAIT PAS
--
-- REJET (directeur / directeur intérimaire SEULEMENT — acte de gouvernance,
-- pas geste de coach) : `school_id` -> NULL, trace conservée, l'athlète
-- disparaît de la file de TOUTE l'école, et il est prévenu.
--   · son compte, son profil, ses évaluations restent intacts ;
--   · il reste visible aux recruteurs — la recherche n'exige pas d'école.
--     Le texte de la notification le dit, parce qu'un mineur qui lit
--     « retiré » comprend « supprimé ».
--
-- PORTÉE : la file uniquement (`coach_id IS NULL`). Désavouer un athlète DÉJÀ
-- réclamé est un autre geste, avec d'autres implications — backlog.
--
-- RÉVERSIBLE SANS LIMITE DE TEMPS : une erreur de clic d'un directeur sur un
-- profil de mineur ne doit jamais dépendre d'une re-déclaration de l'enfant
-- pour se réparer. L'historique se garde (`cancelled_at`), il ne s'efface pas.
--
-- LA BOUCLE EST ASSUMÉE : `_apply_team_attachment_core` et
-- `set_athlete_anchor_on_team_add` réécrivent `school_id`. Un rejeté qui
-- rejoint une équipe de cette école REVIENT dans la file, avec sa mention
-- « déjà rejeté le X ». La trace est un garde-fou, pas un verrou — décision BP.
--
-- RÉCLAMATION : le claim passait par un UPDATE client. Il passe par une RPC,
-- pour une raison qui n'est pas cosmétique : depuis la vague 2,
-- `athletes.coach_id` est un POINTEUR DÉRIVÉ, posé par des triggers. Une
-- notification branchée sur « coach_id passe de NULL à non-NULL » partirait
-- aussi sur un attachement d'équipe ou une resynchronisation — un jeune
-- recevrait « un coach t'a pris en charge » sans que personne n'ait réclamé.
-- Seule une RPC lie la notification au GESTE. La policy « coaches can claim
-- unclaimed school athletes » RESTE en place : défense en profondeur, même si
-- l'UI ne l'emprunte plus en direct.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. LA TRACE ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_claim_rejections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  school_id    uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  rejected_by  uuid NOT NULL REFERENCES public.users(id),
  rejected_at  timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id),
  -- Annulée ou pas, jamais à moitié : les deux colonnes vont ensemble.
  CONSTRAINT school_claim_rejections_annulation_coherente
    CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL))
);

COMMENT ON TABLE public.school_claim_rejections IS
  'Rejets d''établissement sur la file « À réclamer ». Une ligne ACTIVE au plus par couple athlète/école ; l''annulation marque cancelled_at et ne supprime jamais l''historique.';

-- « Une ligne ACTIVE au plus » — l'index partiel, pas une promesse de code.
-- Sans lui, un aller-retour rejet/annulation/rejet empilerait des mentions
-- « déjà rejeté le X » et l'écran ne saurait plus laquelle montrer.
CREATE UNIQUE INDEX IF NOT EXISTS school_claim_rejections_une_active
  ON public.school_claim_rejections (athlete_id, school_id)
  WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS school_claim_rejections_par_ecole
  ON public.school_claim_rejections (school_id, athlete_id);

ALTER TABLE public.school_claim_rejections ENABLE ROW LEVEL SECURITY;

-- LECTURE SEULE, bornée à son école : l'écran de la file doit pouvoir afficher
-- « déjà rejeté le X », y compris à un coach ordinaire qui, lui, ne verra pas
-- le bouton. AUCUNE policy d'écriture : les RPC ci-dessous sont le seul chemin.
DROP POLICY IF EXISTS "school staff read own school rejections" ON public.school_claim_rejections;
CREATE POLICY "school staff read own school rejections"
  ON public.school_claim_rejections
  FOR SELECT TO authenticated
  USING (school_id = public.current_user_school_id() OR public.is_admin());


-- ── 2. LE VOCABULAIRE DES NOTIFICATIONS ────────────────────────────────────
-- Deux valeurs de plus. Le CHECK est réécrit en entier : l'étendre par
-- concaténation laisserait la liste illisible dans le catalogue.
ALTER TABLE public.athlete_notifications DROP CONSTRAINT IF EXISTS athlete_notifications_type_check;
ALTER TABLE public.athlete_notifications ADD CONSTRAINT athlete_notifications_type_check
  CHECK (type = ANY (ARRAY[
    'PROFILE_VIEWED'::text,
    'ADDED_TO_FAVORITES'::text,
    'SUGGESTION_APPROVED'::text,
    'SUGGESTION_REJECTED'::text,
    'COACH_REPORT_UPDATED'::text,
    'COACH_VERIFIED'::text,
    'COACH_MODIFIED_PROFILE'::text,
    'COACH_DISTINCTION_ADDED'::text,
    'COACH_EVALUATION_UPDATED'::text,
    'PROFILE_MILESTONE'::text,
    'PROFILE_TIP'::text,
    'ADMIN_BROADCAST'::text,
    'TEAM_INVITATION'::text,
    'SCHOOL_CLAIM_REJECTED'::text,
    'COACH_CLAIMED'::text
  ]));


-- ── 3. L'ENVOI PUSH, ÉCRIT UNE FOIS ────────────────────────────────────────
-- Repris de notify_first_recruiter_contact : secret au vault, net.http_post
-- vers send-push, et TOUT est avalé par un EXCEPTION. Une notification qui
-- échoue ne doit jamais faire échouer le geste — un rejet à moitié appliqué
-- serait pire qu'un push perdu.
--
-- ⚠ DETTE CONNUE, non traitée ici : la chaîne push n'a pas de deep-link.
-- L'ouverture dépose le jeune sur l'accueil, pas sur son profil. C'est pourquoi
-- le texte du rejet porte le chemin dans ses mots (« Vérifie ton école dans ton
-- profil ») au lieu de compter sur la navigation.
CREATE OR REPLACE FUNCTION public.push_to_user(p_user_id uuid, p_title text, p_body text, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('user_id', p_user_id, 'title', p_title, 'body', p_body, 'data', p_data)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_to_user: livraison échouée pour %: %', p_user_id, SQLERRM;
END;
$function$;


-- ── 4. REJETER ─────────────────────────────────────────────────────────────
-- ⚠ SEULE ÉCRITURE VOLONTAIRE DE school_id HORS ATTACHEMENT — rejet
--   d'établissement, règle 11. Voir l'encadré en tête de fichier.
CREATE OR REPLACE FUNCTION public.reject_school_athlete(p_athlete_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_school uuid;
  v_coach  uuid;
  v_user   uuid;
  v_trace  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun utilisateur authentifié';
  END IF;

  -- FOR UPDATE : deux directeurs de la même école qui cliquent en même temps
  -- ne doivent pas produire deux traces actives (l'index les refuserait, mais
  -- l'un des deux verrait une erreur d'unicité au lieu d'un message clair).
  SELECT a.school_id, a.coach_id, a.user_id
    INTO v_school, v_coach, v_user
    FROM public.athletes a WHERE a.id = p_athlete_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEXUS: athlète introuvable';
  END IF;
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'NEXUS: cet athlète n''est rattaché à aucun établissement';
  END IF;
  -- PORTÉE : la file uniquement. Désavouer un athlète déjà réclamé est un
  -- autre geste (backlog), pas un cas limite à traiter en douce ici.
  IF v_coach IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: cet athlète est déjà réclamé par un entraîneur — le rejet ne couvre que la file';
  END IF;

  -- LE DROIT : directeur ou directeur intérimaire de CETTE école. Un coach
  -- ordinaire ne l'a pas, et l'écran ne lui montre même pas le bouton.
  IF NOT EXISTS (
    SELECT 1 FROM public.school_coaches sc
     WHERE sc.coach_id = v_uid
       AND sc.school_id = v_school
       AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  ) THEN
    RAISE EXCEPTION 'NEXUS: seul un directeur de l''établissement peut rejeter un rattachement';
  END IF;

  INSERT INTO public.school_claim_rejections (athlete_id, school_id, rejected_by)
  VALUES (p_athlete_id, v_school, v_uid)
  RETURNING id INTO v_trace;

  UPDATE public.athletes SET school_id = NULL, updated_at = now() WHERE id = p_athlete_id;

  -- IN-APP — version de référence : elle porte la réassurance en entier.
  BEGIN
    INSERT INTO public.athlete_notifications (athlete_id, type, title, message, metadata)
    VALUES (
      p_athlete_id,
      'SCHOOL_CLAIM_REJECTED',
      'Ton rattachement n''a pas été confirmé',
      'Ton établissement n''a pas confirmé ton rattachement. Vérifie ton école dans ton profil. Ton compte, ton profil et tes données restent intacts.',
      jsonb_build_object('rejection_id', v_trace, 'school_id', v_school)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'reject_school_athlete: notification in-app échouée pour athlète %: %', p_athlete_id, SQLERRM;
  END;

  -- PUSH — court, l'action en tête : la bannière repliée coupe la suite.
  PERFORM public.push_to_user(
    v_user,
    'Nexus',
    'Ton établissement n''a pas confirmé ton rattachement. Vérifie ton école dans ton profil.',
    jsonb_build_object('type', 'school_claim_rejected', 'athlete_id', p_athlete_id)
  );

  RETURN v_trace;
END;
$function$;


-- ── 5. ANNULER UN REJET ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_school_rejection(p_athlete_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_trace  record;
  v_actuel uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun utilisateur authentifié';
  END IF;

  SELECT r.* INTO v_trace
    FROM public.school_claim_rejections r
   WHERE r.athlete_id = p_athlete_id AND r.cancelled_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEXUS: aucun rejet actif pour cet athlète';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.school_coaches sc
     WHERE sc.coach_id = v_uid
       AND sc.school_id = v_trace.school_id
       AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  ) THEN
    RAISE EXCEPTION 'NEXUS: seul un directeur de l''établissement peut annuler ce rejet';
  END IF;

  -- ⚠ LA GARDE QUI COMPTE. Le rejet dit au jeune « vérifie ton école ». S'il
  -- l'a fait — nouvelle école déclarée, ou équipe rejointe qui a réancré —
  -- reposer l'ancienne valeur ÉCRASERAIT SA CORRECTION, en silence, au nom
  -- d'une annulation. On refuse, et on le dit.
  SELECT a.school_id INTO v_actuel FROM public.athletes a WHERE a.id = p_athlete_id FOR UPDATE;
  IF v_actuel IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: cet athlète s''est rattaché à un établissement depuis le rejet — annuler écraserait sa déclaration';
  END IF;

  UPDATE public.athletes SET school_id = v_trace.school_id, updated_at = now() WHERE id = p_athlete_id;

  UPDATE public.school_claim_rejections
     SET cancelled_at = now(), cancelled_by = v_uid
   WHERE id = v_trace.id;
END;
$function$;


-- ── 6. RÉCLAMER ────────────────────────────────────────────────────────────
-- Mêmes prédicats que la policy « coaches can claim unclaimed school
-- athletes » : athlète sans entraîneur, de MON école, et je deviens
-- l'entraîneur. La policy reste derrière, en défense en profondeur.
--
-- ⚠ CE QUE CE PRÉDICAT LAISSE PASSER, ET QUI PRÉEXISTE : il ne teste pas le
-- RÔLE de l'appelant. Un recruteur rattaché au même établissement le satisfait
-- — exactement comme la policy d'aujourd'hui. Reproduit tel quel, sciemment :
-- ajouter `is_coach()` ici resserrerait un droit sans que la décision ait été
-- prise. À trancher séparément.
CREATE OR REPLACE FUNCTION public.claim_school_athletes(p_athlete_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_school uuid;
  v_nom    text;
  v_ecole  text;
  r        record;
  v_n      integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun utilisateur authentifié';
  END IF;
  IF p_athlete_ids IS NULL OR array_length(p_athlete_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_school := public.current_user_school_id();
  IF v_school IS NULL THEN
    RAISE EXCEPTION 'NEXUS: aucun établissement rattaché à ton compte';
  END IF;

  SELECT btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
    INTO v_nom FROM public.users u WHERE u.id = v_uid;
  IF v_nom IS NULL OR v_nom = '' THEN v_nom := 'Ton entraîneur'; END IF;

  SELECT s.name INTO v_ecole FROM public.schools s WHERE s.id = v_school;

  -- UN aller-retour : on pose et on récupère les lignes RÉELLEMENT prises. Un
  -- id qu'un autre coach vient de réclamer sort de lui-même du RETURNING —
  -- personne ne reçoit « X t'a pris en charge » pour un claim qui n'a pas eu
  -- lieu.
  FOR r IN
    UPDATE public.athletes a
       SET coach_id = v_uid, updated_at = now()
     WHERE a.id = ANY (p_athlete_ids)
       AND a.coach_id IS NULL
       AND a.school_id = v_school
    RETURNING a.id, a.user_id
  LOOP
    v_n := v_n + 1;

    BEGIN
      INSERT INTO public.athlete_notifications (athlete_id, type, title, message, metadata)
      VALUES (
        r.id,
        'COACH_CLAIMED',
        'Un entraîneur t''a pris en charge',
        format('Le coach %s t''a pris en charge à %s. Ouvre l''app pour voir ton profil. Il peut maintenant gérer ton profil et répondre aux recruteurs pour toi.',
               v_nom, coalesce(v_ecole, 'ton établissement')),
        jsonb_build_object('coach_id', v_uid, 'school_id', v_school)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'claim_school_athletes: notification in-app échouée pour athlète %: %', r.id, SQLERRM;
    END;

    PERFORM public.push_to_user(
      r.user_id,
      'Nexus',
      format('Le coach %s t''a pris en charge à %s. Ouvre l''app pour voir ton profil.',
             v_nom, coalesce(v_ecole, 'ton établissement')),
      jsonb_build_object('type', 'coach_claimed', 'athlete_id', r.id)
    );
  END LOOP;

  RETURN v_n;
END;
$function$;


-- ── 7. ACL — liste complète, jamais par inclusion (CLAUDE.md) ───────────────
-- Un CREATE FUNCTION hérite des ALTER DEFAULT PRIVILEGES de Supabase, qui
-- accordent EXECUTE à anon, authenticated et service_role. On révoque TOUT,
-- puis on n'accorde que ce qui doit l'être. `push_to_user` n'est appelée que
-- par les deux autres : personne d'autre n'y touche.
REVOKE ALL ON FUNCTION public.push_to_user(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reject_school_athlete(uuid)           FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_school_rejection(uuid)         FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_school_athletes(uuid[])         FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reject_school_athlete(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_school_rejection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_school_athletes(uuid[]) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — modèle 20260909133830 : exécuté EN POST-APPLY, en SQL brut.
-- Toute RAISE porte le préfixe « NEXUS: », sans quoi elle n'atteint jamais
-- l'écran (leçon maison). 6 contrôles, aucune promesse.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  r         record;
  v_acl     text[];
  v_attendu text[];
  v_manque  text;
  v_types   text;
BEGIN
  -- 1. LA TRACE existe, avec ses colonnes et sa cohérence d'annulation.
  IF to_regclass('public.school_claim_rejections') IS NULL THEN
    RAISE EXCEPTION 'NEXUS: table school_claim_rejections absente';
  END IF;

  SELECT string_agg(c, ', ' ORDER BY c) INTO v_manque
  FROM unnest(ARRAY['id','athlete_id','school_id','rejected_by','rejected_at','cancelled_at','cancelled_by']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='school_claim_rejections' AND column_name = c);
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: colonnes manquantes sur school_claim_rejections : %', v_manque;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.school_claim_rejections'::regclass
       AND conname = 'school_claim_rejections_annulation_coherente'
  ) THEN
    RAISE EXCEPTION 'NEXUS: contrainte de cohérence d''annulation absente — une ligne pourrait être annulée sans auteur';
  END IF;

  -- 2. « UNE LIGNE ACTIVE AU PLUS » — l'index partiel, AVEC sa clause WHERE.
  --    Sans le WHERE, l'index interdirait aussi les rejets successifs légitimes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND tablename='school_claim_rejections'
       AND indexname='school_claim_rejections_une_active'
       AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%cancelled_at IS NULL%'
  ) THEN
    RAISE EXCEPTION 'NEXUS: index unique partiel school_claim_rejections_une_active absent ou sans sa clause WHERE';
  END IF;

  -- 3. RLS active, et AUCUNE policy d'écriture : les RPC sont le seul chemin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid='public.school_claim_rejections'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'NEXUS: RLS non activée sur school_claim_rejections';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='school_claim_rejections' AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'NEXUS: une policy d''écriture existe sur school_claim_rejections — le seul chemin d''écriture doit être les RPC';
  END IF;

  -- 4. LE VOCABULAIRE : les 2 valeurs nouvelles ET les 13 anciennes.
  --    Réécrire un CHECK en entier, c'est risquer d'en perdre une en route.
  SELECT pg_get_constraintdef(oid) INTO v_types
    FROM pg_constraint
   WHERE conrelid='public.athlete_notifications'::regclass
     AND conname='athlete_notifications_type_check';
  IF v_types IS NULL THEN
    RAISE EXCEPTION 'NEXUS: athlete_notifications_type_check absente';
  END IF;

  SELECT string_agg(t, ', ' ORDER BY t) INTO v_manque
  FROM unnest(ARRAY['PROFILE_VIEWED','ADDED_TO_FAVORITES','SUGGESTION_APPROVED','SUGGESTION_REJECTED',
                    'COACH_REPORT_UPDATED','COACH_VERIFIED','COACH_MODIFIED_PROFILE','COACH_DISTINCTION_ADDED',
                    'COACH_EVALUATION_UPDATED','PROFILE_MILESTONE','PROFILE_TIP','ADMIN_BROADCAST',
                    'TEAM_INVITATION','SCHOOL_CLAIM_REJECTED','COACH_CLAIMED']) AS t
  WHERE position('''' || t || '''' in v_types) = 0;
  IF v_manque IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: valeurs absentes du CHECK de type : %', v_manque;
  END IF;

  -- 5. LES 4 FONCTIONS : DEFINER, proconfig pinné, ACL comparée EN ENTIER.
  FOR r IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f'
       AND p.proname IN ('push_to_user','reject_school_athlete','cancel_school_rejection','claim_school_athletes')
  LOOP
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'NEXUS: % n''est pas SECURITY DEFINER', r.proname;
    END IF;
    IF r.proconfig IS NULL
       OR NOT ('search_path=public' = ANY (r.proconfig))
       OR NOT ('row_security=off'  = ANY (r.proconfig)) THEN
      RAISE EXCEPTION 'NEXUS: proconfig incomplet sur % : %', r.proname, COALESCE(r.proconfig::text, '<NULL>');
    END IF;

    -- Liste COMPLÈTE et triée, jamais par inclusion : c'est la leçon de
    -- recruiter_search_athletes, où anon était revenu sans que le gate le voie.
    SELECT array_agg(g ORDER BY g) INTO v_acl
      FROM pg_proc pr,
           LATERAL (SELECT COALESCE(NULLIF(split_part(x,'=',1),''),'PUBLIC') AS g
                      FROM unnest(pr.proacl::text[]) AS x) t
     WHERE pr.oid = r.oid;

    v_attendu := CASE WHEN r.proname = 'push_to_user'
                      THEN ARRAY['postgres']
                      ELSE ARRAY['authenticated','postgres'] END;

    IF v_acl IS DISTINCT FROM v_attendu THEN
      RAISE EXCEPTION 'NEXUS: ACL de % = %, attendu %', r.proname,
        COALESCE(v_acl::text, '<NULL = defaut, donc PUBLIC>'), v_attendu::text;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.prokind='f'
         AND p.proname IN ('push_to_user','reject_school_athlete','cancel_school_rejection','claim_school_athletes')) <> 4 THEN
    RAISE EXCEPTION 'NEXUS: les 4 fonctions ne sont pas toutes présentes';
  END IF;

  -- 6. LA DOCTRINE, VÉRIFIÉE PLUTÔT QUE PROMISE.
  --    Seules reject (la décision) et cancel (la remise en état) écrivent
  --    school_id. Le claim n'y touche pas : c'est ce qui sépare un geste de
  --    roster d'un geste d'identité. On cible les ÉCRITURES — un `school_id`
  --    NU à gauche d'un `=` — pas les lectures, toujours qualifiées.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f'
       AND p.proname IN ('claim_school_athletes','push_to_user')
       AND pg_get_functiondef(p.oid) ~* '[^.[:alnum:]_]school_id[[:space:]]*='
  ) THEN
    RAISE EXCEPTION 'NEXUS: claim_school_athletes ou push_to_user écrit school_id — un geste de roster ne touche pas à l''ancrage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='reject_school_athlete'
       AND pg_get_functiondef(p.oid) ~* '[^.[:alnum:]_]school_id[[:space:]]*=[[:space:]]*NULL'
  ) THEN
    RAISE EXCEPTION 'NEXUS: reject_school_athlete ne débranche pas school_id — la fonction ne fait pas ce qu''elle annonce';
  END IF;

  RAISE NOTICE 'NEXUS: rejet/réclamation — 6/6 gates verts.';
END
$gate$;
