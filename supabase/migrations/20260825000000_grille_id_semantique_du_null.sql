-- 20260825000000_grille_id_semantique_du_null
--
-- NON APPLIQUÉE PAR L'AGENT. Fichier préparé sur demande, à appliquer par BP.
-- ATTENTION : le nom de fichier porte un horodatage CHOISI. Si l'application
-- se fait via MCP apply_migration, celui-ci posera sa PROPRE version — il
-- faudra alors renommer le fichier pour qu'il corresponde à ce qui est
-- réellement enregistré dans supabase_migrations.schema_migrations, et
-- chercher par `name`, jamais par `version`.
--
-- ── OBJET : un commentaire, rien d'autre ────────────────────────────────────
-- Aucune donnée touchée, aucune colonne modifiée, aucune fonction redéfinie.
-- COMMENT ON COLUMN uniquement.
--
-- ── POURQUOI ────────────────────────────────────────────────────────────────
-- Le commentaire posé le 2026-08-23 disait :
--
--   « Grille ayant servi à la saisie. NULL = GENERIQUE (repli appliqué par le
--     frontend). Volontairement nullable et sans default : aucun backfill n'a
--     été exécuté, les lignes antérieures restent à NULL. »
--
-- Ses deux phrases se contredisent : NULL ne peut pas signifier À LA FOIS
-- « GENERIQUE » et « ligne antérieure jamais renseignée ».
--
-- Le frontend a tranché dans le sens qui donne à la colonne son utilité.
-- lib/evaluations/grilles.ts (grilleIdForSave) écrit TOUJOURS la grille
-- réellement utilisée, GENERIQUE COMPRISE. Raison : si un athlète est évalué
-- aujourd'hui sur GENERIQUE et que sa position reçoit une grille dédiée dans
-- six mois, laisser NULL ferait repasser cette vieille évaluation par la
-- résolution par position — donc changerait RÉTROACTIVEMENT ses libellés.
-- C'est exactement la dérive que grille_id existe pour empêcher.
--
-- Sémantique retenue :
--   NON NULL  → la grille utilisée à la saisie, GENERIQUE incluse. Figée.
--   NULL      → évaluation ANTÉRIEURE aux grilles, jamais renseignée.
--               Le frontend applique alors le repli par position, puis
--               GENERIQUE. Concerne les 5 lignes historiques, non backfillées
--               et qui le restent.
--
-- Aucune ligne existante ne change de sens au passage : les 5 lignes à NULL
-- relèvent bien du second cas.

comment on column public.evaluations.grille_id is
$c$Grille d'évaluation FIGÉE au moment de la saisie.

NON NULL = la grille réellement utilisée, GENERIQUE COMPRISE. C'est ce figeage
qui garantit qu'une évaluation garde ses libellés même si la position de
l'athlète reçoit une grille dédiée plus tard.

NULL = évaluation ANTÉRIEURE au chantier des grilles, jamais renseignée. Le
frontend applique alors le repli : position_grille, puis GENERIQUE. NULL ne
signifie PAS « GENERIQUE » — le commentaire précédent l'affirmait à tort, et se
contredisait dans sa phrase suivante.

Volontairement nullable et sans default. Aucun backfill n'a été exécuté et
aucun n'est prévu : les 5 lignes historiques restent à NULL.

Écrit par lib/evaluations/grilles.ts -> grilleIdForSave(), appelé depuis
buildEvalRecord (app/coach/athletes/_data/saveAthlete.ts). Quand le référentiel
de grilles est injoignable, grilleIdForSave rend NULL plutôt que de figer une
valeur devinée.$c$;
