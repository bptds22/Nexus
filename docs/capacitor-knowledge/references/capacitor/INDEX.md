# Capacitor docs — index

Doc Capacitor v7 complète, clonée depuis le repo officiel `ionic-team/capacitor-docs`. 141 fichiers dans [`source-docs/`](source-docs/). Cet index pointe vers les pages les plus pertinentes pour le portage mobile de Nexus.

## Pages à lire en premier

Ordre conseillé pour démarrer le projet mobile, du général au spécifique :

1. **[main/getting-started/installation.md](source-docs/main/getting-started/installation.md)** — installer Capacitor dans un projet web existant (Nexus = Next.js).
2. **[main/getting-started/with-ionic.md](source-docs/main/getting-started/with-ionic.md)** — pattern d'intégration avec un framework JS (Next.js suit le même flow que Ionic).
3. **[main/basics/configuring-your-app.md](source-docs/main/basics/configuring-your-app.md)** — `capacitor.config.ts`, options, paths, scheme.
4. **[main/basics/workflow.md](source-docs/main/basics/workflow.md)** — boucle de dev : sync, copy, run, livereload.
5. **[main/ios/index.md](source-docs/main/ios/) + sous-fichiers** — setup Xcode, signing, deploiement TestFlight/App Store.
6. **[main/android/index.md](source-docs/main/android/) + sous-fichiers** — setup Android Studio, signing, deploiement Play Store.
7. Plugins individuels (voir section suivante).

## Plugins critiques pour Nexus

Plugins Capacitor à intégrer pour répondre aux besoins identifiés dans l'audit mobile :

| Plugin | Fichier | Usage Nexus |
|---|---|---|
| **Preferences** | [apis/preferences.md](source-docs/apis/preferences.md) | Stockage clé/valeur pour la session auth (remplace cookies/SSR), prefs utilisateur, cache léger. |
| **Push Notifications** | [apis/push-notifications.md](source-docs/apis/push-notifications.md) | Notifs aux recruteurs (nouvelle correspondance), aux coachs (athlète vérifié, etc.). |
| **Haptics** | [apis/haptics.md](source-docs/apis/haptics.md) | Feedback tactile sur actions (favori, like, swipe kanban). |
| **App** | [apis/app.md](source-docs/apis/app.md) | État de l'app (foreground/background), deep-links, gestion du bouton retour Android. |
| **Status Bar** | [apis/status-bar.md](source-docs/apis/status-bar.md) | Couleur/style de la status bar — alignement avec le dark mode Nexus (#111317). |

### Guides connexes (à lire en complément des plugins)

- [main/guides/push-notifications-firebase.md](source-docs/main/guides/push-notifications-firebase.md) — setup Firebase pour les push notifs.
- [main/guides/deep-links.md](source-docs/main/guides/deep-links.md) — URL universelles pour iOS/Android.
- [main/guides/storage.md](source-docs/main/guides/storage.md) — décision Preferences vs SQLite vs Filesystem.
- [main/guides/live-reload.md](source-docs/main/guides/live-reload.md) — DX pendant le dev.
- [main/guides/splash-screens-and-icons.md](source-docs/main/guides/splash-screens-and-icons.md) — branding mobile.

## Sections de la doc

- **`apis/`** (30+ fichiers) — référence de tous les plugins officiels (Camera, Filesystem, Browser, Clipboard, Geolocation, Local Notifications, Network, Share, Splash Screen, Toast, etc.).
- **`main/getting-started/`** — installation, environment, FAQ, templates, VSCode extension.
- **`main/basics/`** — config, workflow, using-plugins, utilities.
- **`main/ios/` & `main/android/`** — setup platform-spécifique, troubleshooting, deployment.
- **`main/web/`** — cible web (utile si on veut un build web Capacitor en parallèle du Next.js standard).
- **`main/guides/`** — guides longs : deep-links, push Firebase, security, CI/CD, splash, deploying-updates, autofill, etc.
- **`main/reference/`** — `config.md` (référence config complète), `core-apis.md`, `support-policy.mdx`.
- **`main/updating/`** — guides de migration entre versions Capacitor.
- **`main/cordova/`** — compat avec plugins Cordova legacy (probablement pas utile pour Nexus).
- **`plugins/` & `plugins.mdx`** — index général des plugins.
- **`cli/`** — référence des commandes `npx cap *`.

## Notes

- **Version** : v7 (la plus récente versionnée à la date du clone). Capacitor v8 est en préparation dans le `docs/` non-versionné du repo source.
- **Format** : markdown + mdx avec frontmatter Docusaurus (`id`, `title`, `slug`, `custom_edit_url`). Les liens internes utilisent les `slug` Docusaurus, donc pas tous résolvables tels quels en local — utiliser la structure de fichiers ci-dessus pour naviguer.
- **Pas de bruit à nettoyer** : c'est le markdown source officiel, pas du HTML scrapé.
- **Voir aussi** : [SOURCE.md](SOURCE.md) pour le manifest complet + commande de nettoyage du clone temporaire.
