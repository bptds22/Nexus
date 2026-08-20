-- 20260820022949_top_athletes_view_back_to_definer
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration. Nom de fichier
-- aligne sur la version REELLE. Chercher par `name`, jamais par `version`.
--
-- Point 5b(b) du chantier RLS partenaire.
--
-- REVIENT sur 20260820020025_restore_top_athletes_view_invoker, applique le
-- meme jour. Ce n'est PAS une annulation d'erreur : c'est un apprentissage.
--
-- POURQUOI INVOKER ETAIT LE MAUVAIS OUTIL ICI
-- INVOKER est la bonne posture quand la RLS de la table de base a la BONNE
-- GRANULARITE. Pour `athletes`, elle ne l'a pas :
--     la RLS est par LIGNE, l'exposition est COLONNAIRE.
-- Tant qu'une policy SELECT partenaire existait sur athletes, les 87 colonnes
-- des lignes visibles etaient lisibles en PostgREST direct, quoi que
-- l'application demande. Mesure runtime sous JWT partenaire, 2026-08-19 :
--   email 29/29 · date_naissance 29/29 (MINEURS COMPRIS) · nom_parent 29/29
--   telephone 23 · telephone_parent 4 · moyenne_generale 17
-- Aucun GRANT colonne ne pouvait corriger ca : les partenaires partagent le
-- role `authenticated` avec les entraineurs et les recruteurs.
--
-- Refermer exigeait donc de SUPPRIMER cette policy (20260820023055). Une vue
-- INVOKER en DEPENDAIT. D'ou ce reset : pour le chemin partenaire, DEFINER
-- avec gate interne est la posture FORTE — c'est elle qui permet de maitriser
-- la PROJECTION, ce que la RLS ne sait pas faire.
--
-- ORDRE IMPERATIF : ce reset DOIT preceder le drop des policies. Dans l'autre
-- sens, /partenaire/athletes et /classements tombent a zero entre les deux.
--
-- PREUVE (JWT partenaire, prod) : apres reset, 29 lignes / 2 distinctions —
-- identique a avant.
--
-- scripts/check-view-hardening.sql : l'attendu de cette vue passe de INVOKER a
-- DEFINER dans le meme lot. Sans cette mise a jour, le controle signalerait un
-- ecart a chaque execution et on reapprendrait a l'ignorer — exactement ce qui
-- a laisse la regression du 2026-08-18 passer six semaines.

alter view public.top_athletes_view reset (security_invoker);

comment on view public.top_athletes_view is
$c$SECURITY DEFINER ASSUME (2026-08-19, point 5b du chantier RLS partenaire).

Passee en INVOKER le matin meme, puis remise en DEFINER le soir — deliberement.
INVOKER supposait que la RLS de `athletes` ait la bonne granularite. Elle ne
l'a pas : la RLS est par LIGNE, l'exposition est COLONNAIRE. Tant qu'une policy
partenaire existait sur athletes, les 87 colonnes des lignes visibles etaient
lisibles en PostgREST direct (email, date_naissance, nom_parent... verifie en
runtime). Cette policy est desormais SUPPRIMEE, et cette vue ne peut donc plus
etre en INVOKER : elle ne verrait plus aucune ligne.

Pour le chemin partenaire, DEFINER avec gate interne est la posture FORTE :
c'est elle qui permet de maitriser la projection.

Acces restreint par : REVOKE anon + gate is_approved_partner(auth.uid()) dans le
WHERE. Un non-partenaire authentifie lit 0 ligne.

ATTENTION — un CREATE OR REPLACE VIEW ferait perdre les colonnes projetees si la
definition partait d'une version anterieure : `genre` (ajoute 2026-08-18)
alimente les filtres genre des QUATRE ecrans partenaire.

Voir docs/security-definer-partner-views-investigation-20260706.md et
scripts/check-view-hardening.sql, dont l'attendu pour cette vue est DEFINER.$c$;
