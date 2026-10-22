# Leçons — façons de faire corrigées par BP

Relire au début de chaque tâche. Une ligne par règle : date — règle.
Les règles déjà écrites dans CLAUDE.md n'y sont pas recopiées.

- 2026-09-21 — `git add` fichier par fichier seulement : jamais `-A`, `.`, `commit -a` ni un dossier entier. Avant de commiter, vérifier `git diff --cached --name-only` sans filtre.
- 2026-09-24 — Pendant que BP teste en local : ne pas changer de branche et ne pas arrêter le serveur 3002. Travailler dans un dossier séparé (worktree).
- 2026-09-30 — Un rollback puis une ré-application sur la base locale efface les données de test de BP : l'annoncer avant, ou utiliser une base jetable.
- 2026-10-07 — Jamais de rebase ni de force push sur une branche déjà poussée. Pour récupérer main : `git merge --no-ff origin/main`.
- 2026-10-14 — Si une autre session travaille dans le dossier principal : travailler dans un worktree séparé. Jamais de `git stash` dans un dossier partagé.
- 2026-10-22 — Ne jamais modifier une migration déjà appliquée sous le même numéro : créer un nouveau fichier.
