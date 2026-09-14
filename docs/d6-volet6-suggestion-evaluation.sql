-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — VOLET 6 : l'auto-évaluation redevient une PROPOSITION, pas un refus
--
-- ⚠️ DDL PRÉPARÉ, NON APPLIQUÉ. Ne pas `apply_migration` depuis ce fichier.
--    Il rejoint la migration D6 en sixième volet.
--    Registre : docs/fast-follow-1.4.2.md §19.
--
-- ── CE QUI SE PASSE AUJOURD'HUI ───────────────────────────────────────────
-- `trg_suggestion_transition` (AFTER INSERT) résout TOUTE suggestion dans la
-- transaction d'insertion :
--   · champ ∈ champs_profil_athlete()  → APPROUVEE  (transition édition directe)
--   · sinon                            → REJETEE    (« Les distinctions et
--                                        évaluations sont attribuées par ton
--                                        entraîneur. »)
-- Conséquence mesurée en prod le 2026-09-11 : **0 ligne EN_ATTENTE**, et
-- 50 refus automatiques sur les seuls champs d'évaluation (26 « Distinctions »,
-- 24 « Cote globale »), plus 2 traits en snake_case le 2026-09-09.
--
-- Le flux AVAIT un destinataire réel : 41 suggestions ont été traitées à la
-- main par un coach entre le 2026-07-14 et le 2026-09-09, dont 5 Distinctions,
-- 3 Cote globale et 6 traits individuels. Ce n'est pas un flux à inventer,
-- c'est un flux à débrancher du court-circuit.
--
-- ── LA DÉCISION ───────────────────────────────────────────────────────────
-- Trois destins, pas deux, et ils sont NOMMÉS :
--   1. champs de profil          → APPROUVEE d'office (l'athlète les écrit
--                                  déjà en direct ; la ligne est un vestige)
--   2. champs d'auto-évaluation  → RESTENT EN_ATTENTE → boîte du coach
--   3. tout le reste             → REJETEE (champ inconnu, champ retiré)
--
-- La liste 2 est une LISTE BLANCHE EXPLICITE (règle 11), pas un « tout ce qui
-- n'est pas 1 ». Un champ inventé par un client périmé ne doit pas atterrir
-- dans la boîte d'un entraîneur au motif qu'il n'est pas ailleurs.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. LA LISTE BLANCHE
--
-- Miroir EXACT de la liste que `notify_athlete_suggestion_result()` énumère
-- déjà pour décider si un champ est une note. Les deux écritures coexistent
-- (libellé français des anciens clients, nom de colonne depuis le découplage
-- libellé/clé du lot 3 — cf lib/evaluations/grilles.ts) : les DEUX doivent
-- passer, sinon un client sur deux se fait refuser.
--
-- ⚠ Ne PAS dériver cette liste des libellés de grille : depuis fd31bab, les
-- libellés des 14 critères dépendent de la position de l'athlète. Une liste
-- blanche de libellés dynamiques n'est pas une liste blanche.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.champs_autoevaluation_athlete()
  RETURNS text[]
  LANGUAGE sql IMMUTABLE
  SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    -- La cote et les distinctions
    'Cote globale', 'Distinctions', 'Distinction personnalisée',
    -- Les 14 critères — libellés français (clients ≤ lot 3)
    'Leadership', 'Discipline', 'Coachabilité', 'Intelligence de jeu',
    'Compétitivité', 'Esprit d''équipe', 'Résilience', 'Attitude / Mentalité',
    'Vitesse / Explosivité', 'Force / Puissance', 'Endurance cardio',
    'Agilité / Coordination', 'Vision du jeu', 'Sens tactique',
    -- Les 14 critères — noms de colonnes (clients ≥ lot 3)
    'leadership', 'discipline', 'coachabilite', 'intelligence_jeu',
    'competitivite', 'esprit_equipe', 'resilience', 'attitude_mentalite',
    'vitesse_explosivite', 'force_puissance', 'endurance_cardio',
    'agilite_coordination', 'vision_du_jeu', 'sens_tactique'
  ]::text[];
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. L'AIGUILLAGE À TROIS SORTIES
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_suggestion_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $$
BEGIN
  IF NEW.status <> 'EN_ATTENTE' THEN
    RETURN NEW;
  END IF;

  -- ═══ SORTIE 2 — L'AUTO-ÉVALUATION VA AU COACH ═════════════════════════
  -- Déclarée EN PREMIER, avant même le test des champs de profil, et alors
  -- que les deux listes sont disjointes aujourd'hui. La redondance est le
  -- point (règle 11) : le jour où un champ passe de l'une à l'autre, la
  -- décision « ça se propose, ça ne s'écrit pas » reste visible ici plutôt
  -- que de dépendre de l'ordre des tests.
  --
  -- On ne touche À RIEN : la ligne reste EN_ATTENTE, elle apparaît dans
  -- loadCoachTaskCounts() → badge de la tab bar → /coach/a-traiter.
  -- Aucune notification n'est émise à cette étape, et c'est correct :
  -- `notify_athlete_suggestion_result` est AFTER UPDATE, elle se déclenchera
  -- au VERDICT du coach, pas au dépôt.
  -- ⚠️ AUCUNE CONDITION SUR L'EXISTENCE D'UN ENTRAÎNEUR — décision BP,
  -- 2026-09-12, écrite ICI parce qu'une absence de test ne se relit pas.
  --
  -- Une garde « coach_id IS NULL → refus » avait été PROPOSÉE (rapport du
  -- 2026-09-11) et n'a jamais été retenue. Elle est explicitement ÉCARTÉE :
  -- 25 des 30 athlètes ayant déjà proposé une évaluation n'ont aucun
  -- entraîneur rattaché. Les refuser, c'était fermer la porte à 83 % d'entre
  -- eux.
  --
  -- Une proposition sans entraîneur est donc ACCEPTÉE et DORT en EN_ATTENTE.
  -- Quand un entraîneur se rattache, il hérite de la file — c'est le moteur
  -- du produit : le jeune recrute son entraîneur pour débloquer son
  -- évaluation. L'écran le lui dit (« Invite ton coach pour qu'il approuve
  -- cette évaluation ») au lieu de lui annoncer une approbation que personne
  -- ne peut donner.
  --
  -- Si quelqu'un veut un jour refuser les propositions orphelines, il devra
  -- AJOUTER un test ici — et se heurter à ce commentaire.
  IF NEW.champ = ANY (public.champs_autoevaluation_athlete()) THEN
    RETURN NEW;
  END IF;

  -- ═══ SORTIE 1 — champs de profil : déjà écrits en direct ══════════════
  IF NEW.champ = ANY (public.champs_profil_athlete()) THEN
    UPDATE public.athlete_suggestions
       SET status = 'APPROUVEE',
           note_systeme = 'Édition directe (transition vieux client mobile)'
     WHERE id = NEW.id;

  -- ═══ SORTIE 3 — inconnu ou retiré ═════════════════════════════════════
  -- Le message ne parle plus d'évaluations : elles ne passent plus par ici.
  ELSE
    UPDATE public.athlete_suggestions
       SET status = 'REJETEE',
           raison_rejet = 'Ce champ ne se modifie plus depuis ton profil.',
           note_systeme = 'Champ hors périmètre (transition vieux client mobile)',
           reviewed_at = now()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. ⚠️ PRÉREQUIS DE SÉCURITÉ — NON NÉGOCIABLE, MÊME VOLET
--
-- Les politiques actuelles d'`athlete_suggestions` sont :
--
--   Athletes insert own suggestions   INSERT  WITH CHECK (auth.uid() IS NOT NULL)
--   Authenticated users update ...    UPDATE  USING/CHECK (auth.uid() IS NOT NULL)
--   Coaches update suggestions ...    UPDATE  USING (is_coach_of_athlete(athlete_id))
--
-- La deuxième laisse **n'importe quel compte authentifié passer n'importe
-- quelle suggestion à APPROUVEE**. `apply_approved_suggestion` est SECURITY
-- DEFINER avec `row_security=off` : elle écrit alors `cote_globale_entraineur`
-- et `evaluations.cote_globale` en contournant la RLS **et** le trigger de
-- périmètre (sous DEFINER, `current_user` n'est plus 'authenticated', donc
-- `enforce_athlete_self_edit_perimeter` rend NEW sans rien tester).
--
-- Le trou est LATENT aujourd'hui, et seulement par accident : la garde de
-- `apply_approved_suggestion` est `OLD.status = 'EN_ATTENTE'`, et plus aucune
-- ligne n'atteint cet état. **Le volet 6 le rend exploitable** — un athlète
-- proposerait 5/5 puis approuverait sa propre proposition.
--
-- Donc : rendre l'auto-évaluation au coach SANS resserrer ces politiques
-- reviendrait à donner à chaque athlète le droit de s'auto-noter. Les deux
-- gestes partent ensemble ou ne partent pas.
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users update suggestions" ON public.athlete_suggestions;

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches update suggestions for their claimed athletes"
  ON public.athlete_suggestions FOR UPDATE
  USING      (is_coach_of_athlete(athlete_id))
  -- WITH CHECK ajouté : sans lui, un coach légitime peut déplacer une
  -- suggestion vers un athlète qui n'est pas le sien en réécrivant athlete_id.
  WITH CHECK (is_coach_of_athlete(athlete_id));

DROP POLICY IF EXISTS "Athletes insert own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes insert own suggestions"
  ON public.athlete_suggestions FOR INSERT
  -- Était `auth.uid() IS NOT NULL` : tout compte authentifié pouvait déposer
  -- une suggestion sur la fiche de n'importe quel mineur.
  WITH CHECK (is_own_athlete(athlete_id));


-- ───────────────────────────────────────────────────────────────────────────
-- 4. ⚠️ L'HÉRITAGE PAR ÉQUIPE — sinon le moteur ne démarre pas
--
-- Relevé du 2026-09-12, et il contredit ce que j'avais écrit la veille : la
-- boîte « À traiter » ne joint PAS sur `athletes.coach_id`. Elle borne son
-- périmètre avec `get_coach_athletes` (lib/coach/tasks.ts) — owner ∪ équipe
-- ∪ école si directeur — puis filtre `athlete_suggestions` sur ce set.
--
-- Bonne nouvelle : rien n'est figé au dépôt. Le périmètre est recalculé à
-- CHAQUE lecture, donc un entraîneur qui se rattache voit immédiatement les
-- EN_ATTENTE antérieures. Aucun ajustement de jointure n'est nécessaire.
--
-- MAUVAISE nouvelle, et c'est le vrai défaut : la RLS, elle, est plus étroite
-- que le périmètre.
--
--   Coaches can read suggestions ...  USING (is_coach_of_athlete(athlete_id))
--   is_coach_of_athlete(t)  ⇒  EXISTS (… athletes a WHERE a.id = t
--                                        AND a.coach_id = auth.uid())
--
-- Un athlète rattaché à l'entraîneur PAR L'ÉQUIPE (code d'équipe) — et non
-- par `athletes.coach_id` — apparaît donc dans son roster, mais ses
-- suggestions sont filtrées par la RLS. Zéro ligne, sans erreur : ça se lit
-- exactement comme « il n'a rien proposé ».
--
-- Or le code d'équipe est précisément le geste qu'on met en avant à l'athlète
-- sans entraîneur (« Rejoindre mon équipe »). Sans ce correctif, le moteur
-- s'arrête là où on vient de l'allumer.
--
-- ⚠️ NE PAS écrire une sous-requête `users`/`team_athletes` dans la policy
-- (règle 4) : la lecture passe par un helper SECURITY DEFINER, qui doit
-- recouvrir le MÊME périmètre que `get_coach_athletes` — à aligner sur lui au
-- moment d'écrire ce bloc, pas à réinventer ici. C'est le seul point du volet
-- qui reste à rédiger : il demande de lire `get_coach_athletes` en entier et
-- d'en extraire la condition, ce qui n'a pas été fait.
--
-- PREUVE À PRODUIRE : un entraîneur relié à un athlète UNIQUEMENT par équipe
-- voit la proposition EN_ATTENTE de cet athlète dans /coach/a-traiter.
-- ───────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════
-- PRÉ-VOL ET PREUVES
--
-- PRÉ-VOL (règle 3 — aucun changement de contrat pendant qu'un binaire
-- expédié s'appuie dessus). Le DROP de « Authenticated users update
-- suggestions » est un rétrécissement de contrat. Avant d'appliquer :
--   · vérifier qu'AUCUNE surface expédiée (1.2, 1.4.0, 1.4.1) n'écrit
--     athlete_suggestions sous une identité non-coach. Relevé du 2026-09-11 :
--     les surfaces athlète n'y font que des INSERT, l'admin n'y fait que des
--     SELECT, et les quatre chemins d'UPDATE sont tous côté coach
--     (app/coach/suggestions, app/coach/athletes, app/coach/athletes/[id],
--     CoachATraiterMobile). Re-vérifier, ne pas reprendre ce relevé sur parole.
--
-- PREUVES PAR EXÉCUTION (règle 7), sous de VRAIS JWT, sur une fiche jetable :
--   1. athlète INSERT champ='Cote globale' ⇒ la ligne reste EN_ATTENTE
--   2. la même ligne apparaît dans loadCoachTaskCounts() du coach propriétaire
--   3. athlète tente UPDATE status='APPROUVEE' sur SA ligne ⇒ REFUSÉ
--      (c'est LA preuve du §3 — sans elle, le volet est une régression)
--   4. coach propriétaire UPDATE status='APPROUVEE' ⇒ appliqué, et
--      athlete_notifications reçoit un SUGGESTION_APPROVED
--   5. coach NON propriétaire tente le même UPDATE ⇒ REFUSÉ
--   6. athlète INSERT champ='Taille' ⇒ toujours APPROUVEE d'office (sortie 1
--      intacte : le volet ne doit rien changer à l'édition directe)
--   7. athlète INSERT champ='Champ Inventé' ⇒ REJETEE, et le motif ne parle
--      plus d'évaluations
--   8. athlète INSERT sur l'athlete_id d'un AUTRE ⇒ REFUSÉ (nouvelle
--      WITH CHECK de la politique d'insertion)
--   9. les 14 traits passent dans LEURS DEUX écritures — 'Leadership' ET
--      'leadership' — sinon un client sur deux se fait refuser en silence
--
-- ORDRE D'ARRIVÉE, ET IL N'EST PAS NÉGOCIABLE :
--   ce DDL en prod  →  PUIS la restauration de l'UI athlète.
-- Dans l'autre sens on réexpédie exactement le mensonge qu'on a retiré le
-- 2026-09-10 : un bouton « envoyée à ton coach » suivi d'un refus automatique.
-- ═══════════════════════════════════════════════════════════════════════════
