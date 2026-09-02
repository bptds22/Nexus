-- 20260902210000_rseq_cron_extension.sql
-- ============================================================================
-- VEILLE RSEQ — activation de pg_cron.
--
-- L'extension était DISPONIBLE sur le plan (pg_available_extensions la liste en
-- 1.6.4) mais pas installée : ni le schéma `cron`, ni `cron.job`, ni
-- `cron.job_run_details` n'existaient. Un travail qui n'existe pas ne tire pas
-- et ne laisse aucune trace d'échec — c'est exactement ce que le diagnostic du
-- 2026-09-02 a constaté.
--
-- pg_net (0.20.3) est déjà là : c'est lui qui portera l'appel HTTP.
--
-- Cette migration N'ARME AUCUN TRAVAIL. Elle installe l'outil. Le job lui-même
-- vient après, avec le secret, dans 20260902210200 — dans cet ordre, parce
-- qu'un job planifié sans son secret échouerait en silence chaque mercredi.
-- ============================================================================

create extension if not exists pg_cron;
