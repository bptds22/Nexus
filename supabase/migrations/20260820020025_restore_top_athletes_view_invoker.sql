-- 20260820020025_restore_top_athletes_view_invoker
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration (jamais db push).
-- Nom de fichier aligne sur la version REELLE stampee par apply_migration.
-- Chercher par `name` dans schema_migrations, jamais par `version`.
--
-- DEPENDANCE STRICTE : doit passer APRES 20260820015945_partner_read_evaluations_policy.
-- Dans l'autre ordre, tous les badges de distinction disparaissent en silence.
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Point 2 du chantier RLS partenaire : REPARER une regression, pas durcir a neuf.
--
--   2026-07-07  convert_top_athletes_to_invoker  -> INVOKER
--   2026-07-07  harden_top_athletes_view         -> recreee WITH (security_invoker = true)
--   2026-08-18  top_athletes_view_genre          -> CREATE OR REPLACE VIEW sans la
--                                                   clause WITH => INVOKER PERDU
--
-- CREATE OR REPLACE VIEW EFFACE les reloptions que la nouvelle definition ne
-- redeclare pas. Mecanisme prouve le 2026-08-19 sur objet jetable en local :
--
--   create view _probe as select 1 as x;
--   alter view _probe set (security_invoker = true);   -- {security_invoker=true}
--   create or replace view _probe as select 1 as x;    -- NULL  <- REINITIALISE
--
-- Le durcissement de juillet etait donc annule depuis six semaines, sans erreur
-- ni log, par une migration qui ne parlait que d'ajouter une colonne.
--
-- ── FORME : ALTER VIEW, et NON CREATE OR REPLACE ... WITH ────────────────────
-- L'etat catalogue obtenu est IDENTIQUE (reloptions = {security_invoker=true}),
-- mais ALTER ne touche pas a la definition : les 18 colonnes projetees — dont
-- `genre`, ajoute le 2026-08-18, et dont dependent les filtres genre des quatre
-- ecrans partenaire — ne peuvent pas etre perdues. Reproduire la definition a la
-- main pour y accrocher une clause WITH serait exactement le geste qui a cause la
-- regression ci-dessus.
--
-- ── PERIMETRE : NE PAS ETENDRE A trending_athletes_view ──────────────────────
-- Son mode DEFINER est DELIBERE, pas accidentel. Ses CTE agregent
-- recruiter_athlete_views et recruiter_favorites, qui n'ont AUCUNE policy
-- partenaire. En INVOKER : CTE a 0 ligne -> COALESCE(...,0) -> views_delta = 0
-- -> le `.gt("views_delta", 0)` de la page filtre TOUT -> /partenaire/tendances
-- vide en permanence, sans erreur. Verifie apres cette migration : la vue est
-- toujours en DEFINER et rend toujours 29 lignes.
--
-- ── PREUVE RUNTIME, EN PROD ──────────────────────────────────────────────────
-- Le local est PLUS permissif que la prod (dossier §4-ter) : il ne prouve rien
-- ici. Tests via `set local role authenticated` + `request.jwt.claims`.
--
--   | test | mesure                                    | avant | apres |
--   |------|-------------------------------------------|-------|-------|
--   | 2.a  | pg_class.reloptions                       |  NULL | {security_invoker=true} |
--   | 2.b  | partenaire -> lignes top_athletes_view    |    29 |    29 |
--   | 2.c  | partenaire -> distinctions NON nulles     |     2 |     2 |  <- LE test qui decide
--   | 2.d  | coach (non-partenaire) -> lignes de la vue |     0 |     0 |  <- negatif
--   | 2.e  | trending : reloptions / lignes            | NULL/29 | NULL/29 |
--   | 2.f  | second partenaire bpdesfosses             | 29 / 2 | 29 / 2 |
--   | 2.g  | scripts/check-view-hardening.sql          | 1 ligne | 0 ligne |
--
-- 2.c est le seul test qui distingue un succes d'une panne muette : a 0, la
-- policy du point 1 n'a pas pris et il faut annuler immediatement.
--
-- ── RETOUR ARRIERE ───────────────────────────────────────────────────────────
--   alter view public.top_athletes_view reset (security_invoker);
--
-- Voir docs/security-definer-partner-views-investigation-20260706.md §1, §2, §4-bis.

alter view public.top_athletes_view set (security_invoker = true);

comment on view public.top_athletes_view is
$c$security_invoker=true — RESTAURE le 2026-08-19 apres la regression du
2026-08-18 : la migration top_athletes_view_genre a fait un CREATE OR REPLACE
VIEW sans reporter la clause, ce qui EFFACE les reloptions. Le durcissement du
2026-07-07 (harden_top_athletes_view) etait donc annule depuis six semaines,
sans erreur ni log.

Gate appelant is_approved_partner(auth.uid()) dans le WHERE — conserve.

ATTENTION 1 — tout CREATE OR REPLACE VIEW sur cet objet efface a nouveau
security_invoker. Le reposer explicitement via WITH (security_invoker = true),
puis lancer scripts/check-view-hardening.sql (zero ligne = conforme).

ATTENTION 2 — cette vue DEPEND desormais de la policy « approved partners read
evaluations of eligible athletes » sur public.evaluations. Sans elle, le
LEFT JOIN LATERAL rend 0 ligne pour un partenaire et toutes les distinctions
tombent a NULL en silence : les badges disparaissent et le filtre « Avec
distinction » de /partenaire/athletes rend zero resultat, sans aucune erreur.

ATTENTION 3 — NE PAS appliquer le meme traitement a trending_athletes_view.
Son mode DEFINER est delibere : ses CTE agregent recruiter_athlete_views et
recruiter_favorites, qui n'ont AUCUNE policy partenaire. En INVOKER, tous les
deltas tomberaient a 0 et /partenaire/tendances serait vide en permanence.

Voir docs/security-definer-partner-views-investigation-20260706.md, sections 1,
2 et 4-bis.$c$;
