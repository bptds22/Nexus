-- ═══════════════════════════════════════════════════════════════════════════
-- D6 volet 6 — ONE-SHOT, variante SQL PUR pour la prod (le MCP execute_sql ne
-- connaît pas les méta-commandes psql de scripts/d6-volet6-oneshot.sql).
-- Même logique, mêmes critères, mêmes attendus (4 suggestions / 4 notifications).
-- Trois BLOCS, exécutés SÉPARÉMENT, dans l'ordre, chacun sur GO :
--   BLOC A — dry-run   (lecture seule)
--   BLOC B — apply     (une transaction ; toute assertion ratée annule tout)
--   BLOC C — rollback  (une transaction ; triggers d'UPDATE coupés pendant la restauration)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════ BLOC A — DRY-RUN ═══════════════════════════
WITH cible AS (
  SELECT s.id, s.athlete_id, s.champ, s.created_at FROM public.athlete_suggestions s
    JOIN public.athletes a ON a.id = s.athlete_id
   WHERE s.status = 'REJETEE'
     AND s.raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.'
     AND s.created_at >= '2026-09-10' AND a.coach_id IS NOT NULL
), notifs AS (
  SELECT n.id FROM public.athlete_notifications n JOIN cible c ON c.athlete_id = n.athlete_id
   WHERE n.type = 'SUGGESTION_REJECTED' AND n.metadata->>'champ' = c.champ
     AND n.created_at BETWEEN c.created_at - interval '5 seconds' AND c.created_at + interval '5 seconds'
)
SELECT (SELECT count(*) FROM cible)                    AS suggestions_a_rouvrir,     -- attendu 4
       (SELECT count(DISTINCT athlete_id) FROM cible)  AS athletes,                  -- attendu 2
       (SELECT count(*) FROM notifs)                   AS notifications_a_retirer,   -- attendu 4
       (SELECT count(*) FROM public.athlete_suggestions WHERE status = 'EN_ATTENTE') AS en_attente_avant, -- attendu 0
       (SELECT count(*) FROM public.athlete_suggestions s JOIN public.athletes a ON a.id = s.athlete_id
         WHERE s.status = 'REJETEE' AND s.created_at >= '2026-09-10' AND a.coach_id IS NULL
           AND s.raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.') AS refus_sans_coach_laisses; -- attendu 12


-- ═════════════════════════════ BLOC B — APPLY ═════════════════════════════
BEGIN;
CREATE TABLE public._volet6_sauvegarde (
  quoi    text        NOT NULL CHECK (quoi IN ('suggestion', 'notification')),
  ligne   jsonb       NOT NULL,
  pris_le timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public._volet6_sauvegarde FROM PUBLIC, anon, authenticated;
ALTER TABLE public._volet6_sauvegarde ENABLE ROW LEVEL SECURITY;

CREATE TEMP TABLE _cible ON COMMIT DROP AS
  SELECT s.id, s.athlete_id, s.champ, s.created_at FROM public.athlete_suggestions s
    JOIN public.athletes a ON a.id = s.athlete_id
   WHERE s.status = 'REJETEE'
     AND s.raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.'
     AND s.created_at >= '2026-09-10' AND a.coach_id IS NOT NULL;
CREATE TEMP TABLE _notifs ON COMMIT DROP AS
  SELECT n.id FROM public.athlete_notifications n JOIN _cible c ON c.athlete_id = n.athlete_id
   WHERE n.type = 'SUGGESTION_REJECTED' AND n.metadata->>'champ' = c.champ
     AND n.created_at BETWEEN c.created_at - interval '5 seconds' AND c.created_at + interval '5 seconds';

DO $$ BEGIN
  IF (SELECT count(*) FROM _cible) <> 4 OR (SELECT count(*) FROM _notifs) <> 4 THEN
    RAISE EXCEPTION 'NEXUS: cible inattendue (% suggestions, % notifications) — rien n''est écrit',
      (SELECT count(*) FROM _cible), (SELECT count(*) FROM _notifs);
  END IF;
END $$;

INSERT INTO public._volet6_sauvegarde (quoi, ligne)
  SELECT 'suggestion', to_jsonb(s) FROM public.athlete_suggestions s WHERE s.id IN (SELECT id FROM _cible);
INSERT INTO public._volet6_sauvegarde (quoi, ligne)
  SELECT 'notification', to_jsonb(n) FROM public.athlete_notifications n WHERE n.id IN (SELECT id FROM _notifs);

UPDATE public.athlete_suggestions
   SET status = 'EN_ATTENTE', note_systeme = NULL, raison_rejet = NULL, reviewed_at = NULL
 WHERE id IN (SELECT id FROM _cible);
DELETE FROM public.athlete_notifications WHERE id IN (SELECT id FROM _notifs);

DO $$ BEGIN
  IF (SELECT count(*) FROM public.athlete_suggestions WHERE id IN (SELECT id FROM _cible) AND status = 'EN_ATTENTE'
        AND note_systeme IS NULL AND raison_rejet IS NULL AND reviewed_at IS NULL) <> 4
     OR (SELECT count(*) FROM public._volet6_sauvegarde) <> 8
     OR EXISTS (SELECT 1 FROM public.athlete_notifications WHERE id IN (SELECT id FROM _notifs)) THEN
    RAISE EXCEPTION 'NEXUS: état après écriture non conforme — tout est annulé';
  END IF;
END $$;
COMMIT;


-- ════════════════════════════ BLOC C — ROLLBACK ═══════════════════════════
BEGIN;
ALTER TABLE public.athlete_suggestions DISABLE TRIGGER trg_apply_suggestion;
ALTER TABLE public.athlete_suggestions DISABLE TRIGGER trg_notify_suggestion_result;
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
-- Ensuite, à la main : SELECT … pour compter les suggestions déjà tranchées
-- (status <> 'EN_ATTENTE' parmi la sauvegarde), puis DROP TABLE public._volet6_sauvegarde.
