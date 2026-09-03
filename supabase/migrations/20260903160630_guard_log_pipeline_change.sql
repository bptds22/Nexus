-- ═══════════════════════════════════════════════════════════════
-- LOT 0 — log_pipeline_change ne doit se déclencher QUE sur un vrai
-- changement de stage.
--
-- ÉTAT AVANT : trg_log_pipeline est AFTER INSERT OR UPDATE, SANS WHEN.
--   CREATE TRIGGER trg_log_pipeline AFTER INSERT OR UPDATE
--     ON public.recruiter_pipeline FOR EACH ROW
--     EXECUTE FUNCTION log_pipeline_change()
-- Toute écriture de colonne le réveille. handleSaveAction (app/recruteur/
-- pipeline/page.tsx) écrit { flagged, next_action_at, next_action_note } et
-- handleSaveVisit écrit { visit_at, updated_at } : chacun insère un
-- PIPELINE_CHANGED dont before_stage == new_stage. Mesuré en prod le
-- 2026-09-03 sur recruiter_activity_log : 69 lignes PIPELINE_CHANGED, dont
-- 7 faux positifs (before_stage = new_stage), 33 inserts légitimes
-- (before_stage NULL) et 29 vrais changements.
--
-- FORME RETENUE : DEUX triggers. Le WHEN d'un trigger unique
-- « INSERT OR UPDATE » ne peut PAS exprimer la garde, pour deux raisons
-- vérifiées sur ce serveur même (PostgreSQL 17, test en transaction annulée
-- sur table temporaire, 2026-09-03) :
--   • WHEN (OLD.stage IS DISTINCT FROM NEW.stage) sur INSERT OR UPDATE
--     → ERREUR : « INSERT trigger's WHEN condition cannot reference OLD values »
--   • WHEN (TG_OP = 'INSERT' OR ...)
--     → ERREUR : « column "tg_op" does not exist »
--     TG_OP est une variable PL/pgSQL du corps de la fonction ; la condition
--     WHEN est évaluée par l'exécuteur, hors de tout contexte PL/pgSQL.
-- Source : PostgreSQL, CREATE TRIGGER — « la condition WHEN ... ne peut pas
-- référencer OLD pour un trigger INSERT, ni NEW pour un trigger DELETE ».
-- Les deux formes séparées sont ACCEPTÉES au même test.
--
-- Pourquoi pas la garde interne façon notify_parent_pipeline_stage : elle
-- marcherait, mais elle impose de réécrire log_pipeline_change. La consigne
-- est de ne pas toucher la fonction si la garde tient au niveau trigger —
-- et elle y tient. La fonction reste donc BIT POUR BIT identique, y compris
-- son CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END, qui continue
-- de fonctionner : le trigger INSERT lui donne TG_OP='INSERT' (before_stage
-- NULL, 1re entrée pipeline) et le trigger UPDATE TG_OP='UPDATE'.
--
-- ORDRE DE DÉCLENCHEMENT : à timing égal, PostgreSQL exécute les triggers
-- par ordre alphabétique de nom. trg_log_pipeline devient
-- trg_log_pipeline_insert / trg_log_pipeline_update : toujours avant
-- trg_notify_parent_pipeline_stage et trg_sync_global_status, comme avant.
-- Aucun changement d'ordre observable.
--
-- NE TOUCHE PAS : la fonction log_pipeline_change, la colonne
-- recruiter_pipeline.notes (deprecated mais TOUJOURS LUE par
-- lib/queries/recruiter/usePipelineCards.ts — pas de suppression ici), les
-- autres triggers de la table, ni aucune policy RLS.
-- ═══════════════════════════════════════════════════════════════

drop trigger if exists trg_log_pipeline on public.recruiter_pipeline;

-- INSERT : toujours journalisé (1re entrée dans le pipeline).
-- Pas de WHEN — OLD n'existe pas, et il n'y a rien à filtrer.
drop trigger if exists trg_log_pipeline_insert on public.recruiter_pipeline;
create trigger trg_log_pipeline_insert
  after insert on public.recruiter_pipeline
  for each row
  execute function public.log_pipeline_change();

-- UPDATE : journalisé UNIQUEMENT si le stage change réellement.
-- IS DISTINCT FROM (et non <>) pour traiter les NULL correctement.
drop trigger if exists trg_log_pipeline_update on public.recruiter_pipeline;
create trigger trg_log_pipeline_update
  after update on public.recruiter_pipeline
  for each row
  when (old.stage is distinct from new.stage)
  execute function public.log_pipeline_change();
