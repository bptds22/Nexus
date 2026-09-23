-- ═══════════════════════════════════════════════════════════════════════════
-- D6 volet 6 — ONE-SHOT données (plan §6), APRÈS la migration 20260923210000.
--
-- Décisions BP 2026-09-23 :
--   D1  les refus machine d'athlètes qui ont un coach repassent EN_ATTENTE,
--       note_systeme / raison_rejet / reviewed_at EFFACÉS ;
--   D4  leurs notifications de refus sont SUPPRIMÉES (sauvegardées d'abord).
--   Les refus d'athlètes SANS coach restent REJETEE, notifications comprises.
--
-- Cible définie par CRITÈRES, jamais par identifiants. Trois modes :
--   psql -v mode=dryrun  -f …   comptes seulement, AUCUNE écriture, aucun nom
--   psql -v mode=apply   -f …   une transaction : sauvegarde, écritures, assertions
--   psql -v mode=rollback -f …  restaure depuis la sauvegarde
-- Attendus (prod, relevé du 2026-09-23) : 4 suggestions, 2 athlètes, 4
-- notifications. Surchargeables : -v attendu_sugg=… -v attendu_notif=…
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\if :{?attendu_sugg}  \else \set attendu_sugg 4  \endif
\if :{?attendu_notif} \else \set attendu_notif 4 \endif
\if :{?mode} \else \echo 'NEXUS: préciser -v mode=dryrun|apply|rollback' \quit \endif

\set cible_sql 'SELECT s.id, s.athlete_id, s.champ, s.created_at FROM public.athlete_suggestions s JOIN public.athletes a ON a.id = s.athlete_id WHERE s.status = ''REJETEE'' AND s.raison_rejet = ''Les distinctions et évaluations sont attribuées par ton entraîneur.'' AND s.created_at >= ''2026-09-10'' AND a.coach_id IS NOT NULL'

SELECT (:'mode' = 'dryrun') AS est_dryrun, (:'mode' = 'apply') AS est_apply, (:'mode' = 'rollback') AS est_rollback \gset

-- ─────────────────────────────── DRY-RUN ───────────────────────────────────
\if :est_dryrun
WITH cible AS (:cible_sql),
notifs AS (
  SELECT n.id FROM public.athlete_notifications n JOIN cible c ON c.athlete_id = n.athlete_id
   WHERE n.type = 'SUGGESTION_REJECTED' AND n.metadata->>'champ' = c.champ
     AND n.created_at BETWEEN c.created_at - interval '5 seconds' AND c.created_at + interval '5 seconds')
SELECT (SELECT count(*) FROM cible)                    AS suggestions_a_rouvrir,
       :attendu_sugg                                   AS attendu_sugg,
       (SELECT count(DISTINCT athlete_id) FROM cible)  AS athletes,
       (SELECT count(*) FROM notifs)                   AS notifications_a_retirer,
       :attendu_notif                                  AS attendu_notif,
       (SELECT count(*) FROM public.athlete_suggestions WHERE status = 'EN_ATTENTE') AS en_attente_avant,
       (SELECT count(*) FROM public.athlete_suggestions s JOIN public.athletes a ON a.id = s.athlete_id
         WHERE s.status = 'REJETEE' AND s.created_at >= '2026-09-10' AND a.coach_id IS NULL
           AND s.raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.') AS refus_sans_coach_laisses;
\endif

-- ──────────────────────────────── APPLY ────────────────────────────────────
\if :est_apply
BEGIN;
CREATE TABLE public._volet6_sauvegarde (
  quoi    text        NOT NULL CHECK (quoi IN ('suggestion', 'notification')),
  ligne   jsonb       NOT NULL,
  pris_le timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public._volet6_sauvegarde FROM PUBLIC, anon, authenticated;
ALTER TABLE public._volet6_sauvegarde ENABLE ROW LEVEL SECURITY;   -- aucune policy : illisible hors service

CREATE TEMP TABLE _cible ON COMMIT DROP AS :cible_sql;
CREATE TEMP TABLE _notifs ON COMMIT DROP AS
  SELECT n.id FROM public.athlete_notifications n JOIN _cible c ON c.athlete_id = n.athlete_id
   WHERE n.type = 'SUGGESTION_REJECTED' AND n.metadata->>'champ' = c.champ
     AND n.created_at BETWEEN c.created_at - interval '5 seconds' AND c.created_at + interval '5 seconds';

SELECT (SELECT count(*) FROM _cible) = :attendu_sugg AND (SELECT count(*) FROM _notifs) = :attendu_notif AS cible_conforme \gset
\if :cible_conforme
\else
  \echo 'NEXUS: cible inattendue — on s''arrête et on relit, on n''ajuste pas le script'
  ROLLBACK;
  \quit
\endif

INSERT INTO public._volet6_sauvegarde (quoi, ligne)
  SELECT 'suggestion', to_jsonb(s) FROM public.athlete_suggestions s WHERE s.id IN (SELECT id FROM _cible);
INSERT INTO public._volet6_sauvegarde (quoi, ligne)
  SELECT 'notification', to_jsonb(n) FROM public.athlete_notifications n WHERE n.id IN (SELECT id FROM _notifs);

-- D1 — REJETEE → EN_ATTENTE : aucun trigger n'agit (apply et notify ne partent
-- que DEPUIS EN_ATTENTE ; la transition est AFTER INSERT).
UPDATE public.athlete_suggestions
   SET status = 'EN_ATTENTE', note_systeme = NULL, raison_rejet = NULL, reviewed_at = NULL
 WHERE id IN (SELECT id FROM _cible);
-- D4
DELETE FROM public.athlete_notifications WHERE id IN (SELECT id FROM _notifs);

SELECT (SELECT count(*) FROM public.athlete_suggestions WHERE id IN (SELECT id FROM _cible) AND status = 'EN_ATTENTE'
          AND note_systeme IS NULL AND raison_rejet IS NULL AND reviewed_at IS NULL) = :attendu_sugg
   AND (SELECT count(*) FROM public._volet6_sauvegarde) = :attendu_sugg + :attendu_notif
   AND NOT EXISTS (SELECT 1 FROM public.athlete_notifications WHERE id IN (SELECT id FROM _notifs)) AS apply_conforme \gset
\if :apply_conforme
  COMMIT;
  \echo 'NEXUS: one-shot appliqué'
\else
  \echo 'NEXUS: état après écriture non conforme — ROLLBACK'
  ROLLBACK;
\endif
\endif

-- ─────────────────────────────── ROLLBACK ──────────────────────────────────
\if :est_rollback
BEGIN;
-- ⚠ Restaurer EN_ATTENTE → REJETEE réveillerait les deux triggers d'UPDATE :
-- apply_approved_suggestion réécrirait reviewed_at à now(), et
-- notify_athlete_suggestion_result enverrait un NOUVEAU refus à l'athlète — en
-- plus de celui qu'on restaure (doublon constaté en preuve locale). On les
-- coupe le temps de la restauration, DANS la transaction : un échec annule
-- aussi la désactivation.
ALTER TABLE public.athlete_suggestions DISABLE TRIGGER trg_apply_suggestion;
ALTER TABLE public.athlete_suggestions DISABLE TRIGGER trg_notify_suggestion_result;
-- Seulement les suggestions qu'aucun coach n'a encore tranchées : un verdict
-- humain posé depuis ne s'efface pas. Les autres sont COMPTÉES.
SELECT count(*) AS deja_tranchees_non_restaurees
  FROM public._volet6_sauvegarde b JOIN public.athlete_suggestions s ON s.id = (b.ligne->>'id')::uuid
 WHERE b.quoi = 'suggestion' AND s.status <> 'EN_ATTENTE';
WITH restaurees AS (
  UPDATE public.athlete_suggestions s
     SET status       = b.ligne->>'status',
         note_systeme = b.ligne->>'note_systeme',
         raison_rejet = b.ligne->>'raison_rejet',
         reviewed_at  = (b.ligne->>'reviewed_at')::timestamptz
    FROM public._volet6_sauvegarde b
   WHERE b.quoi = 'suggestion' AND s.id = (b.ligne->>'id')::uuid AND s.status = 'EN_ATTENTE'
  RETURNING s.athlete_id, s.champ, s.created_at
)
-- Seulement les notifications des suggestions RESTAURÉES : celle d'une
-- suggestion tranchée entre-temps ferait mentir le vrai verdict.
INSERT INTO public.athlete_notifications
  SELECT (jsonb_populate_record(NULL::public.athlete_notifications, b.ligne)).*
    FROM public._volet6_sauvegarde b
    JOIN restaurees r ON r.athlete_id = (b.ligne->>'athlete_id')::uuid
                     AND r.champ = b.ligne->'metadata'->>'champ'
                     AND (b.ligne->>'created_at')::timestamptz BETWEEN r.created_at - interval '5 seconds'
                                                                   AND r.created_at + interval '5 seconds'
   WHERE b.quoi = 'notification'
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.athlete_suggestions ENABLE TRIGGER trg_apply_suggestion;
ALTER TABLE public.athlete_suggestions ENABLE TRIGGER trg_notify_suggestion_result;
COMMIT;
\echo 'NEXUS: rollback données appliqué — public._volet6_sauvegarde conservée (à supprimer à la main)'
\endif
