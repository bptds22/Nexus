-- ═══════════════════════════════════════════════════════════════════════════
-- L'ATHLÈTE MODIFIE SON PROFIL — fin du flow de proposition
--
-- APPLIQUÉE sur le cloud le 2026-09-09 (version 20260909191744). Gate en
--   post-apply, SQL brut : 8/8 verts.
--
-- ⚠ MAIS LE GARDE POSÉ ICI NE BLOQUAIT RIEN — voir la migration suivante,
--   20260909191916_edition_directe_athlete_garde_invoker. En SECURITY DEFINER,
--   `current_user` vaut le PROPRIÉTAIRE, pas le rôle appelant : le test
--   `current_user <> 'authenticated'` sortait en early-return à chaque appel.
--   Les 8 gates de catalogue étaient verts ; c'est la PREUVE PAR EXÉCUTION
--   demandée par BP qui l'a attrapé, colonne par colonne. Le correctif passe
--   la fonction en SECURITY INVOKER. Ce fichier garde la version telle
--   qu'appliquée : l'historique doit montrer la faute, pas la cacher.
--
-- DÉCISION BP (2026-09-09) : les sections aujourd'hui gatées « PROPOSER →
-- approbation coach » deviennent modifiables DIRECTEMENT par l'athlète.
-- Restent au coach, et à lui seul : DISTINCTIONS et ÉVALUATIONS.
-- Le badge vérifié atteste désormais le RATTACHEMENT et l'ÉVALUATION, plus
-- chaque donnée du profil — écart assumé, et c'est LA décision.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE CETTE MIGRATION FAIT, DANS L'ORDRE
--
--   1. `note_systeme` sur athlete_suggestions — la trace de ce que la
--      PLATEFORME a décidé, pour ne jamais le confondre avec une décision de
--      coach.
--   2. Le texte des notifications apprend le cas système. Sans ça, la reprise
--      des 237 en attente dirait « Ton coach a approuvé » et « Ton coach a
--      rejeté » à 49 jeunes, alors qu'aucun coach n'a rien fait. Un mensonge
--      de masse, à des mineurs.
--   3. LE GARDE — ce que l'athlète peut écrire sur SA ligne, et rien d'autre.
--   4. LE TRIGGER DE TRANSITION — les vieux clients mobiles n'écrivent plus
--      d'orphelines.
--   5. LA REPRISE des 237 en attente.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CE QUE LA PHASE 1 A DÉCOUVERT, ET QUI CHANGE LA NATURE DU CHANTIER
--
-- La proposition n'a JAMAIS été une règle de base : la policy
-- « athletes can update own profile » autorise l'athlète à écrire N'IMPORTE
-- QUELLE colonne de sa propre ligne, et UPDATE est accordé à `authenticated`
-- sur les 89 colonnes. Prouvé par exécution le 2026-09-09 : un athlète peut
-- aujourd'hui poser `verified = true`, s'attribuer une `cote_globale_
-- entraineur`, se débrancher de son coach et de son école, changer son
-- `status`. Le garde-fou vivait dans le CLIENT.
--
-- Ce chantier n'OUVRE donc rien. Il FERME — et il ferme une faille vivante.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. LA TRACE SYSTÈME ────────────────────────────────────────────────────
ALTER TABLE public.athlete_suggestions
  ADD COLUMN IF NOT EXISTS note_systeme text;

COMMENT ON COLUMN public.athlete_suggestions.note_systeme IS
  'Renseignée quand la PLATEFORME a tranché, jamais un coach. Sert au texte des notifications et à distinguer, dans l''historique, une décision humaine d''une bascule de règle.';


-- ── 2. LES NOTIFICATIONS APPRENNENT LE CAS SYSTÈME ─────────────────────────
-- Corps repris À L'IDENTIQUE de la version en production (les 29 entrées de
-- `v_is_rating`, le CASE de libellés, la dette de grille documentée) — SEULES
-- les deux branches de titre changent, et seulement quand `note_systeme` est
-- renseignée.
CREATE OR REPLACE FUNCTION public.notify_athlete_suggestion_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title       TEXT;
  v_is_rating   BOOLEAN;
  v_champ_label TEXT;
  v_systeme     BOOLEAN := NEW.note_systeme IS NOT NULL;
BEGIN
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
    IF v_systeme THEN
      -- AUCUN COACH N'A APPROUVÉ. La règle a changé, la valeur est appliquée.
      -- Dire « ton coach a approuvé » ici serait un mensonge à un mineur.
      v_title := 'Ta modification a été appliquée : ' || v_champ_label || ' mis à jour';
    ELSIF NEW.champ = 'Distinctions' THEN
      v_title := 'Ton coach a approuvé ta suggestion : Distinctions mises à jour';
    ELSIF v_is_rating AND COALESCE(NEW.valeur_proposee, '') <> '' THEN
      v_title := 'Ton coach a approuvé ta suggestion : ' || v_champ_label
              || ' mis à jour (' || NEW.valeur_proposee || '/5)';
    ELSE
      v_title := 'Ton coach a approuvé ta suggestion : ' || v_champ_label
              || ' mis à jour';
    END IF;

    INSERT INTO athlete_notifications (athlete_id, type, title, message, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_APPROVED',
      v_title,
      CASE WHEN v_systeme
           THEN 'Tu modifies maintenant ton profil directement, sans passer par ton entraîneur.'
           ELSE NULL END,
      jsonb_build_object('champ', NEW.champ, 'valeur', NEW.valeur_proposee, 'systeme', v_systeme)
    );

  ELSIF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    IF v_systeme THEN
      -- Le motif ÉNONCE LA RÈGLE plutôt que d'annoncer un refus : le jeune
      -- apprend qui décide, au lieu de croire qu'on lui a dit non.
      v_title := COALESCE(NEW.raison_rejet, 'Cette information est tenue par ton entraîneur.');
    ELSE
      v_title := 'Ton coach a rejeté ta suggestion : ' || v_champ_label;
    END IF;

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_REJECTED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'raison', NEW.raison_rejet, 'systeme', v_systeme)
    );
  END IF;

  RETURN NEW;
END;
$function$;


-- ── 3. LE GARDE — le périmètre de l'athlète sur sa propre ligne ────────────
-- Généralise le patron de `enforce_is_showcase_admin_seul`, qui protège déjà
-- une colonne de la même façon.
--
-- ⚠ IL NE DOIT MORDRE QUE SUR L'ACTEUR ATHLÈTE, en écriture DIRECTE.
-- Le discriminant est `current_user` : un UPDATE envoyé par le client tourne
-- sous le rôle `authenticated` ; une fonction SECURITY DEFINER (les triggers
-- de la vague 2, les RPC de rejet/réclamation, les flows coach passant par une
-- RPC) tourne sous son PROPRIÉTAIRE. `auth.uid()`, lui, ne suffirait PAS :
-- quand un jeune rejoint une équipe, c'est `trg_team_athletes_referent` qui
-- écrit `athletes.coach_id` AVEC auth.uid() = l'athlète. Un garde basé sur le
-- seul auth.uid() casserait la vague 2 le jour de sa première prise d'équipe.
--
-- ⚠ EXCLUSION VOLONTAIRE — `statut_recrutement_override` N'EST PAS BLOQUÉE.
-- Le CLAUDE.md en fait une règle produit : « Recruitment Status (on athlete,
-- last-write-wins) — n'importe lequel de coach / athlète / recruteur peut la
-- mettre à jour ». L'écriture par l'athlète y est donc LÉGITIME, et la bloquer
-- ici casserait une règle métier au nom d'une liste de sécurité.
-- Aucune surface athlète ne l'écrit aujourd'hui : l'exclusion est un droit
-- gardé ouvert, pas un usage constaté. Son jumeau `recruitment_status`, lui,
-- EST bloqué — il n'est écrit que par les flows coach/recruteur, et son
-- `recruitment_status_changed_by` doit rester une signature crédible.
-- Le jour où l'un des deux disparaît au profit de l'autre, cette exclusion se
-- relit — elle ne s'hérite pas (règle 11).
CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture directe ? On ne s'en mêle pas.
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- IDENTITÉ ET RATTACHEMENT — ce n'est pas à lui de le déclarer.
  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := v_bloquees || 'user_id';   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id  THEN v_bloquees := v_bloquees || 'coach_id';  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN v_bloquees := v_bloquees || 'school_id'; END IF;
  IF NEW.status    IS DISTINCT FROM OLD.status    THEN v_bloquees := v_bloquees || 'status';    END IF;

  -- VÉRIFICATION — la faille vivante avant cette migration : un athlète
  -- pouvait se déclarer vérifié lui-même.
  IF NEW.verified            IS DISTINCT FROM OLD.verified            THEN v_bloquees := v_bloquees || 'verified';            END IF;
  IF NEW.verified_at         IS DISTINCT FROM OLD.verified_at         THEN v_bloquees := v_bloquees || 'verified_at';         END IF;
  IF NEW.verified_by         IS DISTINCT FROM OLD.verified_by         THEN v_bloquees := v_bloquees || 'verified_by';         END IF;
  IF NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN v_bloquees := v_bloquees || 'verification_method'; END IF;

  -- JUGEMENT DU COACH — c'est tout l'objet de la décision du 2026-09-09.
  IF NEW.cote_globale_entraineur IS DISTINCT FROM OLD.cote_globale_entraineur THEN v_bloquees := v_bloquees || 'cote_globale_entraineur'; END IF;

  -- CALCULÉ / ADMIN.
  IF NEW.profile_completion IS DISTINCT FROM OLD.profile_completion THEN v_bloquees := v_bloquees || 'profile_completion'; END IF;
  IF NEW.is_showcase        IS DISTINCT FROM OLD.is_showcase        THEN v_bloquees := v_bloquees || 'is_showcase';        END IF;

  -- CONSENTEMENTS — ils se donnent par leur propre chemin, journalisé.
  IF NEW.consentement_parental      IS DISTINCT FROM OLD.consentement_parental      THEN v_bloquees := v_bloquees || 'consentement_parental';      END IF;
  IF NEW.consentement_parental_date IS DISTINCT FROM OLD.consentement_parental_date THEN v_bloquees := v_bloquees || 'consentement_parental_date'; END IF;
  IF NEW.partner_visibility_opt_in            IS DISTINCT FROM OLD.partner_visibility_opt_in            THEN v_bloquees := v_bloquees || 'partner_visibility_opt_in';            END IF;
  IF NEW.partner_visibility_opted_in_at       IS DISTINCT FROM OLD.partner_visibility_opted_in_at       THEN v_bloquees := v_bloquees || 'partner_visibility_opted_in_at';       END IF;
  IF NEW.partner_visibility_parental_consent  IS DISTINCT FROM OLD.partner_visibility_parental_consent  THEN v_bloquees := v_bloquees || 'partner_visibility_parental_consent';  END IF;

  -- ENGAGEMENT — état de recrutement tenu hors du profil.
  IF NEW.recruitment_status            IS DISTINCT FROM OLD.recruitment_status            THEN v_bloquees := v_bloquees || 'recruitment_status';            END IF;
  IF NEW.recruitment_status_changed_by IS DISTINCT FROM OLD.recruitment_status_changed_by THEN v_bloquees := v_bloquees || 'recruitment_status_changed_by'; END IF;
  IF NEW.recruitment_status_changed_at IS DISTINCT FROM OLD.recruitment_status_changed_at THEN v_bloquees := v_bloquees || 'recruitment_status_changed_at'; END IF;
  IF NEW.committed_school_id           IS DISTINCT FROM OLD.committed_school_id           THEN v_bloquees := v_bloquees || 'committed_school_id';           END IF;

  IF array_length(v_bloquees, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: ces informations ne se modifient pas depuis ton profil (%). Elles sont tenues par ton entraîneur ou par Nexus.',
      array_to_string(v_bloquees, ', ');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_athlete_self_edit_perimeter ON public.athletes;
CREATE TRIGGER trg_athlete_self_edit_perimeter
  BEFORE UPDATE ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_self_edit_perimeter();


-- ── 4. TRANSITION — les vieux clients n'écrivent plus d'orphelines ────────
-- Entre le Promote web et l'adoption du store, une app installée continuera
-- d'insérer des propositions. Sans ce trigger, elles s'empileraient sans
-- personne pour les traiter : le trou de 237 se reformerait, en silence.
--
-- ⚠ TEMPORAIRE — À RETIRER AU 1.4.2, quand le parc mobile aura tourné.
-- Il n'est pas une règle : il est un tampon de migration, et il est écrit ici
-- pour que celui qui le trouvera sache qu'il peut partir.
-- La liste des champs de PROFIL, en un seul endroit : le trigger de
-- transition ET la reprise ci-dessous la lisent. Deux copies divergeraient.
-- « Position secondaire » n'y est PAS : le moteur ne sait pas l'appliquer
-- (aucun WHEN pour elle), l'approuver notifierait « appliquée » sans rien
-- appliquer.
CREATE OR REPLACE FUNCTION public.champs_profil_athlete()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT ARRAY[
    'Taille', 'Poids', 'Envergure', 'Taille mains',
    'Main dominante', 'Pied dominant',
    '40 yards', 'Saut vertical', 'Saut longueur', 'Développé couché',
    'Navette', 'Sprint 100m',
    'Sport principal', 'Sport secondaire', 'Position', 'Numéro'
  ];
$function$;

CREATE OR REPLACE FUNCTION public.trg_suggestion_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF NEW.status <> 'EN_ATTENTE' THEN
    RETURN NEW;
  END IF;

  IF NEW.champ = ANY (public.champs_profil_athlete()) THEN
    -- C'est désormais son droit : appliqué tout de suite, par le moteur
    -- existant (l'UPDATE ci-dessous déclenche apply_approved_suggestion).
    UPDATE public.athlete_suggestions
       SET status = 'APPROUVEE',
           note_systeme = 'Édition directe (transition vieux client mobile)'
     WHERE id = NEW.id;
  ELSE
    UPDATE public.athlete_suggestions
       SET status = 'REJETEE',
           raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.',
           note_systeme = 'Édition directe (transition vieux client mobile)',
           reviewed_at = now()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_suggestion_transition ON public.athlete_suggestions;
CREATE TRIGGER trg_suggestion_transition
  AFTER INSERT ON public.athlete_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.trg_suggestion_transition();


-- ── 5. LA REPRISE DES 237 EN ATTENTE ──────────────────────────────────────
-- ⚠ POURQUOI ON COUPE trg_notify_parent_on_minor LE TEMPS DE LA REPRISE :
-- il est BEFORE INSERT OR UPDATE sur `athletes` et se déclenche sur N'IMPORTE
-- QUEL update. Sur les 40 athlètes touchés, UN remplit ses conditions
-- (14-17 ans, parent_email renseigné, parent_notified_at NULL) : la reprise
-- lui enverrait un VRAI courriel d'avis parental, déclenché par une migration.
-- Un parent recevrait « votre enfant s'est inscrit » des semaines après coup.
-- On le coupe, on reprend, on le remet — et le gate vérifie qu'il est bien
-- rallumé.
ALTER TABLE public.athletes DISABLE TRIGGER trg_notify_parent_on_minor;

-- 5a. Les champs de PROFIL : appliqués par le moteur existant.
UPDATE public.athlete_suggestions
   SET status = 'APPROUVEE',
       note_systeme = 'Reprise 1.4.1 : l''athlète modifie désormais son profil directement'
 WHERE status = 'EN_ATTENTE'
   AND champ = ANY (public.champs_profil_athlete());

-- 5b. Tout le reste — distinctions, cote globale, traits : la règle est dite.
UPDATE public.athlete_suggestions
   SET status = 'REJETEE',
       raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.',
       note_systeme = 'Reprise 1.4.1 : le flow de proposition est retiré',
       reviewed_at = now()
 WHERE status = 'EN_ATTENTE'
   AND NOT (champ = ANY (public.champs_profil_athlete()))
   AND champ <> 'Position secondaire';

-- 5c. « Position secondaire » — le moteur ne sait pas l'appliquer. On ne
-- prétend pas l'avoir fait : on dit au jeune où le faire lui-même.
UPDATE public.athlete_suggestions
   SET status = 'REJETEE',
       raison_rejet = 'Tu peux maintenant modifier ce champ directement dans ton profil.',
       note_systeme = 'Reprise 1.4.1 : champ non pris en charge par le moteur d''application',
       reviewed_at = now()
 WHERE status = 'EN_ATTENTE'
   AND champ = 'Position secondaire';

ALTER TABLE public.athletes ENABLE TRIGGER trg_notify_parent_on_minor;


-- ── 6. ACL — liste complète, jamais par inclusion ─────────────────────────
-- Aucune de ces fonctions n'est appelée depuis le client : deux sont des
-- corps de trigger, la troisième une constante partagée.
REVOKE ALL ON FUNCTION public.enforce_athlete_self_edit_perimeter() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trg_suggestion_transition()           FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.champs_profil_athlete()               FROM PUBLIC, anon, authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- GATE — post-apply, SQL brut. 8 contrôles.
-- ═══════════════════════════════════════════════════════════════════════════
DO $gate$
DECLARE
  r         record;
  v_acl     text[];
  v_n       integer;
  v_txt     text;
BEGIN
  -- 1. La colonne de trace existe.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='athlete_suggestions'
                    AND column_name='note_systeme') THEN
    RAISE EXCEPTION 'NEXUS: colonne note_systeme absente';
  END IF;

  -- 2. LE TRIGGER PARENTAL EST RALLUMÉ. Le contrôle le plus important de ce
  --    gate : le laisser éteint couperait les avis parentaux pour de bon.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname='athletes' AND t.tgname='trg_notify_parent_on_minor'
       AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'NEXUS: trg_notify_parent_on_minor n''est pas réactivé — les avis parentaux seraient muets';
  END IF;

  -- 3. Les deux triggers du chantier sont posés, au bon moment.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname='athletes' AND t.tgname='trg_athlete_self_edit_perimeter'
       AND (t.tgtype::int & 2) > 0 AND (t.tgtype::int & 16) > 0 AND t.tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'NEXUS: garde de périmètre absente ou mal typée (BEFORE UPDATE attendu)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname='athlete_suggestions' AND t.tgname='trg_suggestion_transition'
       AND (t.tgtype::int & 2) = 0 AND (t.tgtype::int & 4) > 0 AND t.tgenabled='O'
  ) THEN
    RAISE EXCEPTION 'NEXUS: trigger de transition absent ou mal typé (AFTER INSERT attendu)';
  END IF;

  -- 4. PLUS AUCUNE PROPOSITION EN ATTENTE. C'est le but du chantier.
  SELECT count(*) INTO v_n FROM public.athlete_suggestions WHERE status='EN_ATTENTE';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'NEXUS: % propositions restent EN_ATTENTE après la reprise', v_n;
  END IF;

  -- 5. Chaque ligne reprise porte sa trace système — sinon l'historique ne
  --    distingue plus une décision de coach d'une bascule de règle.
  SELECT count(*) INTO v_n
    FROM public.athlete_suggestions
   WHERE note_systeme IS NOT NULL AND reviewed_at IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % lignes système sans reviewed_at — la date de décision manque', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.athlete_suggestions WHERE note_systeme IS NOT NULL;
  IF v_n < 237 THEN
    RAISE EXCEPTION 'NEXUS: seulement % lignes portent une note système, 237 attendues au minimum', v_n;
  END IF;

  -- 6. Les trois fonctions : DEFINER (sauf la constante), proconfig pinné,
  --    ACL = {postgres} — aucune n'est appelable depuis le client.
  FOR r IN
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prokind='f'
       AND p.proname IN ('enforce_athlete_self_edit_perimeter','trg_suggestion_transition','champs_profil_athlete')
  LOOP
    SELECT array_agg(g ORDER BY g) INTO v_acl
      FROM pg_proc pr,
           LATERAL (SELECT COALESCE(NULLIF(split_part(x,'=',1),''),'PUBLIC') AS g
                      FROM unnest(pr.proacl::text[]) AS x) t
     WHERE pr.oid = r.oid;
    IF v_acl IS DISTINCT FROM ARRAY['postgres'] THEN
      RAISE EXCEPTION 'NEXUS: ACL de % = %, attendu {postgres}', r.proname,
        COALESCE(v_acl::text, '<NULL = defaut, donc PUBLIC>');
    END IF;

    IF r.proname <> 'champs_profil_athlete' THEN
      IF NOT r.prosecdef THEN
        RAISE EXCEPTION 'NEXUS: % n''est pas SECURITY DEFINER', r.proname;
      END IF;
      IF r.proconfig IS NULL OR NOT ('search_path=public' = ANY (r.proconfig)) THEN
        RAISE EXCEPTION 'NEXUS: search_path non pinné sur %', r.proname;
      END IF;
    END IF;
  END LOOP;

  -- 7. Le garde discrimine bien sur `current_user`, pas sur le seul auth.uid()
  --    — c'est ce qui laisse passer les triggers de la vague 2.
  v_txt := pg_get_functiondef('public.enforce_athlete_self_edit_perimeter()'::regprocedure);
  IF v_txt NOT ILIKE '%current_user%' THEN
    RAISE EXCEPTION 'NEXUS: le garde ne teste pas current_user — il bloquerait les fonctions DEFINER';
  END IF;

  -- 8. Le texte des notifications connaît le cas système.
  v_txt := pg_get_functiondef('public.notify_athlete_suggestion_result()'::regprocedure);
  IF v_txt NOT ILIKE '%note_systeme%' THEN
    RAISE EXCEPTION 'NEXUS: notify_athlete_suggestion_result ignore note_systeme — elle dirait « ton coach a approuvé » sur une bascule de règle';
  END IF;

  RAISE NOTICE 'NEXUS: édition directe athlète — 8/8 gates verts.';
END
$gate$;
