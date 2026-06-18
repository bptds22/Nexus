# Mobile Dev Loop — Live Reload Capacitor (iter 7.44)

But : itérer sur le mobile **sans refaire `cap run` à chaque modification**. L'app sur l'émulateur pointe vers le dev server Next ; chaque save d'un fichier = hot reload instantané.

## Setup (une fois)

Démarrer l'émulateur Android (Android Studio → Device Manager → ▶) AVANT les commandes ci-dessous.

## Boucle quotidienne

### Terminal 1 — Dev server Next (à laisser tourner)

```bash
npm run dev:mobile
```

- Lance `next dev` sur `0.0.0.0:3000` (accessible depuis l'émulateur via `10.0.2.2:3000`)
- Pose `NEXT_PUBLIC_CAPACITOR_BUILD=true` → les pages `IS_CAPACITOR` rendent la version **mobile** dès le dev server
- Pas de `output: 'export'` activé (next.config.ts garde le static-export sous `CAPACITOR_BUILD=true`, posé uniquement par le build de prod)

### Terminal 2 — Installer l'APK dev (UNE fois)

```bash
npm run cap:dev
```

- `npx cap run android --live-reload --external --host 10.0.2.2 --port 3000`
- Sync Android avec `server.url=http://10.0.2.2:3000` injecté **runtime** dans `android/app/src/main/assets/capacitor.config.json` (le `capacitor.config.ts` SOURCE reste intact)
- Installe et lance l'APK dev sur l'émulateur
- L'app charge maintenant ses pages depuis le dev server Terminal 1

### Itérations Claude / BP

Modifier un fichier mobile (composant React, page, etc.) :
- Next dev recompile (HMR)
- L'émulateur reçoit le hot reload via le WebView
- **Plus de `cap run`** entre chaque modif

## Quand re-faire `cap:dev`

Refaire UNIQUEMENT si :
- Un plugin Capacitor natif est ajouté (`@capacitor/qqch` nouveau)
- La config native change (`AndroidManifest.xml`, `capacitor.config.ts` SOURCE, plugins config)
- L'émulateur a été éteint/réinitialisé

Sinon, `cap:dev` une seule fois suffit pour toute la session.

## Avant un commit / build de validation

Toujours valider que le static-export marche AVANT de pousser :

```bash
npm run build:mobile       # next build avec CAPACITOR_BUILD=true → out/ généré
npx cap sync android       # copie out/ vers android assets + RESET capacitor.config.json (efface le server.url dev)
npm run mobile:run:android # build APK release-like + run
```

Cela garantit :
- Le build statique sans dev server fonctionne
- Le `server.url` injecté par `cap:dev` est **effacé** par le `cap sync` (config repart de `capacitor.config.ts` source)
- L'APK fonctionne avec ses assets embarqués

## Anti-oops : pourquoi pas de risque commit prod

1. `capacitor.config.ts` SOURCE n'a JAMAIS `server.url` — vérifiable dans git
2. `--live-reload` est passé UNIQUEMENT par `cap:dev` — les scripts prod (`mobile:android`, `mobile:run:android`, `build:mobile`) ne le touchent jamais
3. `android/app/src/main/assets/capacitor.config.json` (où le server.url dev est injecté) est **non tracké git** (`git ls-files android/app/src/main/assets/` → 0 fichier)
4. `next.config.ts` : `output:'export'` reste gated sur `CAPACITOR_BUILD=true` UNIQUEMENT — `dev:mobile` ne pose que le `NEXT_PUBLIC_CAPACITOR_BUILD`, sans déclencher le pipeline statique

## Troubleshooting

### L'app ouvre une page blanche
- Vérifier que `dev:mobile` (Terminal 1) tourne bien sur 3000
- Tester depuis le host : `curl http://localhost:3000/recruteur/profil` doit répondre
- Tester depuis l'émulateur (adb shell) : `curl http://10.0.2.2:3000/recruteur/profil` doit répondre

### L'app charge la version desktop au lieu de mobile
- Vérifier dans la console WebView : `process.env.NEXT_PUBLIC_CAPACITOR_BUILD` doit valoir "true"
- Si "false" : `next.config.ts` a peut-être été modifié, vérifier que le bloc `isCapacitorRuntime` lit aussi `NEXT_PUBLIC_CAPACITOR_BUILD`

### Le live reload ne s'applique pas
- Reload manuel : sur l'émulateur, tirer un peu vers le bas (pull-to-refresh) ou tuer/relancer l'app
- Vérifier que le file watcher Next n'a pas planté (Terminal 1)

### Erreur "Cleartext HTTP traffic not permitted"
- L'émulateur Android refuse HTTP. `--live-reload` ajoute automatiquement `cleartext=true` runtime, mais si ça plante : forcer dans `capacitor.config.ts` temporairement (`server: { cleartext: true }`) — **ne pas committer**.

## Production : aucun changement

Tous les scripts existants (`build:mobile`, `mobile:sync`, `mobile:android`, `mobile:run:android`) restent INTACTS et fonctionnent comme avant. Le dev loop est en plus, opt-in.
