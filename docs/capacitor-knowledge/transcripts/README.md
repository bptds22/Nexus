# transcripts/

Transcripts de vidéos YouTube (tutoriels Capacitor, talks Ionic, démos Next.js mobile, etc.) convertis en markdown. Permet la recherche full-text et la citation directe sans avoir à re-regarder la vidéo.

## Convention de nommage

```
transcripts/YYYY-MM-DD-nom-de-la-video.md
```

- `YYYY-MM-DD` = date de **publication** de la vidéo (pas date d'ajout au repo)
- Slug en kebab-case minuscule, sans accents ni caractères spéciaux

Exemples :
- `transcripts/2026-05-15-capacitor-vs-react-native-2026.md`
- `transcripts/2025-11-03-nextjs-static-export-deep-dive.md`

## Format attendu

Markdown. Frontmatter YAML **recommandé** pour conserver le contexte source :

```markdown
---
title: "Capacitor vs React Native in 2026"
source: https://www.youtube.com/watch?v=XXXXXXXXXXX
channel: Ionic Framework
date_published: 2026-05-15
duration: "32:14"
date_transcribed: 2026-05-27
---

# Capacitor vs React Native in 2026

## [00:00] Introduction

(transcript ici, idéalement avec timestamps en `[MM:SS]` ou `[HH:MM:SS]`)
```

Champs frontmatter :
- `title` — titre exact de la vidéo
- `source` — URL YouTube complète
- `channel` — nom de la chaîne
- `date_published` — date de publication (YYYY-MM-DD)
- `duration` — durée totale (`MM:SS` ou `HH:MM:SS`)
- `date_transcribed` — date d'ajout au knowledge base

Garder les timestamps dans le corps pour permettre de pointer vers un moment précis de la vidéo.
