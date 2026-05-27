---
type: source-manifest
date_added: 2026-05-27
method: 2
status: complete
source_repo: https://github.com/ionic-team/capacitor-docs
source_commit: 95a89aa476431c456874cceaecec19bc0a1cf5bc
source_subdir: versioned_docs/version-v7/
version: v7
pages_count: 141
total_size_kb: 1408
---

# Source Capacitor docs

## Méthode utilisée

**Méthode 2 — Clone du repo officiel de la doc.** Méthode 1 (llms.txt) a échoué : les 4 URLs candidates retournent toutes HTTP 404 (`capacitorjs.com/llms-full.txt`, `capacitorjs.com/llms.txt`, `capacitorjs.com/docs/llms-full.txt`, `capacitorjs.com/docs/llms.txt`). Capacitor ne publie pas encore de `llms.txt`.

## Contenu téléchargé

Le repo `ionic-team/capacitor-docs` a été cloné en shallow (`--depth=1`) et le sous-dossier `versioned_docs/version-v7/` a été copié intégralement vers `source-docs/`.

- **Repo source** : https://github.com/ionic-team/capacitor-docs
- **Commit cloné** : `95a89aa476431c456874cceaecec19bc0a1cf5bc`
- **Sous-dossier source** : `versioned_docs/version-v7/`
- **Version Capacitor** : v7 (la plus récente versionnée — v8 est en préparation dans le `docs/` non-versionné du repo)
- **Versions ignorées** : v2, v3, v4, v5, v6 (anciennes)
- **Fichiers copiés** : 141 (markdown + mdx + assets)
- **Taille totale** : ~1.4 MB (1408 KB)
- **Format** : markdown + mdx avec frontmatter Docusaurus (les `id`, `title`, `slug` etc. sont préservés)

## Structure copiée dans `source-docs/`

```
source-docs/
├── README.md
├── index.md
├── plugins.mdx
├── apis/                  ← 30+ plugin docs (preferences, push-notifications, haptics, app, status-bar, camera, filesystem, etc.)
├── cli/                   ← CLI commands reference
├── main/
│   ├── getting-started/   ← installation, environment-setup, with-ionic, vscode-extension
│   ├── basics/            ← configuring-your-app, workflow, using-plugins, utilities
│   ├── ios/               ← iOS-specific setup, deployment, troubleshooting
│   ├── android/           ← Android-specific
│   ├── web/               ← Web target
│   ├── guides/            ← Guides (deep-links, push, file uploads, etc.)
│   ├── reference/         ← Reference docs (config, plugins)
│   ├── updating/          ← Migration guides
│   └── cordova/           ← Cordova plugin compat
└── plugins/               ← Plugin-specific guides
```

## Date de téléchargement

2026-05-27

## Notes

- **Source faisant autorité** : c'est le repo officiel maintenu par l'équipe Ionic. Pas de conversion HTML→markdown ici — c'est le markdown source.
- **MDX vs MD** : quelques fichiers sont en `.mdx` (composants React inline). Lisibles tels quels mais avec un peu de syntaxe JSX en surplus.
- **Pas de nettoyage de bruit** nécessaire : ce sont des fichiers de doc source, pas du HTML scrapé. Le frontmatter Docusaurus (`---\nid:\ntitle:\nslug:\n---`) est conservé en tête de chaque fichier — utile pour traçabilité.
- **Nettoyage du clone temporaire** :
  ```powershell
  Remove-Item -Recurse -Force C:\Users\bptds\Documents\capacitor-docs-temp\
  ```
- Si on veut un jour la version v8 (en préparation), ré-exécuter le clone et copier `docs/` (non-versionné) au lieu de `versioned_docs/version-v7/`.
