# references/

Pointeurs vers du contenu externe : liens, repos d'exemple, articles, threads Twitter/Reddit, issues GitHub instructives. **Pas de contenu inline** — juste l'URL + un commentaire court qui dit pourquoi c'est utile.

Si un article mérite d'être archivé en entier, il va dans [`../transcripts/`](../transcripts/) (pour les vidéos) ou idéalement dans [`../skills/`](../skills/) si c'est de la doc technique structurée.

## Convention de nommage

Deux options selon le volume :

**Option A — un fichier thématique groupé** (recommandé pour démarrer) :

```
references/<thème>.md
```

Exemples :
- `references/capacitor-plugins.md` — tous les plugins évalués
- `references/exemple-repos.md` — repos d'apps réelles à étudier
- `references/articles.md` — articles de blog, posts Medium, etc.

**Option B — un fichier par référence majeure** (si une ressource mérite sa propre fiche) :

```
references/YYYY-MM-DD-slug.md
```

## Format attendu

Markdown. Une référence par bloc, avec **toujours** : URL, source, date d'ajout, commentaire.

```markdown
## Capacitor Plugins — repo officiel

- **URL** : https://github.com/ionic-team/capacitor-plugins
- **Date ajoutée** : 2026-05-27
- **Pourquoi c'est utile** : source officielle des plugins maintenus par l'équipe Ionic. À consulter avant d'envisager un plugin tiers.
- **Plugins clés pour Nexus** : Camera (upload photos athlètes), Filesystem (cache hors-ligne), Preferences (auth tokens).
```

Frontmatter facultatif pour les fichiers à référence unique :

```markdown
---
url: https://...
type: repo | article | thread | issue
date_added: 2026-05-27
---
```

Garder les commentaires concis — la valeur de `references/` c'est de filtrer et contextualiser, pas de paraphraser le contenu source.
