# Release Android — de l'AAB à la publication Play Console

**Écrit le 2026-09-16, pendant la préparation de la 1.4.2.**

Ce document existe parce qu'il manquait. `docs/passation-android-1.4.1.md`
s'arrête à `assembleDebug` — un APK de débogage, qui ne s'envoie nulle part.
Tout ce qui suit cette étape avait été fait de mémoire, sans trace, et la 1.4.3
aurait recommencé à tâtons.

> **Ce qui est VÉRIFIÉ dans ce dépôt** est marqué ✅ et s'accompagne de la
> commande qui le prouve. **Ce qui relève de la console Google Play** est marqué
> 🖥 : je ne peux pas le lire depuis le dépôt, et les libellés exacts de
> l'interface changent au fil des refontes. Traiter les 🖥 comme une carte, pas
> comme un script.

---

## 0. Avant de commencer — les trois pièges du dépôt

**La clé MapTiler est inlinée AU BUILD.** `.env.local` n'est pas versionné
(`.gitignore` l.36), donc chaque machine a le sien. Une clé absente ne casse
pas le build : elle produit une carte CÉGEP qui affiche « Invalid key » en
production. Procédure complète en §2 de `passation-android-1.4.1.md`.

**`build:mobile` embarque le `.env.local` présent.** S'il pointe sur le Docker
local au lieu du Supabase cloud, l'AAB shippable interroge une base qui
n'existe pas pour les usagers. **Vérifier avant de bâtir**, pas après.

**La version que l'app affiche d'elle-même vient du natif.**
`ForceUpdateGate` lit `App.getInfo().version`, qui rend le `versionName` de
`android/app/build.gradle`. Bumper le gradle suffit donc ; aucune constante JS
à synchroniser. `versionGate.ts` compare `version` et **jamais** `build`.

---

## 1. La branche et le bump ✅

```bash
git checkout -b release/1.4.2 main
```

Le dépôt ne pose **pas de tag** de release — le repère est la branche
`release/x.y.z`. `release/1.4.1` en est le précédent exemple.

Dans `android/app/build.gradle`, deux lignes et deux seulement :

```gradle
versionCode 12          // entier, +1 à CHAQUE upload, même pour un correctif
versionName "1.4.2"     // ce que l'usager voit, et ce que le mur compare
```

**`versionCode` ne se réutilise jamais.** Play refuse un upload dont le
`versionCode` a déjà été vu, même sur une piste différente, même supprimé.
Une erreur de manipulation coûte donc un numéro — bumper, ne pas corriger.

**Les autres fichiers qui portent un numéro**, balayés le 2026-09-16 :

| fichier | valeur | à bumper ? |
|---|---|---|
| `android/app/build.gradle` | `versionCode` / `versionName` | **OUI** — seule source pour Android |
| `package.json` | `0.1.0` | non — décoratif, jamais lu par l'app |
| `capacitor.config.ts` | aucune version | — |
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` | **pas pour Android** |

⚠️ **L'iOS dérive, et c'est structurel.** Le §7 de la passation signalait
`MARKETING_VERSION` resté à 1.4.0 sur une branche `release/1.4.1`. Il est
aujourd'hui à 1.4.1 — donc corrigé, puis re-décalé dès qu'Android passe à
1.4.2. Rien ne synchronise les deux plateformes. **Le vérifier avant toute
archive iOS**, et ne pas s'y fier pour savoir ce qui est en ligne.

---

## 2. Bâtir ✅

```bash
npm install
npm run mobile:sync                 # = build:mobile + cap sync
cd android && ./gradlew bundleRelease
```

`bundleRelease`, **pas** `assembleDebug` ni `assembleRelease` : Play attend un
**AAB** (Android App Bundle), pas un APK.

**Contrôle MapTiler, sur le bundle qui vient d'être produit** :

```bash
grep -rc 'NEXT_PUBLIC_MAPTILER_KEY' android/app/src/main/assets/public/_next/static/chunks/
# 0 attendu → la clé a bien été inlinée

grep -rl 'MiFISmUXg5HRz18rZJwD' android/app/src/main/assets/public/_next/static/chunks/
# doit renvoyer un fichier
```

Si le premier ne rend pas 0, Next n'a rien eu à inliner : la variable était
absente. **Ne pas envoyer**, corriger le `.env.local`, rebâtir.

---

## 3. L'artefact ✅

```
android/app/build/outputs/bundle/release/app-release.aab
```

**Vérifier la signature avant d'envoyer** — un AAB non signé est refusé, et un
AAB signé par la mauvaise clé est refusé *définitivement* pour ce paquet :

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool.exe" \
  -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

Attendu — l'identité du keystore d'upload :

```
Owner: CN=Bruno-Philippe Desfosses Simard, OU=Nexus, O=Gestion Welead inc,
       L=Repentigny, ST=Quebec, C=CA
SHA1:   7B:DF:F3:3A:F0:02:1C:D5:15:A6:6A:07:E5:80:AF:E2:A8:F5:1C:60
SHA256: 17:F4:4F:2F:D1:AA:98:E9:45:8F:DC:DC:09:8C:52:55:E5:3E:CF:A8:51:0B:10:67:13:85:04:0E:81:58:C9:76
```

**Ces empreintes sont l'identité du paquet.** Si un upload est un jour refusé
pour cause de clé, c'est ici qu'on compare.

La signature est câblée dans `android/app/build.gradle` (l.3-6, 25-38), qui lit
`android/keystore.properties`. Ce fichier pointe sur
`C:/Users/bptds/keys/nexus-upload.jks` et contient les mots de passe en clair.

> 🔑 **Ni le `.jks` ni le `keystore.properties` ne sont au dépôt, et ils ne
> doivent jamais y entrer.** Perdre le `.jks` sans avoir activé Play App
> Signing signifie **ne plus jamais pouvoir mettre l'app à jour**. Le
> sauvegarder hors de la machine, avec ses mots de passe, avant le premier
> upload. Le certificat court jusqu'en **2053** — il n'expirera pas, mais il
> peut être perdu.

Vérifier aussi que la version déclarée **dans l'AAB** est la bonne, et pas
seulement dans le gradle :

```bash
unzip -p android/app/build/outputs/bundle/release/app-release.aab \
  base/manifest/AndroidManifest.xml | strings | grep -E '^1\.4\.'
```

---

## 4. Play Console — le déroulé 🖥

### 4.1 Premier upload seulement : Play App Signing

Au tout premier envoi, Play propose de gérer la clé de **signature d'app**
(distincte de la clé d'**upload**). C'est une étape de console, **pas un
prérequis de build** : l'AAB est signé avec la clé d'upload, Play le re-signe
avec la clé d'app qu'il détient.

L'accepter. C'est ce qui permet de récupérer une clé d'upload perdue — sans
lui, un `.jks` perdu ferme définitivement la porte des mises à jour.

### 4.2 Choisir la piste

| piste | pour quoi | qui voit |
|---|---|---|
| **Test interne** | vérifier l'AAB réel sur un vrai appareil | jusqu'à 100 testeurs, dispo en minutes |
| **Test fermé** | recette élargie | liste ou groupe Google |
| **Test ouvert** | bêta publique | tout le monde via un lien |
| **Production** | tout le parc | tout le monde |

**Toujours passer par Test interne d'abord.** C'est la seule façon d'exécuter
l'artefact exact qui partira en production — un APK de débogage ne prouve pas
qu'un AAB signé et re-signé par Play fonctionne.

### 4.3 Créer la version

**Test et publication → [piste] → Créer une version**, puis :

1. **Importer** `app-release.aab`. Play affiche `versionCode` et `versionName` —
   les relire, c'est le dernier filet contre un bump oublié.
2. **Nom de la version** : `1.4.2 (12)`. Interne, jamais vu des usagers.
3. **Notes de version** : visibles dans le Store, par langue. Le français du
   Québec est `fr-CA`. Décrire ce que l'usager **constate**, pas les commits.
4. **Vérifier la version** puis **Lancer le déploiement**.

### 4.4 Ce qui bloque la publication, une fois pour toutes 🖥

Ces formulaires ne concernent que la **première** mise en production, mais ils
bloquent totalement tant qu'ils sont incomplets :

- **Sécurité des données** — ce que l'app collecte et pourquoi. Nexus collecte
  des données de mineurs : cette section doit être cohérente avec
  `/confidentialite` et avec l'inventaire Loi 25. **Ne pas improviser** ;
  partir du document de politique, pas de mémoire.
- **Classification du contenu** — questionnaire, délivre la cote.
- **Public cible** — Nexus vise des 14-17 ans. Déclarer une tranche incluant
  des mineurs déclenche les règles **Familles** de Google : exigences
  supplémentaires sur la publicité, l'analytique et le contenu.
- **Fiche du Store** — titre, descriptions courte et longue, icône 512×512,
  bandeau 1024×500, captures par format d'appareil.
- **Coordonnées** et **politique de confidentialité** (URL publique).
- **Compte développeur** : la validation **D-U-N-S** a été obtenue le
  **13 septembre 2026**, la voie organisation est donc ouverte.

### 4.5 Déploiement progressif

Pour la production, Play permet un pourcentage (5 %, 10 %, 20 %…). L'augmenter
par paliers en surveillant les plantages. **Un déploiement progressif ne peut
pas être annulé** — il ne peut qu'être *stoppé* puis remplacé par une version
supérieure. D'où la règle du `versionCode` : toujours en avant.

---

## 5. Après la publication — armer le mur ✅

**Dans cet ordre, jamais l'inverse.** Le mur exige une version : si elle n'est
pas encore installable depuis le Store, il enferme tout le parc devant une
mise à jour qui n'existe pas.

1. La version est **publiée** et réellement installable depuis le Store.
2. Laisser le déploiement atteindre 100 % (ou un palier assumé).
3. Alors seulement, jouer la transaction de
   `docs/forcage-mise-a-jour-1.4.1.md`, en remplaçant `1.4.1` par `1.4.2`.

Cette transaction monte `min_version_*` et `suggested_version_*`, puis passe
`force_update_enabled` à `true`. Elle porte un préambule `set_config`
indispensable : `app_settings` est en écriture sous `is_admin()`, et
`auth.uid()` est NULL dans l'éditeur SQL. L'identifiant admin est **résolu par
courriel**, jamais collé en dur. Un `select` de contrôle précède le `commit` —
**le lire avant de valider**.

État au 2026-09-16, avant la 1.4.2 :

```
force_update_enabled       false
min_version_android        1.4.0
min_version_ios            1.4.0
suggested_version_android  1.4.1
suggested_version_ios      1.4.1
```

Le mur de la 1.4.1 **n'a jamais été armé** : seule la bannière douce est
montée. En partant de là, passer les minimales à 1.4.2 murerait d'un coup tout
le parc 1.4.0 et 1.4.1. **Décision produit, pas technique** — la prendre
explicitement.

**Une seule plateforme prête ?** Retirer l'autre des `in (...)`. Une minimale
iOS restée à 1.4.0 ne mure personne.

**Le repli** tient en une ligne : `force_update_enabled` à `false` libère tout
le parc immédiatement.

---

## 6. Ce que ce document ne couvre pas encore

- **iOS.** Aucune procédure App Store Connect n'est écrite. Le bump
  `MARKETING_VERSION` est manuel et a déjà été oublié une fois.
- **Les notes de version** n'ont pas de gabarit. En créer un au premier
  passage en production.
- **La sauvegarde du keystore** n'est vérifiée par rien. Aucun contrôle
  automatique ne dira qu'il a disparu — on l'apprendra au prochain build.
