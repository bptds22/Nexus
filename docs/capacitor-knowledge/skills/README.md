# skills/

Fichiers `SKILL.md` provenant de repos GitHub spécialisés (Capacitor, Ionic, plugins natifs, Next.js static export, etc.). Un fichier par skill — le contenu provient typiquement de `skill://...` ou d'un clone de repo public.

## Convention de nommage

```
skills/<source>-<skill-slug>.md
```

Exemples :
- `skills/capacitor-camera.md`
- `skills/ionic-storage.md`
- `skills/nextjs-static-export.md`

Slug en kebab-case minuscule. Préfixer par la source (`capacitor-`, `ionic-`, `nextjs-`, etc.) pour grouper visuellement.

## Format attendu

Markdown standard. Frontmatter YAML **optionnel** mais recommandé :

```markdown
---
source: https://github.com/ionic-team/capacitor-plugins/tree/main/camera
date_added: 2026-05-27
version: 6.x
---

# Capacitor Camera Plugin

(contenu du SKILL.md)
```

Champs frontmatter utiles :
- `source` — URL du repo ou du fichier original
- `date_added` — date d'ajout au knowledge base (YYYY-MM-DD)
- `version` — version du plugin / outil documenté
- `tags` — liste optionnelle (ex: `[capacitor, plugin, ios]`)
