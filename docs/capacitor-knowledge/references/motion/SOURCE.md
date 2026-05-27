---
type: source-manifest
date_added: 2026-05-27
last_updated: 2026-05-27
method: 3
status: partial
pages_count: 15
total_size_kb: 184
---

# Source Motion docs

## Méthode utilisée

**Méthode 3 — Fallback web fetch direct.** Méthodes 1 et 2 ont échoué :

- **Méthode 1 (llms-full.txt)** : les 4 URLs candidates (`motion.dev/llms-full.txt`, `motion.dev/llms.txt`, `motion.dev/docs/llms-full.txt`, `motion.dev/docs/llms.txt`) retournent toutes HTTP 404.
- **Méthode 2 (clone repo)** : `motiondivision/motion` cloné avec succès (HEAD `43e508e3e967b3d17b5361064d0d53812f12fee6`), mais le repo ne contient PAS le contenu du site doc — uniquement `README.md`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md` à la racine, et quelques README dans `packages/`. Aucun dossier `docs/`, `website/`, `apps/website/` ou `content/`. Le contenu du site `motion.dev` vit dans un repo privé séparé. Le candidat `motiondivision/motiondocs` n'existe pas (404).

## Contenu téléchargé

5 pages pivots téléchargées depuis `motion.dev/docs/<slug>` et converties HTML → markdown via `turndown` (npm package). Conversion limitée au `<main>` du HTML pour éviter le bruit nav/footer/script.

| Fichier | Source URL | Taille (chars) |
|---|---|---|
| `pages/react-quick-start.md` | https://motion.dev/docs/react-quick-start | 13 336 |
| `pages/react-animation.md` | https://motion.dev/docs/react-animation | 21 783 |
| `pages/react-gestures.md` | https://motion.dev/docs/react-gestures | 8 820 |
| `pages/react-scroll-animations.md` | https://motion.dev/docs/react-scroll-animations | 14 583 |
| `pages/react-layout-animations.md` | https://motion.dev/docs/react-layout-animations | 19 799 |

**Total** : ~78 KB de markdown sur 5 pages.

## Date de téléchargement

2026-05-27

## Notes

- **Doc partielle.** Seules les 5 pages les plus utiles pour Nexus ont été récupérées (quick-start, animation, gestures, scroll, layout). Le reste de la doc Motion (transitions, SVG, hooks, motion values, exit, AnimatePresence, useScroll, etc.) n'est PAS dans ce dump.
- **Conversion HTML→markdown imparfaite.** Turndown préserve le contenu mais les premières ~10 lignes de chaque fichier sont du bruit de navigation (breadcrumbs + table des matières latérale). Le vrai contenu commence après. Les blocs `<pre><code>` sont préservés en fenced markdown avec lang hint quand disponible.
- **Framer Motion v12 (utilisé dans Nexus) a 95% d'API compatible** avec Motion (anciennement Framer Motion). Vérifier l'API officielle [framer.com/motion](https://www.framer.com/motion/) si un pattern de cette doc ne fonctionne pas avec la version installée dans Nexus.
- Si on veut la doc complète plus tard, options à explorer :
  1. Scraper la sitemap `motion.dev/sitemap.xml` et batch les pages
  2. Contacter Matt Perry / l'équipe Motion pour savoir si un `llms.txt` est prévu
  3. Pour les patterns avancés, fallback sur les exemples du repo cloné (`packages/framer-motion/` contient le source TypeScript, lisible)

## Changelog

### 2026-05-27 — Extension

- **10 pages additionnelles téléchargées** via le même flow HTML→markdown (curl + turndown). Pages ajoutées : `react-transitions`, `react-animate-presence`, `react-motion-value`, `react-use-scroll`, `react-use-transform`, `react-use-spring`, `react-use-animate`, `react-motion-component`, `react-three-fiber`, `react-accessibility`. Total : **15 pages** dans `pages/`.
- **Bruit de navigation nettoyé** sur toutes les pages (15 fichiers) via `clean.js` :
  - Suppression du breadcrumb top + bloc "Copy pageCopy page" + sidebar TOC complète (~170 lignes par page).
  - Suppression des sections trailing : `## Related topics`, `## Level up your animations.`, blocs promo Motion+/MotionScore/Newsletter, footer Previous/Next.
- **INDEX.md généré** dans `pages/../INDEX.md` (un fichier par page avec description, ordre de lecture logique, plus une note sur la compatibilité framer-motion@^12).

| Fichier | URL | Taille (KB) |
|---|---|---|
| `pages/react-transitions.md` | https://motion.dev/docs/react-transitions | 16 |
| `pages/react-animate-presence.md` | https://motion.dev/docs/react-animate-presence | 12 |
| `pages/react-motion-value.md` | https://motion.dev/docs/react-motion-value | 8 |
| `pages/react-use-scroll.md` | https://motion.dev/docs/react-use-scroll | 8 |
| `pages/react-use-transform.md` | https://motion.dev/docs/react-use-transform | 8 |
| `pages/react-use-spring.md` | https://motion.dev/docs/react-use-spring | 4 |
| `pages/react-use-animate.md` | https://motion.dev/docs/react-use-animate | 4 |
| `pages/react-motion-component.md` | https://motion.dev/docs/react-motion-component | 24 |
| `pages/react-three-fiber.md` | https://motion.dev/docs/react-three-fiber | 8 |
| `pages/react-accessibility.md` | https://motion.dev/docs/react-accessibility | 8 |

**Total dossier `motion/`** : ~184 KB sur 15 pages + INDEX + SOURCE.
